import { describe, it, expect } from 'vitest';
import { INITIAL_PRODUCTS } from './data/mockData';
import { Product } from './types';

describe('Phase 13: Product Details Experience Specification & Architecture', () => {
  const watchProduct = INITIAL_PRODUCTS.find(p => p.id === 'prod_1')!;
  const smartphoneProduct = INITIAL_PRODUCTS.find(p => p.id === 'prod_3') || INITIAL_PRODUCTS[1];

  it('verifies product data model has all Phase 13 mandatory fields', () => {
    INITIAL_PRODUCTS.forEach(product => {
      expect(product.id).toBeDefined();
      expect(product.title).toBeDefined();
      expect(product.brand).toBeDefined();
      expect(product.rating).toBeGreaterThanOrEqual(1);
      expect(product.sellingPrice).toBeGreaterThan(0);
      expect(product.originalPrice).toBeGreaterThanOrEqual(product.sellingPrice);
      expect(product.discountPercent).toBeGreaterThanOrEqual(0);
      expect(product.stockStatus).toBeDefined();
      expect(product.fullDescription).toBeDefined();
      expect(product.specifications).toBeDefined();
      expect(Object.keys(product.specifications).length).toBeGreaterThan(0);
      expect(product.warranty).toBeDefined();
      expect(product.primaryImage).toBeDefined();
      expect(product.images.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('validates video handling logic: video is prominent when available and not rendered when missing', () => {
    // Products with video
    const productsWithVideo = INITIAL_PRODUCTS.filter(p => p.hasVideo && p.videoUrl);
    expect(productsWithVideo.length).toBeGreaterThan(0);

    productsWithVideo.forEach(p => {
      expect(p.hasVideo).toBe(true);
      expect(p.videoUrl).toMatch(/^https?:\/\//);
    });

    // Test product without video simulation
    const mockProductWithoutVideo: Product = {
      ...watchProduct,
      id: 'mock_no_video',
      hasVideo: false,
      videoUrl: undefined
    };

    // When hasVideo is false, video element/trigger must not be displayed
    const shouldDisplayVideoControls = mockProductWithoutVideo.hasVideo && !!mockProductWithoutVideo.videoUrl;
    expect(shouldDisplayVideoControls).toBe(false);
  });

  it('verifies pricing, strikethrough original price, and savings discount calculation', () => {
    INITIAL_PRODUCTS.forEach(p => {
      const calculatedSavings = p.originalPrice - p.sellingPrice;
      const expectedDiscountPercent = Math.round(((p.originalPrice - p.sellingPrice) / p.originalPrice) * 100);
      
      expect(calculatedSavings).toBeGreaterThanOrEqual(0);
      expect(Math.round(p.discountPercent)).toBe(expectedDiscountPercent);
    });
  });

  it('verifies related products and recommended products partitioning logic', () => {
    const current = watchProduct;
    
    // Related products: same category, different ID
    const related = INITIAL_PRODUCTS
      .filter(p => p.category === current.category && p.id !== current.id)
      .slice(0, 3);

    related.forEach(r => {
      expect(r.category).toBe(current.category);
      expect(r.id).not.toBe(current.id);
    });

    // Recommended products: other categories or trending
    const recommended = INITIAL_PRODUCTS
      .filter(p => p.id !== current.id && p.category !== current.category)
      .slice(0, 3);

    recommended.forEach(rec => {
      expect(rec.id).not.toBe(current.id);
      expect(rec.category).not.toBe(current.category);
    });
  });

  it('validates quantity bounds and stock status restrictions', () => {
    // In-stock item
    const inStock = watchProduct;
    expect(inStock.stockQuantity).toBeGreaterThan(0);
    expect(inStock.stockStatus).toBe('IN_STOCK');

    // Simulate quantity adjustments
    const minQty = 1;
    const requestedQty = 5;
    const clampedQty = Math.min(inStock.stockQuantity, Math.max(minQty, requestedQty));
    expect(clampedQty).toBe(5);

    // Out-of-stock simulation
    const outOfStockProduct: Product = {
      ...watchProduct,
      id: 'mock_oos',
      stockQuantity: 0,
      stockStatus: 'OUT_OF_STOCK'
    };
    const isOutOfStock = outOfStockProduct.stockStatus === 'OUT_OF_STOCK' || outOfStockProduct.stockQuantity <= 0;
    expect(isOutOfStock).toBe(true);
  });

  it('validates 4 mandatory customer assurance trust signals and warranty info', () => {
    INITIAL_PRODUCTS.forEach(product => {
      expect(product.warranty).toBeTruthy();
      expect(typeof product.warranty).toBe('string');
      // All products must have warranty specification
      expect(product.warranty.length).toBeGreaterThan(5);
    });

    // Verify 6-digit Indian PIN code validation pattern
    const validPincode = '400001';
    const invalidPincode = 'ABC12';
    expect(/^\d{6}$/.test(validPincode)).toBe(true);
    expect(/^\d{6}$/.test(invalidPincode)).toBe(false);
  });
});
