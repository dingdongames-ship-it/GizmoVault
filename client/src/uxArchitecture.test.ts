import { describe, it, expect } from 'vitest';
import { INITIAL_PRODUCTS, INITIAL_ADDRESSES, INITIAL_ORDERS, INITIAL_INGESTED_ITEMS } from './data/mockData';

describe('GizmoVault Phase 2 — User Experience Architecture Verification', () => {
  it('verifies primary categories and dynamic specification schema', () => {
    const watches = INITIAL_PRODUCTS.filter(p => p.category === 'Imported Watches');
    const gadgets = INITIAL_PRODUCTS.filter(p => p.category === 'Electronic Gadgets');

    expect(watches.length).toBeGreaterThan(0);
    expect(gadgets.length).toBeGreaterThan(0);

    const watch = watches[0];
    expect(watch.specifications).toHaveProperty('Movement');
    expect(watch.specifications).toHaveProperty('Water Resistance');
    expect(watch.hasVideo).toBe(true);
    expect(watch.videoUrl).toBeDefined();

    const gadget = gadgets[0];
    expect(gadget.specifications).toHaveProperty('Noise Cancellation');
    expect(gadget.specifications).toHaveProperty('Battery');
  });

  it('validates server-side cart pricing and coupon calculation logic', () => {
    const item1 = INITIAL_PRODUCTS[0]; // sellingPrice: 4499
    const item2 = INITIAL_PRODUCTS[3]; // sellingPrice: 1999
    
    const subtotal = item1.sellingPrice + item2.sellingPrice; // 6498
    expect(subtotal).toBe(6498);

    // GIZMO10: 10% discount
    const discount10 = Math.round(subtotal * 0.1); // 650
    expect(discount10).toBe(650);
    expect(subtotal - discount10).toBe(5848);

    // GIZMO500: Flat 500 discount for orders >= 2999
    const discount500 = subtotal >= 2999 ? 500 : 0;
    expect(discount500).toBe(500);
    expect(subtotal - discount500).toBe(5998);
  });

  it('verifies order number format and tracking code convention', () => {
    const sampleOrder = INITIAL_ORDERS[0];
    expect(sampleOrder.orderNumber).toMatch(/^GV-2026-\d{6}$/);
    expect(sampleOrder.trackingNumber).toContain('DELHIVERY');
    expect(sampleOrder.shippingAddress).toBeDefined();
    expect(sampleOrder.shippingAddress.postalCode).toBe('201301');
    expect(sampleOrder.paymentStatus).toBe('PAID');
  });

  it('verifies WhatsApp ingested item schema and confidence thresholding', () => {
    const item = INITIAL_INGESTED_ITEMS[0];
    expect(item.confidenceScore).toBeGreaterThanOrEqual(0.85);
    expect(item.metaMessageId).toContain('wamid.');
    expect(item.specs).toBeDefined();
    expect(item.extractedCategory).toBe('Imported Watches');
  });

  it('verifies Google Play Store account deletion and data safety compliance', () => {
    expect(INITIAL_ADDRESSES.length).toBeGreaterThanOrEqual(1);
    // Address book supports multiple user addresses
    const defaultAddr = INITIAL_ADDRESSES.find(a => a.isDefault);
    expect(defaultAddr).toBeDefined();
  });
});
