import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { DatabaseSync } from 'node:sqlite';
import { createDatabaseConnection } from '../db/connection.js';
import { runMigrations } from '../db/migrator.js';
import { seedDatabase } from '../db/seed.js';
import { HeuristicProductExtractor } from './extractor.js';
import { AIPipelineService } from './pipeline.service.js';
import { app } from '../index.js';

describe('Phase 6: AI Product Extraction Engine', () => {
  let db: DatabaseSync;
  let extractor: HeuristicProductExtractor;
  let pipeline: AIPipelineService;

  beforeEach(() => {
    db = createDatabaseConnection({ inMemory: true });
    runMigrations(db);
    seedDatabase(db);
    extractor = new HeuristicProductExtractor();
    pipeline = new AIPipelineService(db, extractor);
  });

  afterEach(() => {
    try {
      db.close();
    } catch {
      // ignore
    }
  });

  describe('Heuristic Attribute Parsing & Scoring', () => {
    it('extracts structured watch attributes, specs, and prices with high confidence', async () => {
      const mockMsg = {
        source_id: 'src_wa_meta',
        meta_message_id: 'wamid.WATCH_TEST',
        sender_phone: '+919812345678',
        message_type: 'image' as const,
        caption: 'ChronoMaster Diver 300M Automatic with ceramic bezel and sapphire crystal. MRP: ₹38,000, Special Offer: ₹29,999. Waterproof 300m with 316L steel bracelet.',
        media_id: 'med_watch_991',
        timestamp: new Date().toISOString()
      };

      const result = await extractor.extract(mockMsg);

      expect(result.title).toContain('ChronoMaster');
      expect(result.category).toBe('Imported Luxury Watches');
      expect(result.suggested_category_id).toBe('cat_watches');
      expect(result.brand).toBe('ChronoMaster');
      expect(result.original_price).toBe(38000);
      expect(result.selling_price).toBe(29999);
      expect(result.discount_amount).toBe(8001);
      expect(result.discount_percent).toBe(21);
      expect(result.specs['Movement']).toBe('Automatic Mechanical');
      expect(result.specs['Crystal']).toContain('Sapphire');
      expect(result.specs['Bezel']).toContain('Ceramic');
      expect(result.confidence_score).toBeGreaterThanOrEqual(0.70);
      expect(result.approval_status).toBe('NEEDS_REVIEW');
      expect(result.media_urls.length).toBe(1);
    });

    it('extracts gadget attributes, discount math, and specs for audio/phones', async () => {
      const mockMsg = {
        source_id: 'src_wa_sim',
        meta_message_id: 'wamid.AUDIO_TEST',
        sender_phone: '+919988112233',
        message_type: 'text' as const,
        raw_text: 'SoundCore Horizon Wireless Headphones with Active Noise Cancellation ANC. Retail: ₹24,999, Deal: ₹18,499. Up to 60 hours battery life.',
        timestamp: new Date().toISOString()
      };

      const result = await extractor.extract(mockMsg);

      expect(result.category).toBe('Audio & Sound');
      expect(result.suggested_category_id).toBe('cat_audio');
      expect(result.brand).toBe('SoundCore Labs');
      expect(result.original_price).toBe(24999);
      expect(result.selling_price).toBe(18499);
      expect(result.discount_amount).toBe(6500);
      expect(result.specs['Noise Cancellation']).toContain('Active Noise Cancellation');
      expect(result.specs['Battery']).toContain('60 hours battery');
      expect(result.confidence_score).toBeGreaterThanOrEqual(0.70);
    });

    it('recovers gracefully from inverted MRP / selling prices', async () => {
      const mockMsg = {
        source_id: 'src_wa_sim',
        meta_message_id: 'wamid.INVERTED_PRICE',
        sender_phone: '+919988112233',
        message_type: 'text' as const,
        raw_text: 'New Drone 4K: Offer ₹45,000, MRP ₹35,000.', // Vendor inverted numbers
        timestamp: new Date().toISOString()
      };

      const result = await extractor.extract(mockMsg);
      // Ensure sanity: selling price cannot exceed original price
      expect(result.selling_price).toBeLessThanOrEqual(result.original_price);
      expect(result.original_price).toBe(45000);
      expect(result.selling_price).toBe(35000);
    });
  });

  describe('Pipeline Service & Ingestion Job State Transitions', () => {
    it('processes WhatsApp message, saves extracted product, and updates job to COMPLETED', async () => {
      // 1. Insert a mock raw inbound message
      const msgId = 'wa_msg_pipeline_test';
      db.prepare(`
        INSERT INTO whatsapp_messages (id, source_id, meta_message_id, sender_phone, message_type, raw_text, processing_status)
        VALUES (?, 'src_wa_meta', 'wamid.PIPELINE_TEST', '+919900112233', 'text', 'Vortex Fold Pro 5G with Snapdragon processor. MRP 149999 selling for 129999', 'PENDING')
      `).run(msgId);

      db.prepare(`
        INSERT INTO ingestion_jobs (id, source_message_id, job_status, attempt_count)
        VALUES ('job_pipe_01', ?, 'PENDING', 0)
      `).run(msgId);

      // 2. Process message through pipeline
      const extracted = await pipeline.processMessage(msgId);

      expect(extracted.id).toBeDefined();
      expect(extracted.message_id).toBe(msgId);
      expect(extracted.extracted_title).toContain('Vortex Fold Pro');
      expect(extracted.extracted_selling_price).toBe(129999);
      expect(extracted.extracted_original_price).toBe(149999);
      expect(extracted.approval_status).toBe('NEEDS_REVIEW');

      // 3. Verify database state
      const updatedMsg = db.prepare('SELECT processing_status FROM whatsapp_messages WHERE id = ?').get(msgId) as any;
      expect(updatedMsg.processing_status).toBe('PROCESSED');

      const updatedJob = db.prepare('SELECT * FROM ingestion_jobs WHERE source_message_id = ?').get(msgId) as any;
      expect(updatedJob.job_status).toBe('COMPLETED');
      expect(updatedJob.attempt_count).toBe(1);
    });

    it('lists extracted products with approval status filtering', () => {
      const { items, total } = pipeline.listExtracted({ status: 'NEEDS_REVIEW' });
      expect(total).toBeGreaterThanOrEqual(1); // seed item
      expect(items.every((i) => i.approval_status === 'NEEDS_REVIEW')).toBe(true);
    });
  });

  describe('Express Endpoints Integration', () => {
    it('GET /api/v1/ai/extracted returns list of extracted items', async () => {
      const res = await request(app).get('/api/v1/ai/extracted');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.count).toBeGreaterThanOrEqual(1);
    });

    it('POST /api/v1/ai/extract/:messageId executes extraction via API', async () => {
      // First insert an unparsed message into DB
      const resMsg = await request(app)
        .post('/api/v1/whatsapp/simulate')
        .send({
          sender_phone: '+919811223344',
          text: 'Vortex SkyPhantom 4K HDR Drone with 3-axis gimbal. Retail ₹68,000, price ₹54,999. Sub 249g lightweight aerial camera.'
        });

      const internalId = resMsg.body.result.messageIds[0];
      expect(internalId).toBeDefined();

      // Trigger AI extraction
      const extractRes = await request(app).post(`/api/v1/ai/extract/${internalId}`);
      expect(extractRes.status).toBe(200);
      expect(extractRes.body.success).toBe(true);
      expect(extractRes.body.data.extracted_category).toBe('Photography & Drones');
      expect(extractRes.body.data.extracted_selling_price).toBe(54999);
      expect(extractRes.body.data.confidence_score).toBeGreaterThanOrEqual(0.70);
    });
  });
});
