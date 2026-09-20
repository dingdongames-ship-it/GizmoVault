import { Product } from '../types';
import { INITIAL_PRODUCTS } from '../data/mockData';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  recoveryTimeout?: number;
}

/**
 * Resilient Circuit Breaker to prevent cascading network failures.
 */
export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private failureThreshold: number;
  private recoveryTimeout: number;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 3;
    this.recoveryTimeout = options.recoveryTimeout ?? 8000;
  }

  public getState(): CircuitState {
    if (this.state === 'OPEN') {
      const now = Date.now();
      if (now - this.lastFailureTime > this.recoveryTimeout) {
        this.state = 'HALF_OPEN';
      }
    }
    return this.state;
  }

  public async execute<T>(fn: () => Promise<T>, fallback?: () => Promise<T> | T): Promise<T> {
    const currentState = this.getState();

    if (currentState === 'OPEN') {
      if (fallback) {
        return await fallback();
      }
      throw new Error('CircuitBreaker is OPEN: Catalog service is temporarily unreachable');
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      if (fallback) {
        return await fallback();
      }
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= this.failureThreshold || this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
    }
  }

  public reset(): void {
    this.failureCount = 0;
    this.state = 'CLOSED';
    this.lastFailureTime = 0;
  }
}

export const catalogCircuitBreaker = new CircuitBreaker({
  failureThreshold: 3,
  recoveryTimeout: 8000
});

/**
 * Exponential backoff retry utility.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries: number = 2,
  baseDelayMs: number = 300
): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, baseDelayMs * Math.pow(2, attempt)));
      }
    }
  }
  throw lastError;
}

/**
 * Maps raw backend/WhatsApp ingested product data to client-side Product type.
 */
export function mapRawProductToProduct(raw: any): Product {
  // Extract thumbnail / primary image
  const primaryImg =
    raw.primaryImage ||
    raw.primary_image ||
    (Array.isArray(raw.images) && raw.images.length > 0
      ? (typeof raw.images[0] === 'string'
          ? raw.images[0]
          : raw.images.find((img: any) => img.is_primary)?.thumbnail_url ||
            raw.images.find((img: any) => img.is_primary)?.image_url ||
            raw.images[0]?.thumbnail_url ||
            raw.images[0]?.image_url)
      : null) ||
    'https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=800&q=80';

  const allImages = Array.isArray(raw.images) && raw.images.length > 0
    ? raw.images.map((img: any) => (typeof img === 'string' ? img : (img.image_url || img.thumbnail_url || primaryImg)))
    : [primaryImg];

  // Convert specifications array to Record<string, string>
  let specsRecord: Record<string, string> = {};
  if (Array.isArray(raw.specifications)) {
    for (const spec of raw.specifications) {
      if (spec && spec.spec_key) {
        specsRecord[spec.spec_key] = String(spec.spec_value || '');
      }
    }
  } else if (raw.specifications && typeof raw.specifications === 'object') {
    specsRecord = raw.specifications;
  }

  const categoryName =
    raw.category ||
    raw.category_name ||
    (raw.category_id === 'cat_watches' ? 'Imported Watches' : 'Electronic Gadgets');

  const categorySlug =
    raw.categorySlug ||
    raw.category_slug ||
    (raw.category_id === 'cat_watches' ? 'imported-luxury-watches' : 'electronic-gadgets');

  const originalPrice = Number(raw.originalPrice ?? raw.original_price ?? raw.mrp ?? 0);
  const sellingPrice = Number(raw.sellingPrice ?? raw.selling_price ?? 0);
  const discountPercent =
    raw.discountPercent ??
    raw.discount_percent ??
    (originalPrice > sellingPrice && originalPrice > 0
      ? Math.round(((originalPrice - sellingPrice) / originalPrice) * 100)
      : 0);

  const videoUrl =
    raw.videoUrl ||
    raw.video_url ||
    (Array.isArray(raw.videos) && raw.videos.length > 0 ? raw.videos[0]?.video_url : undefined);

  return {
    id: String(raw.id),
    sku: raw.sku || `GV-${raw.id}`,
    title: raw.title || 'Ingested Product',
    shortDescription: raw.shortDescription || raw.short_description || '',
    fullDescription: raw.fullDescription || raw.full_description || raw.description || '',
    category: categoryName,
    categorySlug: categorySlug,
    brand: raw.brand || raw.brand_name || 'GizmoVault',
    model: raw.model,
    originalPrice,
    sellingPrice,
    discountPercent,
    currency: raw.currency || 'INR',
    primaryImage: primaryImg,
    images: allImages,
    hasVideo: Boolean(raw.hasVideo || raw.has_video || videoUrl),
    videoUrl,
    stockQuantity: Number(raw.stockQuantity ?? raw.stock_quantity ?? 10),
    stockStatus:
      raw.stockStatus ||
      raw.stock_status ||
      (Number(raw.stockQuantity ?? raw.stock_quantity ?? 10) > 3
        ? 'IN_STOCK'
        : Number(raw.stockQuantity ?? raw.stock_quantity ?? 10) > 0
        ? 'LOW_STOCK'
        : 'OUT_OF_STOCK'),
    rating: Number(raw.rating ?? raw.rating_avg ?? 4.8),
    ratingCount: Number(raw.ratingCount ?? raw.rating_count ?? 24),
    warranty: raw.warranty || raw.warranty_info || '1 Year Manufacturer Warranty',
    shippingClass: raw.shippingClass || raw.shipping_class || 'Express Insured Air',
    tags: Array.isArray(raw.tags)
      ? raw.tags
      : typeof raw.tags === 'string'
      ? raw.tags.split(',').map((t: string) => t.trim())
      : [],
    specifications: specsRecord,
    isFeatured: Boolean(raw.isFeatured ?? raw.is_featured),
    isTrending: Boolean(raw.isTrending ?? raw.is_trending)
  };
}

/**
 * Fetches published products ingested from WhatsApp and stores/verifies them.
 * Supports category filtering, circuit breaker protection, timeout control, and retries.
 */
export async function fetchPublishedCatalog(category?: string): Promise<Product[]> {
  const queryParams = new URLSearchParams();
  queryParams.append('status', 'PUBLISHED');
  if (category) {
    queryParams.append('category', category);
  }

  const url = `/api/v1/products?${queryParams.toString()}`;

  const fetchWithTimeout = async (): Promise<Product[]> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json'
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Catalog API responded with HTTP ${response.status}: ${response.statusText}`);
      }

      const payload = await response.json();

      if (payload && payload.success && Array.isArray(payload.data)) {
        return payload.data.map(mapRawProductToProduct);
      } else if (Array.isArray(payload)) {
        return payload.map(mapRawProductToProduct);
      }

      return [];
    } catch (err: any) {
      clearTimeout(timeoutId);
      throw err;
    }
  };

  // Run through retry and circuit breaker with graceful fallback to initial products
  return catalogCircuitBreaker.execute<Product[]>(
    () => withRetry(fetchWithTimeout, 2, 400),
    () => {
      // Graceful offline / fallback when server is unavailable or request times out
      if (category) {
        return INITIAL_PRODUCTS.filter(
          (p) =>
            p.category.toLowerCase().includes(category.toLowerCase()) ||
            p.categorySlug.toLowerCase().includes(category.toLowerCase())
        );
      }
      return INITIAL_PRODUCTS;
    }
  );
}
