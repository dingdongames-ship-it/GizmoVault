import { DatabaseSync } from 'node:sqlite';
import { getDb } from '../db/index.js';
import { HeuristicProductExtractor, ProductExtractor, ExtractedProductResult } from './extractor.js';
import { InboundWhatsAppMessage } from '../whatsapp/connector.js';

export interface ExtractedProductRow {
  id: string;
  message_id: string;
  extracted_title: string;
  extracted_category: string;
  suggested_category_id: string;
  extracted_brand: string;
  extracted_model?: string;
  extracted_original_price: number;
  extracted_selling_price: number;
  extracted_discount: number;
  extracted_specs: string;
  extracted_description: string;
  media_urls?: string;
  confidence_score: number;
  duplicate_of_product_id?: string | null;
  approval_status: 'NEEDS_REVIEW' | 'APPROVED' | 'REJECTED' | 'FLAGGED';
  created_at: string;
}

export class AIPipelineService {
  private db: DatabaseSync;
  private extractor: ProductExtractor;

  constructor(customDb?: DatabaseSync, customExtractor?: ProductExtractor) {
    this.db = customDb || getDb();
    this.extractor = customExtractor || new HeuristicProductExtractor();
  }

  public async processMessage(internalMessageId: string): Promise<ExtractedProductRow> {
    // 1. Fetch WhatsApp message
    const msg = this.db.prepare(`
      SELECT * FROM whatsapp_messages WHERE id = ?
    `).get(internalMessageId) as any;

    if (!msg) {
      throw new Error(`WhatsApp message ${internalMessageId} not found`);
    }

    // 2. Mark job as PROCESSING
    this.db.prepare(`
      UPDATE ingestion_jobs 
      SET job_status = 'PROCESSING', started_at = CURRENT_TIMESTAMP, attempt_count = attempt_count + 1
      WHERE source_message_id = ?
    `).run(internalMessageId);

    try {
      const inboundMsg: InboundWhatsAppMessage = {
        source_id: msg.source_id,
        meta_message_id: msg.meta_message_id,
        sender_phone: msg.sender_phone,
        message_type: msg.message_type,
        raw_text: msg.raw_text,
        caption: msg.caption,
        media_id: msg.media_id,
        timestamp: msg.received_at
      };

      // 3. Extract attributes
      const extracted: ExtractedProductResult = await this.extractor.extract(inboundMsg);

      const extractedId = `ext_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

      // 4. Save into extracted_products
      this.db.prepare(`
        INSERT INTO extracted_products (
          id, message_id, extracted_title, extracted_category, suggested_category_id,
          extracted_brand, extracted_model, extracted_original_price, extracted_selling_price,
          extracted_discount, extracted_specs, extracted_description, media_urls,
          confidence_score, approval_status
        ) VALUES (
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?
        )
      `).run(
        extractedId,
        internalMessageId,
        extracted.title,
        extracted.category,
        extracted.suggested_category_id,
        extracted.brand || 'GizmoVault Imports',
        extracted.model || null,
        extracted.original_price,
        extracted.selling_price,
        extracted.discount_amount,
        JSON.stringify(extracted.specs),
        extracted.description,
        JSON.stringify(extracted.media_urls),
        extracted.confidence_score,
        extracted.approval_status
      );

      // 5. Update message and job status
      this.db.prepare(`
        UPDATE whatsapp_messages SET processing_status = 'PROCESSED' WHERE id = ?
      `).run(internalMessageId);

      this.db.prepare(`
        UPDATE ingestion_jobs 
        SET job_status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP
        WHERE source_message_id = ?
      `).run(internalMessageId);

      return this.getExtractedById(extractedId)!;
    } catch (err: any) {
      // Mark job as failed
      this.db.prepare(`
        UPDATE ingestion_jobs 
        SET job_status = 'FAILED', error_message = ?
        WHERE source_message_id = ?
      `).run(err.message, internalMessageId);

      this.db.prepare(`
        UPDATE whatsapp_messages SET processing_status = 'FAILED' WHERE id = ?
      `).run(internalMessageId);

      throw err;
    }
  }

  public getExtractedById(id: string): ExtractedProductRow | null {
    return ((this.db.prepare(`
      SELECT * FROM extracted_products WHERE id = ?
    `).get(id) as unknown) as ExtractedProductRow) || null;
  }

  public listExtracted(options: { status?: string; limit?: number; offset?: number } = {}): {
    items: ExtractedProductRow[];
    total: number;
  } {
    let whereClause = '1=1';
    const params: any[] = [];

    if (options.status) {
      whereClause += ' AND approval_status = ?';
      params.push(options.status);
    }

    const countRow = this.db.prepare(`
      SELECT COUNT(*) as count FROM extracted_products WHERE ${whereClause}
    `).get(...params) as { count: number };
    const total = countRow ? countRow.count : 0;

    const limit = options.limit || 50;
    const offset = options.offset || 0;

    const items = this.db.prepare(`
      SELECT * FROM extracted_products 
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset) as unknown as ExtractedProductRow[];

    return { items, total };
  }
}
