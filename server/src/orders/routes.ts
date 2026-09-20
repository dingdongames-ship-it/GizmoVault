import { Router, Request, Response } from 'express';
import { OrderService, OrderStatus } from './order.service.js';

export function createOrderRouter(orderServiceInstance?: OrderService): Router {
  const router = Router();
  const orderService = orderServiceInstance || new OrderService();

  const resolveUserId = (req: Request): string =>
    (req.headers['x-user-id'] as string) || 'user_demo_01';

  /**
   * POST /api/v1/orders
   * Creates a new order from a validated checkout cart.
   */
  router.post('/', (req: Request, res: Response) => {
    try {
      const userId = resolveUserId(req);
      const {
        addressId, items, subtotal, discountTotal,
        couponId, shippingFee, taxAmount, grandTotal,
        currency, paymentMethod, notes, shippingAddressSnapshot
      } = req.body;

      if (!addressId || !items || items.length === 0 || !grandTotal) {
        return res.status(400).json({
          success: false,
          error: 'addressId, items, and grandTotal are required.'
        });
      }

      const order = orderService.createOrder({
        userId, addressId, items, subtotal, discountTotal,
        couponId, shippingFee, taxAmount, grandTotal, currency,
        paymentMethod, notes,
        shippingAddressSnapshot: shippingAddressSnapshot || JSON.stringify({ addressId })
      });

      res.status(201).json({ success: true, data: order });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  /**
   * GET /api/v1/orders
   * Lists all orders for the authenticated customer.
   */
  router.get('/', (req: Request, res: Response) => {
    try {
      const userId = resolveUserId(req);
      const orders = orderService.getOrdersByUser(userId);
      res.json({ success: true, count: orders.length, data: orders });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  /**
   * GET /api/v1/orders/:id
   * Retrieves a specific order with items.
   */
  router.get('/:id', (req: Request, res: Response) => {
    try {
      const order = orderService.getOrderById(String(req.params.id));
      if (!order) return res.status(404).json({ success: false, error: 'Order not found.' });
      res.json({ success: true, data: order });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  /**
   * GET /api/v1/orders/:id/tracking
   * Returns order tracking timeline.
   */
  router.get('/:id/tracking', (req: Request, res: Response) => {
    try {
      const timeline = orderService.getTrackingTimeline(String(req.params.id));
      res.json({ success: true, data: timeline });
    } catch (err: any) {
      res.status(404).json({ success: false, error: err.message });
    }
  });

  /**
   * PATCH /api/v1/orders/:id/status
   * Transitions order to a new status (admin only — no auth in sandbox).
   */
  router.patch('/:id/status', (req: Request, res: Response) => {
    try {
      const { status } = req.body;
      if (!status) return res.status(400).json({ success: false, error: 'New status is required.' });
      const order = orderService.transitionOrderStatus(String(req.params.id), status as OrderStatus);
      res.json({ success: true, data: order });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  /**
   * POST /api/v1/orders/:id/confirm-payment
   * Server-side confirmation that payment webhook was verified.
   * RULE: Never mark order PAID based on frontend only.
   */
  router.post('/:id/confirm-payment', (req: Request, res: Response) => {
    try {
      const order = orderService.markOrderPaid(String(req.params.id), req.body?.paymentMethod);
      res.json({ success: true, data: order });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  /**
   * POST /api/v1/orders/:id/cancel
   * Customer-initiated order cancellation.
   */
  router.post('/:id/cancel', (req: Request, res: Response) => {
    try {
      const userId = resolveUserId(req);
      const order = orderService.cancelOrder(String(req.params.id), userId);
      res.json({ success: true, data: order });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  /**
   * GET /api/v1/orders/admin/all
   * Admin: Lists all orders with optional status filter.
   */
  router.get('/admin/all', (req: Request, res: Response) => {
    try {
      const status = req.query.status as OrderStatus | undefined;
      const page = Number(req.query.page) || 1;
      const pageSize = Number(req.query.page_size) || 20;

      const result = orderService.listAllOrders({ status, page, pageSize });
      res.json({ success: true, total: result.total, page, pageSize, data: result.orders });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}
