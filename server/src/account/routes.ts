import { Router, Request, Response } from 'express';
import { AccountService } from './account.service.js';
import { db } from '../config/db.js';

export function createAccountRouter(service?: AccountService): Router {
  const router = Router();
  const accountService = service || new AccountService(db);

  // GET /api/v1/account/:userId
  router.get('/:userId', (req: Request, res: Response) => {
    try {
      const profile = accountService.getProfile(String(req.params.userId));
      res.json({ success: true, profile });
    } catch (err: any) {
      const status = err.message.includes('not found') ? 404 : 500;
      res.status(status).json({ error: err.message });
    }
  });

  // PUT /api/v1/account/:userId
  router.put('/:userId', (req: Request, res: Response) => {
    try {
      const { fullName, email } = req.body;
      const updated = accountService.updateProfile(String(req.params.userId), { fullName, email });
      res.json({ success: true, profile: updated });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // GET /api/v1/account/:userId/export
  router.get('/:userId/export', (req: Request, res: Response) => {
    try {
      const data = accountService.exportCustomerData(String(req.params.userId));
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/v1/account/:userId (Google Play Store compliant account deletion)
  router.delete('/:userId', (req: Request, res: Response) => {
    try {
      const { reason } = req.body || {};
      const result = accountService.deleteAccount(String(req.params.userId), reason);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  return router;
}
