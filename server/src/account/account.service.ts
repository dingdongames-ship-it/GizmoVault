import { DatabaseSync } from 'node:sqlite';
import crypto from 'crypto';
import { getDb } from '../db/connection.js';

export interface CustomerProfile {
  id: string;
  fullName: string;
  email: string | null;
  phone: string;
  status: string;
  isPhoneVerified: boolean;
  isEmailVerified: boolean;
  createdAt: string;
  addressesCount: number;
  ordersCount: number;
  wishlistCount: number;
}

export interface CustomerDataExport {
  user: {
    id: string;
    fullName: string;
    email: string | null;
    phone: string;
    createdAt: string;
  };
  addresses: any[];
  orders: any[];
  wishlist: any[];
  exportedAt: string;
}

export class AccountService {
  private db: DatabaseSync;

  constructor(customDb?: DatabaseSync) {
    this.db = customDb || getDb();
  }

  /**
   * Retrieves complete customer profile overview
   */
  getProfile(userId: string): CustomerProfile {
    const user = this.db.prepare(
      `SELECT id, full_name, email, phone, status, is_phone_verified, is_email_verified, created_at, deleted_at
       FROM users WHERE id = ? AND (deleted_at IS NULL OR deleted_at = '')`
    ).get(userId) as any;

    if (!user) {
      throw new Error(`Customer with ID ${userId} not found`);
    }

    const addrCount = (this.db.prepare(
      `SELECT COUNT(*) as cnt FROM addresses WHERE user_id = ?`
    ).get(userId) as any)?.cnt || 0;

    const ordCount = (this.db.prepare(
      `SELECT COUNT(*) as cnt FROM orders WHERE user_id = ?`
    ).get(userId) as any)?.cnt || 0;

    const wishCount = (this.db.prepare(
      `SELECT COUNT(*) as cnt FROM wishlists WHERE user_id = ?`
    ).get(userId) as any)?.cnt || 0;

    return {
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      phone: user.phone,
      status: user.status,
      isPhoneVerified: Boolean(user.is_phone_verified),
      isEmailVerified: Boolean(user.is_email_verified),
      createdAt: user.created_at,
      addressesCount: Number(addrCount),
      ordersCount: Number(ordCount),
      wishlistCount: Number(wishCount),
    };
  }

  /**
   * Updates basic profile details
   */
  updateProfile(userId: string, data: { fullName?: string; email?: string }): CustomerProfile {
    const existing = this.db.prepare(
      `SELECT id FROM users WHERE id = ? AND (deleted_at IS NULL OR deleted_at = '')`
    ).get(userId);

    if (!existing) {
      throw new Error(`Customer with ID ${userId} not found`);
    }

    if (data.fullName !== undefined) {
      this.db.prepare(
        `UPDATE users SET full_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
      ).run(data.fullName.trim(), userId);
    }

    if (data.email !== undefined) {
      this.db.prepare(
        `UPDATE users SET email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
      ).run(data.email.trim() || null, userId);
    }

    return this.getProfile(userId);
  }

  /**
   * Data Export per Google Play Store / GDPR guidelines
   */
  exportCustomerData(userId: string): CustomerDataExport {
    const profile = this.getProfile(userId);

    const addresses = this.db.prepare(
      `SELECT id, full_name, phone, address_line1, address_line2, city, state, postal_code, country, is_default
       FROM addresses WHERE user_id = ?`
    ).all(userId) as any[];

    const orders = this.db.prepare(
      `SELECT id, order_number, order_status as status, payment_status, grand_total as total_amount, currency, created_at
       FROM orders WHERE user_id = ? ORDER BY created_at DESC`
    ).all(userId) as any[];

    const wishlist = this.db.prepare(
      `SELECT w.id, w.product_id, p.title, p.selling_price
       FROM wishlists w
       LEFT JOIN products p ON w.product_id = p.id
       WHERE w.user_id = ?`
    ).all(userId) as any[];

    return {
      user: {
        id: profile.id,
        fullName: profile.fullName,
        email: profile.email,
        phone: profile.phone,
        createdAt: profile.createdAt,
      },
      addresses,
      orders,
      wishlist,
      exportedAt: new Date().toISOString(),
    };
  }

  /**
   * Soft deletes user and anonymizes PII per Google Play Store Account Deletion Policy
   */
  deleteAccount(userId: string, reason?: string): { success: boolean; message: string } {
    const user = this.db.prepare(
      `SELECT id, full_name, phone FROM users WHERE id = ? AND (deleted_at IS NULL OR deleted_at = '')`
    ).get(userId) as any;

    if (!user) {
      throw new Error(`Account ${userId} not found or already deleted`);
    }

    // Anonymize user record: scrub name, email, phone hash
    const anonymizedPhone = `DEL_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const anonymizedEmail = `deleted_${Date.now()}@gizmovault.invalid`;

    this.db.prepare(
      `UPDATE users 
       SET full_name = 'Deleted Account',
           email = ?,
           phone = ?,
           status = 'DELETED',
           deleted_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).run(anonymizedEmail, anonymizedPhone, userId);

    // Delete user addresses
    this.db.prepare(
      `DELETE FROM addresses WHERE user_id = ?`
    ).run(userId);

    // Clear wishlist
    this.db.prepare(
      `DELETE FROM wishlists WHERE user_id = ?`
    ).run(userId);

    return {
      success: true,
      message: 'Account and associated personal data successfully purged in compliance with Google Play Store guidelines',
    };
  }
}
