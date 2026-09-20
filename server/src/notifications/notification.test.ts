import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { runMigrations } from '../db/migrator.js';
import { seedDatabase } from '../db/seed.js';
import { NotificationService } from './notification.service.js';

describe('Phase 25 — Notification System', () => {
  let db: DatabaseSync;
  let notifService: NotificationService;
  let testUserId: string;

  beforeEach(() => {
    db = new DatabaseSync(':memory:');
    runMigrations(db);
    seedDatabase(db);
    notifService = new NotificationService(db);

    const user = db.prepare(`SELECT id FROM users LIMIT 1`).get() as { id: string } | undefined;
    testUserId = user?.id || '';
  });

  afterEach(() => {
    db.close();
  });

  it('sendNotification creates in-app notification record', () => {
    if (!testUserId) return;
    const notif = notifService.sendNotification({
      userId: testUserId,
      type: 'ORDER_CONFIRMATION',
      title: 'Order Confirmed',
      message: 'Your order GV-2026-000001 has been confirmed',
    });

    expect(notif.id).toBeDefined();
    expect(notif.userId).toBe(testUserId);
    expect(notif.title).toBe('Order Confirmed');
    expect(notif.isRead).toBe(false);
  });

  it('notifyOrderStatus creates contextual notification for SHIPPED status', () => {
    if (!testUserId) return;
    const notif = notifService.notifyOrderStatus(testUserId, 'GV-2026-000042', 'SHIPPED');
    expect(notif.title).toContain('on the way');
    expect(notif.message).toContain('GV-2026-000042');
  });

  it('getUserNotifications returns user notifications in reverse order', () => {
    if (!testUserId) return;
    notifService.sendNotification({ userId: testUserId, type: 'SECURITY_ALERT', title: 'A', message: 'First' });
    notifService.sendNotification({ userId: testUserId, type: 'SECURITY_ALERT', title: 'B', message: 'Second' });

    const list = notifService.getUserNotifications(testUserId);
    expect(list.length).toBeGreaterThanOrEqual(2);
    expect(list[0].title).toBe('B');
  });

  it('markAsRead and markAllAsRead update notification read state', () => {
    if (!testUserId) return;
    const notif = notifService.sendNotification({
      userId: testUserId,
      type: 'DELIVERED',
      title: 'Delivered',
      message: 'Item delivered',
    });

    expect(notifService.getUnreadCount(testUserId)).toBeGreaterThan(0);
    notifService.markAsRead(notif.id);

    const after = notifService.getUserNotifications(testUserId);
    const updated = after.find(n => n.id === notif.id);
    expect(updated?.isRead).toBe(true);

    // markAllAsRead
    notifService.markAllAsRead(testUserId);
    expect(notifService.getUnreadCount(testUserId)).toBe(0);
  });
});
