import { DatabaseSync } from 'node:sqlite';
import crypto from 'crypto';
import { getDb } from '../db/connection.js';

// ─────────────────────────────────────────────────────────────────────
// Phase 24: Inventory Management System
// Per GizmoVault.txt Phase 24:
//   - Stock quantity, reserved stock, available stock
//   - When order placed: reserve inventory
//   - When payment succeeds: confirm deduction
//   - When cancelled/failed: release reservation
//   - Prevent overselling
// ─────────────────────────────────────────────────────────────────────

export type InventoryStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'RESERVED';

export interface InventoryRecord {
  productId: string;
  stockQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  lowStockThreshold: number;
  status: InventoryStatus;
}

export interface InventoryReservation {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  status: 'RESERVED' | 'CONFIRMED' | 'RELEASED';
  createdAt: string;
  updatedAt: string;
}

export class InventoryService {
  private db: DatabaseSync;

  constructor(customDb?: DatabaseSync) {
    this.db = customDb || getDb();
    this.ensureReservationsTable();
  }

  /**
   * Creates the inventory_reservations table if it doesn't exist.
   * This is a lightweight migration for this phase.
   */
  private ensureReservationsTable(): void {
    this.db.prepare(`
      CREATE TABLE IF NOT EXISTS inventory_reservations (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        status TEXT DEFAULT 'RESERVED',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    this.db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_res_order ON inventory_reservations(order_id)
    `).run();
    this.db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_res_product ON inventory_reservations(product_id, status)
    `).run();
  }

  /**
   * Returns current inventory state for a product.
   */
  public getInventory(productId: string): InventoryRecord {
    const product = this.db.prepare(
      `SELECT id, stock_quantity, low_stock_threshold FROM products WHERE id = ?`
    ).get(productId) as { id: string; stock_quantity: number; low_stock_threshold: number } | undefined;

    if (!product) {
      throw new Error(`Product ${productId} not found.`);
    }

    const reservedRow = this.db.prepare(
      `SELECT COALESCE(SUM(quantity), 0) as reserved
       FROM inventory_reservations WHERE product_id = ? AND status = 'RESERVED'`
    ).get(productId) as { reserved: number };

    const reserved = reservedRow.reserved || 0;
    const available = Math.max(0, product.stock_quantity - reserved);

    let status: InventoryStatus;
    if (available === 0) {
      status = 'OUT_OF_STOCK';
    } else if (available <= product.low_stock_threshold) {
      status = 'LOW_STOCK';
    } else {
      status = 'IN_STOCK';
    }

    return {
      productId,
      stockQuantity: product.stock_quantity,
      reservedQuantity: reserved,
      availableQuantity: available,
      lowStockThreshold: product.low_stock_threshold,
      status
    };
  }

  /**
   * Reserves inventory for an order.
   * Called when order is placed (PAYMENT_PENDING state).
   * Throws if insufficient stock to prevent overselling.
   */
  public reserveInventory(
    orderId: string,
    items: Array<{ productId: string; quantity: number }>
  ): InventoryReservation[] {
    // First, check all items have enough available stock
    for (const item of items) {
      const inv = this.getInventory(item.productId);
      if (inv.availableQuantity < item.quantity) {
        throw new Error(
          `Insufficient stock for product ${item.productId}. ` +
          `Requested: ${item.quantity}, Available: ${inv.availableQuantity}`
        );
      }
    }

    // All checks passed — create reservations in a batch
    const reservations: InventoryReservation[] = [];
    const now = new Date().toISOString();

    for (const item of items) {
      const resId = `res_${crypto.randomBytes(8).toString('hex')}`;
      this.db.prepare(`
        INSERT INTO inventory_reservations (id, order_id, product_id, quantity, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'RESERVED', ?, ?)
      `).run(resId, orderId, item.productId, item.quantity, now, now);

      reservations.push({
        id: resId,
        orderId,
        productId: item.productId,
        quantity: item.quantity,
        status: 'RESERVED',
        createdAt: now,
        updatedAt: now
      });
    }

    return reservations;
  }

  /**
   * Confirms inventory deduction when payment succeeds.
   * Actually decrements stock_quantity and marks reservations as CONFIRMED.
   */
  public confirmInventoryDeduction(orderId: string): void {
    const reservations = this.db.prepare(
      `SELECT * FROM inventory_reservations WHERE order_id = ? AND status = 'RESERVED'`
    ).all(orderId) as any[];

    if (reservations.length === 0) {
      // Idempotent — already confirmed or no reservations
      return;
    }

    for (const res of reservations) {
      // Decrement actual stock
      this.db.prepare(`
        UPDATE products SET
          stock_quantity = MAX(0, stock_quantity - ?),
          stock_status = CASE
            WHEN MAX(0, stock_quantity - ?) = 0 THEN 'OUT_OF_STOCK'
            WHEN MAX(0, stock_quantity - ?) <= low_stock_threshold THEN 'LOW_STOCK'
            ELSE 'IN_STOCK'
          END,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(res.quantity, res.quantity, res.quantity, res.product_id);

      // Mark reservation as CONFIRMED
      this.db.prepare(`
        UPDATE inventory_reservations SET status = 'CONFIRMED', updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(res.id);
    }
  }

  /**
   * Releases reserved inventory when payment fails or order is cancelled.
   * Does NOT change stock_quantity — only removes the RESERVED hold.
   */
  public releaseInventoryReservation(orderId: string): void {
    this.db.prepare(`
      UPDATE inventory_reservations SET status = 'RELEASED', updated_at = CURRENT_TIMESTAMP
      WHERE order_id = ? AND status = 'RESERVED'
    `).run(orderId);
  }

  /**
   * Admin: adjust stock quantity (restock, manual correction).
   */
  public adjustStock(productId: string, adjustment: number, reason?: string): InventoryRecord {
    const product = this.db.prepare(
      `SELECT stock_quantity, low_stock_threshold FROM products WHERE id = ?`
    ).get(productId) as any;

    if (!product) throw new Error(`Product ${productId} not found.`);

    const newQty = Math.max(0, product.stock_quantity + adjustment);
    const newStatus = newQty === 0 ? 'OUT_OF_STOCK' :
      newQty <= product.low_stock_threshold ? 'LOW_STOCK' : 'IN_STOCK';

    this.db.prepare(`
      UPDATE products SET stock_quantity = ?, stock_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(newQty, newStatus, productId);

    return this.getInventory(productId);
  }

  /**
   * Checks if a list of items can all be fulfilled (pre-checkout check).
   */
  public checkAvailability(items: Array<{ productId: string; quantity: number }>): {
    canFulfill: boolean;
    issues: Array<{ productId: string; requested: number; available: number }>;
  } {
    const issues: Array<{ productId: string; requested: number; available: number }> = [];

    for (const item of items) {
      try {
        const inv = this.getInventory(item.productId);
        if (inv.availableQuantity < item.quantity) {
          issues.push({ productId: item.productId, requested: item.quantity, available: inv.availableQuantity });
        }
      } catch {
        issues.push({ productId: item.productId, requested: item.quantity, available: 0 });
      }
    }

    return { canFulfill: issues.length === 0, issues };
  }
}
