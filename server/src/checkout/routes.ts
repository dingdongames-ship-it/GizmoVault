import { Router, Request, Response } from 'express';
import { CheckoutService } from './checkout.service.js';

export function createCheckoutRouter(checkoutServiceInstance?: CheckoutService): Router {
  const router = Router();
  const checkoutService = checkoutServiceInstance || new CheckoutService();

  /**
   * GET /api/v1/checkout/payment-methods
   * Returns allowed payment methods filtered by country and subtotal.
   */
  router.get('/payment-methods', (req: Request, res: Response) => {
    try {
      const country = (req.query.country as string) || 'IN';
      const subtotal = Number(req.query.subtotal) || 0;

      const methods = checkoutService.getSupportedPaymentMethods({
        country,
        subtotal
      });

      res.json({
        success: true,
        country,
        subtotal,
        count: methods.length,
        data: methods
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  /**
   * POST /api/v1/checkout/summary
   * Calculates comprehensive 6-step checkout summary with authoritative prices,
   * stock verification, coupon discount, dynamic shipping, and supported payment methods.
   */
  router.post('/summary', (req: Request, res: Response) => {
    try {
      const {
        items,
        country,
        postalCode,
        addressId,
        shippingMethod,
        couponCode,
        paymentMethodId,
        userId
      } = req.body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Cart items array is required.'
        });
      }

      const summary = checkoutService.calculateCheckoutSummary({
        items,
        country,
        postalCode,
        addressId,
        shippingMethod,
        couponCode,
        paymentMethodId,
        userId: userId || 'user_demo_01'
      });

      res.json({
        success: true,
        data: summary
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  /**
   * POST /api/v1/checkout/tokenize-card
   * PCI-DSS Level 1 compliant card tokenization simulator.
   * Drops raw card number (PAN) and CVV immediately.
   */
  router.post('/tokenize-card', (req: Request, res: Response) => {
    try {
      const { cardNumber, cardHolder, expiryMonth, expiryYear, cvv } = req.body;

      if (!cardNumber || !cardHolder || !expiryMonth || !expiryYear || !cvv) {
        return res.status(400).json({
          success: false,
          error: 'Card number, cardholder name, expiry date, and CVV are required.'
        });
      }

      const tokenResult = checkoutService.tokenizeCard({
        cardNumber,
        cardHolder,
        expiryMonth,
        expiryYear,
        cvv
      });

      res.json({
        success: true,
        data: tokenResult
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  return router;
}
