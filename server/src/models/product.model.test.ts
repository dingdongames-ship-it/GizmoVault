import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { createDatabaseConnection } from '../db/connection.js';
import { runMigrations } from '../db/migrator.js';
import { seedDatabase } from '../db/seed.js';
import {
  calculateDiscount,
  determineStockStatus,
  generateSku,
  validateProduct,
  ProductRepository
} from './product.model.js';

describe('Phase 4: Product Data Model & Validation Engine', () => {
  let db: DatabaseSync;
  let repo: ProductRepository;

  beforeEach(() => {
    db = createDatabaseConnection({ inMemory: true });
    runMigrations(db);
    seedDatabase(db);
    repo = new ProductRepository(db);
  });

  afterEach(() => {
    try {
      db.close();
    } catch {
      // ignore
    }
  });

  describe('Business Math & Helper Rules', () => {
    it('calculates discount amount and discount percentage accurately', () => {
      const d1 = calculateDiscount(40000, 30000);
      expect(d1.discountAmount).toBe(10000);
      expect(d1.discountPercent).toBe(25);

      const d2 = calculateDiscount(1000, 1000);
      expect(d2.discountAmount).toBe(0);
      expect(d2.discountPercent).toBe(0);

      const d3 = calculateDiscount(9999, 4999);
      expect(d3.discountAmount).toBe(5000);
      expect(d3.discountPercent).toBe(50);
    });

    it('determines correct stock status enum', () => {
      expect(determineStockStatus(0)).toBe('OUT_OF_STOCK');
      expect(determineStockStatus(-2)).toBe('OUT_OF_STOCK');
      expect(determineStockStatus(3, 5)).toBe('LOW_STOCK');
      expect(determineStockStatus(5, 5)).toBe('LOW_STOCK');
      expect(determineStockStatus(6, 5)).toBe('IN_STOCK');
      expect(determineStockStatus(100)).toBe('IN_STOCK');
    });

    it('generates well-formed GizmoVault SKUs', () => {
      const sku = generateSku('smartphones-foldables', 'vortex');
      expect(sku).toMatch(/^GV-[A-Z0-9]+-VORTEX-\d{4}$/);

      const defaultSku = generateSku('');
      expect(defaultSku).toMatch(/^GV-PROD-GV-\d{4}$/);
    });

    it('validates product attributes and enforces price hierarchy', () => {
      // Valid input
      const valid = validateProduct({
        title: 'Nebula Smart Tracker',
        full_description: 'Precision GPS activity and fitness tracker.',
        category_id: 'cat_wearables',
        original_price: 5000,
        selling_price: 3999,
        stock_quantity: 10
      });
      expect(valid.valid).toBe(true);
      expect(valid.errors.length).toBe(0);

      // Selling price > Original price should be rejected
      const invalidPrice = validateProduct({
        title: 'Broken Price Product',
        full_description: 'Valid long description for product testing.',
        category_id: 'cat_wearables',
        original_price: 2000,
        selling_price: 2500
      });
      expect(invalidPrice.valid).toBe(false);
      expect(invalidPrice.errors).toContain('Selling price cannot exceed original price (MRP).');

      // Negative prices should be rejected
      const negPrice = validateProduct({
        title: 'Negative Price Product',
        full_description: 'Valid long description for product testing.',
        category_id: 'cat_wearables',
        original_price: -100,
        selling_price: 50
      });
      expect(negPrice.valid).toBe(false);
    });
  });

  describe('Product Repository Operations', () => {
    it('creates a new product with specs, images, and inventory synchronization', () => {
      const created = repo.create({
        title: 'ZenAura Mechanical Masterpiece',
        short_description: 'Handcrafted skeleton mechanical watch.',
        full_description: 'Ultra-thin manual wind mechanical luxury watch with hand-engraved dial.',
        category_id: 'cat_watches',
        brand_id: 'brand_zenaura',
        model: 'ZA-SKEL-01',
        original_price: 60000,
        selling_price: 49999,
        stock_quantity: 4,
        low_stock_threshold: 5,
        is_featured: true,
        specifications: [
          { spec_key: 'Movement', spec_value: 'Hand-wound Skeleton Caliber 12' },
          { spec_key: 'Crystal', spec_value: 'Boxed Sapphire' }
        ],
        images: [
          { image_url: 'https://example.com/watch_front.jpg', is_primary: true },
          { image_url: 'https://example.com/watch_back.jpg', is_primary: false }
        ]
      });

      expect(created.id).toBeDefined();
      expect(created.sku).toMatch(/^GV-CATWAT/);
      expect(created.discount_amount).toBe(10001);
      expect(created.stock_status).toBe('LOW_STOCK'); // 4 <= 5
      expect(created.specifications?.length).toBe(2);
      expect(created.images?.length).toBe(2);
      expect(created.category_name).toBe('Imported Luxury Watches');

      // Check direct lookup by ID and SKU
      const foundById = repo.getById(created.id);
      expect(foundById?.title).toBe('ZenAura Mechanical Masterpiece');

      const foundBySku = repo.getBySku(created.sku);
      expect(foundBySku?.id).toBe(created.id);
    });

    it('updates product and recalculates dynamic discount fields and inventory', () => {
      const existing = repo.getBySku('GV-WATCH-CHRONO-01')!;
      expect(existing).toBeDefined();

      // Update selling price and stock
      const updated = repo.update(existing.id, {
        selling_price: 34999,
        stock_quantity: 0
      });

      expect(updated.selling_price).toBe(34999);
      expect(updated.discount_amount).toBe(existing.original_price - 34999);
      expect(updated.stock_quantity).toBe(0);
      expect(updated.stock_status).toBe('OUT_OF_STOCK');

      // Verify inventory table was synchronized
      const inv = db.prepare('SELECT quantity_available FROM inventory WHERE product_id = ?').get(existing.id) as any;
      expect(inv.quantity_available).toBe(0);
    });

    it('performs soft delete and excludes from standard listings', () => {
      const existing = repo.getBySku('GV-WATCH-CHRONO-01')!;
      const deleted = repo.delete(existing.id, true);
      expect(deleted).toBe(true);

      const lookup = repo.getById(existing.id);
      expect(lookup).toBeNull();

      const { products } = repo.list();
      expect(products.some((p) => p.id === existing.id)).toBe(false);
    });

    it('supports multifaceted listing filters (category, search, price range, stock)', () => {
      // Filter by category
      const watches = repo.list({ categoryId: 'cat_watches' });
      expect(watches.products.length).toBeGreaterThanOrEqual(4);
      expect(watches.products.every((p) => p.category_id === 'cat_watches')).toBe(true);

      // Filter by price range
      const budgetAudio = repo.list({
        categoryId: 'cat_audio',
        maxPrice: 15000
      });
      expect(budgetAudio.products.every((p) => p.selling_price <= 15000)).toBe(true);

      // Filter by search query
      const droneSearch = repo.list({ search: 'Drone' });
      expect(droneSearch.products.length).toBeGreaterThanOrEqual(1);
      expect(droneSearch.products[0].title).toContain('Drone');
    });
  });
});
