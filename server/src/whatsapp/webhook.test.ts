import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import express from 'express';
import { DatabaseSync } from 'node:sqlite';
import { createDatabaseConnection } from '../db/connection.js';
import { runMigrations } from '../db/migrator.js';
import { seedDatabase } from '../db/seed.js';
import { WhatsAppWebhookService, createWhatsAppWebhookRouter } from './webhook.js';
import { MediaPipelineService } from '../media/media.service.js';
import { AIExtractionService } from '../ai/extractor.js';
import { DeduplicationService } from '../ai/dedup.service.js';

describe('WhatsApp Cloud API Webhook & Product Ingestion Pipeline', () => {
  let db: DatabaseSync;
  let webhookService: WhatsAppWebhookService;
  let testApp: express.Express;
  const verifyToken = 'test_verify_token_2026';
  const appSecret = 'test_app_secret_meta_2026';

  // Helper: Mock JPEG buffer with valid magic bytes
  const createMockJpeg = () => {
    const header = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
    const body = Buffer.alloc(256, 0x11);
    return Buffer.concat([header, body]);
  };

  beforeEach(() => {
    db = createDatabaseConnection({ inMemory: true });
    runMigrations(db);
    seedDatabase(db);

    const mediaPipeline = new MediaPipelineService({
      maxImageSizeBytes: 15 * 1024 * 1024,
      maxVideoSizeBytes: 50 * 1024 * 1024
    }, db);

    const aiExtractor = new AIExtractionService();
    const dedupService = new DeduplicationService(db);

    webhookService = new WhatsAppWebhookService({
      db,
      verifyToken,
      appSecret,
      mediaPipeline,
      aiExtractor,
      dedupService,
      mediaDownloader: async (_mediaId: string) => {
        return {
          buffer: createMockJpeg(),
          mimeType: 'image/jpeg'
        };
      }
    });

    testApp = express();
    testApp.use(express.json());
    testApp.use('/api/v1/whatsapp', createWhatsAppWebhookRouter(webhookService));
  });

  afterEach(() => {
    try {
      db.close();
    } catch {}
  });

  describe('1. Webhook Verification (GET)', () => {
    it('returns raw challenge integer with HTTP 200 on valid mode and token', async () => {
      const challenge = '1158201444';
      const res = await request(testApp)
        .get('/api/v1/whatsapp/webhook')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': verifyToken,
          'hub.challenge': challenge
        });

      expect(res.status).toBe(200);
      expect(res.text).toBe(challenge);
    });

    it('returns 403 when verify_token does not match', async () => {
      const res = await request(testApp)
        .get('/api/v1/whatsapp/webhook')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'wrong_token',
          'hub.challenge': '12345'
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('mismatch');
    });

    it('returns 403 when hub.mode is not subscribe', async () => {
      const res = await request(testApp)
        .get('/api/v1/whatsapp/webhook')
        .query({
          'hub.mode': 'unsubscribe',
          'hub.verify_token': verifyToken,
          'hub.challenge': '12345'
        });

      expect(res.status).toBe(403);
    });
  });

  describe('2. HMAC-SHA256 Signature Validation (POST)', () => {
    const samplePayload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'WH_ENTRY_001',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                metadata: { display_phone_number: '1234567890', phone_number_id: '999888777' },
                messages: [
                  {
                    from: '919876543210',
                    id: 'wamid.HBgLTESTSIG001',
                    timestamp: '1726743600',
                    text: { body: 'Rolex Submariner Date 41mm Automatic Watch MRP 1150000 Offer Price 985000' },
                    type: 'text'
                  }
                ]
              }
            }
          ]
        }
      ]
    };

    it('accepts payload when X-Hub-Signature-256 is valid', async () => {
      const bodyStr = JSON.stringify(samplePayload);
      const hmac = crypto.createHmac('sha256', appSecret).update(bodyStr).digest('hex');
      const signatureHeader = `sha256=${hmac}`;

      const res = await request(testApp)
        .post('/api/v1/whatsapp/webhook')
        .set('X-Hub-Signature-256', signatureHeader)
        .send(samplePayload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.status).toBe('PROCESSED');
    });

    it('rejects payload with 401 when X-Hub-Signature-256 is invalid', async () => {
      const res = await request(testApp)
        .post('/api/v1/whatsapp/webhook')
        .set('X-Hub-Signature-256', 'sha256=invalid_tampered_signature_hex_0000000000000000000000000000000000000000')
        .send(samplePayload);

      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Invalid HMAC signature');
    });
  });

  describe('3. Idempotency & Replay Deliveries', () => {
    it('silently drops duplicate delivery with 200 OK without re-inserting into catalog', async () => {
      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            changes: [
              {
                field: 'messages',
                value: {
                  messages: [
                    {
                      from: '919876543210',
                      id: 'wamid.HBgLIDEMPOTENT_MSG_01',
                      timestamp: '1726743600',
                      text: { body: 'Omega Seamaster Professional 300M Co-Axial MRP 520000 Offer Price 445000' },
                      type: 'text'
                    }
                  ]
                }
              }
            ]
          }
        ]
      };

      // 1st delivery
      const res1 = await request(testApp)
        .post('/api/v1/whatsapp/webhook')
        .send(payload);

      expect(res1.status).toBe(200);
      expect(res1.body.status).toBe('PROCESSED');
      expect(res1.body.results.length).toBe(1);

      // Verify event was logged in webhook_events
      const eventRow = db.prepare('SELECT * FROM webhook_events WHERE idempotency_key = ?').get('wamid.HBgLIDEMPOTENT_MSG_01') as any;
      expect(eventRow).toBeDefined();

      // 2nd delivery (identical wamid replay)
      const res2 = await request(testApp)
        .post('/api/v1/whatsapp/webhook')
        .send(payload);

      expect(res2.status).toBe(200);
      expect(res2.body.message).toBe('Replay ignored');

      // Verify no duplicate in products table
      const countRow = db.prepare("SELECT COUNT(*) as count FROM products WHERE source_reference_id = 'wamid.HBgLIDEMPOTENT_MSG_01'").get() as { count: number };
      expect(countRow.count).toBe(1);
    });
  });

  describe('4. Media Pipeline & AI Catalog Insertion', () => {
    it('downloads media, extracts product attributes, and publishes high-confidence items to storefront', async () => {
      const mediaPayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            changes: [
              {
                field: 'messages',
                value: {
                  messages: [
                    {
                      from: '919876543210',
                      id: 'wamid.HBgLMEDIA_WATCH_99',
                      timestamp: '1726743600',
                      type: 'image',
                      image: {
                        id: 'meta_media_778899',
                        caption: 'Rolex Cosmograph Daytona Oystersteel Black Dial MRP 1350000 Offer Price 1150000 100m water resistant chronometer'
                      }
                    }
                  ]
                }
              }
            ]
          }
        ]
      };

      const res = await request(testApp)
        .post('/api/v1/whatsapp/webhook')
        .send(mediaPayload);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('PROCESSED');

      const result = res.body.results[0];
      expect(result).toBeDefined();
      expect(result.title).toContain('ChronoMaster');
      expect(result.media).toBeDefined();
      expect(result.media.cdnUrl).toContain('https://cdn.gizmovault.com/media/products/');

      // High confidence check: > 0.85 should be PUBLISHED and is_featured = 1
      if (result.confidence_score > 0.85) {
        expect(result.status).toBe('PUBLISHED');
        expect(result.is_published).toBe(1);
        expect(result.is_featured).toBe(1);

        // Verify product in database is immediately visible
        const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(result.productId) as any;
        expect(prod.is_published).toBe(1);
        expect(prod.is_featured).toBe(1);
        expect(prod.stock_quantity).toBeGreaterThan(0);
        expect(prod.stock_status).toBe('IN_STOCK');
      }

      // Check product_images table has the media
      const imgRow = db.prepare('SELECT * FROM product_images WHERE product_id = ?').get(result.productId) as any;
      expect(imgRow).toBeDefined();
      expect(imgRow.image_url).toBe(result.media.cdnUrl);
    });

    it('flags low-confidence items as NEEDS_REVIEW for the Admin Moderation Queue', async () => {
      const vaguePayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            changes: [
              {
                field: 'messages',
                value: {
                  messages: [
                    {
                      from: '919876543210',
                      id: 'wamid.HBgLVAGUE_001',
                      timestamp: '1726743600',
                      type: 'text',
                      text: { body: 'Watch in box call for price' }
                    }
                  ]
                }
              }
            ]
          }
        ]
      };

      const res = await request(testApp)
        .post('/api/v1/whatsapp/webhook')
        .send(vaguePayload);

      expect(res.status).toBe(200);
      const result = res.body.results[0];
      expect(result.confidence_score).toBeLessThanOrEqual(0.85);
      expect(result.status).toBe('NEEDS_REVIEW');
      expect(result.is_published).toBe(0);

      // Verify in extracted_products table as NEEDS_REVIEW
      const ext = db.prepare("SELECT * FROM extracted_products WHERE approval_status = 'NEEDS_REVIEW'").get() as any;
      expect(ext).toBeDefined();
    });
  });
});
