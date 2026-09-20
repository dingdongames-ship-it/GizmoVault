import { DatabaseSync } from 'node:sqlite';
import crypto from 'crypto';
import { getDb } from '../db/connection.js';

export type NotificationChannel = 'EMAIL' | 'SMS' | 'WHATSAPP' | 'PUSH' | 'IN_APP';
export type NotificationType =
  | 'ORDER_CONFIRMATION'
  | 'PAYMENT_CONFIRMATION'
  | 'SHIPPED'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REFUND_PROCESSED'
  | 'SECURITY_ALERT';

export interface NotificationPayload {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  channel?: NotificationChannel;
  metadata?: Record<string, any>;
}

export interface NotificationRecord {
  id: string;
  userId: string;
  title: string;
  message: string;
  channel: NotificationChannel;
  isRead: boolean;
  createdAt: string;
}

export class NotificationService {
  private db: DatabaseSync;

  constructor(customDb?: DatabaseSync) {
    this.db = customDb || getDb();
  }

  /**
   * Dispatches a notification across specified channel and stores in-app record
   */
  sendNotification(payload: NotificationPayload): NotificationRecord {
    const id = `notif_${crypto.randomBytes(8).toString('hex')}`;
    const channel = payload.channel || 'IN_APP';

    this.db.prepare(
      `INSERT INTO notifications (id, user_id, title, message, channel, is_read, created_at)
       VALUES (?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)`
    ).run(id, payload.userId, payload.title, payload.message, channel);

    return {
      id,
      userId: payload.userId,
      title: payload.title,
      message: payload.message,
      channel,
      isRead: false,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Helper to notify order status changes (Order confirmation, Shipped, Delivered, etc.)
   */
  notifyOrderStatus(userId: string, orderNumber: string, status: string): NotificationRecord {
    const titleMap: Record<string, string> = {
      CONFIRMED: `Order Confirmed: ${orderNumber}`,
      SHIPPED: `Your order ${orderNumber} is on the way!`,
      OUT_FOR_DELIVERY: `Out for Delivery: ${orderNumber}`,
      DELIVERED: `Delivered: ${orderNumber}`,
      CANCELLED: `Order Cancelled: ${orderNumber}`,
    };

    const messageMap: Record<string, string> = {
      CONFIRMED: `Thank you for shopping with GizmoVault! Your order ${orderNumber} has been confirmed.`,
      SHIPPED: `Package for order ${orderNumber} has been handed over to our courier partner.`,
      OUT_FOR_DELIVERY: `Our delivery partner is out with your package. Expect delivery today!`,
      DELIVERED: `Package ${orderNumber} has been delivered. Enjoy your gizmo!`,
      CANCELLED: `Your order ${orderNumber} has been cancelled. Any deducted amount will be refunded within 5-7 business days.`,
    };

    const typeMap: Record<string, NotificationType> = {
      CONFIRMED: 'ORDER_CONFIRMATION',
      SHIPPED: 'SHIPPED',
      OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
      DELIVERED: 'DELIVERED',
      CANCELLED: 'CANCELLED',
    };

    return this.sendNotification({
      userId,
      type: typeMap[status] || 'ORDER_CONFIRMATION',
      title: titleMap[status] || `Order Update: ${orderNumber}`,
      message: messageMap[status] || `Status updated to ${status} for order ${orderNumber}.`,
      channel: 'IN_APP',
    });
  }

  /**
   * Fetch all notifications for a customer
   */
  getUserNotifications(userId: string, limit = 20): NotificationRecord[] {
    const rows = this.db.prepare(
      `SELECT id, user_id, title, message, channel, is_read, created_at
       FROM notifications WHERE user_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?`
    ).all(userId, limit) as any[];

    return rows.map(r => ({
      id: r.id,
      userId: r.user_id,
      title: r.title,
      message: r.message,
      channel: r.channel as NotificationChannel,
      isRead: Boolean(r.is_read),
      createdAt: r.created_at,
    }));
  }

  /**
   * Mark a notification as read
   */
  markAsRead(notificationId: string): void {
    this.db.prepare(
      `UPDATE notifications SET is_read = 1 WHERE id = ?`
    ).run(notificationId);
  }

  /**
   * Mark all notifications as read for a customer
   */
  markAllAsRead(userId: string): void {
    this.db.prepare(
      `UPDATE notifications SET is_read = 1 WHERE user_id = ?`
    ).run(userId);
  }

  /**
   * Count unread notifications
   */
  getUnreadCount(userId: string): number {
    const result = this.db.prepare(
      `SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0`
    ).get(userId) as any;
    return Number(result?.count || 0);
  }
}
