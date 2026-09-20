import { DatabaseSync } from 'node:sqlite';
import { getDb } from '../db/index.js';
import { ProductRepository, Product, ProductSpecification, ProductImage, generateSku } from '../models/product.model.js';
import { ProductDeduplicationService } from '../ai/dedup.service.js';

export type WorkflowStatus =
  | 'NEW'
  | 'PROCESSING'
  | 'EXTRACTED'
  | 'VALIDATION'
  | 'NEEDS_REVIEW'
  | 'APPROVED'
  | 'PUBLISHED'
  | 'REJECTED'
  | 'ARCHIVED';

export interface ExtractedProductRecord {
  id: string;
  message_id: string;
  extracted_title: string | null;
  extracted_category: string | null;
  suggested_category_id: string | null;
  extracted_brand: string | null;
  extracted_model: string | null;
  extracted_original_price: number | null;
  extracted_selling_price: number | null;
  extracted_discount: number | null;
  extracted_specs: string | null;
  extracted_description: string | null;
  media_urls: string | null;
  confidence_score: number;
  duplicate_of_product_id: string | null;
  approval_status: WorkflowStatus;
  created_at: string;
  updated_at: string;
  // Enriched fields
  category_name?: string;
  parsed_specs?: Array<{ spec_key: string; spec_value: string }>;
  parsed_media?: string[];
  sender_phone?: string;
  duplicate_warning?: any;
}

export interface EditExtractedProductDTO {
  title?: string;
  description?: string;
  category_id?: string;
  brand?: string;
  model?: string;
  original_price?: number;
  selling_price?: number;
  stock_quantity?: number;
  specifications?: Array<{ spec_key: string; spec_value: string }>;
  media_urls?: string[];
  notes?: string;
}

export interface ApprovalOverrides extends EditExtractedProductDTO {
  is_featured?: boolean;
  is_trending?: boolean;
  warranty_info?: string;
}

export interface QueueFilterOptions {
  status?: string;
  categoryId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface QueueStats {
  total: number;
  needsReview: number;
  extracted: number;
  validation: number;
  approved: number;
  published: number;
  rejected: number;
  archived: number;
}

export class AdminApprovalService {
  private db: DatabaseSync;
  private productRepo: ProductRepository;
  private dedupService: ProductDeduplicationService;

  constructor(db?: DatabaseSync) {
    this.db = db || getDb();
    this.productRepo = new ProductRepository(this.db);
    this.dedupService = new ProductDeduplicationService(this.db);
  }

  // 1. Get Moderation Queue with filters and metadata enrichment
  public getQueue(options: QueueFilterOptions = {}): { items: ExtractedProductRecord[]; total: number } {
    const { status, categoryId, search, limit = 20, offset = 0 } = options;

    const conditions: string[] = [];
    const params: any[] = [];

    if (status && status !== 'ALL') {
      conditions.push('ep.approval_status = ?');
      params.push(status);
    }

    if (categoryId) {
      conditions.push('(ep.suggested_category_id = ? OR c.slug = ?)');
      params.push(categoryId, categoryId);
    }

    if (search && search.trim()) {
      const q = `%${search.trim().toLowerCase()}%`;
      conditions.push('(LOWER(ep.extracted_title) LIKE ? OR LOWER(ep.extracted_brand) LIKE ? OR LOWER(ep.extracted_model) LIKE ?)');
      params.push(q, q, q);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRow = this.db.prepare(`
      SELECT COUNT(*) as cnt
      FROM extracted_products ep
      LEFT JOIN categories c ON ep.suggested_category_id = c.id
      ${whereClause}
    `).get(...params) as { cnt: number } | undefined;

    const total = countRow?.cnt ?? 0;

    const rows = this.db.prepare(`
      SELECT 
        ep.*,
        c.name as category_name,
        wm.sender_phone
      FROM extracted_products ep
      LEFT JOIN categories c ON ep.suggested_category_id = c.id
      LEFT JOIN whatsapp_messages wm ON ep.message_id = wm.id
      ${whereClause}
      ORDER BY ep.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset) as any[];

    const items: ExtractedProductRecord[] = rows.map((r) => this.enrichRecord(r));

    return { items, total };
  }

  // 2. Aggregate queue status counts
  public getQueueStats(): QueueStats {
    const rows = this.db.prepare(`
      SELECT approval_status, COUNT(*) as cnt
      FROM extracted_products
      GROUP BY approval_status
    `).all() as Array<{ approval_status: string; cnt: number }>;

    const stats: QueueStats = {
      total: 0,
      needsReview: 0,
      extracted: 0,
      validation: 0,
      approved: 0,
      published: 0,
      rejected: 0,
      archived: 0
    };

    for (const r of rows) {
      stats.total += r.cnt;
      switch (r.approval_status) {
        case 'NEEDS_REVIEW':
          stats.needsReview = r.cnt;
          break;
        case 'EXTRACTED':
          stats.extracted = r.cnt;
          break;
        case 'VALIDATION':
          stats.validation = r.cnt;
          break;
        case 'APPROVED':
          stats.approved = r.cnt;
          break;
        case 'PUBLISHED':
          stats.published = r.cnt;
          break;
        case 'REJECTED':
          stats.rejected = r.cnt;
          break;
        case 'ARCHIVED':
          stats.archived = r.cnt;
          break;
      }
    }

    return stats;
  }

  // 3. Get single extracted item with full details
  public getExtractedProduct(id: string): ExtractedProductRecord | null {
    const row = this.db.prepare(`
      SELECT 
        ep.*,
        c.name as category_name,
        wm.sender_phone,
        wm.raw_text as raw_payload
      FROM extracted_products ep
      LEFT JOIN categories c ON ep.suggested_category_id = c.id
      LEFT JOIN whatsapp_messages wm ON ep.message_id = wm.id
      WHERE ep.id = ?
    `).get(id) as any;

    if (!row) return null;

    const enriched = this.enrichRecord(row);

    // If candidate has brand/title, run duplicate check
    if (enriched.extracted_title) {
      const dups = this.dedupService.findDuplicates({
        title: enriched.extracted_title,
        brand: enriched.extracted_brand || undefined,
        model: enriched.extracted_model || undefined
      });
      if (dups.length > 0) {
        enriched.duplicate_warning = dups[0];
      }
    }

    return enriched;
  }

  // 4. Edit extracted product attributes before approval
  public editExtractedProduct(
    id: string,
    updates: EditExtractedProductDTO,
    adminUserId: string
  ): ExtractedProductRecord {
    const existing = this.getExtractedProduct(id);
    if (!existing) {
      throw new Error(`Extracted product not found: ${id}`);
    }

    const title = updates.title !== undefined ? updates.title.trim() : existing.extracted_title;
    const description = updates.description !== undefined ? updates.description.trim() : existing.extracted_description;
    const categoryId = updates.category_id !== undefined ? updates.category_id : existing.suggested_category_id;
    const brand = updates.brand !== undefined ? updates.brand.trim() : existing.extracted_brand;
    const model = updates.model !== undefined ? updates.model.trim() : existing.extracted_model;
    const originalPrice = updates.original_price !== undefined ? updates.original_price : existing.extracted_original_price;
    const sellingPrice = updates.selling_price !== undefined ? updates.selling_price : existing.extracted_selling_price;

    let discount = existing.extracted_discount;
    if (originalPrice && sellingPrice && originalPrice > 0) {
      discount = Math.max(0, Math.round(((originalPrice - sellingPrice) / originalPrice) * 100));
    }

    let specsJson = existing.extracted_specs;
    if (updates.specifications) {
      specsJson = JSON.stringify(updates.specifications);
    }

    let mediaJson = existing.media_urls;
    if (updates.media_urls) {
      mediaJson = JSON.stringify(updates.media_urls);
    }

    this.db.prepare(`
      UPDATE extracted_products
      SET 
        extracted_title = ?,
        extracted_description = ?,
        suggested_category_id = ?,
        extracted_brand = ?,
        extracted_model = ?,
        extracted_original_price = ?,
        extracted_selling_price = ?,
        extracted_discount = ?,
        extracted_specs = ?,
        media_urls = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      title,
      description,
      categoryId,
      brand,
      model,
      originalPrice,
      sellingPrice,
      discount,
      specsJson,
      mediaJson,
      id
    );

    // Audit action
    this.logApprovalAction({
      extractedProductId: id,
      adminUserId,
      action: 'EDIT',
      modificationNotes: updates.notes || 'Product attributes updated by admin'
    });

    return this.getExtractedProduct(id)!;
  }

  // 5. State Transition Validator
  public transitionStatus(
    id: string,
    targetStatus: WorkflowStatus,
    adminUserId: string,
    notes?: string
  ): ExtractedProductRecord {
    const item = this.getExtractedProduct(id);
    if (!item) {
      throw new Error(`Extracted product not found: ${id}`);
    }

    const current = item.approval_status;

    // Validate permitted transitions
    const validTransitions: Record<WorkflowStatus, WorkflowStatus[]> = {
      NEW: ['PROCESSING', 'REJECTED', 'ARCHIVED'],
      PROCESSING: ['EXTRACTED', 'REJECTED', 'ARCHIVED'],
      EXTRACTED: ['VALIDATION', 'NEEDS_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED'],
      VALIDATION: ['NEEDS_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED'],
      NEEDS_REVIEW: ['APPROVED', 'PUBLISHED', 'REJECTED', 'ARCHIVED'],
      APPROVED: ['PUBLISHED', 'ARCHIVED', 'REJECTED'],
      PUBLISHED: ['ARCHIVED'],
      REJECTED: ['NEEDS_REVIEW', 'ARCHIVED'],
      ARCHIVED: ['NEEDS_REVIEW']
    };

    const allowed = validTransitions[current] || [];
    if (!allowed.includes(targetStatus) && targetStatus !== current) {
      throw new Error(`Invalid status transition from ${current} to ${targetStatus}`);
    }

    this.db.prepare(`
      UPDATE extracted_products
      SET approval_status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(targetStatus, id);

    this.logApprovalAction({
      extractedProductId: id,
      adminUserId,
      action: `TRANSITION_TO_${targetStatus}`,
      modificationNotes: notes || `Workflow status transitioned from ${current} to ${targetStatus}`
    });

    return this.getExtractedProduct(id)!;
  }

  // 6. Approve & Publish into Live Catalog
  public approveAndPublish(
    id: string,
    adminUserId: string,
    overrides?: ApprovalOverrides
  ): { extractedProduct: ExtractedProductRecord; publishedProduct: Product } {
    let item = this.getExtractedProduct(id);
    if (!item) {
      throw new Error(`Extracted product not found: ${id}`);
    }

    // If overrides are provided, apply them first
    if (overrides) {
      item = this.editExtractedProduct(id, overrides, adminUserId);
    }

    const title = overrides?.title || item.extracted_title || 'Untitled Ingested Product';
    const fullDesc = overrides?.description || item.extracted_description || title;
    const shortDesc = title;
    const categoryId = overrides?.category_id || item.suggested_category_id || 'cat_phones';
    const rawBrand = overrides?.brand || item.extracted_brand || 'GizmoVault';
    const model = overrides?.model || item.extracted_model || undefined;
    const originalPrice = overrides?.original_price ?? item.extracted_original_price ?? 9999;
    const sellingPrice = overrides?.selling_price ?? item.extracted_selling_price ?? originalPrice;
    const stockQuantity = overrides?.stock_quantity ?? 10;

    // Ensure category exists
    const catCheck = this.db.prepare('SELECT id, slug FROM categories WHERE id = ?').get(categoryId) as any;
    if (!catCheck) {
      throw new Error(`Selected category ID does not exist: ${categoryId}`);
    }

    // Ensure or create brand
    const brandId = this.ensureBrand(rawBrand);

    // Prepare specifications
    let specs: ProductSpecification[] = [];
    if (overrides?.specifications) {
      specs = overrides.specifications;
    } else if (item.parsed_specs && item.parsed_specs.length > 0) {
      specs = item.parsed_specs;
    }

    // Prepare images
    let images: ProductImage[] = [];
    if (overrides?.media_urls && overrides.media_urls.length > 0) {
      images = overrides.media_urls.map((url, idx) => ({
        image_url: url,
        is_primary: idx === 0,
        display_order: idx
      }));
    } else if (item.parsed_media && item.parsed_media.length > 0) {
      images = item.parsed_media.map((url, idx) => ({
        image_url: url,
        is_primary: idx === 0,
        display_order: idx
      }));
    } else {
      // Default placeholder image
      images = [
        {
          image_url: '/assets/products/placeholder-gadget.svg',
          is_primary: true,
          display_order: 0
        }
      ];
    }

    // Create product in catalog using ProductRepository
    const sku = generateSku(categoryId, rawBrand);
    const publishedProduct = this.productRepo.create({
      sku,
      title,
      full_description: fullDesc,
      short_description: shortDesc,
      category_id: categoryId,
      brand_id: brandId,
      model,
      original_price: originalPrice,
      selling_price: sellingPrice,
      stock_quantity: stockQuantity,
      is_published: true,
      is_featured: overrides?.is_featured ?? false,
      is_trending: overrides?.is_trending ?? false,
      warranty_info: overrides?.warranty_info || '1 Year Official Warranty',
      shipping_class: 'STANDARD',
      origin_source: 'WHATSAPP_INGESTION',
      source_reference_id: item.message_id,
      specifications: specs,
      images
    });

    // Update extracted_products record
    this.db.prepare(`
      UPDATE extracted_products
      SET 
        approval_status = 'PUBLISHED',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(id);

    // Audit approval
    this.logApprovalAction({
      extractedProductId: id,
      adminUserId,
      action: overrides ? 'EDIT_AND_APPROVE' : 'APPROVE',
      modificationNotes: overrides?.notes || 'Product approved and published to live catalog',
      resultingProductId: publishedProduct.id
    });

    const updatedExtracted = this.getExtractedProduct(id)!;
    return { extractedProduct: updatedExtracted, publishedProduct };
  }

  // 7. Reject product
  public rejectProduct(id: string, adminUserId: string, reason: string): ExtractedProductRecord {
    const item = this.getExtractedProduct(id);
    if (!item) {
      throw new Error(`Extracted product not found: ${id}`);
    }

    this.db.prepare(`
      UPDATE extracted_products
      SET approval_status = 'REJECTED', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(id);

    this.logApprovalAction({
      extractedProductId: id,
      adminUserId,
      action: 'REJECT',
      modificationNotes: reason
    });

    return this.getExtractedProduct(id)!;
  }

  // 8. Archive product
  public archiveProduct(id: string, adminUserId: string, reason?: string): ExtractedProductRecord {
    const item = this.getExtractedProduct(id);
    if (!item) {
      throw new Error(`Extracted product not found: ${id}`);
    }

    this.db.prepare(`
      UPDATE extracted_products
      SET approval_status = 'ARCHIVED', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(id);

    this.logApprovalAction({
      extractedProductId: id,
      adminUserId,
      action: 'ARCHIVE',
      modificationNotes: reason || 'Product archived from moderation queue'
    });

    return this.getExtractedProduct(id)!;
  }

  // 9. Merge with existing product (for duplicates)
  public mergeWithExisting(
    id: string,
    targetProductId: string,
    adminUserId: string,
    options: { updatePrice?: boolean; addStock?: number; notes?: string } = {}
  ): { extractedProduct: ExtractedProductRecord; targetProduct: Product } {
    const item = this.getExtractedProduct(id);
    if (!item) {
      throw new Error(`Extracted product not found: ${id}`);
    }

    const target = this.productRepo.findById(targetProductId);
    if (!target) {
      throw new Error(`Target product for merge not found: ${targetProductId}`);
    }

    let newStock = target.stock_quantity;
    if (options.addStock && options.addStock > 0) {
      newStock += options.addStock;
    }

    let newPrice = target.selling_price;
    if (options.updatePrice && item.extracted_selling_price && item.extracted_selling_price < target.selling_price) {
      newPrice = item.extracted_selling_price;
    }

    const updatedTarget = this.productRepo.update(targetProductId, {
      stock_quantity: newStock,
      selling_price: newPrice
    });

    // Mark extracted item as published/merged
    this.db.prepare(`
      UPDATE extracted_products
      SET 
        approval_status = 'PUBLISHED',
        duplicate_of_product_id = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(targetProductId, id);

    this.logApprovalAction({
      extractedProductId: id,
      adminUserId,
      action: 'MERGE',
      modificationNotes: options.notes || `Merged into ${target.sku}. Stock added: ${options.addStock || 0}`,
      resultingProductId: targetProductId
    });

    return {
      extractedProduct: this.getExtractedProduct(id)!,
      targetProduct: updatedTarget
    };
  }

  // 10. Bulk Operations
  public bulkApprove(
    ids: string[],
    adminUserId: string
  ): { successful: Array<{ id: string; productId: string }>; failed: Array<{ id: string; error: string }> } {
    const successful: Array<{ id: string; productId: string }> = [];
    const failed: Array<{ id: string; error: string }> = [];

    for (const id of ids) {
      try {
        const result = this.approveAndPublish(id, adminUserId);
        successful.push({ id, productId: result.publishedProduct.id });
      } catch (err: any) {
        failed.push({ id, error: err.message || 'Approval failed' });
      }
    }

    return { successful, failed };
  }

  public bulkReject(
    ids: string[],
    adminUserId: string,
    reason: string
  ): { successful: string[]; failed: Array<{ id: string; error: string }> } {
    const successful: string[] = [];
    const failed: Array<{ id: string; error: string }> = [];

    for (const id of ids) {
      try {
        this.rejectProduct(id, adminUserId, reason);
        successful.push(id);
      } catch (err: any) {
        failed.push({ id, error: err.message || 'Rejection failed' });
      }
    }

    return { successful, failed };
  }

  public bulkArchive(
    ids: string[],
    adminUserId: string
  ): { successful: string[]; failed: Array<{ id: string; error: string }> } {
    const successful: string[] = [];
    const failed: Array<{ id: string; error: string }> = [];

    for (const id of ids) {
      try {
        this.archiveProduct(id, adminUserId);
        successful.push(id);
      } catch (err: any) {
        failed.push({ id, error: err.message || 'Archiving failed' });
      }
    }

    return { successful, failed };
  }

  // Helper to log approval actions in product_approvals
  private logApprovalAction(entry: {
    extractedProductId: string;
    adminUserId: string;
    action: string;
    modificationNotes?: string;
    resultingProductId?: string;
  }): void {
    const id = `appr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.db.prepare(`
      INSERT INTO product_approvals (
        id, extracted_product_id, admin_user_id, action, modification_notes, resulting_product_id
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      id,
      entry.extractedProductId,
      entry.adminUserId,
      entry.action,
      entry.modificationNotes || null,
      entry.resultingProductId || null
    );
  }

  // Helper to ensure brand exists
  private ensureBrand(brandName: string): string {
    const cleanName = brandName.trim();
    const slug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const existing = this.db.prepare(`
      SELECT id FROM brands WHERE LOWER(name) = LOWER(?) OR LOWER(slug) = LOWER(?) LIMIT 1
    `).get(cleanName, slug) as { id: string } | undefined;

    if (existing) {
      return existing.id;
    }

    const newBrandId = `brand_${slug.replace(/-/g, '_')}_${Math.floor(Math.random() * 1000)}`;
    this.db.prepare(`
      INSERT INTO brands (id, name, slug, origin_country)
      VALUES (?, ?, ?, 'Global')
    `).run(newBrandId, cleanName, slug);

    return newBrandId;
  }

  // Helper to parse and enrich extracted record
  private enrichRecord(row: any): ExtractedProductRecord {
    let parsedSpecs: Array<{ spec_key: string; spec_value: string }> = [];
    let parsedMedia: string[] = [];

    if (row.extracted_specs) {
      try {
        const raw = JSON.parse(row.extracted_specs);
        if (Array.isArray(raw)) {
          parsedSpecs = raw;
        } else if (typeof raw === 'object' && raw !== null) {
          parsedSpecs = Object.entries(raw).map(([k, v]) => ({ spec_key: k, spec_value: String(v) }));
        }
      } catch {
        parsedSpecs = [];
      }
    }

    if (row.media_urls) {
      try {
        const raw = JSON.parse(row.media_urls);
        if (Array.isArray(raw)) {
          parsedMedia = raw;
        }
      } catch {
        parsedMedia = [];
      }
    }

    return {
      id: row.id,
      message_id: row.message_id,
      extracted_title: row.extracted_title,
      extracted_category: row.extracted_category,
      suggested_category_id: row.suggested_category_id,
      extracted_brand: row.extracted_brand,
      extracted_model: row.extracted_model,
      extracted_original_price: row.extracted_original_price,
      extracted_selling_price: row.extracted_selling_price,
      extracted_discount: row.extracted_discount,
      extracted_specs: row.extracted_specs,
      extracted_description: row.extracted_description,
      media_urls: row.media_urls,
      confidence_score: row.confidence_score,
      duplicate_of_product_id: row.duplicate_of_product_id,
      approval_status: row.approval_status as WorkflowStatus,
      created_at: row.created_at,
      updated_at: row.updated_at,
      category_name: row.category_name,
      sender_phone: row.sender_phone,
      parsed_specs: parsedSpecs,
      parsed_media: parsedMedia
    };
  }
}
