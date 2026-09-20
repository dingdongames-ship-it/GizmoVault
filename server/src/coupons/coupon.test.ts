import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { DatabaseSync } from 'node:sqlite';
import { runMigrations } from '../db/migrator.js';
import { seedDatabase } from '../db/seed.js';
import { CouponService } from './coupon.service.js';
import { createCouponRouter } from './routes.js';
import express from 'express';

describe('Phase 15: Dynamic Coupon Engine & Validation Rules', () => {
  let db: DatabaseSync;
  let couponService: CouponService;
  let app: express.Express;

  beforeEach(() => {
    db = new DatabaseSync(':memory:');
    runMigrations(db);
    seedDatabase(db);
    couponService = new CouponService(db);

    app = express();
    app.use(express.json());
    app.use('/api/v1/coupons', createCouponRouter(couponService));
  });

  afterEach(() => {
    db.close();
  });

  it('allows admin to create a percentage discount coupon with maximum discount cap', () => {
    const created = couponService.createCoupon({
      code: 'MEGA25',
      discountType: 'PERCENT',
      discountValue: 25,
      minOrderAmount: 4000,
      maxDiscountAmount: 2000,
      usageLimit: 500,
      perUserLimit: 1
    });

    expect(created.code).toBe('MEGA25');
    expect(created.discount_type).toBe('PERCENT');
    expect(created.discount_value).toBe(25);
    expect(created.max_discount_amount).toBe(2000);

    // Validate on ₹10,000 cart: 25% is 2500, capped at 2000
    const result = couponService.validateCoupon('MEGA25', [
      { productId: 'prod_watch_01', unitPrice: 10000, quantity: 1 }
    ]);
    expect(result.valid).toBe(true);
    expect(result.discountAmount).toBe(2000);
  });

  it('allows admin to create a fixed amount discount coupon with minimum order threshold', () => {
    const created = couponService.createCoupon({
      code: 'FLAT750',
      discountType: 'FLAT',
      discountValue: 750,
      minOrderAmount: 5000
    });

    expect(created.code).toBe('FLAT750');

    // Below minimum order: reject
    const belowMin = couponService.validateCoupon('FLAT750', [
      { productId: 'prod_watch_01', unitPrice: 3000, quantity: 1 }
    ]);
    expect(belowMin.valid).toBe(false);
    expect(belowMin.reason).toContain('Minimum order amount');

    // Above minimum order: apply flat ₹750
    const aboveMin = couponService.validateCoupon('FLAT750', [
      { productId: 'prod_watch_01', unitPrice: 6000, quantity: 1 }
    ]);
    expect(aboveMin.valid).toBe(true);
    expect(aboveMin.discountAmount).toBe(750);
  });

  it('enforces category-specific coupons: only items matching category receive discount', () => {
    couponService.createCoupon({
      code: 'WATCHONLY15',
      discountType: 'PERCENT',
      discountValue: 15,
      categoryId: 'cat_watches',
      minOrderAmount: 1000
    });

    // Cart with a watch (₹10,000) and a phone (₹50,000)
    const cart = [
      { productId: 'prod_watch_01', categoryId: 'cat_watches', unitPrice: 10000, quantity: 1 },
      { productId: 'prod_phone_01', categoryId: 'cat_phones', unitPrice: 50000, quantity: 1 }
    ];

    const result = couponService.validateCoupon('WATCHONLY15', cart);
    expect(result.valid).toBe(true);
    expect(result.eligibleSubtotal).toBe(10000); // Only watch item is eligible
    expect(result.discountAmount).toBe(1500); // 15% of 10000
  });

  it('enforces product-specific coupons: only specific product receives discount', () => {
    couponService.createCoupon({
      code: 'SPECIALPROD500',
      discountType: 'FLAT',
      discountValue: 500,
      productId: 'prod_watch_01',
      minOrderAmount: 1000
    });

    // Cart with different product
    const nonEligibleCart = [
      { productId: 'prod_phone_01', unitPrice: 50000, quantity: 1 }
    ];
    const invalidRes = couponService.validateCoupon('SPECIALPROD500', nonEligibleCart);
    expect(invalidRes.valid).toBe(false);
    expect(invalidRes.reason).toContain('eligible items');

    // Cart with eligible product
    const eligibleCart = [
      { productId: 'prod_watch_01', unitPrice: 38999, quantity: 1 }
    ];
    const validRes = couponService.validateCoupon('SPECIALPROD500', eligibleCart);
    expect(validRes.valid).toBe(true);
    expect(validRes.discountAmount).toBe(500);
  });

  it('enforces first-order coupon restriction for new vs existing customers', () => {
    couponService.createCoupon({
      code: 'FIRSTVAULT',
      discountType: 'PERCENT',
      discountValue: 15,
      isFirstOrderOnly: true,
      minOrderAmount: 1000
    });

    // New user with 0 past orders
    const newUserId = 'user_fresh_new';
    const newUserRes = couponService.validateCoupon('FIRSTVAULT', [
      { productId: 'prod_watch_01', unitPrice: 5000, quantity: 1 }
    ], newUserId);
    expect(newUserRes.valid).toBe(true);
    expect(newUserRes.discountAmount).toBe(750);

    // Existing user who already completed an order (user_demo_01 in seed)
    const existingUserId = 'user_demo_01';
    const existingUserRes = couponService.validateCoupon('FIRSTVAULT', [
      { productId: 'prod_watch_01', unitPrice: 5000, quantity: 1 }
    ], existingUserId);
    expect(existingUserRes.valid).toBe(false);
    expect(existingUserRes.reason).toContain('first-time customers');
  });

  it('rejects expired coupons or coupons scheduled for future dates', () => {
    // Expired coupon
    couponService.createCoupon({
      code: 'EXPIRED2025',
      discountType: 'FLAT',
      discountValue: 500,
      validFrom: '2025-01-01T00:00:00.000Z',
      validUntil: '2025-06-01T00:00:00.000Z'
    });

    const expiredRes = couponService.validateCoupon('EXPIRED2025', [
      { productId: 'prod_watch_01', unitPrice: 5000, quantity: 1 }
    ]);
    expect(expiredRes.valid).toBe(false);
    expect(expiredRes.reason).toContain('expired');
  });

  it('enforces per-user redemption limit', () => {
    const coupon = couponService.createCoupon({
      code: 'ONETIMEUSE',
      discountType: 'FLAT',
      discountValue: 200,
      perUserLimit: 1
    });

    const userId = 'user_demo_01';
    const cart = [{ productId: 'prod_watch_01', unitPrice: 3000, quantity: 1 }];

    // 1st attempt: valid
    const firstAttempt = couponService.validateCoupon('ONETIMEUSE', cart, userId);
    expect(firstAttempt.valid).toBe(true);

    // Record usage
    couponService.recordUsage(coupon.id, userId, 'ord_test_01', 200);

    // 2nd attempt: rejected because user already redeemed once
    const secondAttempt = couponService.validateCoupon('ONETIMEUSE', cart, userId);
    expect(secondAttempt.valid).toBe(false);
    expect(secondAttempt.reason).toContain('maximum allowed times');
  });

  it('allows admin to toggle coupon status', () => {
    const coupon = couponService.createCoupon({
      code: 'TOGGLETEST',
      discountType: 'FLAT',
      discountValue: 300,
      isActive: true
    });

    const cart = [{ productId: 'prod_watch_01', unitPrice: 3000, quantity: 1 }];

    // Deactivate coupon
    couponService.toggleCouponStatus(coupon.id, false);
    const resInactive = couponService.validateCoupon('TOGGLETEST', cart);
    expect(resInactive.valid).toBe(false);
    expect(resInactive.reason).toContain('inactive');

    // Reactivate coupon
    couponService.toggleCouponStatus(coupon.id, true);
    const resActive = couponService.validateCoupon('TOGGLETEST', cart);
    expect(resActive.valid).toBe(true);
  });

  it('exposes REST API endpoints for coupon validation and admin management', async () => {
    // 1. POST /api/v1/coupons/validate
    const valRes = await request(app)
      .post('/api/v1/coupons/validate')
      .send({
        code: 'GIZMO10',
        subtotal: 5000
      });
    expect(valRes.status).toBe(200);
    expect(valRes.body.data.valid).toBe(true);
    expect(valRes.body.data.discountAmount).toBe(500);

    // 2. GET /api/v1/coupons
    const listRes = await request(app).get('/api/v1/coupons');
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.length).toBeGreaterThan(0);

    // 3. POST /api/v1/coupons (Admin create)
    const createRes = await request(app)
      .post('/api/v1/coupons')
      .send({
        code: 'NEWAPI10',
        discountType: 'PERCENT',
        discountValue: 10,
        minOrderAmount: 2000
      });
    expect(createRes.status).toBe(201);
    expect(createRes.body.data.code).toBe('NEWAPI10');
  });
});
