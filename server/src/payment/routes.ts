import { Router, Request, Response } from 'express';
import { PaymentProviderFactory, PaymentProvider } from './payment.provider.js';

export function createPaymentRouter(provider?: PaymentProvider): Router {
  const router = Router();
  const paymentProvider = provider || PaymentProviderFactory.create();

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
      const payment = await paymentProvider.createPayment({
        orderId, orderNumber, amount: Math.round(amount),
        currency: currency || 'INR',
        customerPhone, customerEmail, customerName, description
      });
      res.status(201).json({ success: true, data: payment });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  /**
   * POST /api/v1/payments/:id/verify
   * Server-side payment signature verification.
   * CRITICAL: NEVER mark an order PAID based on frontend confirmation alone.
   */
  router.post('/:id/verify', async (req: Request, res: Response) => {
    try {
      const paymentId = String(req.params.id);
      const { signature, ...metadata } = req.body;
      const payment = await paymentProvider.verifyPayment(paymentId, signature, metadata);
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
      const result = await paymentProvider.capturePayment(paymentId, amount);
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
      const result = await paymentProvider.refundPayment(paymentId, amount, reason);
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
      const payment = await paymentProvider.getPaymentStatus(paymentId);
      res.json({ success: true, data: payment });
    } catch (err: any) {
      res.status(404).json({ success: false, error: err.message });
    }
  });

  /**
   * POST /api/v1/payments/webhook
   * Receives and verifies payment gateway webhook events.
   * CRITICAL: Server-side HMAC verification required. Never trust unverified callbacks.
   */
  router.post('/webhook', async (req: Request, res: Response) => {
    try {
      const rawBody = JSON.stringify(req.body);
      const signature = (req.headers['x-razorpay-signature'] || req.headers['x-webhook-signature'] || '') as string;
      const result = await paymentProvider.handleWebhook(rawBody, signature);
      res.json({ success: true, verified: result.verified, event: result.eventType });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  return router;
}
