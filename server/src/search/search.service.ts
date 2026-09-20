import { DatabaseSync } from 'node:sqlite';
import { getDb } from '../db/connection.js';

export interface SearchResult {
  id: string;
  title: string;
  brand: string;
  model: string;
  sku: string;
  sellingPrice: number;
  mrp: number;
  discountPercent: number;
  thumbnailUrl: string;
  categoryId: string;
  categoryName: string;
  stockQuantity: number;
  isPublished: number;
  score: number;
  highlight?: string;
}

export interface SearchParams {
  query: string;
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  sortBy?: 'relevance' | 'price_asc' | 'price_desc' | 'newest' | 'popular';
  page?: number;
  pageSize?: number;
}

export interface AutocompleteResult {
  type: 'product' | 'brand' | 'category' | 'keyword';
  value: string;
  id?: string;
  thumbnailUrl?: string;
  price?: number;
}

export interface SearchSuggestions {
  popular: string[];
  recent: string[];
  trending: string[];
}

export class SearchService {
  private db: DatabaseSync;

  constructor(customDb?: DatabaseSync) {
    this.db = customDb || getDb();
  }

  /**
   * Full-text search across products: title, brand, model, SKU, description.
   * Products use: p.title, b.name (brand via JOIN), p.model, p.sku, p.full_description
   * Images are in product_images table (thumbnail_url WHERE is_primary=1).
   */
  public search(params: SearchParams): { results: SearchResult[]; total: number; query: string } {
    const {
      query,
      categoryId,
      minPrice,
      maxPrice,
      inStock = false,
      sortBy = 'relevance',
      page = 1,
      pageSize = 20
    } = params;

    const cleanQuery = (query || '').trim().toLowerCase();
    if (!cleanQuery) {
      return { results: [], total: 0, query: '' };
    }

    const conditions: string[] = [
      `p.deleted_at IS NULL`,
      `p.is_published = 1`
    ];
    const bindings: any[] = [];

    // Multi-token search across title, brand name (via join), model, sku, description
    const tokens = cleanQuery.split(/\s+/).filter(Boolean);
    const tokenConditions = tokens.map(() =>
      `(LOWER(p.title) LIKE ? OR LOWER(COALESCE(b.name,'')) LIKE ? OR LOWER(COALESCE(p.model,'')) LIKE ? OR LOWER(p.sku) LIKE ? OR LOWER(COALESCE(p.full_description,'')) LIKE ?)`
    );
    conditions.push(`(${tokenConditions.join(' OR ')})`);

    for (const token of tokens) {
      const like = `%${token}%`;
      bindings.push(like, like, like, like, like);
    }

    if (categoryId) {
      conditions.push(`p.category_id = ?`);
      bindings.push(categoryId);
    }
    if (minPrice !== undefined) {
      conditions.push(`p.selling_price >= ?`);
      bindings.push(minPrice);
    }
    if (maxPrice !== undefined) {
      conditions.push(`p.selling_price <= ?`);
      bindings.push(maxPrice);
    }
    if (inStock) {
      conditions.push(`p.stock_quantity > 0`);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Relevance score expression using safe binding
    const scoreLike = `%${cleanQuery}%`;
    const scoreExpr = `(
      CASE WHEN LOWER(p.title) LIKE ? THEN 3 ELSE 0 END +
      CASE WHEN LOWER(COALESCE(b.name,'')) LIKE ? THEN 2 ELSE 0 END +
      CASE WHEN LOWER(COALESCE(p.model,'')) LIKE ? THEN 2 ELSE 0 END +
      CASE WHEN LOWER(p.sku) LIKE ? THEN 2 ELSE 0 END +
      CASE WHEN LOWER(COALESCE(p.full_description,'')) LIKE ? THEN 1 ELSE 0 END
    ) as score`;

    const orderClause = sortBy === 'relevance'
      ? 'ORDER BY score DESC, p.is_trending DESC, p.created_at DESC'
      : sortBy === 'price_asc' ? 'ORDER BY p.selling_price ASC'
      : sortBy === 'price_desc' ? 'ORDER BY p.selling_price DESC'
      : sortBy === 'newest' ? 'ORDER BY p.created_at DESC'
      : 'ORDER BY p.stock_quantity DESC, p.created_at DESC'; // popular

    const offset = (page - 1) * pageSize;

    const countRow = this.db.prepare(`
      SELECT COUNT(*) as total
      FROM products p
      LEFT JOIN brands b ON p.brand_id = b.id
      ${whereClause}
    `).get(...bindings) as { total: number };

    const rows = this.db.prepare(`
      SELECT
        p.id, p.title, COALESCE(b.name, '') as brand_name, COALESCE(p.model, '') as model, p.sku,
        p.selling_price, p.original_price as mrp, COALESCE(p.discount_percent, 0) as discount_percent,
        p.stock_quantity, p.is_published,
        p.category_id, c.name as category_name,
        (SELECT thumbnail_url FROM product_images pi WHERE pi.product_id = p.id AND pi.is_primary = 1 LIMIT 1) as thumbnail_url,
        ${scoreExpr}
      FROM products p
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN categories c ON p.category_id = c.id
      ${whereClause}
      ${orderClause}
      LIMIT ? OFFSET ?
    `).all(scoreLike, scoreLike, scoreLike, scoreLike, scoreLike, ...bindings, pageSize, offset) as any[];

    const results: SearchResult[] = rows.map(row => {
      let highlight = row.title;
      for (const token of tokens) {
        const re = new RegExp(`(${token})`, 'gi');
        highlight = highlight.replace(re, '**$1**');
      }

      return {
        id: row.id,
        title: row.title,
        brand: row.brand_name || '',
        model: row.model || '',
        sku: row.sku || '',
        sellingPrice: row.selling_price,
        mrp: row.mrp || row.selling_price,
        discountPercent: row.discount_percent || 0,
        thumbnailUrl: row.thumbnail_url || '',
        categoryId: row.category_id,
        categoryName: row.category_name || '',
        stockQuantity: row.stock_quantity,
        isPublished: row.is_published,
        score: row.score || 0,
        highlight
      };
    });

    return { results, total: countRow.total, query: cleanQuery };
  }

  /**
   * Autocomplete: partial query → product titles, brand names, category names.
   */
  public autocomplete(partialQuery: string, limit = 8): AutocompleteResult[] {
    const q = (partialQuery || '').trim().toLowerCase();
    if (q.length < 2) return [];

    const like = `%${q}%`;
    const results: AutocompleteResult[] = [];

    // Product title suggestions
    const products = this.db.prepare(`
      SELECT p.id, p.title, p.selling_price,
        (SELECT thumbnail_url FROM product_images pi WHERE pi.product_id = p.id AND pi.is_primary = 1 LIMIT 1) as thumbnail_url
      FROM products p
      WHERE LOWER(p.title) LIKE ? AND p.is_published = 1 AND p.deleted_at IS NULL
      ORDER BY p.is_trending DESC, p.created_at DESC
      LIMIT 4
    `).all(like) as any[];

    for (const p of products) {
      results.push({
        type: 'product',
        value: p.title,
        id: p.id,
        price: p.selling_price,
        thumbnailUrl: p.thumbnail_url || ''
      });
    }

    // Brand suggestions
    const brands = this.db.prepare(`
      SELECT DISTINCT b.id, b.name FROM brands b
      JOIN products p ON p.brand_id = b.id
      WHERE LOWER(b.name) LIKE ? AND p.is_published = 1 AND p.deleted_at IS NULL
      LIMIT 2
    `).all(like) as { id: string; name: string }[];

    for (const b of brands) {
      if (b.name) {
        results.push({ type: 'brand', value: b.name, id: b.id });
      }
    }

    // Category suggestions
    const cats = this.db.prepare(`
      SELECT id, name FROM categories WHERE LOWER(name) LIKE ? LIMIT 2
    `).all(like) as { id: string; name: string }[];

    for (const c of cats) {
      results.push({ type: 'category', value: c.name, id: c.id });
    }

    return results.slice(0, limit);
  }

  /**
   * Returns popular, trending, and recent search suggestions.
   */
  public getSuggestions(): SearchSuggestions {
    const popularBrands = this.db.prepare(`
      SELECT DISTINCT LOWER(b.name) as brand_name
      FROM brands b
      JOIN products p ON p.brand_id = b.id
      WHERE p.is_published = 1 AND p.deleted_at IS NULL
      ORDER BY RANDOM()
      LIMIT 5
    `).all() as { brand_name: string }[];

    return {
      popular: popularBrands.map(b => b.brand_name).filter(Boolean),
      recent: ['smartwatch', 'imported watch', 'earbuds', 'powerbank'],
      trending: ['amoled watch', 'TWS earphones', 'dash cam', 'mechanical keyboard']
    };
  }
}
