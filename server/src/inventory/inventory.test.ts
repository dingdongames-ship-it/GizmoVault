import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { runMigrations } from '../db/migrator.js';
import { seedDatabase } from '../db/seed.js';
import { InventoryService } from './inventory.service.js';

describe('Phase 24 — Inventory Management System', () => {
  let db: DatabaseSync;
  let invService: InventoryService;
  let testProductId: string;

  beforeEach(() => {
    db = new DatabaseSync(':memory:');
    runMigrations(db);
    seedDatabase(db);
    invService = new InventoryService(db);

    const product = db.prepare(
      `SELECT id FROM products WHERE is_published = 1 AND deleted_at IS NULL AND stock_quantity > 0 LIMIT 1`
    ).get() as { id: string } | undefined;
    testProductId = product?.id || '';
  });

  afterEach(() => { db.close(); });

  it('getInventory returns correct fields for a seeded product', () => {
    if (!testProductId) return;
    const inv = invService.getInventory(testProductId);
    expect(inv.productId).toBe(testProductId);
    expect(typeof inv.stockQuantity).toBe('number');
    expect(typeof inv.reservedQuantity).toBe('number');
    expect(inv.availableQuantity).toBe(inv.stockQuantity - inv.reservedQuantity);
    expect(['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK']).toContain(inv.status);
  });

  it('getInventory throws for nonexistent product', () => {
    expect(() => invService.getInventory('nonexistent-prod')).toThrow('not found');
  });

  it('reserveInventory creates reservation and reduces available stock', () => {
    if (!testProductId) return;
    const before = invService.getInventory(testProductId);
    const orderId = `ord_test_${Date.now()}`;
    const qty = 1;

    invService.reserveInventory(orderId, [{ productId: testProductId, quantity: qty }]);

    const after = invService.getInventory(testProductId);
    expect(after.reservedQuantity).toBe(before.reservedQuantity + qty);
    expect(after.availableQuantity).toBe(before.availableQuantity - qty);
    // stockQuantity should NOT be decremented yet
    expect(after.stockQuantity).toBe(before.stockQuantity);
  });

  it('reserveInventory throws when insufficient stock', () => {
    if (!testProductId) return;
    const inv = invService.getInventory(testProductId);
    // Request way more than available
    expect(() =>
      invService.reserveInventory('ord_overstock', [{ productId: testProductId, quantity: inv.stockQuantity + 9999 }])
    ).toThrow('Insufficient stock');
  });

  it('confirmInventoryDeduction decrements stockQuantity after payment success', () => {
    if (!testProductId) return;
    const before = invService.getInventory(testProductId);
    const orderId = `ord_confirm_${Date.now()}`;

    invService.reserveInventory(orderId, [{ productId: testProductId, quantity: 1 }]);
    invService.confirmInventoryDeduction(orderId);

    const after = invService.getInventory(testProductId);
    expect(after.stockQuantity).toBe(before.stockQuantity - 1);
    expect(after.reservedQuantity).toBe(0); // confirmed = no longer reserved
  });

  it('releaseInventoryReservation restores available stock without changing stockQuantity', () => {
    if (!testProductId) return;
    const before = invService.getInventory(testProductId);
    const orderId = `ord_release_${Date.now()}`;

    invService.reserveInventory(orderId, [{ productId: testProductId, quantity: 1 }]);

    // Release the reservation (payment failed / cancelled)
    invService.releaseInventoryReservation(orderId);

    const after = invService.getInventory(testProductId);
    expect(after.availableQuantity).toBe(before.availableQuantity); // back to original
    expect(after.stockQuantity).toBe(before.stockQuantity); // stock unchanged
    expect(after.reservedQuantity).toBe(0);
  });

  it('checkAvailability returns canFulfill=true for valid quantities', () => {
    if (!testProductId) return;
    const result = invService.checkAvailability([{ productId: testProductId, quantity: 1 }]);
    expect(result.canFulfill).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('checkAvailability returns canFulfill=false with issues for excess quantity', () => {
    if (!testProductId) return;
    const result = invService.checkAvailability([{ productId: testProductId, quantity: 999999 }]);
    expect(result.canFulfill).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it('adjustStock increases stock_quantity by the adjustment amount', () => {
    if (!testProductId) return;
    const before = invService.getInventory(testProductId);
    invService.adjustStock(testProductId, 10);
    const after = invService.getInventory(testProductId);
    expect(after.stockQuantity).toBe(before.stockQuantity + 10);
  });
});
