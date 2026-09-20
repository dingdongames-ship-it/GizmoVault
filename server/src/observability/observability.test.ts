import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { Logger, correlationIdMiddleware } from './logger.js';
import { metrics, metricsMiddleware } from './metrics.js';

describe('Phase 30 — Observability, Logging & Metrics', () => {
  beforeEach(() => {
    metrics.reset();
  });

  describe('Structured Logger', () => {
    it('outputs structured JSON with timestamp, level, and message', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const customLogger = new Logger('TestService');

      customLogger.info('User placed order', { orderId: 'ord_123', amount: 4999 });

      expect(consoleSpy).toHaveBeenCalled();
      const output = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(output.level).toBe('INFO');
      expect(output.message).toContain('[TestService] User placed order');
      expect(output.context.orderId).toBe('ord_123');
      expect(output.timestamp).toBeDefined();

      consoleSpy.mockRestore();
    });

    it('formats error logs with stack trace', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const customLogger = new Logger('TestService');

      customLogger.error('Database connection failed', new Error('Connection refused'));

      expect(errorSpy).toHaveBeenCalled();
      const output = JSON.parse(errorSpy.mock.calls[0][0]);
      expect(output.level).toBe('ERROR');
      expect(output.error).toContain('Connection refused');

      errorSpy.mockRestore();
    });
  });

  describe('Correlation ID Middleware', () => {
    it('generates correlation ID and sets x-correlation-id response header', async () => {
      const app = express();
      app.use(correlationIdMiddleware);
      app.get('/test', (_req, res) => res.json({ ok: true }));

      const res = await request(app).get('/test');
      expect(res.headers['x-correlation-id']).toBeDefined();
      expect(res.headers['x-correlation-id']).toMatch(/^req_/);
    });

    it('preserves client-provided correlation ID in response header', async () => {
      const app = express();
      app.use(correlationIdMiddleware);
      app.get('/test', (_req, res) => res.json({ ok: true }));

      const res = await request(app)
        .get('/test')
        .set('x-correlation-id', 'client-trace-id-999');

      expect(res.headers['x-correlation-id']).toBe('client-trace-id-999');
    });
  });

  describe('Metrics Middleware', () => {
    it('increments totalRequests and tracks 500 errors', async () => {
      const app = express();
      app.use(metricsMiddleware);
      app.get('/success', (_req, res) => res.status(200).send('ok'));
      app.get('/error', (_req, res) => res.status(500).send('fail'));

      await request(app).get('/success');
      await request(app).get('/success');
      await request(app).get('/error');

      const data = metrics.getMetrics();
      expect(data.totalRequests).toBe(3);
      expect(data.totalErrors).toBe(1);
      expect(data.uptimeSeconds).toBeGreaterThanOrEqual(0);
    });
  });
});
