import { DatabaseSync } from 'node:sqlite';
import { getDb } from '../db/connection.js';

export interface RecommendationItem {
  id: string;
  title: string;
  brand: string;
  sellingPrice: number;
  mrp: number;
  discountPercent: number;
  thumbnailUrl: string;
  categoryId: string;
  categoryName: string;
  stockQuantity: number;
  reason: string;
}

export interface RecommendationContext {
  userId?: string;
  currentProductId?: string;
  categoryId?: string;
  cartProductIds?: string[];
  recentlyViewedIds?: string[];
  limit?: number;
}

export class RecommendationEngine {
  private db: DatabaseSync;

  constructor(customDb?: DatabaseSync) {
    this.db = customDb || getDb();
  }

  private mapRow(row: any, reason: string): RecommendationItem {
    return {
      id: row.id,
      title: row.title,
      brand: row.brand_name || '',
      sellingPrice: row.selling_price,
      mrp: row.mrp || row.selling_price,
      discountPercent: row.discount_percent || 0,
      thumbnailUrl: row.thumbnail_url || '',
      categoryId: row.category_id,
      categoryName: row.category_name || '',
      stockQuantity: row.stock_quantity,
      reason
    };
  }

  private getProducts(whereParts: string[], params: any[], limit: number): any[] {
    const where = whereParts.join(' AND ');
    return this.db.prepare(`
      SELECT
        p.id, p.title, COALESCE(b.name, '') as brand_name, p.selling_price,
        p.original_price as mrp, COALESCE(p.discount_percent, 0) as discount_percent,
        p.stock_quantity, p.category_id, c.name as category_name,
        (SELECT thumbnail_url FROM product_images pi WHERE pi.product_id = p.id AND pi.is_primary = 1 LIMIT 1) as thumbnail_url
      FROM products p
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE ${where}
      ORDER BY p.is_trending DESC, p.created_at DESC
      LIMIT ?
    `).all(...params, limit) as any[];
  }

  public getRecommendations(ctx: RecommendationContext): RecommendationItem[] {
    const limit = ctx.limit || 10;
    const seen = new Set<string>();
    if (ctx.currentProductId) seen.add(ctx.currentProductId);
    (ctx.cartProductIds || []).forEach(id => seen.add(id));
    (ctx.recentlyViewedIds || []).forEach(id => seen.add(id));

    const results: RecommendationItem[] = [];

    // 1. Same category
    if (ctx.categoryId || ctx.currentProductId) {
      const catId = ctx.categoryId || this.getCategoryForProduct(ctx.currentProductId!);
      if (catId) {
        const rows = this.getProducts(
          ['p.category_id = ?', 'p.is_published = 1', 'p.deleted_at IS NULL', 'p.stock_quantity > 0'],
          [catId],
          5
        );
        for (const row of rows) {
          if (!seen.has(row.id) && results.length < limit) {
            results.push(this.mapRow(row, 'More from this category'));
            seen.add(row.id);
          }
        }
      }
    }

    // 2. Same brand (via brand_id join)
    if (ctx.currentProductId && results.length < limit) {
      const currentProduct = this.db.prepare(
        `SELECT brand_id FROM products WHERE id = ?`
      ).get(ctx.currentProductId) as { brand_id: string } | undefined;

      if (currentProduct?.brand_id) {
        const brandRow = this.db.prepare(`SELECT name FROM brands WHERE id = ?`).get(currentProduct.brand_id) as { name: string } | undefined;
        const brandName = brandRow?.name || '';

        const rows = this.getProducts(
          ['p.brand_id = ?', 'p.is_published = 1', 'p.deleted_at IS NULL', 'p.stock_quantity > 0'],
          [currentProduct.brand_id],
          4
        );
        for (const row of rows) {
          if (!seen.has(row.id) && results.length < limit) {
            results.push(this.mapRow(row, `More from ${brandName}`));
            seen.add(row.id);
          }
        }
      }
    }

    // 3. Trending fallback
    if (results.length < limit) {
      const rows = this.getProducts(
        ['p.is_published = 1', 'p.deleted_at IS NULL', 'p.stock_quantity > 0', 'p.is_trending = 1'],
        [],
        limit - results.length
      );
      for (const row of rows) {
        if (!seen.has(row.id) && results.length < limit) {
          results.push(this.mapRow(row, 'Trending Now'));
          seen.add(row.id);
        }
      }
    }

    // 4. Popular fallback
    if (results.length < limit) {
      const rows = this.db.prepare(`
        SELECT
          p.id, p.title, COALESCE(b.name, '') as brand_name, p.selling_price,
          p.original_price as mrp, COALESCE(p.discount_percent, 0) as discount_percent,
          p.stock_quantity, p.category_id, c.name as category_name,
          (SELECT thumbnail_url FROM product_images pi WHERE pi.product_id = p.id AND pi.is_primary = 1 LIMIT 1) as thumbnail_url
        FROM products p
        LEFT JOIN brands b ON p.brand_id = b.id
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.is_published = 1 AND p.deleted_at IS NULL AND p.stock_quantity > 0
        ORDER BY p.created_at DESC
        LIMIT ?
      `).all(limit - results.length) as any[];

      for (const row of rows) {
        if (!seen.has(row.id) && results.length < limit) {
          results.push(this.mapRow(row, 'Popular in Store'));
          seen.add(row.id);
        }
      }
    }

    return results;
  }

  public getRecentlyViewed(recentlyViewedIds: string[]): RecommendationItem[] {
    if (!recentlyViewedIds.length) return [];
    const placeholders = recentlyViewedIds.map(() => '?').join(',');
    const rows = this.db.prepare(`
      SELECT
        p.id, p.title, COALESCE(b.name, '') as brand_name, p.selling_price,
        p.original_price as mrp, COALESCE(p.discount_percent, 0) as discount_percent,
        p.stock_quantity, p.category_id, c.name as category_name,
        (SELECT thumbnail_url FROM product_images pi WHERE pi.product_id = p.id AND pi.is_primary = 1 LIMIT 1) as thumbnail_url
      FROM products p
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id IN (${placeholders}) AND p.is_published = 1 AND p.deleted_at IS NULL
    `).all(...recentlyViewedIds) as any[];
    return rows.map(row => this.mapRow(row, 'Recently Viewed'));
  }

  public getForUser(userId: string, limit = 6): RecommendationItem[] {
    const purchasedCategories = this.db.prepare(`
      SELECT DISTINCT p.category_id
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      JOIN products p ON p.id = oi.product_id
      WHERE o.user_id = ? AND o.order_status NOT IN ('CANCELLED', 'FAILED')
      LIMIT 3
    `).all(userId) as { category_id: string }[];

    if (!purchasedCategories.length) {
      return this.getRecommendations({ limit });
    }

    const seen = new Set<string>();
    const results: RecommendationItem[] = [];

    for (const { category_id } of purchasedCategories) {
      const rows = this.getProducts(
        ['p.category_id = ?', 'p.is_published = 1', 'p.deleted_at IS NULL', 'p.stock_quantity > 0'],
        [category_id],
        3
      );
      for (const row of rows) {
        if (!seen.has(row.id) && results.length < limit) {
          results.push(this.mapRow(row, 'Based on Purchase History'));
          seen.add(row.id);
        }
      }
    }
    return results;
  }

  private getCategoryForProduct(productId: string): string | null {
    const row = this.db.prepare(`SELECT category_id FROM products WHERE id = ?`).get(productId) as { category_id: string } | undefined;
    return row?.category_id || null;
  }
}
