import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { app } from '../index.js';
import { getDb } from '../db/index.js';
import { CatalogClassifierService } from './classifier.service.js';
import { CatalogProductRepository } from '../models/catalog.model.js';

describe('Admin Ingestion & Catalog API (POST /api/v1/admin/ingest-product)', () => {
  const db = getDb();
  const classifier = new CatalogClassifierService();
  const catalogRepo = new CatalogProductRepository(db);

  const testTempDir = path.resolve(process.cwd(), 'uploads/test_fixtures');
  const sampleImagePath = path.join(testTempDir, 'sample_watch.jpg');

  beforeEach(() => {
    if (!fs.existsSync(testTempDir)) {
      fs.mkdirSync(testTempDir, { recursive: true });
    }
    // Create a dummy image file for upload testing
    fs.writeFileSync(sampleImagePath, Buffer.from('fake-jpeg-image-bytes'));
  });

  afterEach(() => {
    if (fs.existsSync(sampleImagePath)) {
      fs.unlinkSync(sampleImagePath);
    }
  });

  it('classifies rich WhatsApp product caption accurately', () => {
    const rawCaption = `
      Original Imported Smartwatch Series 9
      AMOLED Display Bluetooth Calling
      Battery life 7 days
      Price ₹3,499
      Discount Deal only for today
    `;

    const draft = classifier.classifyCatalogItem(
      rawCaption,
      'https://cdn.gizmovault.com/watch.jpg',
      'IMAGE',
      {
        merchantId: 'merchant_in_01',
        originalFilename: 'sample_watch.jpg',
        tags: ['imported', 'smartwatch']
      }
    );

    expect(draft.title).toContain('Smartwatch Series 9');
    expect(draft.category).toBe('Imported Watches');
    expect(draft.price).toBe(3499);
    expect(draft.currency).toBe('INR');
    expect(draft.media).toHaveLength(1);
    expect(draft.media[0].url).toBe('https://cdn.gizmovault.com/watch.jpg');
    expect(draft.status).toBe('DRAFT');
    expect(draft.description_html).toContain('<h4>Key Features</h4>');
  });

  it('falls back gracefully when WhatsApp caption is sparse', () => {
    const sparseCaption = '';

    const draft = classifier.classifyCatalogItem(
      sparseCaption,
      '/uploads/catalog/test.jpg',
      'IMAGE',
      {
        merchantId: 'merchant_sparse',
        originalFilename: 'boat_earbuds_anc.jpg'
      }
    );

    expect(draft.title).toBe('Boat earbuds anc');
    expect(draft.category).toBe('Audio Products');
    expect(draft.price).toBe(0.0);
    expect(draft.status).toBe('DRAFT');
    expect(draft.description_html).toContain('Audio Products');
  });

  it('ingests product via multipart stream POST /api/v1/admin/ingest-product', async () => {
    const payload = JSON.stringify({
      raw_text: 'Noise ColorFit Pro 5 Max AMOLED Display Calling Price: ₹2,999',
      merchant_id: 'merchant_tech_store',
      timestamp: Date.now(),
      original_file_id: 'wa_msg_987654',
      tags: ['gadgets', 'bestseller']
    });

    const res = await request(app)
      .post('/api/v1/admin/ingest-product')
      .attach('file', sampleImagePath)
      .field('payload', payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.product).toBeDefined();

    const product = res.body.product;
    expect(product.merchant_id).toBe('merchant_tech_store');
    expect(product.price).toBe(2999);
    expect(product.currency).toBe('INR');
    expect(product.status).toBe('DRAFT');
    expect(product.media).toHaveLength(1);
    expect(product.media[0].url).toContain('/uploads/catalog/');
  });

  it('lists and filters ingested products via GET /api/v1/admin/products', async () => {
    // Insert a known item
    catalogRepo.create({
      id: 'test_cat_item_999',
      merchant_id: 'merchant_list_test',
      title: 'Tissot PRX Powermatic 80 Blue Dial',
      description_html: '<p>Swiss automatic watch</p>',
      status: 'DRAFT',
      category: 'Imported Watches',
      price: 58000,
      currency: 'INR',
      media: [{ url: '/uploads/catalog/tissot.jpg', media_type: 'IMAGE', position: 1 }]
    });

    const res = await request(app)
      .get('/api/v1/admin/products')
      .query({ category: 'Imported Watches', merchant_id: 'merchant_list_test' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.products).toBeDefined();
    expect(res.body.total).toBeGreaterThanOrEqual(1);

    const found = res.body.products.find((p: any) => p.id === 'test_cat_item_999');
    expect(found).toBeDefined();
    expect(found.title).toBe('Tissot PRX Powermatic 80 Blue Dial');
    expect(found.category).toBe('Imported Watches');
  });
});
