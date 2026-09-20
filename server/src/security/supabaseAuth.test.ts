import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { verifySupabaseToken } from './supabase.js';
import { authenticateToken, requireRole, AuthenticatedRequest } from './security.middleware.js';

describe('Server Supabase Auth & JWT Verification', () => {
  describe('verifySupabaseToken', () => {
    it('verifies demo/sandbox Supabase token correctly', async () => {
      const user = await verifySupabaseToken('mock-supabase-token');
      expect(user).toBeDefined();
      expect(user?.id).toBe('demo-supabase-user');
      expect(user?.role).toBe('CUSTOMER');
    });

    it('returns null for empty or invalid token', async () => {
      const user = await verifySupabaseToken('completely-invalid-garbage-token');
      expect(user).toBeNull();
    });
  });

  describe('authenticateToken Express Middleware with Supabase Token', () => {
    let app: express.Express;

    beforeEach(() => {
      app = express();
      app.use(express.json());

      app.get(
        '/api/protected-resource',
        (req, res, next) => authenticateToken(req as AuthenticatedRequest, res, next),
        (req, res) => res.json({
          success: true,
          userId: (req as AuthenticatedRequest).user?.id,
          role: (req as AuthenticatedRequest).user?.role,
        })
      );
    });

    it('authorizes request when valid Supabase bearer token is provided', async () => {
      const res = await request(app)
        .get('/api/protected-resource')
        .set('Authorization', 'Bearer mock-supabase-token');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.userId).toBe('demo-supabase-user');
      expect(res.body.role).toBe('CUSTOMER');
    });

    it('rejects request with 401 when Authorization header is absent', async () => {
      const res = await request(app).get('/api/protected-resource');
      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Unauthorized');
    });

    it('rejects request with 403 when Bearer token is invalid', async () => {
      const res = await request(app)
        .get('/api/protected-resource')
        .set('Authorization', 'Bearer invalid.token.value');

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Forbidden');
    });
  });
});
