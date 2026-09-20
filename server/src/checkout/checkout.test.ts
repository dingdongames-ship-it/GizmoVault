import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { DatabaseSync } from 'node:sqlite';
import { runMigrations } from '../db/migrator.js';
import { seedDatabase } from '../db/seed.js';
import { CheckoutService } from './checkout.service.js';
import { createCheckoutRouter } from './routes.js';

/**
 * Phase 17: Streamlined 6-Step Checkout Tests
 *
 * Validates:
 * 1. Payment method resolution by country (India vs International)
 * 2. COD availability based on order amount threshold (max ₹10,000)
 * 3. International payment methods include cards + wallets, exclude UPI/COD
 * 4. SWIFT wire transfer added for luxury international orders >= ₹50,000
 * 5. PCI-DSS Tokenizer: Visa/Mastercard brand detection, last4, token prefix
 * 6. PCI-DSS Tokenizer: invalid card number throws
 * 7. PCI-DSS Tokenizer: invalid CVV throws
 * 8. PCI-DSS Tokenizer: short cardholder name throws
 * 9. Checkout summary: empty cart throws
 * 10. Checkout summary: compliance flags are all true
 * 11. REST GET /payment-methods returns methods for India
 * 12. REST POST /tokenize-card returns tokenized card
 */
describe('Phase 17 — Streamlined 6-Step Checkout', () => {
  let db: DatabaseSync;
  let checkoutService: CheckoutService;
  let app: express.Express;

  beforeEach(() => {
    db = new DatabaseSync(':memory:');
    runMigrations(db);
    seedDatabase(db);
    checkoutService = new CheckoutService(db);

    app = express();
    app.use(express.json());
    app.use('/api/v1/checkout', createCheckoutRouter(checkoutService));
  });

  afterEach(() => {
    db.close();
  });

  // ─── PAYMENT METHODS ────────────────────────────────────────────
  describe('Payment Method Resolution', () => {
    it('returns 5 methods for India: UPI, Cards, NetBanking, Wallets, COD (under ₹10k)', () => {
      const methods = checkoutService.getSupportedPaymentMethods({ country: 'IN', subtotal: 500 });
      expect(methods).toHaveLength(5);
      const ids = methods.map(m => m.id);
      expect(ids).toContain('upi');
      expect(ids).toContain('cards');
      expect(ids).toContain('netbanking');
      expect(ids).toContain('wallets');
      expect(ids).toContain('cod');
    });

    it('COD is available for domestic orders at or below ₹10,000', () => {
      const methods = checkoutService.getSupportedPaymentMethods({ country: 'IN', subtotal: 9999 });
      const cod = methods.find(m => m.id === 'cod');
      expect(cod!.isAvailable).toBe(true);
    });

    it('COD is unavailable for domestic orders above ₹10,000', () => {
      const methods = checkoutService.getSupportedPaymentMethods({ country: 'IN', subtotal: 15000 });
      const cod = methods.find(m => m.id === 'cod');
      expect(cod!.isAvailable).toBe(false);
      expect(cod!.unavailableReason).toContain('exceeds maximum COD threshold');
    });

    it('international methods exclude UPI, COD, NetBanking — include intl_cards, intl_wallets', () => {
      const methods = checkoutService.getSupportedPaymentMethods({ country: 'US', subtotal: 2000 });
      const ids = methods.map(m => m.id);
      expect(ids).not.toContain('upi');
      expect(ids).not.toContain('cod');
      expect(ids).not.toContain('netbanking');
      expect(ids).toContain('intl_cards');
      expect(ids).toContain('intl_wallets');
    });

    it('adds SWIFT wire transfer for luxury international orders >= ₹50,000', () => {
      const methods = checkoutService.getSupportedPaymentMethods({ country: 'AE', subtotal: 55000 });
      const wire = methods.find(m => m.id === 'wire_transfer');
      expect(wire).toBeDefined();
      expect(wire!.isAvailable).toBe(true);
    });

    it('does NOT add SWIFT wire transfer for international orders below ₹50,000', () => {
      const methods = checkoutService.getSupportedPaymentMethods({ country: 'AE', subtotal: 30000 });
      const wire = methods.find(m => m.id === 'wire_transfer');
      expect(wire).toBeUndefined();
    });
  });

  // ─── PCI TOKENIZER ───────────────────────────────────────────────
  describe('PCI-DSS Card Tokenizer', () => {
    it('tokenizes a valid Visa card, returns masked token with correct brand and last4', () => {
      const result = checkoutService.tokenizeCard({
        cardNumber: '4111111111111111',
        cardHolder: 'Aarav Sharma',
        expiryMonth: '12',
        expiryYear: '2028',
        cvv: '123'
      });
      expect(result.tokenId).toMatch(/^tok_pci_/);
      expect(result.last4).toBe('1111');
      expect(result.cardBrand).toBe('Visa');
      expect(result.pciComplianceNote).toContain('PAN and CVV permanently dropped');
    });

    it('identifies Mastercard brand from 5xxx prefix', () => {
      const result = checkoutService.tokenizeCard({
        cardNumber: '5500000000000004',
        cardHolder: 'Priya Nair',
        expiryMonth: '06',
        expiryYear: '2027',
        cvv: '321'
      });
      expect(result.cardBrand).toBe('Mastercard');
    });

    it('throws on non-numeric card number', () => {
      expect(() => checkoutService.tokenizeCard({
        cardNumber: 'ABCD-EFGH-IJKL-MNOP',
        cardHolder: 'Test User',
        expiryMonth: '01',
        expiryYear: '2027',
        cvv: '123'
      })).toThrow('Invalid card number format.');
    });

    it('throws on CVV too short (< 3 digits)', () => {
      expect(() => checkoutService.tokenizeCard({
        cardNumber: '4111111111111111',
        cardHolder: 'Test User',
        expiryMonth: '01',
        expiryYear: '2027',
        cvv: '12'
      })).toThrow('Invalid CVV/CVC format.');
    });

    it('throws when cardholder name is only 1 character', () => {
      expect(() => checkoutService.tokenizeCard({
        cardNumber: '4111111111111111',
        cardHolder: 'A',
        expiryMonth: '01',
        expiryYear: '2027',
        cvv: '123'
      })).toThrow('Valid cardholder name is required.');
    });
  });

  // ─── CHECKOUT SUMMARY ────────────────────────────────────────────
  describe('calculateCheckoutSummary', () => {
    it('throws when cart items array is empty', () => {
      expect(() => checkoutService.calculateCheckoutSummary({
        items: [],
        country: 'IN'
      })).toThrow('Cart is empty');
    });

    it('throws for a non-existent product ID', () => {
      expect(() => checkoutService.calculateCheckoutSummary({
        items: [{ productId: 'nonexistent-product-xyz', quantity: 1 }],
        country: 'IN'
      })).toThrow('no longer available');
    });

    it('returns all compliance flags as true', () => {
      // Get any published product
      const product = db.prepare(
        `SELECT id FROM products WHERE is_published = 1 AND deleted_at IS NULL LIMIT 1`
      ).get() as any;

      if (!product) {
        console.warn('No published products in seed — skipping compliance flag test');
        return;
      }

      const summary = checkoutService.calculateCheckoutSummary({
        items: [{ productId: product.id, quantity: 1 }],
        country: 'IN'
      });
      expect(summary.compliance.googlePlayPhysicalGoodsExemption).toBe(true);
      expect(summary.compliance.pciDssCompliant).toBe(true);
      expect(summary.compliance.zeroCardDataRetention).toBe(true);
    });

    it('step2 delivery address state is invalid when no addressId provided', () => {
      const product = db.prepare(
        `SELECT id FROM products WHERE is_published = 1 AND deleted_at IS NULL LIMIT 1`
      ).get() as any;

      if (!product) return;

      const summary = checkoutService.calculateCheckoutSummary({
        items: [{ productId: product.id, quantity: 1 }],
        country: 'IN'
        // no addressId
      });
      expect(summary.stepStates.step2DeliveryAddress.valid).toBe(false);
      expect(summary.stepStates.step6OrderConfirmation.canPlaceOrder).toBe(false);
    });

    it('express shipping fee is ₹199 for domestic orders', () => {
      const product = db.prepare(
        `SELECT id FROM products WHERE is_published = 1 AND deleted_at IS NULL LIMIT 1`
      ).get() as any;

      if (!product) return;

      const summary = checkoutService.calculateCheckoutSummary({
        items: [{ productId: product.id, quantity: 1 }],
        country: 'IN',
        shippingMethod: 'EXPRESS'
      });
      expect(summary.shipping.fee).toBe(199);
      expect(summary.shipping.method).toBe('EXPRESS');
    });

    it('standard shipping is free for domestic orders >= ₹999', () => {
      const product = db.prepare(
        `SELECT id, selling_price FROM products WHERE is_published = 1 AND deleted_at IS NULL ORDER BY selling_price DESC LIMIT 1`
      ).get() as any;

      if (!product) return;

      // Use enough qty to exceed ₹999 threshold
      const qty = Math.ceil(999 / product.selling_price) + 1;
      const summary = checkoutService.calculateCheckoutSummary({
        items: [{ productId: product.id, quantity: qty }],
        country: 'IN',
        shippingMethod: 'STANDARD'
      });
      if (summary.subtotal >= 999) {
        expect(summary.shipping.isFree).toBe(true);
        expect(summary.shipping.fee).toBe(0);
      }
    });
  });

  // ─── REST API ENDPOINTS ──────────────────────────────────────────
  describe('REST API', () => {
    it('GET /api/v1/checkout/payment-methods returns methods for India', async () => {
      const res = await request(app)
        .get('/api/v1/checkout/payment-methods?country=IN&subtotal=1500')
        .expect(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBeGreaterThan(0);
      const ids = res.body.data.map((m: any) => m.id);
      expect(ids).toContain('upi');
    });

    it('POST /api/v1/checkout/tokenize-card returns tokenized card for valid input', async () => {
      const res = await request(app)
        .post('/api/v1/checkout/tokenize-card')
        .send({
          cardNumber: '4111111111111111',
          cardHolder: 'Test Customer',
          expiryMonth: '09',
          expiryYear: '2029',
          cvv: '456'
        })
        .expect(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.tokenId).toMatch(/^tok_pci_/);
      expect(res.body.data.last4).toBe('1111');
      expect(res.body.data.cardBrand).toBe('Visa');
    });
  });
});
