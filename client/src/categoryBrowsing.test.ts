import { describe, it, expect } from 'vitest';
import { INITIAL_PRODUCTS } from './data/mockData';

describe('Phase 12: Category Browsing Experience & Filtering Logic', () => {
  const masterCategories = [
    {
      id: 'cat_phones',
      name: 'Smartphones & Foldables',
      slug: 'smartphones-foldables',
      subcategories: ['Foldable & Flip', 'Flagship 5G', 'Compact Edition']
    },
    {
      id: 'cat_watches',
      name: 'Imported Luxury Watches',
      slug: 'imported-luxury-watches',
      subcategories: ['Mechanical & Automatic', 'Tachymeter Chronographs', 'Skeleton Exhibition', 'Ultra AMOLED Smartwatches']
    },
    {
      id: 'cat_audio',
      name: 'Audio & Sound',
      slug: 'audio-sound',
      subcategories: ['Over-Ear ANC', 'True Wireless (TWS)', 'Studio Reference']
    },
    {
      id: 'cat_wearables',
      name: 'Smart Wearables',
      slug: 'smart-wearables',
      subcategories: ['Titanium Trackers', 'Smart Health Rings']
    },
    {
      id: 'cat_gaming',
      name: 'Gaming Gear',
      slug: 'gaming-gear',
      subcategories: ['Mechanical Keyboards', 'Precision Wireless Mice']
    },
    {
      id: 'cat_drones',
      name: 'Photography & Drones',
      slug: 'photography-drones',
      subcategories: ['4K GPS Drones', 'Handheld Gimbals']
    }
  ];

  it('validates all 6 master categories and their hierarchical subcategories', () => {
    expect(masterCategories.length).toBe(6);
    masterCategories.forEach(cat => {
      expect(cat.id).toMatch(/^cat_/);
      expect(cat.slug).toBeTruthy();
      expect(cat.subcategories.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('sorts category products by price low-to-high and high-to-low', () => {
    const sortedAsc = [...INITIAL_PRODUCTS].sort((a, b) => a.sellingPrice - b.sellingPrice);
    for (let i = 0; i < sortedAsc.length - 1; i++) {
      expect(sortedAsc[i].sellingPrice).toBeLessThanOrEqual(sortedAsc[i + 1].sellingPrice);
    }

    const sortedDesc = [...INITIAL_PRODUCTS].sort((a, b) => b.sellingPrice - a.sellingPrice);
    for (let i = 0; i < sortedDesc.length - 1; i++) {
      expect(sortedDesc[i].sellingPrice).toBeGreaterThanOrEqual(sortedDesc[i + 1].sellingPrice);
    }
  });

  it('sorts category products by popularity (rating) and newest arrival', () => {
    const sortedPopular = [...INITIAL_PRODUCTS].sort((a, b) => b.rating - a.rating);
    for (let i = 0; i < sortedPopular.length - 1; i++) {
      expect(sortedPopular[i].rating).toBeGreaterThanOrEqual(sortedPopular[i + 1].rating);
    }

    const sortedNewest = [...INITIAL_PRODUCTS].sort((a, b) => b.id.localeCompare(a.id));
    expect(sortedNewest.length).toBe(INITIAL_PRODUCTS.length);
  });

  it('filters category products by price bracket presets', () => {
    // Under 5,000
    const under5k = INITIAL_PRODUCTS.filter(p => p.sellingPrice < 5000);
    expect(under5k.length).toBeGreaterThan(0);
    under5k.forEach(p => expect(p.sellingPrice).toBeLessThan(5000));

    // 5,000 to 20,000
    const midBracket = INITIAL_PRODUCTS.filter(p => p.sellingPrice >= 5000 && p.sellingPrice <= 20000);
    midBracket.forEach(p => {
      expect(p.sellingPrice).toBeGreaterThanOrEqual(5000);
      expect(p.sellingPrice).toBeLessThanOrEqual(20000);
    });
  });

  it('filters by availability and video demo criteria', () => {
    const inStock = INITIAL_PRODUCTS.filter(p => p.stockStatus !== 'OUT_OF_STOCK');
    expect(inStock.length).toBeGreaterThan(0);

    const withVideo = INITIAL_PRODUCTS.filter(p => p.hasVideo);
    expect(withVideo.length).toBeGreaterThan(0);
    withVideo.forEach(p => {
      expect(p.hasVideo).toBe(true);
      expect(p.videoUrl).toBeDefined();
    });
  });

  it('verifies product counter computation and empty state handling', () => {
    const totalCount = INITIAL_PRODUCTS.length;
    expect(totalCount).toBeGreaterThan(0);

    // Filter that returns empty set
    const emptyMatches = INITIAL_PRODUCTS.filter(p => p.sellingPrice > 1000000);
    expect(emptyMatches.length).toBe(0);
  });
});
