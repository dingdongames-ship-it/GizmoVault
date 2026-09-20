import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CircuitBreaker, withRetry, mapRawProductToProduct, fetchPublishedCatalog } from './api';

describe('Client API Service & Resilience Pipeline', () => {
  describe('CircuitBreaker', () => {
    it('initializes in CLOSED state and executes successful calls', async () => {
      const cb = new CircuitBreaker({ failureThreshold: 2, recoveryTimeout: 100 });
      expect(cb.getState()).toBe('CLOSED');

      const result = await cb.execute(async () => 'OK');
      expect(result).toBe('OK');
      expect(cb.getState()).toBe('CLOSED');
    });

    it('trips to OPEN state after hitting failure threshold', async () => {
      const cb = new CircuitBreaker({ failureThreshold: 2, recoveryTimeout: 100 });

      // First failure
      await expect(cb.execute(async () => { throw new Error('fail 1'); })).rejects.toThrow('fail 1');
      expect(cb.getState()).toBe('CLOSED');

      // Second failure - trips circuit
      await expect(cb.execute(async () => { throw new Error('fail 2'); })).rejects.toThrow('fail 2');
      expect(cb.getState()).toBe('OPEN');

      // Immediate subsequent call is blocked by circuit breaker
      await expect(cb.execute(async () => 'should not run')).rejects.toThrow('CircuitBreaker is OPEN');
    });

    it('uses fallback when provided in OPEN state', async () => {
      const cb = new CircuitBreaker({ failureThreshold: 1, recoveryTimeout: 500 });
      await expect(cb.execute(async () => { throw new Error('err'); })).rejects.toThrow();

      const fallbackResult = await cb.execute(
        async () => 'network call',
        () => 'fallback data'
      );
      expect(fallbackResult).toBe('fallback data');
    });
  });

  describe('withRetry', () => {
    it('succeeds immediately without retrying if first attempt succeeds', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      const res = await withRetry(fn, 2, 10);
      expect(res).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('retries on failure and resolves on subsequent attempt', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('temporary failure'))
        .mockResolvedValueOnce('retry success');

      const res = await withRetry(fn, 2, 10);
      expect(res).toBe('retry success');
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('mapRawProductToProduct', () => {
    it('maps backend snake_case attributes, media thumbnail, and specs to Product interface', () => {
      const raw = {
        id: 'p_ingested_01',
        sku: 'GV-INGEST-001',
        title: 'Rolex Submariner Date 41mm',
        short_description: 'Automatic Luxury Diver Watch',
        full_description: 'Brand new in box with official papers and international warranty.',
        category_name: 'Imported Watches',
        brand_name: 'Rolex Geneve',
        model: 'Submariner 126610LN',
        currency: 'INR',
        original_price: 145000,
        selling_price: 98000,
        discount_percent: 32,
        stock_quantity: 4,
        stock_status: 'IN_STOCK',
        is_published: true,
        is_featured: true,
        images: [
          {
            image_url: 'https://cdn.gizmovault.com/images/full.jpg',
            thumbnail_url: 'https://cdn.gizmovault.com/images/thumb.jpg',
            is_primary: true
          }
        ],
        specifications: [
          { spec_key: 'Movement', spec_value: 'Calibre 3235' },
          { spec_key: 'Water Resistance', spec_value: '300m' }
        ]
      };

      const product = mapRawProductToProduct(raw);

      expect(product.id).toBe('p_ingested_01');
      expect(product.title).toBe('Rolex Submariner Date 41mm');
      expect(product.brand).toBe('Rolex Geneve');
      expect(product.sellingPrice).toBe(98000);
      expect(product.originalPrice).toBe(145000);
      expect(product.discountPercent).toBe(32);
      expect(product.primaryImage).toBe('https://cdn.gizmovault.com/images/thumb.jpg');
      expect(product.specifications['Movement']).toBe('Calibre 3235');
      expect(product.specifications['Water Resistance']).toBe('300m');
      expect(product.isFeatured).toBe(true);
    });
  });

  describe('fetchPublishedCatalog', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('fetches from /api/v1/products?status=PUBLISHED with query params', async () => {
      const mockRawProduct = {
        id: 'p_test',
        title: 'Imported Smart Watch',
        brand_name: 'Amazfit',
        category_name: 'Imported Watches',
        selling_price: 15999,
        original_price: 24999,
        stock_quantity: 10,
        stock_status: 'IN_STOCK',
        images: [{ image_url: 'https://test.com/img.jpg', is_primary: true }]
      };

      // Mock global fetch
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, count: 1, data: [mockRawProduct] })
      } as any);

      const items = await fetchPublishedCatalog();
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/products?status=PUBLISHED'),
        expect.any(Object)
      );
      expect(items.length).toBe(1);
      expect(items[0].title).toBe('Imported Smart Watch');
      expect(items[0].brand).toBe('Amazfit');
      expect(items[0].sellingPrice).toBe(15999);
    });

    it('falls back gracefully to initial products when fetch throws', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

      const items = await fetchPublishedCatalog();
      expect(Array.isArray(items)).toBe(true);
      expect(items.length).toBeGreaterThan(0);
    });
  });
});
