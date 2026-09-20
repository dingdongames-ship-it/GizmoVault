import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { createAdminRoutes } from './routes.js';
import { CatalogProductRepository } from '../models/catalog.model.js';
import { CatalogClassifierService } from './classifier.service.js';
import { ingestionEventBus, IngestionEventPayload } from './ingestion-stream.js';

function createTestDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE IF NOT EXISTS catalog_products (
      id TEXT PRIMARY KEY,
      merchant_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description_html TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'DRAFT',
      category TEXT NOT NULL,
      price REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      media TEXT NOT NULL DEFAULT '[]',
      raw_whatsapp_source TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  return db;
}

describe('Real-Time Ingestion Stream & Merchant Catalog Endpoints', () => {
  let app: express.Express;
  let catalogRepo: CatalogProductRepository;
  let classifier: CatalogClassifierService;
  let db: DatabaseSync;

  beforeEach(() => {
    db = createTestDb();
    catalogRepo = new CatalogProductRepository(db);
    classifier = new CatalogClassifierService();

    app = express();
    app.use(express.json());
    app.use('/api/v1/admin', createAdminRoutes(undefined, catalogRepo, classifier));
  });

  it('1. GET /api/v1/admin/ingestion-stream initializes SSE connection and sends handshake', async () => {
    const server = app.listen(0);
    const port = (server.address() as any).port;

    const data = await new Promise<string>((resolve, reject) => {
      const req = http.get(`http://127.0.0.1:${port}/api/v1/admin/ingestion-stream`, (res) => {
        expect(res.headers['content-type']).toContain('text/event-stream');
        expect(res.headers['cache-control']).toContain('no-cache');
        res.on('data', (chunk) => {
          resolve(chunk.toString());
          req.destroy();
          server.close();
        });
      });
      req.on('error', (err) => {
        server.close();
        reject(err);
      });
    });

    expect(data).toContain('event: CONNECTED');
  });

  it('2. IngestionEventBus broadcasts INGESTION_COMPLETED when product is created', async () => {
    const receivedEvents: IngestionEventPayload[] = [];
    const listener = (evt: IngestionEventPayload) => {
      receivedEvents.push(evt);
    };

    ingestionEventBus.on('ingestion_event', listener);

    const draft = classifier.classifyCatalogItem(
      'Galaxy Titanium Watch ₹18,999 with ECG sensor',
      '/uploads/catalog/watch.jpg',
      'IMAGE',
      { merchantId: 'm_live_01' }
    );
    const created = catalogRepo.create(draft);

    ingestionEventBus.broadcast({
      type: 'INGESTION_COMPLETED',
      timestamp: new Date().toISOString(),
      product: created,
      latencyMs: 142
    });

    expect(receivedEvents.length).toBe(1);
    expect(receivedEvents[0].type).toBe('INGESTION_COMPLETED');
    expect(receivedEvents[0].product?.title).toContain('Galaxy Titanium Watch');
    expect(receivedEvents[0].latencyMs).toBe(142);

    ingestionEventBus.off('ingestion_event', listener);
  });

  it('3. PATCH /api/v1/admin/products/:id updates fields and broadcasts CATALOG_UPDATED', async () => {
    const receivedEvents: IngestionEventPayload[] = [];
    const listener = (evt: IngestionEventPayload) => {
      receivedEvents.push(evt);
    };
    ingestionEventBus.on('ingestion_event', listener);

    const draft = classifier.classifyCatalogItem(
      'Draft Gadget ₹999',
      '',
      'IMAGE',
      { merchantId: 'm_test' }
    );
    const created = catalogRepo.create(draft);

    const res = await request(app)
      .patch(`/api/v1/admin/products/${created.id}`)
      .send({
        title: 'Premium Approved Gadget Pro',
        price: 1299,
        status: 'ACTIVE'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.product.title).toBe('Premium Approved Gadget Pro');
    expect(res.body.product.price).toBe(1299);
    expect(res.body.product.status).toBe('ACTIVE');

    // Verify broadcast event was emitted
    const updateEvt = receivedEvents.find((e) => e.type === 'CATALOG_UPDATED');
    expect(updateEvt).toBeDefined();
    expect(updateEvt?.product?.id).toBe(created.id);
    expect(updateEvt?.product?.status).toBe('ACTIVE');

    ingestionEventBus.off('ingestion_event', listener);
  });

  it('4. DELETE /api/v1/admin/products/:id deletes product and broadcasts CATALOG_DELETED', async () => {
    const receivedEvents: IngestionEventPayload[] = [];
    const listener = (evt: IngestionEventPayload) => {
      receivedEvents.push(evt);
    };
    ingestionEventBus.on('ingestion_event', listener);

    const draft = classifier.classifyCatalogItem('Item to delete ₹500', '', 'IMAGE');
    const created = catalogRepo.create(draft);

    const res = await request(app).delete(`/api/v1/admin/products/${created.id}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify product is gone from repository
    expect(catalogRepo.findById(created.id)).toBeNull();

    // Verify deletion broadcast
    const deleteEvt = receivedEvents.find((e) => e.type === 'CATALOG_DELETED');
    expect(deleteEvt).toBeDefined();
    expect(deleteEvt?.productId).toBe(created.id);

    ingestionEventBus.off('ingestion_event', listener);
  });

  it('5. POST /api/v1/admin/products/bulk handles bulk publish and delete', async () => {
    const item1 = catalogRepo.create(classifier.classifyCatalogItem('Bulk Item 1 ₹100', '', 'IMAGE'));
    const item2 = catalogRepo.create(classifier.classifyCatalogItem('Bulk Item 2 ₹200', '', 'IMAGE'));

    // Bulk publish
    const publishRes = await request(app)
      .post('/api/v1/admin/products/bulk')
      .send({
        action: 'publish',
        ids: [item1.id, item2.id]
      });

    expect(publishRes.status).toBe(200);
    expect(publishRes.body.affected).toBe(2);
    expect(catalogRepo.findById(item1.id)?.status).toBe('ACTIVE');
    expect(catalogRepo.findById(item2.id)?.status).toBe('ACTIVE');

    // Bulk delete
    const deleteRes = await request(app)
      .post('/api/v1/admin/products/bulk')
      .send({
        action: 'delete',
        ids: [item1.id, item2.id]
      });

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.affected).toBe(2);
    expect(catalogRepo.findById(item1.id)).toBeNull();
  });
});
