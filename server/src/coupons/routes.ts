import { Router, Request, Response } from 'express';
import { CouponService } from './coupon.service.js';

export function createCouponRouter(couponService?: CouponService): Router {
  const router = Router();
  const service = couponService || new CouponService();

  /**
   * POST /api/v1/coupons/validate
   * Validates promotional coupon for cart items or total.
   */
  router.post('/validate', (req: Request, res: Response) => {
    try {
      const { code, items = [], subtotal, userId } = req.body;
      if (!code) {
        res.status(400).json({ success: false, error: 'Coupon code is required' });
        return;
      }

      // If items array is not provided, simulate single generic item with provided subtotal
      const cartItems = Array.isArray(items) && items.length > 0
        ? items
        : [{ productId: 'generic_cart', unitPrice: Number(subtotal || 0), quantity: 1 }];

      const result = service.validateCoupon(String(code), cartItems, userId);
      res.json({
        success: true,
        data: result
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  /**
   * GET /api/v1/coupons
   * Returns list of available promotional coupons.
   */
  router.get('/', (_req: Request, res: Response) => {
    try {
      const coupons = service.listCoupons();
      res.json({
        success: true,
        count: coupons.length,
        data: coupons
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  /**
   * POST /api/v1/coupons (Admin)
   * Creates a new promotional coupon.
   */
  router.post('/', (req: Request, res: Response) => {
    try {
      const created = service.createCoupon(req.body);
      res.status(201).json({
        success: true,
        data: created
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  /**
   * PATCH /api/v1/coupons/:id/status (Admin)
   * Toggles coupon status.
   */
  router.patch('/:id/status', (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      const { isActive } = req.body;
      const updated = service.toggleCouponStatus(id, Boolean(isActive));
      res.json({
        success: true,
        data: updated
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  return router;
}
