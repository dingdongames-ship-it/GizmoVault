import { describe, it, expect, vi } from 'vitest';
import { CircuitBreaker, withRetry } from './circuit-breaker.js';

describe('Phase 28 — Fault Resilience & Circuit Breaker', () => {
  describe('CircuitBreaker', () => {
    it('executes successful actions normally when CLOSED', async () => {
      const breaker = new CircuitBreaker('test-service', { failureThreshold: 3 });
      const result = await breaker.execute(async () => 'success');
      expect(result).toBe('success');
      expect(breaker.state).toBe('CLOSED');
    });

    it('trips to OPEN state after reaching failure threshold', async () => {
      const breaker = new CircuitBreaker('failing-service', {
        failureThreshold: 2,
        cooldownPeriodMs: 500,
      });

      // Fail 1
      await expect(breaker.execute(async () => { throw new Error('DB error'); })).rejects.toThrow('DB error');
      expect(breaker.state).toBe('CLOSED');

      // Fail 2 -> should trip open
      await expect(breaker.execute(async () => { throw new Error('DB error'); })).rejects.toThrow('DB error');
      expect(breaker.state).toBe('OPEN');

      // Immediate 3rd call should fast-fail without calling action
      const actionSpy = vi.fn();
      await expect(breaker.execute(actionSpy)).rejects.toThrow('Circuit is OPEN');
      expect(actionSpy).not.toHaveBeenCalled();
    });

    it('transitions to HALF_OPEN after cooldown period', async () => {
      const breaker = new CircuitBreaker('cooldown-service', {
        failureThreshold: 1,
        cooldownPeriodMs: 50,
      });

      await expect(breaker.execute(async () => { throw new Error('fail'); })).rejects.toThrow();
      expect(breaker.state).toBe('OPEN');

      // Wait for cooldown
      await new Promise(res => setTimeout(res, 70));

      // Next call should transition to HALF_OPEN and succeed -> back to CLOSED
      const res = await breaker.execute(async () => 'recovered');
      expect(res).toBe('recovered');
      expect(breaker.state).toBe('CLOSED');
    });
  });

  describe('withRetry', () => {
    it('retries failing operations until success within maxRetries', async () => {
      let attempts = 0;
      const result = await withRetry(
        async () => {
          attempts += 1;
          if (attempts < 3) throw new Error('temporary network glitch');
          return 'final success';
        },
        { maxRetries: 4, baseDelayMs: 10, maxDelayMs: 50 }
      );

      expect(result).toBe('final success');
      expect(attempts).toBe(3);
    });

    it('throws error after exhausting all retries', async () => {
      let attempts = 0;
      await expect(
        withRetry(
          async () => {
            attempts += 1;
            throw new Error('permanent failure');
          },
          { maxRetries: 3, baseDelayMs: 5, maxDelayMs: 20 }
        )
      ).rejects.toThrow('permanent failure');

      expect(attempts).toBe(3);
    });
  });
});
