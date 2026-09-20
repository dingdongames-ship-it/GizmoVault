import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express, { Request, Response } from 'express';
import request from 'supertest';
import { DatabaseSync } from 'node:sqlite';
import { 
  createRateLimiter, 
  authenticateToken, 
  requireRole, 
  generateToken, 
  sanitizeInput,
  AuthenticatedRequest
} from './security.middleware.js';
import { AuditService } from './audit.service.js';

describe('Phase 26 — Security Hardening & RBAC', () => {
  describe('Input Sanitization', () => {
    it('strips dangerous HTML/script injection tags', () => {
      const malicious = '<script>alert("xss")</script>';
      const clean = sanitizeInput(malicious);
      expect(clean).not.toContain('<script>');
      expect(clean).toContain('&lt;script&gt;');
    });

    it('trims whitespace and quotes', () => {
      expect(sanitizeInput('   "hello"   ')).toBe('&quot;hello&quot;');
    });
  });

  describe('Rate Limiter', () => {
    it('permits requests under the limit and blocks requests exceeding the limit', async () => {
      const app = express();
      // Allow max 2 requests per minute
      app.use(createRateLimiter(60000, 2));
      app.get('/test', (_req, res) => res.json({ ok: true }));

      const res1 = await request(app).get('/test');
      expect(res1.status).toBe(200);

      const res2 = await request(app).get('/test');
      expect(res2.status).toBe(200);

      const res3 = await request(app).get('/test');
      expect(res3.status).toBe(429);
      expect(res3.body.error).toBe('Too Many Requests');
    });
  });

  describe('JWT Authentication & RBAC', () => {
    let app: express.Express;

    beforeEach(() => {
      app = express();
      app.use(express.json());

      app.get('/admin-only', 
        (req, res, next) => authenticateToken(req as AuthenticatedRequest, res, next),
        (req, res, next) => requireRole('ADMIN')(req as AuthenticatedRequest, res, next),
        (_req, res) => res.json({ success: true, message: 'Admin Area' })
      );

      app.get('/customer-area',
        (req, res, next) => authenticateToken(req as AuthenticatedRequest, res, next),
        (req, res, next) => requireRole('CUSTOMER', 'ADMIN')(req as AuthenticatedRequest, res, next),
        (req, res) => res.json({ success: true, userId: (req as AuthenticatedRequest).user?.id })
      );
    });

    it('returns 401 when missing Authorization header', async () => {
      const res = await request(app).get('/admin-only');
      expect(res.status).toBe(401);
    });

    it('returns 403 when customer tries to access admin-only endpoint', async () => {
      const customerToken = generateToken({ id: 'user_cust_1', role: 'CUSTOMER' });
      const res = await request(app)
        .get('/admin-only')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Forbidden');
    });

    it('allows admin to access admin-only endpoint', async () => {
      const adminToken = generateToken({ id: 'user_admin_1', role: 'ADMIN' });
      const res = await request(app)
        .get('/admin-only')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Admin Area');
    });

    it('allows customer to access customer endpoint', async () => {
      const customerToken = generateToken({ id: 'user_cust_42', role: 'CUSTOMER' });
      const res = await request(app)
        .get('/customer-area')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.userId).toBe('user_cust_42');
    });
  });

  describe('Audit Logging', () => {
    let db: DatabaseSync;
    let auditService: AuditService;

    beforeEach(() => {
      db = new DatabaseSync(':memory:');
      auditService = new AuditService(db);
    });

    afterEach(() => {
      db.close();
    });

    it('records security audit events and retrieves them chronologically', () => {
      const event = auditService.logEvent({
        eventType: 'AUTH_LOGIN_SUCCESS',
        actorId: 'usr_123',
        actorRole: 'CUSTOMER',
        action: 'User logged in via OTP',
        details: { method: 'SMS', device: 'Mobile Browser' },
      });

      expect(event.id).toBeDefined();
      expect(event.eventType).toBe('AUTH_LOGIN_SUCCESS');

      const logs = auditService.getRecentLogs(10);
      expect(logs.length).toBe(1);
      expect(logs[0]?.actorId).toBe('usr_123');
      expect(logs[0]?.details?.method).toBe('SMS');
    });
  });
});
