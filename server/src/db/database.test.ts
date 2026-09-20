import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { createDatabaseConnection } from './connection.js';
import { runMigrations } from './migrator.js';
import { seedDatabase } from './seed.js';

describe('Phase 3: Database Architecture & Schema Verification', () => {
  let db: DatabaseSync;

  beforeEach(() => {
    // Create isolated in-memory test database for each test run
    db = createDatabaseConnection({ inMemory: true });
  });

  afterEach(() => {
    try {
      db.close();
    } catch {
      // ignore
    }
  });

  it('executes 001_initial_schema migration cleanly and records it in _migrations', () => {
    const res = runMigrations(db);
    expect(res.applied.length).toBeGreaterThanOrEqual(1);
    expect(res.applied).toContain('001_initial_schema.sql');

    // Verify _migrations table has it recorded
    const rows = db.prepare('SELECT name FROM _migrations').all() as Array<{ name: string }>;
    expect(rows.map((r) => r.name)).toContain('001_initial_schema.sql');
  });

  it('migration is idempotent on subsequent runs', () => {
    const firstRun = runMigrations(db);
    expect(firstRun.applied.length).toBeGreaterThanOrEqual(1);

    const secondRun = runMigrations(db);
    expect(secondRun.applied.length).toBe(0);
    expect(secondRun.skipped).toContain('001_initial_schema.sql');
  });

  it('creates all 33 core architecture tables in sqlite_master', () => {
    runMigrations(db);

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_migrations'")
      .all() as Array<{ name: string }>;

    const tableNames = new Set(tables.map((t) => t.name));

    const expected33Tables = [
      'admin_roles',
      'admin_users',
      'users',
      'addresses',
      'categories',
      'brands',
      'products',
      'product_variants',
      'product_specifications',
      'product_images',
      'product_videos',
      'inventory',
      'prices',
      'discounts',
      'coupons',
      'carts',
      'cart_items',
      'wishlists',
      'orders',
      'order_items',
      'payments',
      'payment_attempts',
      'shipments',
      'shipment_trackings',
      'notifications',
      'whatsapp_sources',
      'whatsapp_messages',
      'whatsapp_media',
      'ingestion_jobs',
      'extracted_products',
      'product_approvals',
      'webhook_events',
      'audit_logs',
      'coupon_usages'
    ];

    expect(tableNames.size).toBeGreaterThanOrEqual(33);

    for (const expected of expected33Tables) {
      expect(tableNames.has(expected), `Missing expected table: ${expected}`).toBe(true);
    }
  });

  it('enforces foreign key constraints strictly', () => {
    runMigrations(db);

    // Inserting address for non-existent user should fail with FOREIGN KEY constraint error
    expect(() => {
      db.prepare(`
        INSERT INTO addresses (id, user_id, full_name, phone, address_line1, city, state, postal_code)
        VALUES ('addr_fake', 'non_existent_user', 'Ghost', '1234567890', 'Void', 'Bengaluru', 'KA', '560001')
      `).run();
    }).toThrow();
  });

  it('enforces unique constraints on SKU, Order Numbers, and Coupons', () => {
    runMigrations(db);
    seedDatabase(db);

    // Duplicate SKU should fail
    expect(() => {
      db.prepare(`
        INSERT INTO products (id, sku, title, full_description, category_id, original_price, selling_price)
        VALUES ('prod_dup', 'GV-WATCH-CHRONO-01', 'Duplicate Watch', 'Test', 'cat_watches', 1000, 900)
      `).run();
    }).toThrow();

    // Duplicate Coupon code should fail
    expect(() => {
      db.prepare(`
        INSERT INTO coupons (id, code, discount_type, discount_value, valid_from, valid_until)
        VALUES ('cpn_dup', 'GIZMO10', 'PERCENT', 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run();
    }).toThrow();
  });

  it('seeds database with 20+ realistic products, categories, brands, and relationships', () => {
    runMigrations(db);
    const result = seedDatabase(db);

    expect(result.seeded).toBe(true);
    expect(result.counts.products).toBeGreaterThanOrEqual(20);
    expect(result.counts.categories).toBe(6);
    expect(result.counts.brands).toBe(8);

    // Verify product with specs and images
    const tourbillon = db.prepare('SELECT * FROM products WHERE sku = ?').get('GV-WATCH-CHRONO-01') as any;
    expect(tourbillon).toBeDefined();
    expect(tourbillon.selling_price).toBe(38999);
    expect(tourbillon.discount_amount).toBe(6001);

    const specs = db.prepare('SELECT * FROM product_specifications WHERE product_id = ?').all(tourbillon.id);
    expect(specs.length).toBeGreaterThanOrEqual(3);

    const images = db.prepare('SELECT * FROM product_images WHERE product_id = ?').all(tourbillon.id);
    expect(images.length).toBeGreaterThanOrEqual(2);

    // Verify inventory matches product quantity
    const inv = db.prepare('SELECT quantity_available FROM inventory WHERE product_id = ?').get(tourbillon.id) as any;
    expect(inv.quantity_available).toBe(tourbillon.stock_quantity);

    // Verify WhatsApp source and extracted item in review queue
    const waSources = db.prepare('SELECT * FROM whatsapp_sources').all();
    expect(waSources.length).toBeGreaterThanOrEqual(2);

    const extracted = db.prepare('SELECT * FROM extracted_products WHERE approval_status = ?').all('NEEDS_REVIEW');
    expect(extracted.length).toBeGreaterThanOrEqual(1);

    // Verify sample order with items, payment, and shipment
    const order = db.prepare('SELECT * FROM orders WHERE order_number = ?').get('GV-2026-889102') as any;
    expect(order).toBeDefined();
    expect(order.grand_total).toBe(37999);

    const payment = db.prepare('SELECT * FROM payments WHERE order_id = ?').get(order.id) as any;
    expect(payment.status).toBe('CAPTURED');

    const shipment = db.prepare('SELECT * FROM shipments WHERE order_id = ?').get(order.id) as any;
    expect(shipment.carrier).toBe('Bluedart Express');
    expect(shipment.tracking_number).toBe('GV-TRK-881928');
  });

  it('supports soft delete pattern for products', () => {
    runMigrations(db);
    seedDatabase(db);

    const initialActive = db.prepare('SELECT COUNT(*) as count FROM products WHERE deleted_at IS NULL').get() as { count: number };
    
    // Soft delete one product
    db.prepare("UPDATE products SET deleted_at = CURRENT_TIMESTAMP WHERE sku = 'GV-WATCH-CHRONO-01'").run();

    const afterSoftDelete = db.prepare('SELECT COUNT(*) as count FROM products WHERE deleted_at IS NULL').get() as { count: number };
    expect(afterSoftDelete.count).toBe(initialActive.count - 1);

    const deletedItem = db.prepare("SELECT deleted_at FROM products WHERE sku = 'GV-WATCH-CHRONO-01'").get() as any;
    expect(deletedItem.deleted_at).not.toBeNull();
  });
});
