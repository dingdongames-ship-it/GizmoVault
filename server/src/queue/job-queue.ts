import { DatabaseSync } from 'node:sqlite';
import crypto from 'crypto';
import { getDb } from '../db/connection.js';

export type JobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'DEAD_LETTER';

export interface JobRecord<T = any> {
  id: string;
  name: string;
  payload: T;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export class JobQueue {
  private db: DatabaseSync;

  constructor(customDb?: DatabaseSync) {
    this.db = customDb || getDb();
    this.ensureQueueTable();
  }

  private ensureQueueTable(): void {
    this.db.prepare(`
      CREATE TABLE IF NOT EXISTS job_queue (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        status TEXT DEFAULT 'PENDING',
        attempts INTEGER DEFAULT 0,
        max_attempts INTEGER DEFAULT 3,
        error_message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    this.db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_job_status ON job_queue(name, status)
    `).run();
  }

  /**
   * Enqueues a job for async processing
   */
  enqueue<T>(name: string, payload: T, maxAttempts = 3): JobRecord<T> {
    const id = `job_${crypto.randomBytes(8).toString('hex')}`;
    const payloadJson = JSON.stringify(payload);

    this.db.prepare(`
      INSERT INTO job_queue (id, name, payload_json, status, attempts, max_attempts, created_at, updated_at)
      VALUES (?, ?, ?, 'PENDING', 0, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(id, name, payloadJson, maxAttempts);

    return {
      id,
      name,
      payload,
      status: 'PENDING',
      attempts: 0,
      maxAttempts,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Fetches and executes the next pending job
   */
  async processNext<T>(name: string, handler: (payload: T) => Promise<void>): Promise<boolean> {
    const jobRow = this.db.prepare(`
      SELECT id, name, payload_json, attempts, max_attempts
      FROM job_queue
      WHERE name = ? AND status = 'PENDING'
      ORDER BY created_at ASC
      LIMIT 1
    `).get(name) as any;

    if (!jobRow) return false;

    // Mark as processing
    this.db.prepare(`
      UPDATE job_queue
      SET status = 'PROCESSING', attempts = attempts + 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(jobRow.id);

    try {
      const payload = JSON.parse(jobRow.payload_json);
      await handler(payload);

      // Mark COMPLETED
      this.db.prepare(`
        UPDATE job_queue
        SET status = 'COMPLETED', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(jobRow.id);
      return true;
    } catch (err: any) {
      const newAttempts = jobRow.attempts + 1;
      const isDeadLetter = newAttempts >= jobRow.max_attempts;
      const nextStatus: JobStatus = isDeadLetter ? 'DEAD_LETTER' : 'PENDING';

      this.db.prepare(`
        UPDATE job_queue
        SET status = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(nextStatus, err.message || 'Unknown processing error', jobRow.id);

      return false;
    }
  }

  getDeadLetters(limit = 20): JobRecord[] {
    const rows = this.db.prepare(`
      SELECT id, name, payload_json, status, attempts, max_attempts, error_message, created_at, updated_at
      FROM job_queue
      WHERE status = 'DEAD_LETTER'
      ORDER BY updated_at DESC
      LIMIT ?
    `).all(limit) as any[];

    return rows.map(r => ({
      id: r.id,
      name: r.name,
      payload: JSON.parse(r.payload_json),
      status: r.status as JobStatus,
      attempts: r.attempts,
      maxAttempts: r.max_attempts,
      error: r.error_message,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  getStats(): Record<string, number> {
    const rows = this.db.prepare(`
      SELECT status, COUNT(*) as count FROM job_queue GROUP BY status
    `).all() as any[];

    const stats: Record<string, number> = {
      PENDING: 0,
      PROCESSING: 0,
      COMPLETED: 0,
      FAILED: 0,
      DEAD_LETTER: 0,
    };

    for (const r of rows) {
      stats[r.status] = Number(r.count);
    }
    return stats;
  }
}
