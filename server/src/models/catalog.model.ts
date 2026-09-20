import { DatabaseSync } from 'node:sqlite';
import { getDb } from '../db/index.js';

export interface ShopifyProductMedia {
  url: string;
  media_type: 'IMAGE' | 'VIDEO';
  position: number;
}

export interface ShopifyProductDraft {
  id: string;
  merchant_id: string;
  title: string;
  description_html: string;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  category: string;
  price: number;
  currency: string;
  media: ShopifyProductMedia[];
  raw_whatsapp_source?: Record<string, any> | string;
  created_at?: string;
  updated_at?: string;
}

export interface CatalogQueryOptions {
  merchant_id?: string;
  category?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export class CatalogProductRepository {
  private db: DatabaseSync;

  constructor(customDb?: DatabaseSync) {
    this.db = customDb || getDb();
  }

  public create(product: ShopifyProductDraft): ShopifyProductDraft {
    const mediaJson = typeof product.media === 'string' ? product.media : JSON.stringify(product.media || []);
    const sourceJson = typeof product.raw_whatsapp_source === 'object' 
      ? JSON.stringify(product.raw_whatsapp_source) 
      : (product.raw_whatsapp_source || null);

    const stmt = this.db.prepare(`
      INSERT INTO catalog_products (
        id, merchant_id, title, description_html, status,
        category, price, currency, media, raw_whatsapp_source,
        created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `);

    stmt.run(
      product.id,
      product.merchant_id,
      product.title,
      product.description_html,
      product.status || 'DRAFT',
      product.category,
      product.price,
      product.currency || 'INR',
      mediaJson,
      sourceJson
    );

    return this.findById(product.id) || product;
  }

  public findById(id: string): ShopifyProductDraft | null {
    const row = this.db.prepare(`
      SELECT * FROM catalog_products WHERE id = ?
    `).get(id) as Record<string, any> | undefined;

    if (!row) return null;

    return this.mapRowToProduct(row);
  }

  public list(options: CatalogQueryOptions = {}): {
    products: ShopifyProductDraft[];
    total: number;
    page: number;
    limit: number;
  } {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: any[] = [];

    if (options.merchant_id) {
      conditions.push('merchant_id = ?');
      params.push(options.merchant_id);
    }

    if (options.category) {
      conditions.push('LOWER(category) = LOWER(?)');
      params.push(options.category);
    }

    if (options.status) {
      conditions.push('status = ?');
      params.push(options.status);
    }

    if (options.search) {
      conditions.push('(title LIKE ? OR description_html LIKE ?)');
      params.push(`%${options.search}%`, `%${options.search}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRow = this.db.prepare(`
      SELECT COUNT(*) as total FROM catalog_products ${whereClause}
    `).get(...params) as { total: number };

    const total = countRow?.total || 0;

    const rows = this.db.prepare(`
      SELECT * FROM catalog_products ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset) as Array<Record<string, any>>;

    const products = rows.map((r) => this.mapRowToProduct(r));

    return {
      products,
      total,
      page,
      limit
    };
  }

  public updateStatus(id: string, status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED'): boolean {
    const stmt = this.db.prepare(`
      UPDATE catalog_products
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    const result = stmt.run(status, id);
    return (result as any)?.changes > 0;
  }

  private mapRowToProduct(row: Record<string, any>): ShopifyProductDraft {
    let media: ShopifyProductMedia[] = [];
    try {
      media = row.media ? JSON.parse(row.media) : [];
    } catch {
      media = [];
    }

    let rawSource = row.raw_whatsapp_source;
    try {
      if (typeof row.raw_whatsapp_source === 'string' && (row.raw_whatsapp_source.startsWith('{') || row.raw_whatsapp_source.startsWith('['))) {
        rawSource = JSON.parse(row.raw_whatsapp_source);
      }
    } catch {
      // Keep as string
    }

    return {
      id: row.id,
      merchant_id: row.merchant_id,
      title: row.title,
      description_html: row.description_html,
      status: row.status as 'DRAFT' | 'ACTIVE' | 'ARCHIVED',
      category: row.category,
      price: Number(row.price) || 0.0,
      currency: row.currency || 'INR',
      media,
      raw_whatsapp_source: rawSource,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }
}
