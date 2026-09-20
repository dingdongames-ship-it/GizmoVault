import { DatabaseSync } from 'node:sqlite';
import crypto from 'crypto';
import { getDb } from '../db/connection.js';

export interface CouponRecord {
  id: string;
  code: string;
  discount_type: 'PERCENT' | 'FLAT';
  discount_value: number;
  min_order_amount: number;
  max_discount_amount: number | null;
  category_id: string | null;
  product_id: string | null;
  is_first_order_only: number;
  valid_from: string;
  valid_until: string;
  usage_limit: number;
  per_user_limit: number;
  times_used: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface CreateCouponInput {
  code: string;
  discountType: 'PERCENT' | 'FLAT';
  discountValue: number;
  minOrderAmount?: number;
  maxDiscountAmount?: number;
  categoryId?: string;
  productId?: string;
  isFirstOrderOnly?: boolean;
  validFrom?: string;
  validUntil?: string;
  usageLimit?: number;
  perUserLimit?: number;
  isActive?: boolean;
}

export interface CartItemForCoupon {
  productId: string;
  categoryId?: string;
  unitPrice: number;
  quantity: number;
}

export interface CouponValidationResponse {
  valid: boolean;
  code?: string;
  discountType?: 'PERCENT' | 'FLAT';
  discountValue?: number;
  eligibleSubtotal: number;
  discountAmount: number;
  reason?: string;
  couponDetails?: {
    id: string;
    description: string;
    minOrderAmount: number;
    maxDiscountAmount?: number | null;
  };
}

export class CouponService {
  private db: DatabaseSync;

  constructor(customDb?: DatabaseSync) {
    this.db = customDb || getDb();
  }

  /**
   * Admin: Creates a new promotional coupon.
   */
  public createCoupon(input: CreateCouponInput): CouponRecord {
    const code = input.code.trim().toUpperCase();
    if (!code || code.length < 3) {
      throw new Error('Coupon code must be at least 3 characters long');
    }

    const existing = this.db.prepare('SELECT id FROM coupons WHERE code = ?').get(code);
    if (existing) {
      throw new Error(`Coupon with code "${code}" already exists`);
    }

    if (input.discountValue <= 0) {
      throw new Error('Discount value must be greater than 0');
    }

    if (input.discountType === 'PERCENT' && input.discountValue > 100) {
      throw new Error('Percentage discount cannot exceed 100%');
    }

    const id = `cpn_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const validFrom = input.validFrom || new Date().toISOString();
    // Default valid for 90 days if not specified
    const validUntil = input.validUntil || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

    const insertStmt = this.db.prepare(`
      INSERT INTO coupons (
        id, code, discount_type, discount_value, min_order_amount,
        max_discount_amount, category_id, product_id, is_first_order_only,
        valid_from, valid_until, usage_limit, per_user_limit, times_used,
        is_active, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, 0,
        ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `);

    insertStmt.run(
      id,
      code,
      input.discountType,
      input.discountValue,
      input.minOrderAmount || 0,
      input.maxDiscountAmount || null,
      input.categoryId || null,
      input.productId || null,
      input.isFirstOrderOnly ? 1 : 0,
      validFrom,
      validUntil,
      input.usageLimit !== undefined ? input.usageLimit : 1000,
      input.perUserLimit !== undefined ? input.perUserLimit : 1,
      input.isActive !== false ? 1 : 0
    );

    return this.getCouponById(id)!;
  }

  /**
   * Retrieves coupon by ID.
   */
  public getCouponById(id: string): CouponRecord | null {
    const row = this.db.prepare('SELECT * FROM coupons WHERE id = ?').get(id) as unknown as CouponRecord | undefined;
    return row || null;
  }

  /**
   * Retrieves coupon by code.
   */
  public getCouponByCode(code: string): CouponRecord | null {
    const row = this.db.prepare('SELECT * FROM coupons WHERE UPPER(code) = UPPER(?)').get(code.trim()) as unknown as CouponRecord | undefined;
    return row || null;
  }

  /**
   * Lists all coupons for Admin management.
   */
  public listCoupons(): CouponRecord[] {
    return this.db.prepare('SELECT * FROM coupons ORDER BY created_at DESC').all() as unknown as CouponRecord[];
  }

  /**
   * Admin: Toggles coupon active status.
   */
  public toggleCouponStatus(id: string, isActive: boolean): CouponRecord {
    this.db.prepare('UPDATE coupons SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(isActive ? 1 : 0, id);
    const updated = this.getCouponById(id);
    if (!updated) throw new Error('Coupon not found');
    return updated;
  }

  /**
   * Core Engine: Validates coupon applicability against cart items, user history, and limits.
   */
  public validateCoupon(
    code: string,
    cartItems: CartItemForCoupon[],
    userId?: string
  ): CouponValidationResponse {
    const coupon = this.getCouponByCode(code);
    if (!coupon) {
      return { valid: false, eligibleSubtotal: 0, discountAmount: 0, reason: 'Invalid coupon code.' };
    }

    if (coupon.is_active === 0) {
      return { valid: false, eligibleSubtotal: 0, discountAmount: 0, reason: 'This coupon is currently inactive.' };
    }

    const now = new Date().toISOString();
    if (coupon.valid_from && now < coupon.valid_from) {
      return { valid: false, eligibleSubtotal: 0, discountAmount: 0, reason: 'This promotional coupon has not started yet.' };
    }
    if (coupon.valid_until && now > coupon.valid_until) {
      return { valid: false, eligibleSubtotal: 0, discountAmount: 0, reason: 'This promotional coupon has expired.' };
    }

    if (coupon.times_used >= coupon.usage_limit) {
      return { valid: false, eligibleSubtotal: 0, discountAmount: 0, reason: 'This coupon has reached its maximum global redemption limit.' };
    }

    // Per-user limit verification
    if (userId) {
      const userUsage = this.db.prepare(`
        SELECT COUNT(*) as count FROM coupon_usages WHERE coupon_id = ? AND user_id = ?
      `).get(coupon.id, userId) as { count: number };

      if (userUsage && userUsage.count >= coupon.per_user_limit) {
        return { 
          valid: false, 
          eligibleSubtotal: 0, 
          discountAmount: 0, 
          reason: `You have already redeemed this coupon the maximum allowed times (${coupon.per_user_limit}).` 
        };
      }

      // First-order coupon check
      if (coupon.is_first_order_only === 1) {
        const orderHistory = this.db.prepare(`
          SELECT COUNT(*) as count FROM orders WHERE user_id = ? AND order_status != 'CANCELLED'
        `).get(userId) as { count: number };

        if (orderHistory && orderHistory.count > 0) {
          return {
            valid: false,
            eligibleSubtotal: 0,
            discountAmount: 0,
            reason: 'This coupon is exclusively reserved for first-time customers.'
          };
        }
      }
    }

    // Calculate eligible subtotal based on category / product restrictions
    let eligibleSubtotal = 0;
    for (const item of cartItems) {
      let isItemEligible = true;

      if (coupon.product_id && item.productId !== coupon.product_id) {
        isItemEligible = false;
      }

      if (coupon.category_id && item.categoryId && item.categoryId !== coupon.category_id) {
        isItemEligible = false;
      }

      if (isItemEligible) {
        eligibleSubtotal += item.unitPrice * item.quantity;
      }
    }

    if (eligibleSubtotal === 0) {
      if (coupon.product_id) {
        return { valid: false, eligibleSubtotal: 0, discountAmount: 0, reason: 'This coupon only applies to specific eligible items in the catalog.' };
      }
      if (coupon.category_id) {
        return { valid: false, eligibleSubtotal: 0, discountAmount: 0, reason: 'This coupon only applies to products in an eligible category.' };
      }
    }

    if (eligibleSubtotal < coupon.min_order_amount) {
      return {
        valid: false,
        eligibleSubtotal,
        discountAmount: 0,
        reason: `Minimum order amount of ₹${coupon.min_order_amount.toLocaleString('en-IN')} required to apply ${coupon.code}.`
      };
    }

    // Discount calculation
    let calculatedDiscount = 0;
    if (coupon.discount_type === 'PERCENT') {
      calculatedDiscount = (eligibleSubtotal * coupon.discount_value) / 100;
      if (coupon.max_discount_amount && calculatedDiscount > coupon.max_discount_amount) {
        calculatedDiscount = coupon.max_discount_amount;
      }
    } else if (coupon.discount_type === 'FLAT') {
      calculatedDiscount = Math.min(coupon.discount_value, eligibleSubtotal);
    }

    calculatedDiscount = Math.round(calculatedDiscount);

    return {
      valid: true,
      code: coupon.code,
      discountType: coupon.discount_type,
      discountValue: coupon.discount_value,
      eligibleSubtotal,
      discountAmount: calculatedDiscount,
      couponDetails: {
        id: coupon.id,
        description: coupon.discount_type === 'PERCENT'
          ? `${coupon.discount_value}% OFF${coupon.max_discount_amount ? ` up to ₹${coupon.max_discount_amount}` : ''}`
          : `Flat ₹${coupon.discount_value} OFF`,
        minOrderAmount: coupon.min_order_amount,
        maxDiscountAmount: coupon.max_discount_amount
      }
    };
  }

  /**
   * Records coupon redemption upon order completion.
   */
  public recordUsage(couponId: string, userId: string, orderId: string, discountAmount: number): void {
    const usageId = `usg_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    this.db.prepare(`
      INSERT INTO coupon_usages (id, coupon_id, user_id, order_id, discount_amount, used_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(usageId, couponId, userId, orderId, discountAmount);

    this.db.prepare(`
      UPDATE coupons 
      SET times_used = times_used + 1, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(couponId);
  }
}
