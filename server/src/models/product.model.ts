import { DatabaseSync } from 'node:sqlite';
import { getDb } from '../db/index.js';

export interface ProductSpecification {
  spec_key: string;
  spec_value: string;
  display_order?: number;
}

export interface ProductImage {
  id?: string;
  image_url: string;
  thumbnail_url?: string;
  alt_text?: string;
  is_primary?: boolean;
  display_order?: number;
}

export interface ProductVideo {
  id?: string;
  video_url: string;
  thumbnail_url?: string;
  duration_seconds?: number;
  format?: string;
}

export interface Product {
  id: string;
  sku: string;
  title: string;
  short_description?: string;
  full_description: string;
  category_id: string;
  category_name?: string;
  category_slug?: string;
  brand_id?: string;
  brand_name?: string;
  model?: string;
  currency: string;
  original_price: number;
  selling_price: number;
  discount_amount: number;
  discount_percent: number;
  stock_quantity: number;
  stock_status: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
  low_stock_threshold: number;
  is_published: boolean;
  is_featured: boolean;
  is_trending: boolean;
  warranty_info?: string;
  shipping_class: string;
  origin_source: string;
  source_reference_id?: string;
  tags?: string;
  rating_avg: number;
  rating_count: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  specifications?: ProductSpecification[];
  images?: ProductImage[];
  videos?: ProductVideo[];
}

export interface CreateProductDTO {
  id?: string;
  sku?: string;
  title: string;
  short_description?: string;
  full_description: string;
  category_id: string;
  brand_id?: string;
  model?: string;
  currency?: string;
  original_price: number;
  selling_price: number;
  stock_quantity?: number;
  low_stock_threshold?: number;
  is_published?: boolean;
  is_featured?: boolean;
  is_trending?: boolean;
  warranty_info?: string;
  shipping_class?: string;
  origin_source?: string;
  source_reference_id?: string;
  tags?: string;
  specifications?: ProductSpecification[];
  images?: Array<{ image_url: string; is_primary?: boolean; display_order?: number }>;
  videos?: Array<{ video_url: string; format?: string }>;
}

export interface ProductFilterOptions {
  categoryId?: string;
  brandId?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  inStockOnly?: boolean;
  isFeatured?: boolean;
  isTrending?: boolean;
  isPublished?: boolean;
  sortBy?: 'price_asc' | 'price_desc' | 'rating' | 'newest';
  limit?: number;
  offset?: number;
}

// Validation & Math Helpers
export function calculateDiscount(originalPrice: number, sellingPrice: number): {
  discountAmount: number;
  discountPercent: number;
} {
  if (originalPrice <= 0) return { discountAmount: 0, discountPercent: 0 };
  const discountAmount = Math.max(0, originalPrice - sellingPrice);
  const discountPercent = Math.round((discountAmount / originalPrice) * 100);
  return { discountAmount, discountPercent };
}

export function determineStockStatus(
  quantity: number,
  lowStockThreshold: number = 5
): 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' {
  if (quantity <= 0) return 'OUT_OF_STOCK';
  if (quantity <= lowStockThreshold) return 'LOW_STOCK';
  return 'IN_STOCK';
}

export function generateSku(categoryCode: string, brandCode: string = 'GV'): string {
  const cleanCat = categoryCode.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'PROD';
  const cleanBrand = brandCode.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'GV';
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `GV-${cleanCat}-${cleanBrand}-${randomSuffix}`;
}

export function validateProduct(data: Partial<CreateProductDTO>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.title || data.title.trim().length < 3) {
    errors.push('Product title must be at least 3 characters long.');
  }

  if (!data.full_description || data.full_description.trim().length < 10) {
    errors.push('Product full description must be at least 10 characters long.');
  }

  if (!data.category_id) {
    errors.push('Category ID is required.');
  }

  if (typeof data.original_price !== 'number' || isNaN(data.original_price) || data.original_price < 0) {
    errors.push('Original price (MRP) must be a non-negative number.');
  }

  if (typeof data.selling_price !== 'number' || isNaN(data.selling_price) || data.selling_price < 0) {
    errors.push('Selling price must be a non-negative number.');
  }

  if (
    typeof data.original_price === 'number' &&
    typeof data.selling_price === 'number' &&
    data.selling_price > data.original_price
  ) {
    errors.push('Selling price cannot exceed original price (MRP).');
  }

  if (data.stock_quantity !== undefined && (typeof data.stock_quantity !== 'number' || data.stock_quantity < 0)) {
    errors.push('Stock quantity cannot be negative.');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export class ProductRepository {
  private db: DatabaseSync;

  constructor(customDb?: DatabaseSync) {
    this.db = customDb || getDb();
  }

  public getById(id: string): Product | null {
    const row = this.db.prepare(`
      SELECT p.*, c.name as category_name, c.slug as category_slug, b.name as brand_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN brands b ON p.brand_id = b.id
      WHERE p.id = ? AND p.deleted_at IS NULL
    `).get(id) as any;

    if (!row) return null;
    return this.enrichProduct(row);
  }

  public findById(id: string): Product | null {
    return this.getById(id);
  }

  public getBySku(sku: string): Product | null {
    const row = this.db.prepare(`
      SELECT p.*, c.name as category_name, c.slug as category_slug, b.name as brand_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN brands b ON p.brand_id = b.id
      WHERE p.sku = ? AND p.deleted_at IS NULL
    `).get(sku) as any;

    if (!row) return null;
    return this.enrichProduct(row);
  }

  public list(options: ProductFilterOptions = {}): { products: Product[]; total: number } {
    let whereConditions = ['p.deleted_at IS NULL'];
    const params: any[] = [];

    if (options.categoryId) {
      whereConditions.push('p.category_id = ?');
      params.push(options.categoryId);
    }

    if (options.brandId) {
      whereConditions.push('p.brand_id = ?');
      params.push(options.brandId);
    }

    if (options.search) {
      whereConditions.push('(p.title LIKE ? OR p.tags LIKE ? OR p.model LIKE ?)');
      const term = `%${options.search}%`;
      params.push(term, term, term);
    }

    if (options.minPrice !== undefined) {
      whereConditions.push('p.selling_price >= ?');
      params.push(options.minPrice);
    }

    if (options.maxPrice !== undefined) {
      whereConditions.push('p.selling_price <= ?');
      params.push(options.maxPrice);
    }

    if (options.inStockOnly) {
      whereConditions.push('p.stock_quantity > 0');
    }

    if (options.isFeatured !== undefined) {
      whereConditions.push('p.is_featured = ?');
      params.push(options.isFeatured ? 1 : 0);
    }

    if (options.isTrending !== undefined) {
      whereConditions.push('p.is_trending = ?');
      params.push(options.isTrending ? 1 : 0);
    }

    if (options.isPublished !== undefined) {
      whereConditions.push('p.is_published = ?');
      params.push(options.isPublished ? 1 : 0);
    }

    const whereClause = whereConditions.join(' AND ');

    // Total count
    const countRow = this.db.prepare(`
      SELECT COUNT(*) as count FROM products p WHERE ${whereClause}
    `).get(...params) as { count: number };
    const total = countRow ? countRow.count : 0;

    // Order By
    let orderByClause = 'ORDER BY p.created_at DESC';
    if (options.sortBy === 'price_asc') {
      orderByClause = 'ORDER BY p.selling_price ASC';
    } else if (options.sortBy === 'price_desc') {
      orderByClause = 'ORDER BY p.selling_price DESC';
    } else if (options.sortBy === 'rating') {
      orderByClause = 'ORDER BY p.rating_avg DESC';
    }

    // Limit and Offset
    const limit = options.limit || 50;
    const offset = options.offset || 0;

    const rows = this.db.prepare(`
      SELECT p.*, c.name as category_name, c.slug as category_slug, b.name as brand_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN brands b ON p.brand_id = b.id
      WHERE ${whereClause}
      ${orderByClause}
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset) as any[];

    const products = rows.map((r) => this.enrichProduct(r));
    return { products, total };
  }

  public create(dto: CreateProductDTO): Product {
    const validation = validateProduct(dto);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    const id = dto.id || `prod_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const sku = dto.sku || generateSku(dto.category_id);
    const originalPrice = dto.original_price;
    const sellingPrice = dto.selling_price;
    const { discountAmount, discountPercent } = calculateDiscount(originalPrice, sellingPrice);
    const stockQty = dto.stock_quantity ?? 0;
    const lowStockThreshold = dto.low_stock_threshold ?? 5;
    const stockStatus = determineStockStatus(stockQty, lowStockThreshold);

    this.db.prepare(`
      INSERT INTO products (
        id, sku, title, short_description, full_description,
        category_id, brand_id, model, currency,
        original_price, selling_price, discount_amount, discount_percent,
        stock_quantity, stock_status, low_stock_threshold,
        is_published, is_featured, is_trending,
        warranty_info, shipping_class, origin_source, source_reference_id, tags
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?
      )
    `).run(
      id,
      sku,
      dto.title.trim(),
      dto.short_description || null,
      dto.full_description.trim(),
      dto.category_id,
      dto.brand_id || null,
      dto.model || null,
      dto.currency || 'INR',
      originalPrice,
      sellingPrice,
      discountAmount,
      discountPercent,
      stockQty,
      stockStatus,
      lowStockThreshold,
      dto.is_published === false ? 0 : 1,
      dto.is_featured ? 1 : 0,
      dto.is_trending ? 1 : 0,
      dto.warranty_info || null,
      dto.shipping_class || 'STANDARD',
      dto.origin_source || 'MANUAL',
      dto.source_reference_id || null,
      dto.tags || null
    );

    // Save specifications
    if (dto.specifications && dto.specifications.length > 0) {
      const insertSpec = this.db.prepare(`
        INSERT INTO product_specifications (id, product_id, spec_key, spec_value, display_order)
        VALUES (?, ?, ?, ?, ?)
      `);
      dto.specifications.forEach((s, idx) => {
        insertSpec.run(`spec_${id}_${idx}`, id, s.spec_key, s.spec_value, s.display_order ?? idx);
      });
    }

    // Save images
    if (dto.images && dto.images.length > 0) {
      const insertImg = this.db.prepare(`
        INSERT INTO product_images (id, product_id, image_url, is_primary, display_order)
        VALUES (?, ?, ?, ?, ?)
      `);
      dto.images.forEach((img, idx) => {
        insertImg.run(`img_${id}_${idx}`, id, img.image_url, img.is_primary ? 1 : (idx === 0 ? 1 : 0), img.display_order ?? idx);
      });
    }

    // Save videos
    if (dto.videos && dto.videos.length > 0) {
      const insertVid = this.db.prepare(`
        INSERT INTO product_videos (id, product_id, video_url, format)
        VALUES (?, ?, ?, ?)
      `);
      dto.videos.forEach((vid, idx) => {
        insertVid.run(`vid_${id}_${idx}`, id, vid.video_url, vid.format || 'mp4');
      });
    }

    // Maintain inventory record
    this.db.prepare(`
      INSERT OR REPLACE INTO inventory (id, product_id, quantity_available, quantity_reserved, low_stock_threshold)
      VALUES (?, ?, ?, 0, ?)
    `).run(`inv_${id}`, id, stockQty, lowStockThreshold);

    // Maintain prices record
    this.db.prepare(`
      INSERT INTO prices (id, product_id, currency, amount, is_active)
      VALUES (?, ?, ?, ?, 1)
    `).run(`price_${id}_${Date.now()}`, id, dto.currency || 'INR', sellingPrice);

    return this.getById(id)!;
  }

  public update(id: string, updates: Partial<CreateProductDTO>): Product {
    const existing = this.getById(id);
    if (!existing) {
      throw new Error(`Product with id ${id} not found`);
    }

    const merged = {
      title: updates.title ?? existing.title,
      full_description: updates.full_description ?? existing.full_description,
      category_id: updates.category_id ?? existing.category_id,
      original_price: updates.original_price ?? existing.original_price,
      selling_price: updates.selling_price ?? existing.selling_price,
      stock_quantity: updates.stock_quantity ?? existing.stock_quantity
    };

    const validation = validateProduct(merged);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    const originalPrice = merged.original_price;
    const sellingPrice = merged.selling_price;
    const { discountAmount, discountPercent } = calculateDiscount(originalPrice, sellingPrice);
    const stockQty = merged.stock_quantity;
    const lowStockThreshold = updates.low_stock_threshold ?? existing.low_stock_threshold;
    const stockStatus = determineStockStatus(stockQty, lowStockThreshold);

    this.db.prepare(`
      UPDATE products SET
        title = ?,
        short_description = ?,
        full_description = ?,
        category_id = ?,
        brand_id = ?,
        model = ?,
        original_price = ?,
        selling_price = ?,
        discount_amount = ?,
        discount_percent = ?,
        stock_quantity = ?,
        stock_status = ?,
        low_stock_threshold = ?,
        is_published = ?,
        is_featured = ?,
        is_trending = ?,
        warranty_info = ?,
        shipping_class = ?,
        tags = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      merged.title,
      updates.short_description ?? existing.short_description ?? null,
      merged.full_description,
      merged.category_id,
      updates.brand_id !== undefined ? updates.brand_id : existing.brand_id ?? null,
      updates.model !== undefined ? updates.model : existing.model ?? null,
      originalPrice,
      sellingPrice,
      discountAmount,
      discountPercent,
      stockQty,
      stockStatus,
      lowStockThreshold,
      updates.is_published !== undefined ? (updates.is_published ? 1 : 0) : (existing.is_published ? 1 : 0),
      updates.is_featured !== undefined ? (updates.is_featured ? 1 : 0) : (existing.is_featured ? 1 : 0),
      updates.is_trending !== undefined ? (updates.is_trending ? 1 : 0) : (existing.is_trending ? 1 : 0),
      updates.warranty_info !== undefined ? updates.warranty_info : existing.warranty_info ?? null,
      updates.shipping_class ?? existing.shipping_class,
      updates.tags !== undefined ? updates.tags : existing.tags ?? null,
      id
    );

    // Update inventory if stock changed
    if (updates.stock_quantity !== undefined) {
      this.db.prepare(`
        UPDATE inventory SET quantity_available = ?, updated_at = CURRENT_TIMESTAMP
        WHERE product_id = ?
      `).run(stockQty, id);
    }

    return this.getById(id)!;
  }

  public delete(id: string, soft: boolean = true): boolean {
    if (soft) {
      const result = this.db.prepare(`
        UPDATE products SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(id);
      return result.changes > 0;
    } else {
      const result = this.db.prepare(`
        DELETE FROM products WHERE id = ?
      `).run(id);
      return result.changes > 0;
    }
  }

  private enrichProduct(row: any): Product {
    const specs = (this.db.prepare(`
      SELECT spec_key, spec_value, display_order
      FROM product_specifications
      WHERE product_id = ?
      ORDER BY display_order ASC
    `).all(row.id) as unknown) as ProductSpecification[];

    const images = this.db.prepare(`
      SELECT id, image_url, thumbnail_url, alt_text, is_primary, display_order
      FROM product_images
      WHERE product_id = ?
      ORDER BY display_order ASC
    `).all(row.id) as any[];

    const videos = (this.db.prepare(`
      SELECT id, video_url, thumbnail_url, duration_seconds, format
      FROM product_videos
      WHERE product_id = ?
    `).all(row.id) as unknown) as ProductVideo[];

    return {
      id: row.id,
      sku: row.sku,
      title: row.title,
      short_description: row.short_description,
      full_description: row.full_description,
      category_id: row.category_id,
      category_name: row.category_name,
      category_slug: row.category_slug,
      brand_id: row.brand_id,
      brand_name: row.brand_name,
      model: row.model,
      currency: row.currency || 'INR',
      original_price: row.original_price,
      selling_price: row.selling_price,
      discount_amount: row.discount_amount,
      discount_percent: row.discount_percent,
      stock_quantity: row.stock_quantity,
      stock_status: row.stock_status,
      low_stock_threshold: row.low_stock_threshold,
      is_published: Boolean(row.is_published),
      is_featured: Boolean(row.is_featured),
      is_trending: Boolean(row.is_trending),
      warranty_info: row.warranty_info,
      shipping_class: row.shipping_class,
      origin_source: row.origin_source,
      source_reference_id: row.source_reference_id,
      tags: row.tags,
      rating_avg: row.rating_avg,
      rating_count: row.rating_count,
      created_at: row.created_at,
      updated_at: row.updated_at,
      deleted_at: row.deleted_at,
      specifications: specs,
      images: images.map((img) => ({
        ...img,
        is_primary: Boolean(img.is_primary)
      })),
      videos
    };
  }
}
