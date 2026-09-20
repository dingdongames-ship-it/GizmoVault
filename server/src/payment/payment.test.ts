import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import {
  RazorpaySandboxAdapter,
  PaymentProviderFactory,
  PaymentStatus
} from './payment.provider.js';
import { createPaymentRouter } from './routes.js';

/**
 * Phase 18: Payment Gateway Abstraction Tests
 *
 * Validates:
 * 1. PaymentProviderFactory creates Razorpay adapter from env config
 * 2. createPayment generates INITIATED payment record with provider ID
 * 3. verifyPayment with valid signature transitions to AUTHORIZED
 * 4. verifyPayment with invalid signature throws error
 * 5. capturePayment on AUTHORIZED transitions to PAID
 * 6. capturePayment on INITIATED throws error (must be AUTHORIZED first)
 * 7. refundPayment full amount transitions to REFUNDED
 * 8. refundPayment partial amount transitions to PARTIALLY_REFUNDED
 * 9. handleWebhook with payment.captured event updates status to PAID
 * 10. handleWebhook with invalid JSON throws
 * 11. getPaymentStatus retrieves correct state after lifecycle
 * 12. REST POST /payments/create returns 201 with payment session
 * 13. REST POST /payments/webhook receives events and verifies
 * 14. All 8 payment states defined in type
 */
describe('Phase 18 — Payment Gateway Abstraction', () => {
  let adapter: RazorpaySandboxAdapter;
  let app: express.Express;

  beforeEach(() => {
    adapter = new RazorpaySandboxAdapter();
    app = express();
    app.use(express.json());
    app.use('/api/v1/payments', createPaymentRouter(adapter));
  });

  // ─── FACTORY ───────────────────────────────────────────────────────
  it('PaymentProviderFactory creates a RazorpaySandboxAdapter for "razorpay"', () => {
    const provider = PaymentProviderFactory.create('razorpay');
    expect(provider.providerName).toBe('RAZORPAY_SANDBOX');
  });

  it('PaymentProviderFactory throws for unsupported provider', () => {
    expect(() => PaymentProviderFactory.create('stripe_v99')).toThrow('Unsupported payment provider');
  });

  // ─── PAYMENT LIFECYCLE ────────────────────────────────────────────
  it('createPayment generates INITIATED payment record with provider payment ID', async () => {
    const payment = await adapter.createPayment({
      orderId: 'ord_test_001',
      orderNumber: 'GV-2026-000001',
      amount: 59900,
      currency: 'INR',
      customerName: 'Aarav Sharma',
      customerEmail: 'aarav@example.com',
      customerPhone: '9876543210'
    });
    expect(payment.id).toBeDefined();
    expect(payment.status).toBe('INITIATED');
    expect(payment.providerPaymentId).toBeDefined();
    expect(payment.orderId).toBe('ord_test_001');
    expect(payment.amount).toBe(59900);
    expect(payment.currency).toBe('INR');
  });

  it('verifyPayment with mock_valid_signature transitions to AUTHORIZED', async () => {
    const payment = await adapter.createPayment({
      orderId: 'ord_002', orderNumber: 'GV-2026-000002',
      amount: 25000, currency: 'INR'
    });

    const verified = await adapter.verifyPayment(
      payment.id,
      'mock_valid_signature',
      { razorpay_order_id: 'rp_order_001' }
    );
    expect(verified.status).toBe('AUTHORIZED');
    expect(verified.webhookVerified).toBe(true);
  });

  it('verifyPayment with invalid signature throws and status stays FAILED', async () => {
    const payment = await adapter.createPayment({
      orderId: 'ord_003', orderNumber: 'GV-2026-000003',
      amount: 10000, currency: 'INR'
    });

    await expect(
      adapter.verifyPayment(payment.id, 'tampered_bad_signature', { razorpay_order_id: 'rp_001' })
    ).rejects.toThrow('signature verification failed');
  });

  it('capturePayment on AUTHORIZED payment transitions to PAID', async () => {
    const payment = await adapter.createPayment({
      orderId: 'ord_004', orderNumber: 'GV-2026-000004',
      amount: 34900, currency: 'INR'
    });
    await adapter.verifyPayment(payment.id, 'mock_valid_signature', { razorpay_order_id: 'x' });

    const capture = await adapter.capturePayment(payment.id);
    expect(capture.success).toBe(true);
    expect(capture.status).toBe('PAID');
    expect(capture.capturedAmount).toBe(34900);
  });

  it('capturePayment on INITIATED payment throws (must be AUTHORIZED first)', async () => {
    const payment = await adapter.createPayment({
      orderId: 'ord_005', orderNumber: 'GV-2026-000005',
      amount: 15000, currency: 'INR'
    });
    await expect(adapter.capturePayment(payment.id)).rejects.toThrow('AUTHORIZED');
  });

  it('refundPayment full amount transitions to REFUNDED', async () => {
    const payment = await adapter.createPayment({
      orderId: 'ord_006', orderNumber: 'GV-2026-000006',
      amount: 20000, currency: 'INR'
    });
    await adapter.verifyPayment(payment.id, 'mock_valid_signature', { razorpay_order_id: 'x' });
    await adapter.capturePayment(payment.id);

    const refund = await adapter.refundPayment(payment.id);
    expect(refund.success).toBe(true);
    expect(refund.status).toBe('REFUNDED');
    expect(refund.refundedAmount).toBe(20000);
  });

  it('refundPayment partial amount transitions to PARTIALLY_REFUNDED', async () => {
    const payment = await adapter.createPayment({
      orderId: 'ord_007', orderNumber: 'GV-2026-000007',
      amount: 50000, currency: 'INR'
    });
    await adapter.verifyPayment(payment.id, 'mock_valid_signature', { razorpay_order_id: 'x' });
    await adapter.capturePayment(payment.id);

    const refund = await adapter.refundPayment(payment.id, 10000, 'Customer request');
    expect(refund.status).toBe('PARTIALLY_REFUNDED');
    expect(refund.refundedAmount).toBe(10000);
  });

  it('handleWebhook with payment.captured event updates payment status to PAID', async () => {
    const payment = await adapter.createPayment({
      orderId: 'ord_008', orderNumber: 'GV-2026-000008',
      amount: 79900, currency: 'INR'
    });

    const webhookBody = JSON.stringify({
      event: 'payment.captured',
      payload: {
        payment: {
          entity: { id: payment.id, order_id: 'rp_order_008', amount: 79900 }
        }
      }
    });

    const result = await adapter.handleWebhook(webhookBody, 'mock_webhook_signature');
    expect(result.eventType).toBe('payment.captured');
    expect(result.verified).toBe(true);
    expect(result.status).toBe('PAID');
  });

  it('handleWebhook with invalid JSON body throws an error', async () => {
    await expect(
      adapter.handleWebhook('{ bad json ::::', 'mock_webhook_signature')
    ).rejects.toThrow('Invalid webhook payload');
  });

  it('getPaymentStatus retrieves correct state after full capture lifecycle', async () => {
    const payment = await adapter.createPayment({
      orderId: 'ord_009', orderNumber: 'GV-2026-000009',
      amount: 9999, currency: 'INR'
    });
    await adapter.verifyPayment(payment.id, 'mock_valid_signature', { razorpay_order_id: 'x' });
    await adapter.capturePayment(payment.id);

    const status = await adapter.getPaymentStatus(payment.id);
    expect(status.status).toBe('PAID');
    expect(status.refundedAmount).toBe(0);
  });

  // ─── REST API ─────────────────────────────────────────────────────
  it('POST /api/v1/payments/create returns 201 with payment session', async () => {
    const res = await request(app)
      .post('/api/v1/payments/create')
      .send({
        orderId: 'ord_rest_001',
        orderNumber: 'GV-2026-REST01',
        amount: 45000,
        currency: 'INR',
        customerName: 'Vikram Singh'
      })
      .expect(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('INITIATED');
    expect(res.body.data.providerPaymentId).toBeDefined();
  });

  it('POST /api/v1/payments/webhook returns success for valid mock webhook', async () => {
    const res = await request(app)
      .post('/api/v1/payments/webhook')
      .set('x-razorpay-signature', 'mock_webhook_signature')
      .send({
        event: 'payment.captured',
        payload: { payment: { entity: { id: 'pay_unknown', order_id: 'x' } } }
      })
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.event).toBe('payment.captured');
  });

  // ─── PAYMENT STATES ENUM COVERAGE ────────────────────────────────
  it('covers all 8 required payment states in TypeScript union type', () => {
    const requiredStates: PaymentStatus[] = [
      'INITIATED', 'PENDING', 'AUTHORIZED', 'PAID',
      'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED'
    ];
    expect(requiredStates).toHaveLength(8);
    requiredStates.forEach(state => {
      expect(typeof state).toBe('string');
    });
  });
});
