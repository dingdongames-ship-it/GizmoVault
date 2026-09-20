import { Router, Request, Response } from 'express';
import { NotificationService } from './notification.service.js';
import { db } from '../config/db.js';

export function createNotificationRouter(service?: NotificationService): Router {
  const router = Router();
  const notifService = service || new NotificationService(db);

  // GET /api/v1/notifications/user/:userId
  router.get('/user/:userId', (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const notifications = notifService.getUserNotifications(String(req.params.userId), limit);
      const unreadCount = notifService.getUnreadCount(String(req.params.userId));
      res.json({ success: true, notifications, unreadCount });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/v1/notifications/send
  router.post('/send', (req: Request, res: Response) => {
    try {
      const { userId, type, title, message, channel } = req.body;
      if (!userId || !title || !message) {
        res.status(400).json({ error: 'userId, title, and message are required' });
        return;
      }
      const notif = notifService.sendNotification({ userId, type: type || 'ORDER_CONFIRMATION', title, message, channel });
      res.status(201).json({ success: true, notification: notif });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // PUT /api/v1/notifications/:id/read
  router.put('/:id/read', (req: Request, res: Response) => {
    try {
      notifService.markAsRead(String(req.params.id));
      res.json({ success: true, message: 'Notification marked as read' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // PUT /api/v1/notifications/user/:userId/read-all
  router.put('/user/:userId/read-all', (req: Request, res: Response) => {
    try {
      notifService.markAllAsRead(String(req.params.userId));
      res.json({ success: true, message: 'All notifications marked as read' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
