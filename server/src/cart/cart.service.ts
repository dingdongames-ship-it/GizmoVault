import { DatabaseSync } from 'node:sqlite';
import crypto from 'crypto';
import { getDb } from '../db/connection.js';

export interface CartItemEntity {
  id: string;
  cartId: string;
  productId: string;
  quantity: number;
  isSavedForLater: boolean;
  product: {
    id: string;
    sku: string;
    title: string;
    category: string;
    brand: string;
    model?: string;
    sellingPrice: number;
    originalPrice: number;
    discountPercent: number;
    primaryImage: string;
    stockQuantity: number;
    stockStatus: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
    warranty: string;
  };
  itemTotal: number;
}

export interface CouponValidationResult {
  valid: boolean;
  code?: string;
  discountType?: 'PERCENT' | 'FLAT';
  discountValue?: number;
  discountAmount: number;
  reason?: string;
}

export interface ValidatedCart {
  cartId: string;
  items: CartItemEntity[];
  savedForLaterItems: CartItemEntity[];
  totalItemCount: number;
  subtotal: number;
  originalSubtotal: number;
  productDiscountTotal: number;
  coupon?: CouponValidationResult;
  couponDiscountTotal: number;
  shippingFee: number;
  taxAmount: number;
  grandTotal: number;
  warnings: string[];
  canProceedToCheckout: boolean;
}

export class CartService {
  private db: DatabaseSync;

  constructor(customDb?: DatabaseSync) {
    this.db = customDb || getDb();
  }

  /**
   * Locate existing cart by userId or sessionId, or create a fresh cart record.
   */
  public getOrCreateCart(userId?: string, sessionId?: string): string {
    if (userId) {
      const existingUserCart = this.db
        .prepare('SELECT id FROM carts WHERE user_id = ?')
        .get(userId) as { id: string } | undefined;
      if (existingUserCart) return existingUserCart.id;
    }

    if (sessionId) {
      const existingSessionCart = this.db
        .prepare('SELECT id FROM carts WHERE session_id = ?')
        .get(sessionId) as { id: string } | undefined;
      if (existingSessionCart) return existingSessionCart.id;
    }

    const newCartId = `crt_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const insertStmt = this.db.prepare(`
      INSERT INTO carts (id, user_id, session_id, created_at, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);
    insertStmt.run(newCartId, userId || null, sessionId || null);
    return newCartId;
  }

  /**
   * Retrieves cart and executes full server-truth calculation.
   */
  public getCartDetails(cartId: string, couponCode?: string): ValidatedCart {
    const rawItems = this.db.prepare(`
      SELECT 
        ci.id as item_id,
        ci.cart_id,
        ci.product_id,
        ci.quantity,
        ci.is_saved_for_later,
        p.id as prod_id,
        p.sku,
        p.title,
        c.name as category_name,
        b.name as brand_name,
        p.model,
        p.selling_price,
        p.original_price,
        p.discount_percent,
        p.stock_quantity,
        p.stock_status,
        p.warranty_info,
        p.is_published,
        p.deleted_at,
        (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) as primary_image
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN brands b ON p.brand_id = b.id
      WHERE ci.cart_id = ?
      ORDER BY ci.created_at DESC
    `).all(cartId) as any[];

    const activeItems: CartItemEntity[] = [];
    const savedForLaterItems: CartItemEntity[] = [];
    const warnings: string[] = [];

    let subtotal = 0;
    let originalSubtotal = 0;
    let totalItemCount = 0;
    let canProceed = true;

    for (const row of rawItems) {
      if (row.is_published === 0 || row.deleted_at !== null) {
        warnings.push(`Item "${row.title}" is no longer available.`);
        canProceed = false;
        continue;
      }

      const isSaved = row.is_saved_for_later === 1;
      const liveStock = row.stock_quantity;
      const requestedQty = row.quantity;

      if (!isSaved) {
        if (liveStock <= 0) {
          warnings.push(`"${row.title}" is currently out of stock.`);
          canProceed = false;
        } else if (requestedQty > liveStock) {
          warnings.push(`Only ${liveStock} units available for "${row.title}". Please adjust quantity.`);
          canProceed = false;
        }
      }

      const itemTotal = row.selling_price * requestedQty;
      const entity: CartItemEntity = {
        id: row.item_id,
        cartId: row.cart_id,
        productId: row.prod_id,
        quantity: requestedQty,
        isSavedForLater: isSaved,
        product: {
          id: row.prod_id,
          sku: row.sku,
          title: row.title,
          category: row.category_name || 'General',
          brand: row.brand_name || 'GizmoVault',
          model: row.model || undefined,
          sellingPrice: row.selling_price,
          originalPrice: row.original_price,
          discountPercent: row.discount_percent,
          primaryImage: row.primary_image || 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=800&q=80',
          stockQuantity: liveStock,
          stockStatus: liveStock <= 0 ? 'OUT_OF_STOCK' : liveStock < 5 ? 'LOW_STOCK' : 'IN_STOCK',
          warranty: row.warranty_info || '1 Year Manufacturer Warranty'
        },
        itemTotal
      };

      if (isSaved) {
        savedForLaterItems.push(entity);
      } else {
        activeItems.push(entity);
        subtotal += itemTotal;
        originalSubtotal += row.original_price * requestedQty;
        totalItemCount += requestedQty;
      }
    }

    if (activeItems.length === 0) {
      canProceed = false;
    }

    // Coupon Validation
    let couponResult: CouponValidationResult | undefined;
    let couponDiscountTotal = 0;

    if (couponCode && couponCode.trim()) {
      couponResult = this.validateCoupon(couponCode.trim(), subtotal);
      if (couponResult.valid) {
        couponDiscountTotal = couponResult.discountAmount;
      } else {
        warnings.push(`Coupon "${couponCode}": ${couponResult.reason}`);
      }
    }

    // Shipping rule: Free shipping on orders >= ₹999; ₹99 otherwise (if cart has items)
    const shippingFee = totalItemCount > 0 && subtotal >= 999 ? 0 : totalItemCount > 0 ? 99 : 0;
    const taxAmount = 0; // Inclusive of taxes
    const productDiscountTotal = originalSubtotal - subtotal;
    const grandTotal = Math.max(0, subtotal - couponDiscountTotal + shippingFee + taxAmount);

    return {
      cartId,
      items: activeItems,
      savedForLaterItems,
      totalItemCount,
      subtotal,
      originalSubtotal,
      productDiscountTotal,
      coupon: couponResult,
      couponDiscountTotal,
      shippingFee,
      taxAmount,
      grandTotal,
      warnings,
      canProceedToCheckout: canProceed && warnings.filter(w => !w.startsWith('Coupon')).length === 0
    };
  }

  /**
   * Adds an item to active cart, checking inventory bounds.
   */
  public addItem(cartId: string, productId: string, quantity: number = 1): ValidatedCart {
    if (quantity < 1) {
      throw new Error('Quantity must be at least 1');
    }

    const product = this.db.prepare('SELECT id, title, stock_quantity, is_published, deleted_at FROM products WHERE id = ?').get(productId) as any;
    if (!product || product.is_published === 0 || product.deleted_at !== null) {
      throw new Error('Product not found or unavailable');
    }

    if (product.stock_quantity <= 0) {
      throw new Error(`Product "${product.title}" is out of stock`);
    }

    // Check if product is already in cart
    const existing = this.db.prepare('SELECT id, quantity FROM cart_items WHERE cart_id = ? AND product_id = ?').get(cartId, productId) as any;

    if (existing) {
      const newQty = existing.quantity + quantity;
      if (newQty > product.stock_quantity) {
        throw new Error(`Cannot add ${quantity} more. Only ${product.stock_quantity} units available in stock (already ${existing.quantity} in cart)`);
      }
      this.db.prepare(`
        UPDATE cart_items 
        SET quantity = ?, is_saved_for_later = 0, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(newQty, existing.id);
    } else {
      if (quantity > product.stock_quantity) {
        throw new Error(`Only ${product.stock_quantity} units available in stock`);
      }
      const itemId = `ci_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
      this.db.prepare(`
        INSERT INTO cart_items (id, cart_id, product_id, quantity, is_saved_for_later, created_at, updated_at)
        VALUES (?, ?, ?, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run(itemId, cartId, productId, quantity);
    }

    this.touchCart(cartId);
    return this.getCartDetails(cartId);
  }

  /**
   * Adjusts quantity for an existing cart item.
   */
  public updateQuantity(cartId: string, productId: string, quantity: number): ValidatedCart {
    if (quantity <= 0) {
      return this.removeItem(cartId, productId);
    }

    const product = this.db.prepare('SELECT id, title, stock_quantity FROM products WHERE id = ?').get(productId) as any;
    if (!product) {
      throw new Error('Product not found');
    }

    if (quantity > product.stock_quantity) {
      throw new Error(`Only ${product.stock_quantity} units available for "${product.title}"`);
    }

    const updateStmt = this.db.prepare(`
      UPDATE cart_items 
      SET quantity = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE cart_id = ? AND product_id = ?
    `);
    const result = updateStmt.run(quantity, cartId, productId);
    if (result.changes === 0) {
      throw new Error('Item not found in cart');
    }

    this.touchCart(cartId);
    return this.getCartDetails(cartId);
  }

  /**
   * Removes an item completely from cart.
   */
  public removeItem(cartId: string, productId: string): ValidatedCart {
    this.db.prepare('DELETE FROM cart_items WHERE cart_id = ? AND product_id = ?').run(cartId, productId);
    this.touchCart(cartId);
    return this.getCartDetails(cartId);
  }

  /**
   * Moves an active item to Saved For Later.
   */
  public saveForLater(cartId: string, productId: string): ValidatedCart {
    const res = this.db.prepare(`
      UPDATE cart_items 
      SET is_saved_for_later = 1, updated_at = CURRENT_TIMESTAMP 
      WHERE cart_id = ? AND product_id = ?
    `).run(cartId, productId);

    if (res.changes === 0) {
      throw new Error('Item not found in cart');
    }

    this.touchCart(cartId);
    return this.getCartDetails(cartId);
  }

  /**
   * Moves a Saved For Later item back to Active Cart.
   */
  public moveToCart(cartId: string, productId: string): ValidatedCart {
    const product = this.db.prepare('SELECT id, stock_quantity, is_published, deleted_at FROM products WHERE id = ?').get(productId) as any;
    if (!product || product.is_published === 0 || product.deleted_at !== null || product.stock_quantity <= 0) {
      throw new Error('Item is currently out of stock and cannot be moved to cart');
    }

    const res = this.db.prepare(`
      UPDATE cart_items 
      SET is_saved_for_later = 0, updated_at = CURRENT_TIMESTAMP 
      WHERE cart_id = ? AND product_id = ?
    `).run(cartId, productId);

    if (res.changes === 0) {
      throw new Error('Item not found in saved list');
    }

    this.touchCart(cartId);
    return this.getCartDetails(cartId);
  }

  /**
   * Validates a promotional coupon code against order subtotal and limits.
   */
  public validateCoupon(code: string, subtotal: number): CouponValidationResult {
    const coupon = this.db.prepare(`
      SELECT * FROM coupons 
      WHERE UPPER(code) = UPPER(?) AND is_active = 1
    `).get(code) as any;

    if (!coupon) {
      return { valid: false, discountAmount: 0, reason: 'Invalid or inactive coupon code' };
    }

    const now = new Date().toISOString();
    if (coupon.valid_from && now < coupon.valid_from) {
      return { valid: false, discountAmount: 0, reason: 'Coupon is not yet active' };
    }
    if (coupon.valid_until && now > coupon.valid_until) {
      return { valid: false, discountAmount: 0, reason: 'Coupon has expired' };
    }

    if (subtotal < coupon.min_order_amount) {
      return { 
        valid: false, 
        discountAmount: 0, 
        reason: `Minimum order value of ₹${coupon.min_order_amount.toLocaleString('en-IN')} required for this coupon` 
      };
    }

    let discountAmount = 0;
    if (coupon.discount_type === 'PERCENT') {
      discountAmount = (subtotal * coupon.discount_value) / 100;
      if (coupon.max_discount_amount && discountAmount > coupon.max_discount_amount) {
        discountAmount = coupon.max_discount_amount;
      }
    } else if (coupon.discount_type === 'FLAT') {
      discountAmount = Math.min(coupon.discount_value, subtotal);
    }

    return {
      valid: true,
      code: coupon.code,
      discountType: coupon.discount_type,
      discountValue: coupon.discount_value,
      discountAmount: Math.round(discountAmount)
    };
  }

  /**
   * Pre-checkout full revalidation gate.
   */
  public validateBeforeCheckout(
    cartId: string, 
    couponCode?: string, 
    shippingPincode?: string
  ): {
    canProceed: boolean;
    validatedCart: ValidatedCart;
    errors: string[];
  } {
    const cart = this.getCartDetails(cartId, couponCode);
    const errors: string[] = [];

    if (cart.items.length === 0) {
      errors.push('Cart is empty. Please add items before proceeding to checkout.');
    }

    for (const item of cart.items) {
      if (item.product.stockStatus === 'OUT_OF_STOCK' || item.product.stockQuantity <= 0) {
        errors.push(`"${item.product.title}" is out of stock.`);
      } else if (item.quantity > item.product.stockQuantity) {
        errors.push(`Only ${item.product.stockQuantity} units available for "${item.product.title}".`);
      }
    }

    if (shippingPincode) {
      if (!/^\d{6}$/.test(shippingPincode.trim())) {
        errors.push('Invalid delivery PIN code. Must be a 6-digit Indian Postal Code.');
      }
    }

    if (couponCode && cart.coupon && !cart.coupon.valid) {
      errors.push(`Coupon issue: ${cart.coupon.reason}`);
    }

    return {
      canProceed: errors.length === 0 && cart.canProceedToCheckout,
      validatedCart: cart,
      errors
    };
  }

  /**
   * Clear active cart items upon order placement.
   */
  public clearCart(cartId: string): void {
    this.db.prepare('DELETE FROM cart_items WHERE cart_id = ? AND is_saved_for_later = 0').run(cartId);
    this.touchCart(cartId);
  }

  private touchCart(cartId: string): void {
    this.db.prepare('UPDATE carts SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(cartId);
  }
}
