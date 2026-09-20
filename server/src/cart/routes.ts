import { Router, Request, Response } from 'express';
import { CartService } from './cart.service.js';

export function createCartRouter(cartService?: CartService): Router {
  const router = Router();
  const service = cartService || new CartService();

  // Helper to extract or provision cart ID from headers or body
  const resolveCartId = (req: Request): string => {
    const headerCartId = req.headers['x-cart-id'] as string;
    if (headerCartId) return headerCartId;

    const userId = req.headers['x-user-id'] as string;
    const sessionId = (req.headers['x-session-id'] as string) || (req.query.sessionId as string);
    return service.getOrCreateCart(userId, sessionId);
  };

  /**
   * GET /api/v1/cart
   * Retrieves full server-validated cart with items, totals, and warnings.
   */
  router.get('/', (req: Request, res: Response) => {
    try {
      const cartId = resolveCartId(req);
      const couponCode = req.query.coupon as string | undefined;
      const cart = service.getCartDetails(cartId, couponCode);

      res.setHeader('x-cart-id', cartId);
      res.json({
        success: true,
        data: cart
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  /**
   * POST /api/v1/cart/items
   * Adds an item to active cart.
   */
  router.post('/items', (req: Request, res: Response) => {
    try {
      const cartId = resolveCartId(req);
      const { productId, quantity = 1 } = req.body;

      if (!productId) {
        res.status(400).json({ success: false, error: 'productId is required' });
        return;
      }

      const cart = service.addItem(cartId, productId, Number(quantity));
      res.setHeader('x-cart-id', cartId);
      res.status(201).json({
        success: true,
        data: cart
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  /**
   * PATCH /api/v1/cart/items/:productId
   * Adjusts quantity for an item.
   */
  router.patch('/items/:productId', (req: Request, res: Response) => {
    try {
      const cartId = resolveCartId(req);
      const productId = String(req.params.productId);
      const { quantity } = req.body;

      if (quantity === undefined || isNaN(Number(quantity))) {
        res.status(400).json({ success: false, error: 'Valid numeric quantity is required' });
        return;
      }

      const cart = service.updateQuantity(cartId, productId, Number(quantity));
      res.setHeader('x-cart-id', cartId);
      res.json({
        success: true,
        data: cart
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  /**
   * DELETE /api/v1/cart/items/:productId
   * Removes item from cart.
   */
  router.delete('/items/:productId', (req: Request, res: Response) => {
    try {
      const cartId = resolveCartId(req);
      const productId = String(req.params.productId);

      const cart = service.removeItem(cartId, productId);
      res.setHeader('x-cart-id', cartId);
      res.json({
        success: true,
        data: cart
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  /**
   * POST /api/v1/cart/items/:productId/save-later
   * Moves item from active cart to Saved for Later.
   */
  router.post('/items/:productId/save-later', (req: Request, res: Response) => {
    try {
      const cartId = resolveCartId(req);
      const productId = String(req.params.productId);

      const cart = service.saveForLater(cartId, productId);
      res.setHeader('x-cart-id', cartId);
      res.json({
        success: true,
        data: cart
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  /**
   * POST /api/v1/cart/items/:productId/move-to-cart
   * Moves item from Saved for Later back to active cart.
   */
  router.post('/items/:productId/move-to-cart', (req: Request, res: Response) => {
    try {
      const cartId = resolveCartId(req);
      const productId = String(req.params.productId);

      const cart = service.moveToCart(cartId, productId);
      res.setHeader('x-cart-id', cartId);
      res.json({
        success: true,
        data: cart
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  /**
   * POST /api/v1/cart/validate
   * Pre-checkout full revalidation gate.
   */
  router.post('/validate', (req: Request, res: Response) => {
    try {
      const cartId = resolveCartId(req);
      const { couponCode, shippingPincode } = req.body;

      const result = service.validateBeforeCheckout(cartId, couponCode, shippingPincode);
      res.setHeader('x-cart-id', cartId);
      res.json({
        success: true,
        data: result
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  /**
   * POST /api/v1/cart/coupon
   * Applies promotional coupon code to cart.
   */
  router.post('/coupon', (req: Request, res: Response) => {
    try {
      const cartId = resolveCartId(req);
      const { code } = req.body;

      if (!code) {
        res.status(400).json({ success: false, error: 'Coupon code is required' });
        return;
      }

      const cart = service.getCartDetails(cartId, code);
      res.setHeader('x-cart-id', cartId);
      res.json({
        success: true,
        data: cart
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  /**
   * DELETE /api/v1/cart
   * Clears all active cart items.
   */
  router.delete('/', (req: Request, res: Response) => {
    try {
      const cartId = resolveCartId(req);
      service.clearCart(cartId);
      const cart = service.getCartDetails(cartId);

      res.setHeader('x-cart-id', cartId);
      res.json({
        success: true,
        data: cart
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}
