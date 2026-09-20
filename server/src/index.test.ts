import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from './index.js';
import { db, initializeDatabase } from './config/db.js';

describe('GizmoVault Backend & Architecture Validation', () => {
  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    initializeDatabase();
  });

  it('GET /api/health returns status UP with timestamp', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('UP');
    expect(res.body.service).toBe('GizmoVault API');
    expect(res.body.timestamp).toBeDefined();
  });

  it('GET /api/health/ready confirms database and service readiness', async () => {
    const res = await request(app).get('/api/health/ready');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('READY');
    expect(res.body.checks.database).toBe('UP');
  });

  it('Database contains required tables for Phase 0-3 specifications', () => {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
    const tableNames = tables.map(t => t.name);

    expect(tableNames).toContain('products');
    expect(tableNames).toContain('categories');
    expect(tableNames).toContain('brands');
    expect(tableNames).toContain('users');
    expect(tableNames).toContain('whatsapp_messages');
    expect(tableNames).toContain('extracted_products');
    expect(tableNames).toContain('carts');
    expect(tableNames).toContain('orders');
    expect(tableNames).toContain('payments');
  });

  it('POST /api/auth/account-deletion-request handles Google Play Store deletion', async () => {
    const res = await request(app)
      .post('/api/auth/account-deletion-request')
      .send({ identifier: '+919876543210' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('Google Play Store');
  });

  it('GET /api/products returns seeded product catalog with count and data', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.count).toBeGreaterThanOrEqual(20);
  });

  it('GET /api/products/:id retrieves enriched product with specs and images', async () => {
    const res = await request(app).get('/api/products/GV-WATCH-CHRONO-01');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('ChronoMaster Royal Tourbillon Automatic');
    expect(res.body.data.specifications.length).toBeGreaterThanOrEqual(3);
    expect(res.body.data.images.length).toBeGreaterThanOrEqual(2);
  });
});
