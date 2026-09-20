import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { DatabaseSync } from 'node:sqlite';
import { createDatabaseConnection } from '../db/connection.js';
import { runMigrations } from '../db/migrator.js';
import { seedDatabase } from '../db/seed.js';
import { DeduplicationService } from './dedup.service.js';
import { app } from '../index.js';

describe('Phase 8: Product Deduplication Engine', () => {
  let db: DatabaseSync;
  let service: DeduplicationService;

  beforeEach(() => {
    db = createDatabaseConnection({ inMemory: true });
    runMigrations(db);
    seedDatabase(db);
    service = new DeduplicationService(db);
  });

  afterEach(() => {
    try {
      db.close();
    } catch {
      // ignore
    }
  });

  describe('Fingerprint Generation & Token Similarity', () => {
    it('generates deterministic canonical fingerprint ignoring noise and hype words', () => {
      const candidate1 = {
        title: 'Fresh arrival! ChronoMaster Royal Tourbillon Automatic in stock with box & papers',
        brand: 'ChronoMaster',
        model: 'RT-Geneva-900',
        specs: { Movement: 'Automatic Tourbillon' }
      };

      const candidate2 = {
        title: 'HOT DEAL: ChronoMaster Royal Tourbillon Automatic original retail sale',
        brand: 'ChronoMaster',
        model: 'RT-Geneva-900',
        specs: { Movement: 'Automatic Tourbillon' }
      };

      const fp1 = service.generateFingerprint(candidate1);
      const fp2 = service.generateFingerprint(candidate2);

      expect(fp1).toHaveLength(16);
      expect(fp2).toHaveLength(16);
      expect(fp1).toBe(fp2); // Identical core fingerprint despite different noise words
    });

    it('computes high similarity for equivalent titles and low similarity for distinct products', () => {
      const simHigh = service.computeSimilarity(
        'ChronoMaster Royal Tourbillon Skeleton Dial Automatic',
        'ChronoMaster Royal Tourbillon Automatic Skeleton Geneva'
      );
      expect(simHigh).toBeGreaterThanOrEqual(0.70);

      const simLow = service.computeSimilarity(
        'ChronoMaster Royal Tourbillon Swiss Watch',
        'SoundCore Wireless ANC Bluetooth Earbuds'
      );
      expect(simLow).toBeLessThan(0.15);
    });
  });

  describe('Catalog Deduplication & Variant Matching', () => {
    it('identifies high confidence duplicate when model code matches existing product', () => {
      const candidate = {
        title: 'ChronoMaster Geneva Tourbillon High-End Edition',
        brand: 'ChronoMaster',
        model: 'RT-Geneva-900' // Exact model code of seeded watch
      };

      const matches = service.findDuplicates(candidate);
      expect(matches.length).toBeGreaterThanOrEqual(1);
      expect(matches[0].matchType).toBe('HIGH_CONFIDENCE_DUPLICATE');
      expect(matches[0].similarityScore).toBeGreaterThanOrEqual(0.85);
      expect(matches[0].sku).toBe('GV-WATCH-CHRONO-01');
    });

    it('identifies possible variant when title heavily overlaps with different specs', () => {
      const candidate = {
        title: 'Vortex Fold Pro 5G Titanium Edition 1TB Storage',
        brand: 'VortexTech',
        model: 'VF-PRO-1TB' // different model variant
      };

      const matches = service.findDuplicates(candidate);
      const foldMatch = matches.find((m) => m.sku === 'GV-PHONE-VORTEX-01');
      expect(foldMatch).toBeDefined();
      expect(foldMatch?.similarityScore).toBeGreaterThanOrEqual(0.40);
      expect(foldMatch?.matchType).toBe('POSSIBLE_VARIANT');
    });

    it('tags extracted_products row with duplicate_of_product_id and flags for review', () => {
      // 1. Insert a candidate into extracted_products that duplicates the tourbillon watch
      const extId = 'ext_dup_test_01';
      db.prepare(`
        INSERT INTO extracted_products (
          id, message_id, extracted_title, extracted_category, suggested_category_id,
          extracted_brand, extracted_model, extracted_original_price, extracted_selling_price,
          confidence_score, approval_status
        ) VALUES (
          ?, 'msg_seed_01', 'ChronoMaster Royal Tourbillon Swiss Skeleton Watch', 'Imported Luxury Watches', 'cat_watches',
          'ChronoMaster', 'RT-Geneva-900', 45000, 38999,
          0.95, 'NEEDS_REVIEW'
        )
      `).run(extId);

      // 2. Evaluate and tag
      const result = service.evaluateAndTagExtractedProduct(extId);
      expect(result.isDuplicate).toBe(true);
      expect(result.duplicateOf).toBeDefined();

      // 3. Verify database state
      const row = db.prepare('SELECT duplicate_of_product_id, approval_status FROM extracted_products WHERE id = ?').get(extId) as any;
      expect(row.duplicate_of_product_id).toBe('prod_watch_01');
      expect(row.approval_status).toBe('FLAGGED');
    });
  });

  describe('REST API Endpoint Integration', () => {
    it('POST /api/v1/ai/check-duplicate returns matches and fingerprint', async () => {
      const res = await request(app)
        .post('/api/v1/ai/check-duplicate')
        .send({
          title: 'ChronoMaster Royal Tourbillon Skeleton Automatic',
          brand: 'ChronoMaster',
          model: 'RT-Geneva-900'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.fingerprint).toBeDefined();
      expect(res.body.isDuplicate).toBe(true);
      expect(res.body.matches.length).toBeGreaterThanOrEqual(1);
      expect(res.body.matches[0].sku).toBe('GV-WATCH-CHRONO-01');
    });
  });
});
