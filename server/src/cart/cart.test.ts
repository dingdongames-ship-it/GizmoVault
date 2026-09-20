import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { DatabaseSync } from 'node:sqlite';
import { runMigrations } from '../db/migrator.js';
import { seedDatabase } from '../db/seed.js';
import { CartService } from './cart.service.js';
import { createCartRouter } from './routes.js';
import express from 'express';

describe('Phase 14: Server-Validated Shopping Cart Architecture', () => {
  let db: DatabaseSync;
  let cartService: CartService;
  let app: express.Express;

  beforeEach(() => {
    db = new DatabaseSync(':memory:');
    runMigrations(db);
    seedDatabase(db);
    cartService = new CartService(db);

    app = express();
    app.use(express.json());
    app.use('/api/v1/cart', createCartRouter(cartService));
  });

  afterEach(() => {
    db.close();
  });

  it('creates or reuses a cart by session id', () => {
    const sessionId = 'sess_test_12345';
    const cartId1 = cartService.getOrCreateCart(undefined, sessionId);
    expect(cartId1).toMatch(/^crt_/);

    const cartId2 = cartService.getOrCreateCart(undefined, sessionId);
    expect(cartId2).toBe(cartId1);
  });

  it('supports single product addition with correct price and grand total', () => {
    const cartId = cartService.getOrCreateCart(undefined, 'sess_single_prod');
    // Add 1 watch item (prod_watch_01: selling price 38999, original 45000)
    const cart = cartService.addItem(cartId, 'prod_watch_01', 1);

    expect(cart.items.length).toBe(1);
    expect(cart.totalItemCount).toBe(1);
    expect(cart.subtotal).toBe(38999);
    expect(cart.shippingFee).toBe(0); // Free because >= 999
    expect(cart.grandTotal).toBe(38999);
    expect(cart.canProceedToCheckout).toBe(true);
  });

  it('supports multiple products with distinct line totals and product discounts', () => {
    const cartId = cartService.getOrCreateCart(undefined, 'sess_multi_prod');
    // Add prod_watch_01 (38,999) + prod_phone_01 (129,999)
    cartService.addItem(cartId, 'prod_watch_01', 1);
    const cart = cartService.addItem(cartId, 'prod_phone_01', 1);

    expect(cart.items.length).toBe(2);
    expect(cart.totalItemCount).toBe(2);
    expect(cart.subtotal).toBe(38999 + 129999);
    expect(cart.productDiscountTotal).toBeGreaterThan(0);
    expect(cart.grandTotal).toBe(38999 + 129999);
  });

  it('handles quantity adjustments and enforces strict stock limits', () => {
    const cartId = cartService.getOrCreateCart(undefined, 'sess_qty_test');
    cartService.addItem(cartId, 'prod_watch_01', 1);

    // Increase to 2
    const updated = cartService.updateQuantity(cartId, 'prod_watch_01', 2);
    expect(updated.items[0].quantity).toBe(2);
    expect(updated.subtotal).toBe(38999 * 2);

    // Attempting to exceed product stock_quantity (prod_watch_01 has 14 in seed)
    expect(() => {
      cartService.updateQuantity(cartId, 'prod_watch_01', 999);
    }).toThrow(/available/);

    // Reducing to 0 removes the item
    const emptyCart = cartService.updateQuantity(cartId, 'prod_watch_01', 0);
    expect(emptyCart.items.length).toBe(0);
    expect(emptyCart.subtotal).toBe(0);
  });

  it('supports item removal', () => {
    const cartId = cartService.getOrCreateCart(undefined, 'sess_remove_test');
    cartService.addItem(cartId, 'prod_watch_01', 1);
    cartService.addItem(cartId, 'prod_phone_01', 1);

    const afterRemove = cartService.removeItem(cartId, 'prod_watch_01');
    expect(afterRemove.items.length).toBe(1);
    expect(afterRemove.items[0].productId).toBe('prod_phone_01');
    expect(afterRemove.subtotal).toBe(129999);
  });

  it('supports Save For Later and Move to Cart workflow', () => {
    const cartId = cartService.getOrCreateCart(undefined, 'sess_save_later');
    cartService.addItem(cartId, 'prod_watch_01', 1);
    cartService.addItem(cartId, 'prod_phone_01', 1);

    // Save prod_watch_01 for later
    const afterSave = cartService.saveForLater(cartId, 'prod_watch_01');
    expect(afterSave.items.length).toBe(1);
    expect(afterSave.savedForLaterItems.length).toBe(1);
    expect(afterSave.savedForLaterItems[0].productId).toBe('prod_watch_01');
    // Saved items must not be included in active subtotal
    expect(afterSave.subtotal).toBe(129999);

    // Move back to cart
    const afterMove = cartService.moveToCart(cartId, 'prod_watch_01');
    expect(afterMove.items.length).toBe(2);
    expect(afterMove.savedForLaterItems.length).toBe(0);
    expect(afterMove.subtotal).toBe(129999 + 38999);
  });

  it('validates coupons: percentage with cap, flat discount, and min order constraints', () => {
    const cartId = cartService.getOrCreateCart(undefined, 'sess_coupon_test');
    cartService.addItem(cartId, 'prod_watch_01', 1); // Subtotal = 38,999

    // GIZMO10: 10% discount, max ₹1,000
    const withGizmo10 = cartService.getCartDetails(cartId, 'GIZMO10');
    expect(withGizmo10.coupon?.valid).toBe(true);
    expect(withGizmo10.couponDiscountTotal).toBe(1000); // capped at 1000
    expect(withGizmo10.grandTotal).toBe(38999 - 1000);

    // GIZMO500: Flat ₹500 on >= ₹3000
    const withGizmo500 = cartService.getCartDetails(cartId, 'GIZMO500');
    expect(withGizmo500.coupon?.valid).toBe(true);
    expect(withGizmo500.couponDiscountTotal).toBe(500);
    expect(withGizmo500.grandTotal).toBe(38999 - 500);

    // WATCH50: 20% on >= 20,000, max ₹5,000
    const withWatch50 = cartService.getCartDetails(cartId, 'WATCH50');
    expect(withWatch50.coupon?.valid).toBe(true);
    expect(withWatch50.couponDiscountTotal).toBe(5000); // 20% of 38999 is 7799.8, capped at 5000

    // Minimum order threshold failure test with WELCOME100 (min 500) on empty cart
    const emptyCartId = cartService.getOrCreateCart(undefined, 'sess_empty_coupon');
    const invalidMinOrder = cartService.getCartDetails(emptyCartId, 'WELCOME100');
    expect(invalidMinOrder.coupon?.valid).toBe(false);
  });

  it('enforces pre-checkout revalidation gate verifying availability, live price, stock, and pincode', () => {
    const cartId = cartService.getOrCreateCart(undefined, 'sess_checkout_val');
    cartService.addItem(cartId, 'prod_watch_01', 1);

    // Valid check
    const validCheck = cartService.validateBeforeCheckout(cartId, 'GIZMO10', '560001');
    expect(validCheck.canProceed).toBe(true);
    expect(validCheck.errors.length).toBe(0);

    // Invalid PIN code check
    const invalidPinCheck = cartService.validateBeforeCheckout(cartId, 'GIZMO10', 'INVALID_PIN');
    expect(invalidPinCheck.canProceed).toBe(false);
    expect(invalidPinCheck.errors.some(e => e.includes('PIN code'))).toBe(true);

    // Simulated out-of-stock check: set stock to 0 in database
    db.prepare('UPDATE products SET stock_quantity = 0 WHERE id = ?').run('prod_watch_01');
    const oosCheck = cartService.validateBeforeCheckout(cartId, undefined, '560001');
    expect(oosCheck.canProceed).toBe(false);
    expect(oosCheck.errors.some(e => e.includes('out of stock'))).toBe(true);
  });

  it('exposes full REST API endpoints for client cart synchronization', async () => {
    // 1. GET /api/v1/cart
    const getRes = await request(app)
      .get('/api/v1/cart')
      .set('x-session-id', 'api_sess_01');
    expect(getRes.status).toBe(200);
    expect(getRes.body.success).toBe(true);
    const cartId = getRes.body.data.cartId;

    // 2. POST /api/v1/cart/items
    const addRes = await request(app)
      .post('/api/v1/cart/items')
      .set('x-cart-id', cartId)
      .send({ productId: 'prod_watch_01', quantity: 1 });
    expect(addRes.status).toBe(201);
    expect(addRes.body.data.items.length).toBe(1);

    // 3. PATCH /api/v1/cart/items/:productId
    const patchRes = await request(app)
      .patch('/api/v1/cart/items/prod_watch_01')
      .set('x-cart-id', cartId)
      .send({ quantity: 2 });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.items[0].quantity).toBe(2);

    // 4. POST /api/v1/cart/items/:productId/save-later
    const saveLaterRes = await request(app)
      .post('/api/v1/cart/items/prod_watch_01/save-later')
      .set('x-cart-id', cartId);
    expect(saveLaterRes.status).toBe(200);
    expect(saveLaterRes.body.data.items.length).toBe(0);
    expect(saveLaterRes.body.data.savedForLaterItems.length).toBe(1);

    // 5. POST /api/v1/cart/items/:productId/move-to-cart
    const moveRes = await request(app)
      .post('/api/v1/cart/items/prod_watch_01/move-to-cart')
      .set('x-cart-id', cartId);
    expect(moveRes.status).toBe(200);
    expect(moveRes.body.data.items.length).toBe(1);

    // 6. POST /api/v1/cart/validate
    const validateRes = await request(app)
      .post('/api/v1/cart/validate')
      .set('x-cart-id', cartId)
      .send({ couponCode: 'GIZMO10', shippingPincode: '400001' });
    expect(validateRes.status).toBe(200);
    expect(validateRes.body.data.canProceed).toBe(true);
  });
});
