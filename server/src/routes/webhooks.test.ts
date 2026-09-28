import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import express from 'express';
import { DatabaseSync } from 'node:sqlite';
import { createDatabaseConnection } from '../db/connection.js';
import { runMigrations } from '../db/migrator.js';
import { seedDatabase } from '../db/seed.js';
import { createWhatsAppRouter, WhatsAppWebhookService } from './whatsapp.js';
import { createPaymentRouter } from './payments.js';
import { MediaPipelineService } from '../media/media.service.js';
import { AIExtractionService } from '../ai/extractor.js';
import { DeduplicationService } from '../ai/dedup.service.js';
import { r2Storage } from '../media/r2.storage.js';

describe('Production Webhook Pipelines & Cryptographic Signature Verification', () => {
  let db: DatabaseSync;
  let app: express.Express;
  const whatsappVerifyToken = 'test_wa_verify_token_2026';
  const metaAppSecret = 'test_meta_app_secret_super_secure_key_123';
  const razorpaySecret = 'test_rzp_webhook_secret_key_456';
  const stripeSecret = 'whsec_test_stripe_secret_key_789';

  beforeEach(() => {
    process.env.WHATSAPP_VERIFY_TOKEN = whatsappVerifyToken;
    process.env.META_APP_SECRET = metaAppSecret;
    process.env.RAZORPAY_WEBHOOK_SECRET = razorpaySecret;
    process.env.STRIPE_WEBHOOK_SECRET = stripeSecret;

    db = createDatabaseConnection({ inMemory: true });
    runMigrations(db);
    seedDatabase(db);

    const mediaPipeline = new MediaPipelineService(
      {
        maxImageSizeBytes: 15 * 1024 * 1024,
        maxVideoSizeBytes: 50 * 1024 * 1024,
      },
      db
    );

    const aiExtractor = new AIExtractionService();
    const dedupService = new DeduplicationService(db);

    const mockJpeg = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]),
      Buffer.alloc(128, 0x22),
    ]);

    const whatsappService = new WhatsAppWebhookService({
      db,
      verifyToken: whatsappVerifyToken,
      appSecret: metaAppSecret,
      apiToken: 'test_wa_api_token_v21',
      mediaPipeline,
      aiExtractor,
      dedupService,
      mediaDownloader: async (_mediaId: string) => ({
        buffer: mockJpeg,
        mimeType: 'image/jpeg',
      }),
    });

    app = express();

    // Replicate production index.ts raw stream bypass
    app.use((req, res, next) => {
      if (req.originalUrl?.includes('/webhook') || req.path?.includes('/webhook')) {
        return next();
      }
      express.json({
        verify: (req: any, _res, buf) => {
          req.rawBody = buf;
        },
      })(req, res, next);
    });

    app.use('/api/v1/whatsapp', createWhatsAppRouter(undefined, whatsappService));
    app.use('/api/v1/payments', createPaymentRouter({ db }));
  });

  afterEach(() => {
    try {
      db.close();
    } catch {}
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // 1. WhatsApp Cloud API Webhook Handshake & HMAC-SHA256 Verification
  // ===========================================================================
  describe('WhatsApp Cloud API Inbound Webhook (Task 1)', () => {
    it('GET /api/v1/whatsapp/webhook: succeeds and returns challenge when hub.mode=subscribe and token matches', async () => {
      const challenge = '1982736450';
      const res = await request(app)
        .get('/api/v1/whatsapp/webhook')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': whatsappVerifyToken,
          'hub.challenge': challenge,
        });

      expect(res.status).toBe(200);
      expect(res.text).toBe(challenge);
    });

    it('GET /api/v1/whatsapp/webhook: rejects with 403 on invalid verify token', async () => {
      const res = await request(app)
        .get('/api/v1/whatsapp/webhook')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'wrong_invalid_token',
          'hub.challenge': '999',
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('mismatch');
    });

    it('GET /api/v1/whatsapp/webhook: rejects with 403 when hub.mode is not subscribe', async () => {
      const res = await request(app)
        .get('/api/v1/whatsapp/webhook')
        .query({
          'hub.mode': 'unsubscribe',
          'hub.verify_token': whatsappVerifyToken,
          'hub.challenge': '999',
        });

      expect(res.status).toBe(403);
    });

    it('POST /api/v1/whatsapp/webhook: accepts valid raw HMAC-SHA256 signature and ingests product', async () => {
      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'WH_ACC_01',
            changes: [
              {
                field: 'messages',
                value: {
                  messaging_product: 'whatsapp',
                  messages: [
                    {
                      from: '919876543210',
                      id: 'wamid.HBgLTESTHMAC001',
                      timestamp: '1726743600',
                      type: 'image',
                      image: {
                        id: 'meta_media_graph_v21_001',
                        caption:
                          'Audemars Piguet Royal Oak Chronograph 41mm Blue Dial MRP 3800000 Offer Price 3450000 automatic Swiss movement',
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const rawBody = JSON.stringify(payload);
      const hmac = crypto.createHmac('sha256', metaAppSecret).update(rawBody).digest('hex');
      const signatureHeader = `sha256=${hmac}`;

      const res = await request(app)
        .post('/api/v1/whatsapp/webhook')
        .set('Content-Type', 'application/json')
        .set('x-hub-signature-256', signatureHeader)
        .send(rawBody);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.status).toBe('PROCESSED');
      expect(res.body.results.length).toBe(1);

      // Verify product is in database
      const inserted = db
        .prepare('SELECT * FROM products WHERE source_reference_id = ?')
        .get('wamid.HBgLTESTHMAC001') as any;
      expect(inserted).toBeDefined();
      expect(inserted.selling_price).toBe(3450000);
    });

    it('POST /api/v1/whatsapp/webhook: rejects tampered HMAC-SHA256 signature with 401', async () => {
      const payload = {
        object: 'whatsapp_business_account',
        entry: [{ id: '1', changes: [{ value: { messages: [{ id: 'wamid.TAMPERED' }] } }] }],
      };
      const rawBody = JSON.stringify(payload);
      const tamperedSig = 'sha256=ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

      const res = await request(app)
        .post('/api/v1/whatsapp/webhook')
        .set('Content-Type', 'application/json')
        .set('x-hub-signature-256', tamperedSig)
        .send(rawBody);

      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Invalid HMAC signature');
    });

    it('POST /api/v1/whatsapp/webhook: returns HTTP 200 immediately in async mode to prevent Meta retry loops', async () => {
      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    {
                      from: '919876543210',
                      id: 'wamid.HBgLASYNC001',
                      type: 'text',
                      text: { body: 'Sony WH-1000XM5 Wireless Headphones ANC MRP 34990 Offer 27990' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const rawBody = JSON.stringify(payload);
      const hmac = crypto.createHmac('sha256', metaAppSecret).update(rawBody).digest('hex');

      const res = await request(app)
        .post('/api/v1/whatsapp/webhook?async=true')
        .set('Content-Type', 'application/json')
        .set('x-hub-signature-256', `sha256=${hmac}`)
        .send(rawBody);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.status).toBe('RECEIVED');
    });
  });

  // ===========================================================================
  // 2. Razorpay Production Webhook (HMAC-SHA256 & Timing-Safe Verification)
  // ===========================================================================
  describe('Razorpay Production Payment Webhook (Task 2)', () => {
    it('POST /api/v1/payments/razorpay/webhook: accepts valid HMAC-SHA256 signature and updates SQLite order to PAID', async () => {
      // Seed a test order in SQLite with status PAYMENT_PENDING
      const testOrderId = 'ord_rzp_test_001';
      db.prepare(`
        INSERT INTO orders (
          id, order_number, user_id, address_id, subtotal, grand_total,
          order_status, payment_status, shipping_address_snapshot
        ) VALUES (?, 'GV-2026-RZP001', 'user_demo_01', 'addr_01', 99999, 99999, 'PAYMENT_PENDING', 'PENDING', '{}')
      `).run(testOrderId);

      const eventPayload = {
        entity: 'event',
        event: 'payment.captured',
        event_id: 'evt_rzp_pay_captured_001',
        payload: {
          payment: {
            entity: {
              id: 'pay_rzp_live_998877',
              amount: 9999900,
              currency: 'INR',
              order_id: testOrderId,
            },
          },
        },
      };

      const rawBody = JSON.stringify(eventPayload);
      const validSignature = crypto
        .createHmac('sha256', razorpaySecret)
        .update(rawBody)
        .digest('hex');

      const res = await request(app)
        .post('/api/v1/payments/razorpay/webhook')
        .set('Content-Type', 'application/json')
        .set('x-razorpay-signature', validSignature)
        .send(rawBody);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.verified).toBe(true);
      expect(res.body.event).toBe('payment.captured');
      expect(res.body.status).toBe('PAID');

      // Verify SQLite order status transition
      const order = db.prepare('SELECT order_status, payment_status FROM orders WHERE id = ?').get(testOrderId) as any;
      expect(order.order_status).toBe('PAID');
      expect(order.payment_status).toBe('PAID');
    });

    it('POST /api/v1/payments/razorpay/webhook: rejects tampered signature with 400', async () => {
      const eventPayload = {
        event: 'order.paid',
        payload: { payment: { entity: { id: 'pay_bad', order_id: 'ord_bad' } } },
      };
      const rawBody = JSON.stringify(eventPayload);

      const res = await request(app)
        .post('/api/v1/payments/razorpay/webhook')
        .set('Content-Type', 'application/json')
        .set('x-razorpay-signature', 'deadbeef00000000000000000000000000000000000000000000000000000000')
        .send(rawBody);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid Razorpay signature');
    });

    it('POST /api/v1/payments/razorpay/webhook: rejects request when x-razorpay-signature is missing', async () => {
      const res = await request(app)
        .post('/api/v1/payments/razorpay/webhook')
        .set('Content-Type', 'application/json')
        .send({ event: 'payment.captured' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Missing x-razorpay-signature');
    });
  });

  // ===========================================================================
  // 3. Stripe Production Webhook
  // ===========================================================================
  describe('Stripe Production Payment Webhook (Task 2)', () => {
    it('POST /api/v1/payments/stripe/webhook: handles checkout.session.completed and updates order to PAID', async () => {
      // Seed order
      const testOrderId = 'ord_stripe_test_002';
      db.prepare(`
        INSERT INTO orders (
          id, order_number, user_id, address_id, subtotal, grand_total,
          order_status, payment_status, shipping_address_snapshot
        ) VALUES (?, 'GV-2026-STP002', 'user_demo_01', 'addr_01', 49999, 49999, 'PAYMENT_PENDING', 'PENDING', '{}')
      `).run(testOrderId);

      const eventPayload = {
        id: 'evt_stripe_checkout_001',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_session_123',
            payment_intent: 'pi_test_intent_456',
            amount_total: 4999900,
            currency: 'inr',
            client_reference_id: testOrderId,
          },
        },
      };

      const rawBody = JSON.stringify(eventPayload);

      const res = await request(app)
        .post('/api/v1/payments/stripe/webhook')
        .set('Content-Type', 'application/json')
        .set('stripe-signature', 'mock_stripe_signature')
        .send(rawBody);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.event).toBe('checkout.session.completed');
      expect(res.body.status).toBe('PAID');

      // Verify order transition in SQLite
      const order = db.prepare('SELECT order_status, payment_status FROM orders WHERE id = ?').get(testOrderId) as any;
      expect(order.order_status).toBe('PAID');
      expect(order.payment_status).toBe('PAID');
    });

    it('POST /api/v1/payments/stripe/webhook: handles payment_intent.succeeded', async () => {
      const testOrderId = 'ord_stripe_test_003';
      db.prepare(`
        INSERT INTO orders (
          id, order_number, user_id, address_id, subtotal, grand_total,
          order_status, payment_status, shipping_address_snapshot
        ) VALUES (?, 'GV-2026-STP003', 'user_demo_01', 'addr_01', 29999, 29999, 'PAYMENT_PENDING', 'PENDING', '{}')
      `).run(testOrderId);

      const eventPayload = {
        id: 'evt_stripe_pi_002',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test_intent_789',
            amount: 2999900,
            currency: 'inr',
            metadata: {
              order_id: testOrderId,
            },
          },
        },
      };

      const rawBody = JSON.stringify(eventPayload);

      const res = await request(app)
        .post('/api/v1/payments/stripe/webhook')
        .set('Content-Type', 'application/json')
        .set('stripe-signature', 'mock_stripe_signature')
        .send(rawBody);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.status).toBe('PAID');

      const order = db.prepare('SELECT order_status FROM orders WHERE id = ?').get(testOrderId) as any;
      expect(order.order_status).toBe('PAID');
    });

    it('POST /api/v1/payments/stripe/webhook: rejects request when stripe-signature header is missing', async () => {
      const res = await request(app)
        .post('/api/v1/payments/stripe/webhook')
        .set('Content-Type', 'application/json')
        .send({ type: 'payment_intent.succeeded' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Missing stripe-signature');
    });
  });
});
