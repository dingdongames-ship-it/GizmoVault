import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { DatabaseSync } from 'node:sqlite';
import { runMigrations } from '../db/migrator.js';
import { seedDatabase } from '../db/seed.js';
import { OrderService, OrderStatus } from './order.service.js';
import { createOrderRouter } from './routes.js';

/**
 * Phase 19: Order Lifecycle Management Tests
 *
 * Validates:
 * 1. generateOrderNumber returns GV-YEAR-NNNNNN format
 * 2. createOrder creates order + items linked to valid address
 * 3. createOrder throws if address doesn't belong to user
 * 4. getOrderById returns order with items
 * 5. transitionOrderStatus follows valid transitions (PENDING → PAID → PROCESSING...)
 * 6. transitionOrderStatus throws on invalid transition
 * 7. markOrderPaid updates order_status to PAID and payment_status to PAID
 * 8. cancelOrder transitions to CANCELLED
 * 9. getOrdersByUser returns only that user's orders
 * 10. getTrackingTimeline returns correct step states
 * 11. listAllOrders with status filter
 * 12. REST POST /orders creates order
 * 13. REST GET /orders lists user orders
 * 14. REST POST /orders/:id/confirm-payment sets paid status
 * 15. REST GET /orders/:id/tracking returns timeline
 */
describe('Phase 19 — Order Lifecycle Management', () => {
  let db: DatabaseSync;
  let orderService: OrderService;
  let app: express.Express;
  const TEST_USER = 'user_demo_01';
  let testAddressId: string;
  let testProductId: string;

  beforeEach(() => {
    db = new DatabaseSync(':memory:');
    runMigrations(db);
    seedDatabase(db);
    orderService = new OrderService(db);

    app = express();
    app.use(express.json());
    app.use('/api/v1/orders', createOrderRouter(orderService));

    // Get a real address for this test user
    const addr = db.prepare(
      `SELECT id FROM addresses WHERE user_id = ? LIMIT 1`
    ).get(TEST_USER) as { id: string } | undefined;

    if (!addr) {
      // Insert a test address
      const addrId = `addr_test_${Date.now()}`;
      db.prepare(`
        INSERT INTO addresses (id, user_id, full_name, phone, address_line1, city, state, postal_code, country, is_default, created_at, updated_at)
        VALUES (?, ?, 'Test User', '9876543210', '123 Test Street', 'Mumbai', 'Maharashtra', '400001', 'IN', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run(addrId, TEST_USER);
      testAddressId = addrId;
    } else {
      testAddressId = addr.id;
    }

    // Get a real product
    const product = db.prepare(
      `SELECT id FROM products WHERE is_published = 1 AND deleted_at IS NULL LIMIT 1`
    ).get() as { id: string } | undefined;
    testProductId = product?.id || 'prod_fallback';
  });

  afterEach(() => {
    db.close();
  });

  // ─── ORDER NUMBER ─────────────────────────────────────────────────
  it('generateOrderNumber returns GV-YEAR-NNNNNN format', () => {
    const num = orderService.generateOrderNumber();
    expect(num).toMatch(/^GV-\d{4}-\d{6}$/);
    const year = new Date().getFullYear().toString();
    expect(num).toContain(`GV-${year}-`);
  });

  // ─── ORDER CREATION ───────────────────────────────────────────────
  it('createOrder creates an order with items linked to valid user address', () => {
    const order = orderService.createOrder({
      userId: TEST_USER,
      addressId: testAddressId,
      items: [{
        productId: testProductId,
        quantity: 2,
        unitPrice: 1499,
        totalPrice: 2998,
        titleSnapshot: 'Test Product',
        skuSnapshot: 'SKU-001'
      }],
      subtotal: 2998,
      discountTotal: 0,
      shippingFee: 0,
      taxAmount: 0,
      grandTotal: 2998,
      currency: 'INR',
      shippingAddressSnapshot: JSON.stringify({ city: 'Mumbai', postalCode: '400001' })
    });

    expect(order.id).toBeDefined();
    expect(order.order_number).toMatch(/^GV-\d{4}-\d{6}$/);
    expect(order.order_status).toBe('PAYMENT_PENDING');
    expect(order.payment_status).toBe('PENDING');
    expect(order.items).toHaveLength(1);
    expect(order.items[0].quantity).toBe(2);
    expect(order.items[0].total_price).toBe(2998);
  });

  it('createOrder throws if address does not belong to the user', () => {
    expect(() => orderService.createOrder({
      userId: 'user_NONEXISTENT',
      addressId: testAddressId,
      items: [{ productId: testProductId, quantity: 1, unitPrice: 999, totalPrice: 999, titleSnapshot: 'T', skuSnapshot: 'S' }],
      subtotal: 999, grandTotal: 999, currency: 'INR',
      shippingAddressSnapshot: '{}'
    })).toThrow('not found or does not belong to user');
  });

  // ─── ORDER RETRIEVAL ──────────────────────────────────────────────
  it('getOrderById returns order with items', () => {
    const created = orderService.createOrder({
      userId: TEST_USER, addressId: testAddressId,
      items: [{ productId: testProductId, quantity: 1, unitPrice: 5000, totalPrice: 5000, titleSnapshot: 'Watch', skuSnapshot: 'WCH-001' }],
      subtotal: 5000, grandTotal: 5000, currency: 'INR', shippingAddressSnapshot: '{}'
    });

    const found = orderService.getOrderById(created.id);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(created.id);
    expect(found!.items).toHaveLength(1);
  });

  // ─── STATUS LIFECYCLE ─────────────────────────────────────────────
  it('valid status transition: PAYMENT_PENDING → PAID → PROCESSING → PACKED → SHIPPED', () => {
    const order = orderService.createOrder({
      userId: TEST_USER, addressId: testAddressId,
      items: [{ productId: testProductId, quantity: 1, unitPrice: 3000, totalPrice: 3000, titleSnapshot: 'G', skuSnapshot: 'G-001' }],
      subtotal: 3000, grandTotal: 3000, currency: 'INR', shippingAddressSnapshot: '{}'
    });

    let current = orderService.transitionOrderStatus(order.id, 'PAID');
    expect(current.order_status).toBe('PAID');

    current = orderService.transitionOrderStatus(order.id, 'PROCESSING');
    expect(current.order_status).toBe('PROCESSING');

    current = orderService.transitionOrderStatus(order.id, 'PACKED');
    expect(current.order_status).toBe('PACKED');

    current = orderService.transitionOrderStatus(order.id, 'SHIPPED');
    expect(current.order_status).toBe('SHIPPED');
  });

  it('invalid status transition throws an error', () => {
    const order = orderService.createOrder({
      userId: TEST_USER, addressId: testAddressId,
      items: [{ productId: testProductId, quantity: 1, unitPrice: 2000, totalPrice: 2000, titleSnapshot: 'X', skuSnapshot: 'X-001' }],
      subtotal: 2000, grandTotal: 2000, currency: 'INR', shippingAddressSnapshot: '{}'
    });

    // Cannot go PAYMENT_PENDING → DELIVERED (skipping states)
    expect(() => orderService.transitionOrderStatus(order.id, 'DELIVERED')).toThrow('Invalid status transition');
  });

  it('markOrderPaid sets order_status=PAID and payment_status=PAID', () => {
    const order = orderService.createOrder({
      userId: TEST_USER, addressId: testAddressId,
      items: [{ productId: testProductId, quantity: 1, unitPrice: 1000, totalPrice: 1000, titleSnapshot: 'P', skuSnapshot: 'P-001' }],
      subtotal: 1000, grandTotal: 1000, currency: 'INR', shippingAddressSnapshot: '{}'
    });

    const paid = orderService.markOrderPaid(order.id, 'upi');
    expect(paid.order_status).toBe('PAID');
    expect(paid.payment_status).toBe('PAID');
  });

  it('cancelOrder transitions PAYMENT_PENDING order to CANCELLED', () => {
    const order = orderService.createOrder({
      userId: TEST_USER, addressId: testAddressId,
      items: [{ productId: testProductId, quantity: 1, unitPrice: 750, totalPrice: 750, titleSnapshot: 'C', skuSnapshot: 'C-001' }],
      subtotal: 750, grandTotal: 750, currency: 'INR', shippingAddressSnapshot: '{}'
    });

    const cancelled = orderService.cancelOrder(order.id, TEST_USER);
    expect(cancelled.order_status).toBe('CANCELLED');
  });

  // ─── USER ORDERS ──────────────────────────────────────────────────
  it('getOrdersByUser returns only that specific user\'s orders', () => {
    orderService.createOrder({
      userId: TEST_USER, addressId: testAddressId,
      items: [{ productId: testProductId, quantity: 1, unitPrice: 500, totalPrice: 500, titleSnapshot: 'A', skuSnapshot: 'A-001' }],
      subtotal: 500, grandTotal: 500, currency: 'INR', shippingAddressSnapshot: '{}'
    });

    const orders = orderService.getOrdersByUser(TEST_USER);
    expect(orders.length).toBeGreaterThanOrEqual(1);
    orders.forEach(o => expect(o.user_id).toBe(TEST_USER));
  });

  // ─── TRACKING TIMELINE ────────────────────────────────────────────
  it('getTrackingTimeline returns 7-step journey with correct isCurrent flag', () => {
    const order = orderService.createOrder({
      userId: TEST_USER, addressId: testAddressId,
      items: [{ productId: testProductId, quantity: 1, unitPrice: 2500, totalPrice: 2500, titleSnapshot: 'Track', skuSnapshot: 'T-001' }],
      subtotal: 2500, grandTotal: 2500, currency: 'INR', shippingAddressSnapshot: '{}'
    });

    const timeline = orderService.getTrackingTimeline(order.id);
    expect(timeline).toHaveLength(7);
    const currentStep = timeline.find(t => t.isCurrent);
    expect(currentStep?.status).toBe('PAYMENT_PENDING');
  });

  // ─── REST API ─────────────────────────────────────────────────────
  it('POST /api/v1/orders creates an order and returns 201', async () => {
    const res = await request(app)
      .post('/api/v1/orders')
      .set('x-user-id', TEST_USER)
      .send({
        addressId: testAddressId,
        items: [{ productId: testProductId, quantity: 1, unitPrice: 1999, totalPrice: 1999, titleSnapshot: 'REST Product', skuSnapshot: 'REST-001' }],
        subtotal: 1999, grandTotal: 1999, currency: 'INR',
        shippingAddressSnapshot: JSON.stringify({ city: 'Delhi' })
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.order_number).toMatch(/^GV-\d{4}-\d{6}$/);
    expect(res.body.data.order_status).toBe('PAYMENT_PENDING');
  });

  it('GET /api/v1/orders lists orders for the user', async () => {
    // Create one first
    orderService.createOrder({
      userId: TEST_USER, addressId: testAddressId,
      items: [{ productId: testProductId, quantity: 1, unitPrice: 800, totalPrice: 800, titleSnapshot: 'List', skuSnapshot: 'L-001' }],
      subtotal: 800, grandTotal: 800, currency: 'INR', shippingAddressSnapshot: '{}'
    });

    const res = await request(app)
      .get('/api/v1/orders')
      .set('x-user-id', TEST_USER)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.count).toBeGreaterThanOrEqual(1);
  });

  it('POST /api/v1/orders/:id/confirm-payment marks order as PAID', async () => {
    const order = orderService.createOrder({
      userId: TEST_USER, addressId: testAddressId,
      items: [{ productId: testProductId, quantity: 1, unitPrice: 3500, totalPrice: 3500, titleSnapshot: 'Pay', skuSnapshot: 'PAY-001' }],
      subtotal: 3500, grandTotal: 3500, currency: 'INR', shippingAddressSnapshot: '{}'
    });

    const res = await request(app)
      .post(`/api/v1/orders/${order.id}/confirm-payment`)
      .send({ paymentMethod: 'upi' })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.order_status).toBe('PAID');
  });

  it('GET /api/v1/orders/:id/tracking returns 7-step timeline', async () => {
    const order = orderService.createOrder({
      userId: TEST_USER, addressId: testAddressId,
      items: [{ productId: testProductId, quantity: 1, unitPrice: 1200, totalPrice: 1200, titleSnapshot: 'Trk', skuSnapshot: 'TRK-001' }],
      subtotal: 1200, grandTotal: 1200, currency: 'INR', shippingAddressSnapshot: '{}'
    });

    const res = await request(app)
      .get(`/api/v1/orders/${order.id}/tracking`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(7);
    const current = res.body.data.find((t: any) => t.isCurrent);
    expect(current.status).toBe('PAYMENT_PENDING');
  });
});
