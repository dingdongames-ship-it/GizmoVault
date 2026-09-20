import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { DatabaseSync } from 'node:sqlite';
import { createDatabaseConnection } from '../db/connection.js';
import { runMigrations } from '../db/migrator.js';
import { seedDatabase } from '../db/seed.js';
import { MetaWhatsAppConnector, SimulatorWhatsAppConnector } from './connector.js';
import { WhatsAppIngestionService } from './ingestion.service.js';
import { app } from '../index.js';

describe('Phase 5: WhatsApp Ingestion Engine', () => {
  let db: DatabaseSync;
  let service: WhatsAppIngestionService;
  let metaConnector: MetaWhatsAppConnector;
  let simConnector: SimulatorWhatsAppConnector;

  beforeEach(() => {
    db = createDatabaseConnection({ inMemory: true });
    runMigrations(db);
    seedDatabase(db);
    service = new WhatsAppIngestionService(db);
    metaConnector = new MetaWhatsAppConnector('test_token_123', 'test_secret_abc');
    simConnector = new SimulatorWhatsAppConnector();
  });

  afterEach(() => {
    try {
      db.close();
    } catch {
      // ignore
    }
  });

  describe('Webhook Verification & Connectors', () => {
    it('verifies Meta challenge when verify_token matches', () => {
      const challenge = metaConnector.verifyWebhook('subscribe', 'test_token_123', 'CHALLENGE_9921');
      expect(challenge).toBe('CHALLENGE_9921');
    });

    it('rejects verification when token or mode does not match', () => {
      const invalidToken = metaConnector.verifyWebhook('subscribe', 'wrong_token', 'CHALLENGE_9921');
      expect(invalidToken).toBeNull();

      const invalidMode = metaConnector.verifyWebhook('unsubscribe', 'test_token_123', 'CHALLENGE_9921');
      expect(invalidMode).toBeNull();
    });

    it('parses inbound Meta Cloud API text and media payloads accurately', () => {
      const sampleMetaPayload = {
        entry: [
          {
            changes: [
              {
                field: 'messages',
                value: {
                  messages: [
                    {
                      from: '919876543210',
                      id: 'wamid.TEST_TEXT_001',
                      timestamp: '1726743600',
                      type: 'text',
                      text: { body: 'New stock: Rolex Submariner Date imported with box and papers. ₹85,000' }
                    },
                    {
                      from: '919876543210',
                      id: 'wamid.TEST_IMG_002',
                      timestamp: '1726743605',
                      type: 'image',
                      image: {
                        id: 'media_cloud_888999',
                        caption: 'AudioTech True Wireless Buds with ANC, selling price 4999'
                      }
                    }
                  ]
                }
              }
            ]
          }
        ]
      };

      const parsed = metaConnector.parseInboundPayload(sampleMetaPayload);
      expect(parsed.length).toBe(2);

      // Text message
      expect(parsed[0].meta_message_id).toBe('wamid.TEST_TEXT_001');
      expect(parsed[0].message_type).toBe('text');
      expect(parsed[0].raw_text).toContain('Rolex Submariner');

      // Image message
      expect(parsed[1].meta_message_id).toBe('wamid.TEST_IMG_002');
      expect(parsed[1].message_type).toBe('image');
      expect(parsed[1].media_id).toBe('media_cloud_888999');
      expect(parsed[1].caption).toContain('AudioTech');
    });

    it('simulator connector formats raw test payloads into inbound format', () => {
      const simMsg = simConnector.parseInboundPayload({
        sender_phone: '+919812345678',
        text: 'Custom mod watch with Seiko NH35 caliber. ₹16,500 only.',
        meta_message_id: 'sim_custom_99'
      });

      expect(simMsg.length).toBe(1);
      expect(simMsg[0].meta_message_id).toBe('sim_custom_99');
      expect(simMsg[0].source_id).toBe('src_wa_sim');
      expect(simMsg[0].raw_text).toContain('Seiko NH35');
    });
  });

  describe('Ingestion Service & Idempotency', () => {
    it('persists inbound message and enqueues ingestion job', () => {
      const messages = [
        {
          source_id: 'src_wa_meta',
          meta_message_id: 'wamid.PERSIST_001',
          sender_phone: '+919988776655',
          message_type: 'text' as const,
          raw_text: 'Vortex Mechanical Keyboard with Hall Effect switches. ₹12,999',
          timestamp: new Date().toISOString()
        }
      ];

      const result = service.processInboundMessages(messages, JSON.stringify(messages));
      expect(result.saved).toBe(1);
      expect(result.duplicates).toBe(0);
      expect(result.messageIds.length).toBe(1);

      // Verify row in database
      const row = service.getMessageById('wamid.PERSIST_001');
      expect(row).toBeDefined();
      expect(row.processing_status).toBe('PENDING');

      // Verify pending job was created
      const job = db.prepare('SELECT * FROM ingestion_jobs WHERE source_message_id = ?').get(result.messageIds[0]) as any;
      expect(job).toBeDefined();
      expect(job.job_status).toBe('PENDING');
    });

    it('enforces idempotency on duplicate wamid receipt without throwing', () => {
      const messages = [
        {
          source_id: 'src_wa_meta',
          meta_message_id: 'wamid.IDEMPOTENT_TEST',
          sender_phone: '+919988776655',
          message_type: 'text' as const,
          raw_text: 'Testing idempotency',
          timestamp: new Date().toISOString()
        }
      ];

      // First run
      const res1 = service.processInboundMessages(messages, '{}');
      expect(res1.saved).toBe(1);

      // Duplicate second run
      const res2 = service.processInboundMessages(messages, '{}');
      expect(res2.saved).toBe(0);
      expect(res2.duplicates).toBe(1);
    });
  });

  describe('Express Endpoints Integration', () => {
    it('GET /api/v1/whatsapp/webhook responds to verification handshake', async () => {
      const res = await request(app)
        .get('/api/v1/whatsapp/webhook')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': process.env.WHATSAPP_VERIFY_TOKEN || 'gizmovault_secure_verify_token_2026',
          'hub.challenge': 'VERIFIED_12345'
        });

      expect(res.status).toBe(200);
      expect(res.text).toBe('VERIFIED_12345');
    });

    it('POST /api/v1/whatsapp/simulate accepts simulated vendor broadcast', async () => {
      const res = await request(app)
        .post('/api/v1/whatsapp/simulate')
        .send({
          sender_phone: '+919877665544',
          caption: 'Direct from factory: Titanium Smart Ring Gen 3 with 7-day battery. MRP 18,999, selling for 14,499. Includes sizing kit!',
          media_url: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.result.saved).toBe(1);
    });

    it('GET /api/v1/whatsapp/messages lists received messages', async () => {
      const res = await request(app).get('/api/v1/whatsapp/messages');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.count).toBeGreaterThanOrEqual(1); // includes seed message
    });
  });
});
