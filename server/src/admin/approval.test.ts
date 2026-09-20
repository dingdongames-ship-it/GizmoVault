import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { DatabaseSync } from 'node:sqlite';
import { initializeDatabase, getDb } from '../db/index.js';
import { AdminApprovalService } from './approval.service.js';
import { ProductRepository } from '../models/product.model.js';
import { app } from '../index.js';

describe('Phase 9: Admin Approval System & Catalog Moderation Workflow', () => {
  let db: DatabaseSync;
  let service: AdminApprovalService;
  let productRepo: ProductRepository;

  beforeEach(() => {
    initializeDatabase();
    db = getDb();
    service = new AdminApprovalService(db);
    productRepo = new ProductRepository(db);

    // Clean up test extracted products and approvals
    db.prepare("DELETE FROM product_approvals WHERE admin_user_id = 'admin_001'").run();
    db.prepare("DELETE FROM extracted_products WHERE id LIKE 'test_ext_%'").run();

    // Ensure dummy WhatsApp message exists for foreign key
    db.prepare(`
      INSERT OR IGNORE INTO whatsapp_messages (id, source_id, meta_message_id, sender_phone, message_type, raw_text)
      VALUES ('msg_test_appr_01', 'src_wa_sim', 'wamid.HBgLTEST999', '+919876543210', 'text', 'Vendor test broadcast for approval')
    `).run();
  });

  describe('Queue Retrieval & Metrics', () => {
    it('returns queue items with parsed specs, media, and accurate status counts', () => {
      // 1. Insert mock extracted items
      db.prepare(`
        INSERT INTO extracted_products (
          id, message_id, extracted_title, suggested_category_id, extracted_brand,
          extracted_original_price, extracted_selling_price, extracted_discount,
          extracted_specs, media_urls, confidence_score, approval_status
        ) VALUES 
        (
          'test_ext_01', 'msg_test_appr_01', 'CyberDeck Mechanical Cybernetic Keyboard', 'cat_gaming',
          'CyberTech', 14999, 11999, 20,
          ?, ?, 0.88, 'NEEDS_REVIEW'
        ),
        (
          'test_ext_02', 'msg_test_appr_01', 'AeroDrone Falcon 4K GPS Drone', 'cat_drones',
          'AeroFlight', 45000, 39999, 11,
          ?, ?, 0.92, 'EXTRACTED'
        )
      `).run(
        JSON.stringify([{ spec_key: 'Switches', spec_value: 'Hot-swappable Gateron Yellow' }]),
        JSON.stringify(['https://cdn.gizmovault.com/cyberdeck-1.webp']),
        JSON.stringify([{ spec_key: 'Range', spec_value: '5km' }]),
        JSON.stringify(['https://cdn.gizmovault.com/drone-1.webp'])
      );

      const queue = service.getQueue({ status: 'ALL' });
      expect(queue.total).toBeGreaterThanOrEqual(2);

      const cyberItem = queue.items.find((i) => i.id === 'test_ext_01');
      expect(cyberItem).toBeDefined();
      expect(cyberItem?.parsed_specs?.length).toBe(1);
      expect(cyberItem?.parsed_specs?.[0].spec_key).toBe('Switches');
      expect(cyberItem?.parsed_media?.length).toBe(1);

      const stats = service.getQueueStats();
      expect(stats.needsReview).toBeGreaterThanOrEqual(1);
      expect(stats.extracted).toBeGreaterThanOrEqual(1);
      expect(stats.total).toBeGreaterThanOrEqual(2);
    });

    it('filters queue by status, category, and search keyword', () => {
      db.prepare(`
        INSERT INTO extracted_products (
          id, message_id, extracted_title, suggested_category_id, extracted_brand,
          extracted_original_price, extracted_selling_price, confidence_score, approval_status
        ) VALUES 
        ('test_ext_search_1', 'msg_test_appr_01', 'Quantum Watch Swiss Gold Edition', 'cat_watches', 'Quantum', 85000, 72000, 0.90, 'NEEDS_REVIEW'),
        ('test_ext_search_2', 'msg_test_appr_01', 'PixelBuds ANC Wireless Earbuds', 'cat_audio', 'SoundWave', 9999, 6999, 0.85, 'VALIDATION')
      `).run();

      const watchSearch = service.getQueue({ search: 'Quantum' });
      expect(watchSearch.items.some((i) => i.id === 'test_ext_search_1')).toBe(true);
      expect(watchSearch.items.some((i) => i.id === 'test_ext_search_2')).toBe(false);

      const statusFilter = service.getQueue({ status: 'VALIDATION' });
      expect(statusFilter.items.some((i) => i.id === 'test_ext_search_2')).toBe(true);
      expect(statusFilter.items.some((i) => i.id === 'test_ext_search_1')).toBe(false);
    });
  });

  describe('Attribute Editing & Workflow Transitions', () => {
    it('allows admin to edit product title, pricing, specs and recalculates discount', () => {
      db.prepare(`
        INSERT INTO extracted_products (
          id, message_id, extracted_title, suggested_category_id, extracted_brand,
          extracted_original_price, extracted_selling_price, extracted_discount,
          confidence_score, approval_status
        ) VALUES ('test_ext_edit_01', 'msg_test_appr_01', 'Rough Ingested Name', 'cat_phones', 'VortexTech', 100000, 90000, 10, 0.65, 'NEEDS_REVIEW')
      `).run();

      const updated = service.editExtractedProduct(
        'test_ext_edit_01',
        {
          title: 'Polished Vortex Prime 5G (8GB/256GB)',
          original_price: 100000,
          selling_price: 75000, // 25% discount
          specifications: [{ spec_key: 'RAM', spec_value: '8GB LPDDR5X' }],
          notes: 'Standardized name and adjusted discount'
        },
        'admin_001'
      );

      expect(updated.extracted_title).toBe('Polished Vortex Prime 5G (8GB/256GB)');
      expect(updated.extracted_selling_price).toBe(75000);
      expect(updated.extracted_discount).toBe(25);
      expect(updated.parsed_specs?.length).toBe(1);

      // Verify audit logged
      const approvals = db.prepare("SELECT * FROM product_approvals WHERE extracted_product_id = 'test_ext_edit_01'").all() as any[];
      expect(approvals.length).toBe(1);
      expect(approvals[0].action).toBe('EDIT');
    });

    it('enforces valid workflow state transitions and rejects illegal jumps', () => {
      db.prepare(`
        INSERT INTO extracted_products (
          id, message_id, extracted_title, suggested_category_id, confidence_score, approval_status
        ) VALUES ('test_ext_flow_01', 'msg_test_appr_01', 'Workflow Candidate', 'cat_phones', 0.80, 'NEW')
      `).run();

      // NEW -> PROCESSING: valid
      const s1 = service.transitionStatus('test_ext_flow_01', 'PROCESSING', 'admin_001');
      expect(s1.approval_status).toBe('PROCESSING');

      // PROCESSING -> EXTRACTED: valid
      const s2 = service.transitionStatus('test_ext_flow_01', 'EXTRACTED', 'admin_001');
      expect(s2.approval_status).toBe('EXTRACTED');

      // EXTRACTED -> PUBLISHED directly: invalid jump
      expect(() => {
        service.transitionStatus('test_ext_flow_01', 'PUBLISHED', 'admin_001');
      }).toThrow(/Invalid status transition/);
    });
  });

  describe('Approve, Publish & Reject Workflow', () => {
    it('approves candidate, generates SKU, and inserts product into live catalog', () => {
      db.prepare(`
        INSERT INTO extracted_products (
          id, message_id, extracted_title, extracted_description, suggested_category_id,
          extracted_brand, extracted_model, extracted_original_price, extracted_selling_price,
          extracted_specs, media_urls, confidence_score, approval_status
        ) VALUES (
          'test_ext_appr_01', 'msg_test_appr_01',
          'Monaco Grand Prix Limited Skeleton Chronograph',
          'Swiss high-precision imported mechanical watch.',
          'cat_watches', 'ChronoMaster', 'CM-MONACO-01',
          125000, 99999,
          ?, ?, 0.94, 'NEEDS_REVIEW'
        )
      `).run(
        JSON.stringify([
          { spec_key: 'Movement', spec_value: 'Swiss ETA 2824 Automatic' },
          { spec_key: 'Case', spec_value: '316L Stainless Steel' }
        ]),
        JSON.stringify(['https://cdn.gizmovault.com/monaco-main.webp', 'https://cdn.gizmovault.com/monaco-back.webp'])
      );

      const result = service.approveAndPublish('test_ext_appr_01', 'admin_001', {
        stock_quantity: 15,
        is_featured: true,
        warranty_info: '2 Years International Manufacturer Warranty'
      });

      // 1. Extracted product is now PUBLISHED
      expect(result.extractedProduct.approval_status).toBe('PUBLISHED');

      // 2. Live product was created
      const prod = result.publishedProduct;
      expect(prod.id).toBeDefined();
      expect(prod.sku).toMatch(/^GV-CATWATCH-CHRONOMA-\d{4}$/);
      expect(prod.selling_price).toBe(99999);
      expect(prod.original_price).toBe(125000);
      expect(prod.stock_quantity).toBe(15);
      expect(prod.stock_status).toBe('IN_STOCK');
      expect(prod.is_featured).toBe(true);

      // 3. Check specs and images were persisted
      const specs = db.prepare('SELECT * FROM product_specifications WHERE product_id = ?').all(prod.id) as any[];
      expect(specs.length).toBe(2);

      const images = db.prepare('SELECT * FROM product_images WHERE product_id = ?').all(prod.id) as any[];
      expect(images.length).toBe(2);
      expect(images[0].is_primary).toBe(1);

      // 4. Check inventory row was created
      const inv = db.prepare('SELECT * FROM inventory WHERE product_id = ?').get(prod.id) as any;
      expect(inv).toBeDefined();
      expect(inv.quantity_available).toBe(15);

      // 5. Check product_approvals audit record
      const audit = db.prepare("SELECT * FROM product_approvals WHERE extracted_product_id = ? AND action IN ('APPROVE', 'EDIT_AND_APPROVE')").get('test_ext_appr_01') as any;
      expect(audit).toBeDefined();
      expect(audit.resulting_product_id).toBe(prod.id);
    });

    it('rejects candidate and records admin rejection reason', () => {
      db.prepare(`
        INSERT INTO extracted_products (
          id, message_id, extracted_title, suggested_category_id, confidence_score, approval_status
        ) VALUES ('test_ext_rej_01', 'msg_test_appr_01', 'Counterfeit Luxury Replica', 'cat_watches', 0.25, 'NEEDS_REVIEW')
      `).run();

      const rejected = service.rejectProduct('test_ext_rej_01', 'admin_001', 'Counterfeit replica detected; violates brand guidelines.');
      expect(rejected.approval_status).toBe('REJECTED');

      const audit = db.prepare("SELECT * FROM product_approvals WHERE extracted_product_id = 'test_ext_rej_01'").get() as any;
      expect(audit.action).toBe('REJECT');
      expect(audit.modification_notes).toContain('Counterfeit replica');
    });

    it('merges candidate with existing product and increments inventory', () => {
      // Existing seed watch: prod_watch_01
      const beforeWatch = productRepo.findById('prod_watch_01')!;
      const initialStock = beforeWatch.stock_quantity;

      db.prepare(`
        INSERT INTO extracted_products (
          id, message_id, extracted_title, extracted_selling_price, suggested_category_id, confidence_score, approval_status
        ) VALUES ('test_ext_merge_01', 'msg_test_appr_01', 'ChronoMaster Duplicate Listing', 89000, 'cat_watches', 0.95, 'NEEDS_REVIEW')
      `).run();

      const mergeResult = service.mergeWithExisting('test_ext_merge_01', 'prod_watch_01', 'admin_001', {
        addStock: 5,
        updatePrice: true
      });

      expect(mergeResult.extractedProduct.approval_status).toBe('PUBLISHED');
      expect(mergeResult.extractedProduct.duplicate_of_product_id).toBe('prod_watch_01');
      expect(mergeResult.targetProduct.stock_quantity).toBe(initialStock + 5);

      const afterWatch = productRepo.findById('prod_watch_01')!;
      expect(afterWatch.stock_quantity).toBe(initialStock + 5);
    });
  });

  describe('Bulk Operations', () => {
    it('supports bulk approve and bulk reject across multiple items', () => {
      db.prepare(`
        INSERT INTO extracted_products (
          id, message_id, extracted_title, suggested_category_id, extracted_original_price, extracted_selling_price, approval_status
        ) VALUES 
        ('test_bulk_1', 'msg_test_appr_01', 'Item 1 Bulk', 'cat_phones', 1000, 800, 'NEEDS_REVIEW'),
        ('test_bulk_2', 'msg_test_appr_01', 'Item 2 Bulk', 'cat_phones', 2000, 1600, 'NEEDS_REVIEW'),
        ('test_bulk_3', 'msg_test_appr_01', 'Item 3 Bulk', 'cat_phones', 3000, 2400, 'NEEDS_REVIEW')
      `).run();

      // Bulk approve first two
      const apprRes = service.bulkApprove(['test_bulk_1', 'test_bulk_2'], 'admin_001');
      expect(apprRes.successful.length).toBe(2);
      expect(apprRes.failed.length).toBe(0);

      // Bulk reject third
      const rejRes = service.bulkReject(['test_bulk_3'], 'admin_001', 'Bulk clean up');
      expect(rejRes.successful.length).toBe(1);

      const item3 = service.getExtractedProduct('test_bulk_3');
      expect(item3?.approval_status).toBe('REJECTED');
    });
  });

  describe('REST API Endpoints Integration', () => {
    it('GET /api/v1/admin/approvals/queue returns 200 and paginated queue', async () => {
      const res = await request(app).get('/api/v1/admin/approvals/queue?limit=5');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.items)).toBe(true);
    });

    it('GET /api/v1/admin/approvals/stats returns 200 with queue metrics', async () => {
      const res = await request(app).get('/api/v1/admin/approvals/stats');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.stats).toHaveProperty('total');
      expect(res.body.stats).toHaveProperty('needsReview');
    });

    it('POST /api/v1/admin/approvals/:id/approve publishes item via HTTP API', async () => {
      db.prepare(`
        INSERT INTO extracted_products (
          id, message_id, extracted_title, suggested_category_id, extracted_original_price, extracted_selling_price, approval_status
        ) VALUES ('test_api_appr_01', 'msg_test_appr_01', 'API Test Product Drone', 'cat_drones', 25000, 19999, 'NEEDS_REVIEW')
      `).run();

      const res = await request(app)
        .post('/api/v1/admin/approvals/test_api_appr_01/approve')
        .send({
          overrides: {
            stock_quantity: 8,
            notes: 'Approved via Admin API'
          }
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.publishedProduct).toBeDefined();
      expect(res.body.publishedProduct.sku).toMatch(/^GV-CATDRONE/);
      expect(res.body.publishedProduct.stock_quantity).toBe(8);
    });

    it('POST /api/v1/admin/approvals/bulk-reject rejects items via API', async () => {
      db.prepare(`
        INSERT INTO extracted_products (
          id, message_id, extracted_title, suggested_category_id, approval_status
        ) VALUES ('test_api_rej_01', 'msg_test_appr_01', 'Spam Product', 'cat_phones', 'NEEDS_REVIEW')
      `).run();

      const res = await request(app)
        .post('/api/v1/admin/approvals/bulk-reject')
        .send({
          ids: ['test_api_rej_01'],
          reason: 'Spam listing rejected'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.successful).toContain('test_api_rej_01');
    });
  });
});
