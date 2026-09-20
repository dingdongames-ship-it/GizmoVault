import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { DatabaseSync } from 'node:sqlite';
import { createDatabaseConnection } from '../db/connection.js';
import { runMigrations } from '../db/migrator.js';
import { seedDatabase } from '../db/seed.js';
import { SmartCategoryService } from './category.service.js';
import { app } from '../index.js';

describe('Phase 7: Smart Category Engine', () => {
  let db: DatabaseSync;
  let service: SmartCategoryService;

  beforeEach(() => {
    db = createDatabaseConnection({ inMemory: true });
    runMigrations(db);
    seedDatabase(db);
    service = new SmartCategoryService(db);
  });

  afterEach(() => {
    try {
      db.close();
    } catch {
      // ignore
    }
  });

  describe('Taxonomy Classification & Subcategory Detection', () => {
    it('classifies luxury mechanical watch with subcategory and auto-assignment', () => {
      const res = service.classify(
        'ChronoMaster Royal Skeleton Tourbillon Automatic Watch',
        'Handcrafted in Geneva with sapphire crystal and 316L steel.',
        { Movement: 'Automatic Tourbillon Caliber CM-72' },
        'ChronoMaster'
      );

      expect(res.categoryId).toBe('cat_watches');
      expect(res.categoryName).toBe('Imported Luxury Watches');
      expect(res.confidence).toBeGreaterThanOrEqual(0.75);
      expect(res.routingStatus).toBe('AUTO_ASSIGNED');
      expect(res.subcategory).toBe('Mechanical & Automatic');
      expect(res.matchedKeywords).toContain('watch');
    });

    it('classifies foldable smartphone into smartphones category', () => {
      const res = service.classify(
        'Vortex Fold Pro 5G Titanium Dual Screen',
        'Flagship Snapdragon 8 Gen 3 foldable phone with crease-free hinge.',
        { Display: '8-inch 120Hz LTPO AMOLED' },
        'VortexTech'
      );

      expect(res.categoryId).toBe('cat_phones');
      expect(res.categoryName).toBe('Smartphones & Foldables');
      expect(res.confidence).toBeGreaterThanOrEqual(0.75);
      expect(res.routingStatus).toBe('AUTO_ASSIGNED');
      expect(res.subcategory).toBe('Foldable & Flip Phones');
    });

    it('classifies over-ear ANC headphones into Audio category', () => {
      const res = service.classify(
        'SoundCore Horizon Wireless ANC Headphones',
        'Over-ear studio monitors with LDAC, plush memory foam earcups, and 60hr battery.',
        { NoiseCancellation: 'Hybrid Active Noise Cancellation' },
        'SoundCore Labs'
      );

      expect(res.categoryId).toBe('cat_audio');
      expect(res.categoryName).toBe('Audio & Sound');
      expect(res.confidence).toBeGreaterThanOrEqual(0.75);
      expect(res.routingStatus).toBe('AUTO_ASSIGNED');
      expect(res.subcategory).toBe('Over-Ear Headphones');
    });

    it('prevents smartwatches from being misclassified as luxury analog watches via negative keywords', () => {
      const res = service.classify(
        'Vortex Smartwatch Ultra Apex 49mm GPS',
        'Rugged smartwatch with ECG, SpO2, and fitness tracking.',
        { Display: 'OLED Sapphire Touch' },
        'VortexTech'
      );

      expect(res.categoryId).toBe('cat_wearables');
      expect(res.categoryName).toBe('Smart Wearables');
      expect(res.routingStatus).toBe('AUTO_ASSIGNED');
    });

    it('classifies aerial camera drones into Photography & Drones', () => {
      const res = service.classify(
        'Vortex SkyPhantom 4K Aerial Drone',
        'Sub-249g quadcopter with 3-axis gimbal camera and obstacle sensing.',
        { Sensor: '1/1.3-inch CMOS' },
        'VortexTech'
      );

      expect(res.categoryId).toBe('cat_drones');
      expect(res.categoryName).toBe('Photography & Drones');
      expect(res.routingStatus).toBe('AUTO_ASSIGNED');
      expect(res.subcategory).toBe('Camera Drones');
    });

    it('handles ambiguous or sparse inputs with SUGGESTED or UNCATEGORIZED status', () => {
      const res = service.classify('Generic Portable Gadget Box', 'Universal carrying case');
      expect(res.routingStatus).toBe('UNCATEGORIZED');
      expect(res.confidence).toBeLessThan(0.45);
    });
  });

  describe('Database Taxonomy & REST API Integration', () => {
    it('returns all 6 master categories with product counts from database', () => {
      const categories = service.getAllCategories();
      expect(categories.length).toBe(6);

      const watches = categories.find((c) => c.slug === 'imported-luxury-watches');
      expect(watches).toBeDefined();
      expect(watches.product_count).toBeGreaterThanOrEqual(4);
    });

    it('GET /api/categories returns HTTP 200 with catalog categories', async () => {
      const res = await request(app).get('/api/categories');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(6);
      expect(res.body.data[0].slug).toBeDefined();
    });

    it('POST /api/v1/ai/classify-category returns classification result', async () => {
      const res = await request(app)
        .post('/api/v1/ai/classify-category')
        .send({
          title: 'Nebula CyberDeck Gaming Handheld Console',
          description: 'AMD Ryzen Z1 gaming console with RGB',
          brand: 'NebulaGear'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.categoryId).toBe('cat_gaming');
      expect(res.body.data.categoryName).toBe('Gaming Gear');
      expect(res.body.data.routingStatus).toBe('AUTO_ASSIGNED');
    });
  });
});
