import { DatabaseSync } from 'node:sqlite';
import crypto from 'crypto';
import { getDb } from '../db/connection.js';

// ─────────────────────────────────────────────────────────────────────
// Phase 19: Order Lifecycle Management
// Per GizmoVault.txt:
//   Order lifecycle: CART → CHECKOUT → PAYMENT_PENDING → PAID →
//     PROCESSING → PACKED → SHIPPED → OUT_FOR_DELIVERY → DELIVERED
//   Alternative states: CANCELLED, FAILED, RETURN_REQUESTED, RETURNED, REFUNDED
//   Unique order number format: GV-2026-000001
// ─────────────────────────────────────────────────────────────────────

export type OrderStatus =
  | 'PAYMENT_PENDING'
  | 'PAID'
  | 'PROCESSING'
  | 'PACKED'
  | 'SHIPPED'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'FAILED'
  | 'RETURN_REQUESTED'
  | 'RETURNED'
  | 'REFUNDED';

export type PaymentStatusDB =
  | 'PENDING'
  | 'AUTHORIZED'
  | 'PAID'
  | 'FAILED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED';

export interface CreateOrderInput {
  userId: string;
  addressId: string;
  items: Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    titleSnapshot: string;
    skuSnapshot: string;
  }>;
  subtotal: number;
  discountTotal?: number;
  couponId?: string;
  shippingFee?: number;
  taxAmount?: number;
  grandTotal: number;
  currency?: string;
  paymentMethod?: string;
  notes?: string;
  shippingAddressSnapshot: string; // JSON snapshot of address at time of order
}

export interface OrderRecord {
  id: string;
  order_number: string;
  user_id: string;
  address_id: string;
  subtotal: number;
  discount_total: number;
  coupon_id: string | null;
  shipping_fee: number;
  tax_amount: number;
  grand_total: number;
  currency: string;
  order_status: OrderStatus;
  payment_status: PaymentStatusDB;
  shipping_address_snapshot: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  title_snapshot: string;
  sku_snapshot: string;
  unit_price: number;
  quantity: number;
  total_price: number;
  created_at: string;
}

export interface OrderWithItems extends OrderRecord {
  items: OrderItem[];
  shippingAddressParsed?: Record<string, any>;
}

// Valid order status transitions
const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PAYMENT_PENDING: ['PAID', 'CANCELLED', 'FAILED'],
  PAID: ['PROCESSING', 'CANCELLED', 'REFUNDED'],
  PROCESSING: ['PACKED', 'CANCELLED'],
  PACKED: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['OUT_FOR_DELIVERY', 'DELIVERED'],
  OUT_FOR_DELIVERY: ['DELIVERED'],
  DELIVERED: ['RETURN_REQUESTED'],
  CANCELLED: [],
  FAILED: ['PAYMENT_PENDING'],
  RETURN_REQUESTED: ['RETURNED', 'DELIVERED'],
  RETURNED: ['REFUNDED'],
  REFUNDED: []
};

export class OrderService {
  private db: DatabaseSync;
  private orderCounter = 0;

  constructor(customDb?: DatabaseSync) {
    this.db = customDb || getDb();
  }

  /**
   * Generates a unique order number in GV-YEAR-NNNNNN format.
   * Example: GV-2026-000001
   */
  public generateOrderNumber(): string {
    const year = new Date().getFullYear();
    // Get latest order to determine sequence
    const lastOrder = this.db.prepare(
      `SELECT order_number FROM orders ORDER BY created_at DESC LIMIT 1`
    ).get() as { order_number: string } | undefined;

    let sequence = 1;
    if (lastOrder?.order_number) {
      const parts = lastOrder.order_number.split('-');
      const lastSeq = parseInt(parts[2] || '0', 10);
      sequence = lastSeq + 1;
    }

    return `GV-${year}-${String(sequence).padStart(6, '0')}`;
  }

  /**
   * Creates a new order and its line items in a single transaction.
   * Validates that the address belongs to the user.
   */
  public createOrder(input: CreateOrderInput): OrderWithItems {
    // Verify address ownership
    const addr = this.db.prepare(
      `SELECT id FROM addresses WHERE id = ? AND user_id = ?`
    ).get(input.addressId, input.userId) as { id: string } | undefined;

    if (!addr) {
      throw new Error(`Address ${input.addressId} not found or does not belong to user ${input.userId}.`);
    }

    const orderId = `ord_${crypto.randomBytes(12).toString('hex')}`;
    const orderNumber = this.generateOrderNumber();
    const now = new Date().toISOString();

    // Insert order in a transaction
    const insertOrderTx = this.db.prepare(`
      INSERT INTO orders (
        id, order_number, user_id, address_id,
        subtotal, discount_total, coupon_id, shipping_fee, tax_amount, grand_total,
        currency, order_status, payment_status,
        shipping_address_snapshot, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertOrderTx.run(
      orderId, orderNumber, input.userId, input.addressId,
      input.subtotal, input.discountTotal || 0, input.couponId || null,
      input.shippingFee || 0, input.taxAmount || 0, input.grandTotal,
      input.currency || 'INR', 'PAYMENT_PENDING', 'PENDING',
      input.shippingAddressSnapshot, input.notes || null, now, now
    );

    // Insert order items
    const insertItemStmt = this.db.prepare(`
      INSERT INTO order_items (
        id, order_id, product_id, title_snapshot, sku_snapshot,
        unit_price, quantity, total_price, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of input.items) {
      insertItemStmt.run(
        `oi_${crypto.randomBytes(8).toString('hex')}`,
        orderId, item.productId, item.titleSnapshot, item.skuSnapshot,
        item.unitPrice, item.quantity, item.totalPrice, now
      );
    }

    return this.getOrderById(orderId)!;
  }

  /**
   * Retrieves a complete order with its items.
   */
  public getOrderById(orderId: string): OrderWithItems | null {
    const order = this.db.prepare(
      `SELECT * FROM orders WHERE id = ?`
    ).get(orderId) as unknown as OrderRecord | undefined;

    if (!order) return null;

    const items = this.db.prepare(
      `SELECT * FROM order_items WHERE order_id = ? ORDER BY created_at ASC`
    ).all(orderId) as unknown as OrderItem[];

    let shippingAddressParsed: Record<string, any> = {};
    try {
      shippingAddressParsed = JSON.parse(order.shipping_address_snapshot);
    } catch {}

    return { ...order, items, shippingAddressParsed };
  }

  /**
   * Retrieves all orders for a specific user.
   */
  public getOrdersByUser(userId: string): OrderWithItems[] {
    const orders = this.db.prepare(
      `SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC`
    ).all(userId) as unknown as OrderRecord[];

    return orders.map(order => {
      const items = this.db.prepare(
        `SELECT * FROM order_items WHERE order_id = ?`
      ).all(order.id) as unknown as OrderItem[];
      return { ...order, items };
    });
  }

  /**
   * Transitions an order to a new status, validating allowed transitions.
   */
  public transitionOrderStatus(
    orderId: string,
    newStatus: OrderStatus,
    userId?: string
  ): OrderWithItems {
    const order = this.getOrderById(orderId);
    if (!order) {
      throw new Error(`Order ${orderId} not found.`);
    }

    if (userId && order.user_id !== userId) {
      throw new Error('Unauthorized: You can only update your own orders.');
    }

    const allowedNext = ORDER_TRANSITIONS[order.order_status] || [];
    if (!allowedNext.includes(newStatus)) {
      throw new Error(
        `Invalid status transition: ${order.order_status} → ${newStatus}. ` +
        `Allowed next states: ${allowedNext.join(', ') || 'none (terminal state)'}`
      );
    }

    this.db.prepare(
      `UPDATE orders SET order_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).run(newStatus, orderId);

    return this.getOrderById(orderId)!;
  }

  /**
   * Marks payment as confirmed (server-side only — never accept frontend-only confirmation).
   * RULE 11: "Never mark an order paid based solely on frontend confirmation."
   */
  public markOrderPaid(orderId: string, paymentMethod?: string): OrderWithItems {
    const order = this.getOrderById(orderId);
    if (!order) throw new Error(`Order ${orderId} not found.`);

    if (!['PAYMENT_PENDING', 'FAILED'].includes(order.order_status)) {
      throw new Error(`Cannot mark as paid an order already in status: ${order.order_status}`);
    }

    this.db.prepare(`
      UPDATE orders SET
        order_status = 'PAID',
        payment_status = 'PAID',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(orderId);

    return this.getOrderById(orderId)!;
  }

  /**
   * Cancels an order if in a cancellable state.
   */
  public cancelOrder(orderId: string, userId?: string): OrderWithItems {
    return this.transitionOrderStatus(orderId, 'CANCELLED', userId);
  }

  /**
   * Lists all orders for admin panel with pagination.
   */
  public listAllOrders(options?: {
    status?: OrderStatus;
    page?: number;
    pageSize?: number;
  }): { orders: OrderRecord[]; total: number } {
    const page = options?.page || 1;
    const pageSize = options?.pageSize || 20;
    const offset = (page - 1) * pageSize;

    let query = 'SELECT * FROM orders';
    let countQuery = 'SELECT COUNT(*) as total FROM orders';
    const params: any[] = [];

    if (options?.status) {
      query += ' WHERE order_status = ?';
      countQuery += ' WHERE order_status = ?';
      params.push(options.status);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';

    const orders = this.db.prepare(query).all(...params, pageSize, offset) as unknown as OrderRecord[];
    const countRow = this.db.prepare(countQuery).get(...params) as { total: number };

    return { orders, total: countRow.total };
  }

  /**
   * Generates the order tracking timeline based on status history.
   */
  public getTrackingTimeline(orderId: string): Array<{
    status: OrderStatus;
    label: string;
    description: string;
    isCurrent: boolean;
    isCompleted: boolean;
  }> {
    const order = this.getOrderById(orderId);
    if (!order) throw new Error(`Order ${orderId} not found.`);

    const statusFlow: Array<{ status: OrderStatus; label: string; description: string }> = [
      { status: 'PAYMENT_PENDING', label: 'Order Placed', description: 'Your order has been received and payment is awaiting confirmation.' },
      { status: 'PAID', label: 'Payment Confirmed', description: 'Your payment has been verified and confirmed by our payment gateway.' },
      { status: 'PROCESSING', label: 'Processing', description: 'Our team is picking and verifying your items in the warehouse.' },
      { status: 'PACKED', label: 'Packed & Ready', description: 'Your order has been securely packed and is ready for handover to courier.' },
      { status: 'SHIPPED', label: 'Shipped', description: 'Your package has been dispatched and is on its way to you.' },
      { status: 'OUT_FOR_DELIVERY', label: 'Out for Delivery', description: 'Your order is with our delivery partner and will arrive today.' },
      { status: 'DELIVERED', label: 'Delivered', description: 'Your order has been delivered successfully. Enjoy your purchase!' }
    ];

    const currentIndex = statusFlow.findIndex(s => s.status === order.order_status);

    return statusFlow.map((step, idx) => ({
      ...step,
      isCurrent: step.status === order.order_status,
      isCompleted: currentIndex >= 0 && idx < currentIndex
    }));
  }
}
