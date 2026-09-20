import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { JobQueue } from './job-queue.js';

describe('Phase 29 — Background Job Queue', () => {
  let db: DatabaseSync;
  let queue: JobQueue;

  beforeEach(() => {
    db = new DatabaseSync(':memory:');
    queue = new JobQueue(db);
  });

  afterEach(() => {
    db.close();
  });

  it('enqueues and executes job successfully', async () => {
    const job = queue.enqueue('compress_media', { mediaId: 'med_123', target: 'thumbnail' });
    expect(job.id).toBeDefined();
    expect(job.status).toBe('PENDING');

    const handler = vi.fn().mockResolvedValue(undefined);
    const processed = await queue.processNext('compress_media', handler);

    expect(processed).toBe(true);
    expect(handler).toHaveBeenCalledWith({ mediaId: 'med_123', target: 'thumbnail' });

    const stats = queue.getStats();
    expect(stats.COMPLETED).toBe(1);
    expect(stats.PENDING).toBe(0);
  });

  it('moves job to DEAD_LETTER after maxAttempts failures', async () => {
    queue.enqueue('send_sms', { phone: '+919876543210' }, 2); // max 2 attempts

    const failingHandler = vi.fn().mockRejectedValue(new Error('SMS Gateway Down'));

    // Attempt 1: fails, status goes back to PENDING (attempts=1)
    const processed1 = await queue.processNext('send_sms', failingHandler);
    expect(processed1).toBe(false);

    let stats = queue.getStats();
    expect(stats.PENDING).toBe(1);

    // Attempt 2: fails, hits max_attempts=2 -> DEAD_LETTER
    const processed2 = await queue.processNext('send_sms', failingHandler);
    expect(processed2).toBe(false);

    stats = queue.getStats();
    expect(stats.DEAD_LETTER).toBe(1);

    const deadLetters = queue.getDeadLetters();
    expect(deadLetters.length).toBe(1);
    expect(deadLetters[0].error).toBe('SMS Gateway Down');
  });

  it('processNext returns false when queue is empty', async () => {
    const processed = await queue.processNext('nonexistent_job', async () => {});
    expect(processed).toBe(false);
  });
});
