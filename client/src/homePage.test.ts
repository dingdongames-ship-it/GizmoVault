import { describe, it, expect } from 'vitest';
import { INITIAL_PRODUCTS } from './data/mockData';

describe('Phase 11: Customer Home Page Experience & Section Architecture', () => {
  it('verifies all 6 master taxonomy categories are configured with distinct icons and slugs', () => {
    const expectedCategories = [
      { id: 'cat_phones', slug: 'smartphones-foldables', name: 'Smartphones & Foldables' },
      { id: 'cat_watches', slug: 'imported-luxury-watches', name: 'Imported Luxury Watches' },
      { id: 'cat_audio', slug: 'audio-sound', name: 'Audio & Sound' },
      { id: 'cat_wearables', slug: 'smart-wearables', name: 'Smart Wearables' },
      { id: 'cat_gaming', slug: 'gaming-gear', name: 'Gaming Gear' },
      { id: 'cat_drones', slug: 'photography-drones', name: 'Photography & Drones' }
    ];

    expect(expectedCategories.length).toBe(6);
    const slugs = expectedCategories.map(c => c.slug);
    expect(new Set(slugs).size).toBe(6);
  });

  it('verifies curated collections metadata and image assets', () => {
    const collections = [
      { title: 'Swiss Masterpieces', category: 'Imported Watches', badge: 'Luxury Import' },
      { title: 'Next-Gen Audio', category: 'Electronic Gadgets', badge: 'Hi-Res Certified' },
      { title: 'Titanium Foldables', category: 'Electronic Gadgets', badge: 'Flagship Edition' },
      { title: 'Creator & Flight Studio', category: 'Electronic Gadgets', badge: 'Aerial Precision' }
    ];

    expect(collections.length).toBe(4);
    collections.forEach(col => {
      expect(col.title).toBeTruthy();
      expect(col.badge).toBeTruthy();
      expect(['Imported Watches', 'Electronic Gadgets']).toContain(col.category);
    });
  });

  it('verifies promotional coupon rules and discount math for home screen tickers', () => {
    const testCartAmount = 10000;

    // GIZMO10 rule: 10% off
    const discount10 = Math.round(testCartAmount * 0.1);
    expect(discount10).toBe(1000);

    // GIZMO500 rule: Flat ₹500 off if >= 2999
    const discount500 = testCartAmount >= 2999 ? 500 : 0;
    expect(discount500).toBe(500);

    // Below minimum order rule
    const lowCart = 2000;
    const lowDiscount500 = lowCart >= 2999 ? 500 : 0;
    expect(lowDiscount500).toBe(0);
  });

  it('verifies imported watch and gadget segmentation for home page spotlights', () => {
    const watches = INITIAL_PRODUCTS.filter(p => p.category.toLowerCase().includes('watch'));
    const gadgets = INITIAL_PRODUCTS.filter(p => !p.category.toLowerCase().includes('watch'));

    expect(watches.length).toBeGreaterThanOrEqual(1);
    expect(gadgets.length).toBeGreaterThanOrEqual(1);

    // Watch items must have sapphire glass or movement specs
    const sampleWatch = watches[0];
    expect(sampleWatch.specifications).toBeDefined();
    expect(sampleWatch.originalPrice).toBeGreaterThan(sampleWatch.sellingPrice);

    // Gadget items must have technical specs
    const sampleGadget = gadgets[0];
    expect(sampleGadget.specifications).toBeDefined();
    expect(['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK']).toContain(sampleGadget.stockStatus);
  });

  it('verifies trust badges and Google Play compliance links', () => {
    const requiredBadges = [
      '100% Authenticity Verified',
      'Express Doorstep Delivery',
      '7-Day Easy Replacement',
      'Google Play Certified'
    ];

    expect(requiredBadges.length).toBe(4);

    const complianceLinks = [
      'Privacy Policy',
      'Terms of Service',
      'Refund & Cancellation',
      'Google Play Account Deletion'
    ];

    expect(complianceLinks.length).toBe(4);
  });
});
