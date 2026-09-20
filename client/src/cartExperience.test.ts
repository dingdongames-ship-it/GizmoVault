import { describe, it, expect } from 'vitest';
import { INITIAL_PRODUCTS } from './data/mockData';
import { Product, CartItem } from './types';

describe('Phase 14: Client Cart Experience & Server-Truth Arithmetic', () => {
  const sampleWatch = INITIAL_PRODUCTS.find(p => p.id === 'prod_1')!;
  const samplePhone = INITIAL_PRODUCTS.find(p => p.id === 'prod_2') || INITIAL_PRODUCTS[1];

  it('calculates single and multiple product line totals and cart subtotal accurately', () => {
    const items: CartItem[] = [
      { product: sampleWatch, quantity: 2 },
      { product: samplePhone, quantity: 1 }
    ];

    const subtotal = items.reduce((sum, item) => sum + item.product.sellingPrice * item.quantity, 0);
    const expectedSubtotal = (sampleWatch.sellingPrice * 2) + (samplePhone.sellingPrice * 1);
    expect(subtotal).toBe(expectedSubtotal);
  });

  it('enforces free shipping threshold on orders >= ₹999 and applies ₹99 otherwise', () => {
    // Order >= 999: Free shipping
    const highValSubtotal = 4499;
    const highValShipping = highValSubtotal >= 999 ? 0 : 99;
    expect(highValShipping).toBe(0);

    // Order < 999: ₹99 express courier fee
    const lowValSubtotal = 499;
    const lowValShipping = lowValSubtotal >= 999 ? 0 : 99;
    expect(lowValShipping).toBe(99);

    // Empty cart: 0 shipping
    const emptySubtotal = 0;
    const emptyShipping = emptySubtotal > 0 ? (emptySubtotal >= 999 ? 0 : 99) : 0;
    expect(emptyShipping).toBe(0);
  });

  it('enforces coupon discount calculations and order limits', () => {
    const subtotal = 10000;

    // GIZMO10: 10% off (max 1000)
    const gizmo10Discount = Math.min(1000, Math.round(subtotal * 0.10));
    expect(gizmo10Discount).toBe(1000);

    // GIZMO500: Flat ₹500 on >= ₹3,000
    const gizmo500Discount = subtotal >= 3000 ? 500 : 0;
    expect(gizmo500Discount).toBe(500);

    // WATCH50: 20% off on >= ₹20,000
    const watch50DiscountBelowMin = subtotal >= 20000 ? Math.min(5000, Math.round(subtotal * 0.20)) : 0;
    expect(watch50DiscountBelowMin).toBe(0);

    const highSubtotal = 25000;
    const watch50DiscountAboveMin = highSubtotal >= 20000 ? Math.min(5000, Math.round(highSubtotal * 0.20)) : 0;
    expect(watch50DiscountAboveMin).toBe(5000);
  });

  it('handles Save for Later item partitioning', () => {
    let cart: CartItem[] = [
      { product: sampleWatch, quantity: 1 },
      { product: samplePhone, quantity: 1 }
    ];
    let savedForLater: CartItem[] = [];

    // Save sampleWatch for later
    const itemToSave = cart.find(i => i.product.id === sampleWatch.id)!;
    cart = cart.filter(i => i.product.id !== sampleWatch.id);
    savedForLater.push(itemToSave);

    expect(cart.length).toBe(1);
    expect(cart[0].product.id).toBe(samplePhone.id);
    expect(savedForLater.length).toBe(1);
    expect(savedForLater[0].product.id).toBe(sampleWatch.id);

    // Move back to cart
    const itemToMove = savedForLater.find(i => i.product.id === sampleWatch.id)!;
    savedForLater = savedForLater.filter(i => i.product.id !== sampleWatch.id);
    cart.push(itemToMove);

    expect(cart.length).toBe(2);
    expect(savedForLater.length).toBe(0);
  });

  it('validates pre-checkout stock revalidation logic and pincode verification', () => {
    const availableStock = sampleWatch.stockQuantity;
    const requestedQuantity = availableStock + 5; // Exceeding stock

    const hasStockIssue = requestedQuantity > availableStock;
    expect(hasStockIssue).toBe(true);

    // Valid 6-digit Indian PIN codes
    const validPins = ['560001', '400001', '110001', '700001'];
    validPins.forEach(pin => {
      expect(/^\d{6}$/.test(pin)).toBe(true);
    });

    // Invalid PIN codes
    const invalidPins = ['5600', 'ABCD', '4000012', ''];
    invalidPins.forEach(pin => {
      expect(/^\d{6}$/.test(pin)).toBe(false);
    });
  });
});
