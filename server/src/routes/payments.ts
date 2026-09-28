import { Router, Request, Response } from 'express';
import express from 'express';
import crypto from 'crypto';
import Stripe from 'stripe';
import { DatabaseSync } from 'node:sqlite';
import { getDb } from '../db/index.js';
import { serverSupabase } from '../security/supabase.js';
import { PaymentProviderFactory, PaymentProvider } from '../payment/payment.provider.js';

export interface PaymentRouterOptions {
  provider?: PaymentProvider;
  db?: DatabaseSync;
  stripeClient?: Stripe;
}

/**
 * Creates production-grade payment routes for GizmoVault:
 * - POST /api/v1/payments/create
 * - POST /api/v1/payments/:id/verify
 * - POST /api/v1/payments/:id/capture
 * - POST /api/v1/payments/:id/refund
 * - GET  /api/v1/payments/:id/status
 * - POST /api/v1/payments/razorpay/webhook (Production HMAC-SHA256 verification)
 * - POST /api/v1/payments/stripe/webhook (Production Stripe signature verification)
 * - POST /api/v1/payments/webhook (Legacy/General gateway webhook)
 */
export function createPaymentRouter(providerOrOptions?: PaymentProvider | PaymentRouterOptions): Router {
  const router = Router();

  let provider: PaymentProvider;
  let customDb: DatabaseSync | undefined;
  let customStripe: Stripe | undefined;

  if (providerOrOptions && 'providerName' in providerOrOptions) {
    provider = providerOrOptions;
  } else if (providerOrOptions) {
    provider = providerOrOptions.provider || PaymentProviderFactory.create();
    customDb = providerOrOptions.db;
    customStripe = providerOrOptions.stripeClient;
  } else {
    provider = PaymentProviderFactory.create();
  }

  const getDatabase = (): DatabaseSync => customDb || getDb();

  /**
   * Helper: Broadcast order paid notification to Supabase realtime channel
   */
  async function broadcastOrderPaid(orderPayload: {
    orderId: string;
    orderNumber?: string;
    gateway: 'RAZORPAY' | 'STRIPE' | 'MANUAL';
    paymentId?: string;
    amount?: number;
    currency?: string;
  }) {
    if (serverSupabase) {
      try {
        const channel = serverSupabase.channel('orders-realtime');
        await channel.send({
          type: 'broadcast',
          event: 'order:paid',
          payload: {
            ...orderPayload,
            status: 'PAID',
            timestamp: new Date().toISOString(),
          },
        });
      } catch (err: any) {
        console.warn('[Supabase Realtime Order Broadcast Warning]:', err.message);
      }
    }
  }

  /**
   * Helper: Update SQLite order status to PAID in WAL transaction
   */
  function updateOrderToPaid(orderIdOrNumber: string): { id: string; order_number: string } | null {
    const db = getDatabase();
    try {
      const orderRow = db
        .prepare(`SELECT id, order_number, order_status, payment_status FROM orders WHERE id = ? OR order_number = ?`)
        .get(orderIdOrNumber, orderIdOrNumber) as any;

      if (orderRow) {
        db.prepare(`
          UPDATE orders 
          SET order_status = 'PAID', payment_status = 'PAID', updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `).run(orderRow.id);

        return { id: orderRow.id, order_number: orderRow.order_number };
      }
    } catch (err: any) {
      console.warn(`[SQLite Order Update Warning]: ${err.message}`);
    }
    return null;
  }

  /**
   * POST /api/v1/payments/create
   * Creates a new payment session for an order.
   */
  router.post('/create', async (req: Request, res: Response) => {
    try {
      const { orderId, orderNumber, amount, currency, customerPhone, customerEmail, customerName, description } = req.body;
      if (!orderId || !amount) {
        return res.status(400).json({ success: false, error: 'orderId and amount are required.' });
      }
      const payment = await provider.createPayment({
        orderId,
        orderNumber,
        amount: Math.round(amount),
        currency: currency || 'INR',
        customerPhone,
        customerEmail,
        customerName,
        description,
      });
      res.status(201).json({ success: true, data: payment });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  /**
   * POST /api/v1/payments/:id/verify
   * Server-side payment signature verification.
   */
  router.post('/:id/verify', async (req: Request, res: Response) => {
    try {
      const paymentId = String(req.params.id);
      const { signature, ...metadata } = req.body;
      const payment = await provider.verifyPayment(paymentId, signature, metadata);
      res.json({ success: true, data: payment });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  /**
   * POST /api/v1/payments/:id/capture
   * Captures an authorized payment.
   */
  router.post('/:id/capture', async (req: Request, res: Response) => {
    try {
      const paymentId = String(req.params.id);
      const { amount } = req.body;
      const result = await provider.capturePayment(paymentId, amount);
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  /**
   * POST /api/v1/payments/:id/refund
   * Initiates a refund for a paid order.
   */
  router.post('/:id/refund', async (req: Request, res: Response) => {
    try {
      const paymentId = String(req.params.id);
      const { amount, reason } = req.body;
      const result = await provider.refundPayment(paymentId, amount, reason);
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  /**
   * GET /api/v1/payments/:id/status
   * Retrieves current payment status.
   */
  router.get('/:id/status', async (req: Request, res: Response) => {
    try {
      const paymentId = String(req.params.id);
      const payment = await provider.getPaymentStatus(paymentId);
      res.json({ success: true, data: payment });
    } catch (err: any) {
      res.status(404).json({ success: false, error: err.message });
    }
  });

  /**
   * POST /api/v1/payments/razorpay/webhook
   * Production-grade Razorpay webhook listener with raw byte stream HMAC-SHA256 verification
   */
  router.post(
    '/razorpay/webhook',
    express.raw({ type: 'application/json' }),
    async (req: Request, res: Response) => {
      const signature = (req.headers['x-razorpay-signature'] ||
        req.headers['X-Razorpay-Signature']) as string | undefined;

      if (!signature) {
        return res.status(400).json({ success: false, error: 'Missing x-razorpay-signature header' });
      }

      const rawBuffer = Buffer.isBuffer(req.body)
        ? req.body
        : (req as any).rawBody
        ? Buffer.from((req as any).rawBody)
        : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body));

      const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || 'rzp_webhook_mock_secret';

      // Compute expected HMAC-SHA256 over raw unparsed byte stream
      const expectedSig = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawBuffer)
        .digest('hex');

      // Constant-time timing-safe comparison to prevent timing attacks
      let isValid = false;
      try {
        const sigBuf = Buffer.from(signature, 'hex');
        const expBuf = Buffer.from(expectedSig, 'hex');
        isValid = sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf);
      } catch {
        isValid = false;
      }

      // Allow mock webhook signature in test environment
      if (!isValid && process.env.NODE_ENV === 'test' && signature === 'mock_webhook_signature') {
        isValid = true;
      }

      if (!isValid) {
        return res.status(400).json({ success: false, error: 'Invalid Razorpay signature' });
      }

      let event: any = {};
      try {
        event = JSON.parse(rawBuffer.toString('utf-8'));
      } catch {
        return res.status(400).json({ success: false, error: 'Invalid JSON payload' });
      }

      const eventType: string = event.event || 'unknown';

      // Record in webhook_events for idempotency & auditing
      const db = getDatabase();
      const eventId = event.event_id || `wh_rzp_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
      try {
        db.prepare(`
          INSERT INTO webhook_events (
            id, provider, event_type, idempotency_key, payload, processed
          ) VALUES (?, 'RAZORPAY', ?, ?, ?, 1)
        `).run(eventId, eventType, eventId, rawBuffer.toString('utf-8'));
      } catch (err: any) {
        if (err.message && (err.message.includes('UNIQUE') || err.message.includes('idempotency_key'))) {
          return res.status(200).json({ success: true, message: 'Event replay ignored' });
        }
      }

      // Handle order.paid or payment.captured
      if (eventType === 'order.paid' || eventType === 'payment.captured') {
        const paymentEntity = event.payload?.payment?.entity;
        const orderEntity = event.payload?.order?.entity;

        const targetOrderId =
          paymentEntity?.notes?.order_id ||
          orderEntity?.notes?.order_id ||
          paymentEntity?.order_id ||
          orderEntity?.id ||
          paymentEntity?.description;

        let updatedOrder: { id: string; order_number: string } | null = null;
        if (targetOrderId) {
          updatedOrder = updateOrderToPaid(targetOrderId);
        }

        // Notify Supabase realtime channel
        await broadcastOrderPaid({
          orderId: updatedOrder?.id || targetOrderId || 'unknown',
          orderNumber: updatedOrder?.order_number,
          gateway: 'RAZORPAY',
          paymentId: paymentEntity?.id,
          amount: paymentEntity?.amount,
          currency: paymentEntity?.currency || 'INR',
        });

        return res.status(200).json({
          success: true,
          verified: true,
          event: eventType,
          orderId: updatedOrder?.id || targetOrderId,
          status: 'PAID',
        });
      }

      return res.status(200).json({
        success: true,
        verified: true,
        event: eventType,
      });
    }
  );

  /**
   * POST /api/v1/payments/stripe/webhook
   * Production-grade Stripe webhook listener with constructEvent signature validation
   */
  router.post(
    '/stripe/webhook',
    express.raw({ type: 'application/json' }),
    async (req: Request, res: Response) => {
      const signature = (req.headers['stripe-signature'] ||
        req.headers['Stripe-Signature']) as string | undefined;

      if (!signature) {
        return res.status(400).json({ success: false, error: 'Missing stripe-signature header' });
      }

      const rawBuffer = Buffer.isBuffer(req.body)
        ? req.body
        : (req as any).rawBody
        ? Buffer.from((req as any).rawBody)
        : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body));

      const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_mock_stripe_secret';
      const stripeSecretKey = process.env.STRIPE_SECRET_KEY || 'sk_test_mock_stripe_key';

      let event: Stripe.Event;

      if (process.env.NODE_ENV === 'test' && signature === 'mock_stripe_signature') {
        try {
          event = JSON.parse(rawBuffer.toString('utf-8'));
        } catch {
          return res.status(400).json({ success: false, error: 'Invalid JSON payload' });
        }
      } else {
        try {
          const stripeInstance = customStripe || new Stripe(stripeSecretKey, { apiVersion: '2025-02-24.acacia' as any });
          event = stripeInstance.webhooks.constructEvent(rawBuffer, signature, stripeWebhookSecret);
        } catch (err: any) {
          return res.status(400).json({
            success: false,
            error: `Stripe webhook signature verification failed: ${err.message}`,
          });
        }
      }

      // Record in webhook_events
      const db = getDatabase();
      const eventId = event.id || `wh_stripe_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
      try {
        db.prepare(`
          INSERT INTO webhook_events (
            id, provider, event_type, idempotency_key, payload, processed
          ) VALUES (?, 'STRIPE', ?, ?, ?, 1)
        `).run(eventId, event.type, eventId, rawBuffer.toString('utf-8'));
      } catch (err: any) {
        if (err.message && (err.message.includes('UNIQUE') || err.message.includes('idempotency_key'))) {
          return res.status(200).json({ success: true, message: 'Event replay ignored' });
        }
      }

      // Handle checkout.session.completed and payment_intent.succeeded
      if (
        event.type === 'checkout.session.completed' ||
        event.type === 'payment_intent.succeeded'
      ) {
        const sessionOrIntent = event.data.object as any;
        const targetOrderId =
          sessionOrIntent.metadata?.order_id ||
          sessionOrIntent.client_reference_id ||
          sessionOrIntent.metadata?.orderId;

        let updatedOrder: { id: string; order_number: string } | null = null;
        if (targetOrderId) {
          updatedOrder = updateOrderToPaid(targetOrderId);
        }

        // Notify Supabase realtime channel
        await broadcastOrderPaid({
          orderId: updatedOrder?.id || targetOrderId || sessionOrIntent.id,
          orderNumber: updatedOrder?.order_number,
          gateway: 'STRIPE',
          paymentId: sessionOrIntent.payment_intent || sessionOrIntent.id,
          amount: sessionOrIntent.amount_total || sessionOrIntent.amount,
          currency: sessionOrIntent.currency,
        });

        return res.status(200).json({
          success: true,
          verified: true,
          event: event.type,
          orderId: updatedOrder?.id || targetOrderId,
          status: 'PAID',
        });
      }

      return res.status(200).json({
        success: true,
        verified: true,
        event: event.type,
      });
    }
  );

  /**
   * POST /api/v1/payments/webhook
   * General payment webhook fallback (maintains compatibility with Phase 18 tests)
   */
  router.post(
    '/webhook',
    express.raw({ type: 'application/json' }),
    async (req: Request, res: Response) => {
      try {
        const rawBuffer = Buffer.isBuffer(req.body)
          ? req.body
          : (req as any).rawBody
          ? Buffer.from((req as any).rawBody)
          : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body));

        const signature = (req.headers['x-razorpay-signature'] ||
          req.headers['x-webhook-signature'] ||
          '') as string;

        const result = await provider.handleWebhook(rawBuffer, signature);
        res.json({ success: true, verified: result.verified, event: result.eventType });
      } catch (err: any) {
        res.status(400).json({ success: false, error: err.message });
      }
    }
  );

  return router;
}
