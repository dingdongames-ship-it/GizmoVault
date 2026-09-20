import { Router, Request, Response } from 'express';
import { InventoryService } from './inventory.service.js';
import { db } from '../config/db.js';

export function createInventoryRouter(service?: InventoryService): Router {
  const router = Router();
  const invService = service || new InventoryService(db);

  // GET /api/v1/inventory/product/:productId
  router.get('/product/:productId', (req: Request, res: Response) => {
    try {
      const inv = invService.getInventory(String(req.params.productId));
      res.json({ success: true, inventory: inv });
    } catch (err: any) {
      const status = err.message.includes('not found') ? 404 : 500;
      res.status(status).json({ error: err.message });
    }
  });

  // POST /api/v1/inventory/reserve
  router.post('/reserve', (req: Request, res: Response) => {
    try {
      const { orderId, items } = req.body;
      if (!orderId || !items || !Array.isArray(items)) {
        res.status(400).json({ error: 'orderId and items array are required' });
        return;
      }
      const reservations = invService.reserveInventory(String(orderId), items);
      res.status(201).json({ success: true, reservations });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // POST /api/v1/inventory/confirm
  router.post('/confirm', (req: Request, res: Response) => {
    try {
      const { orderId } = req.body;
      if (!orderId) {
        res.status(400).json({ error: 'orderId is required' });
        return;
      }
      invService.confirmInventoryDeduction(String(orderId));
      res.json({ success: true, message: `Reservation confirmed for order ${orderId}` });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // POST /api/v1/inventory/release
  router.post('/release', (req: Request, res: Response) => {
    try {
      const { orderId } = req.body;
      if (!orderId) {
        res.status(400).json({ error: 'orderId is required' });
        return;
      }
      invService.releaseInventoryReservation(String(orderId));
      res.json({ success: true, message: `Reservation released for order ${orderId}` });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  return router;
}
