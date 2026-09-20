import { Router, Request, Response } from 'express';
import { AddressService } from './address.service.js';

export function createAddressRouter(addressService?: AddressService): Router {
  const router = Router();
  const service = addressService || new AddressService();

  const resolveUserId = (req: Request): string => {
    return (req.headers['x-user-id'] as string) || 'user_demo_01';
  };

  /**
   * GET /api/v1/addresses
   * Lists addresses for the active user.
   */
  router.get('/', (req: Request, res: Response) => {
    try {
      const userId = resolveUserId(req);
      const addresses = service.listAddresses(userId);
      res.json({
        success: true,
        count: addresses.length,
        data: addresses
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  /**
   * POST /api/v1/addresses
   * Creates a new delivery address.
   */
  router.post('/', (req: Request, res: Response) => {
    try {
      const userId = resolveUserId(req);
      const created = service.addAddress(userId, req.body);
      res.status(201).json({
        success: true,
        data: created
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  /**
   * GET /api/v1/addresses/:id
   * Retrieves single address.
   */
  router.get('/:id', (req: Request, res: Response) => {
    try {
      const userId = resolveUserId(req);
      const address = service.getAddressById(String(req.params.id), userId);
      if (!address) {
        res.status(404).json({ success: false, error: 'Address not found' });
        return;
      }
      res.json({
        success: true,
        data: address
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  /**
   * PUT /api/v1/addresses/:id
   * Updates an existing address.
   */
  router.put('/:id', (req: Request, res: Response) => {
    try {
      const userId = resolveUserId(req);
      const updated = service.updateAddress(String(req.params.id), userId, req.body);
      res.json({
        success: true,
        data: updated
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  /**
   * DELETE /api/v1/addresses/:id
   * Deletes an address.
   */
  router.delete('/:id', (req: Request, res: Response) => {
    try {
      const userId = resolveUserId(req);
      service.deleteAddress(String(req.params.id), userId);
      res.json({
        success: true,
        message: 'Address deleted successfully'
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  /**
   * POST /api/v1/addresses/:id/default
   * Sets designated address as default.
   */
  router.post('/:id/default', (req: Request, res: Response) => {
    try {
      const userId = resolveUserId(req);
      const updated = service.setDefaultAddress(String(req.params.id), userId);
      res.json({
        success: true,
        data: updated
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  /**
   * POST /api/v1/addresses/calculate-shipping
   * Computes configurable shipping options based on location and subtotal.
   */
  router.post('/calculate-shipping', (req: Request, res: Response) => {
    try {
      const { country, postalCode, subtotal, method } = req.body;
      const result = service.calculateShipping({
        country,
        postalCode,
        subtotal: Number(subtotal || 0),
        method
      });
      res.json({
        success: true,
        data: result
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  return router;
}
