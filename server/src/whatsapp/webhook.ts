import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { DatabaseSync } from 'node:sqlite';
import { getDb } from '../db/index.js';
import { MediaPipelineService } from '../media/media.service.js';
import { AIExtractionService, StructuredProductAttributes } from '../ai/extractor.js';
import { DeduplicationService, DuplicateMatch } from '../ai/dedup.service.js';

export interface WhatsAppWebhookOptions {
  verifyToken?: string;
  appSecret?: string;
  accessToken?: string;
  db?: DatabaseSync;
  mediaPipeline?: MediaPipelineService;
  aiExtractor?: AIExtractionService;
  dedupService?: DeduplicationService;
  mediaDownloader?: (mediaId: string) => Promise<{ buffer: Buffer; mimeType: string }>;
}

export interface IngestedProductResult {
  productId?: string;
  sku?: string;
  title: string;
  status: 'PUBLISHED' | 'NEEDS_REVIEW';
  is_published: number;
  is_featured: number;
  confidence_score: number;
  duplicates: DuplicateMatch[];
  media?: any;
}

export class WhatsAppWebhookService {
  private db: DatabaseSync;
  private verifyToken: string;
  private appSecret: string;
  private accessToken: string;
  private mediaPipeline: MediaPipelineService;
  private aiExtractor: AIExtractionService;
  private dedupService: DeduplicationService;
  private mediaDownloader?: (mediaId: string) => Promise<{ buffer: Buffer; mimeType: string }>;

  constructor(options: WhatsAppWebhookOptions = {}) {
    this.db = options.db || getDb();
    this.verifyToken = options.verifyToken || process.env.WHATSAPP_VERIFY_TOKEN || 'gizmovault_secure_verify_token_2026';
    this.appSecret = options.appSecret || process.env.WHATSAPP_APP_SECRET || 'gizmovault_meta_app_secret_dev';
    this.accessToken = options.accessToken || process.env.WHATSAPP_ACCESS_TOKEN || '';
    this.mediaPipeline = options.mediaPipeline || new MediaPipelineService({
      maxImageSizeBytes: 15 * 1024 * 1024,
      maxVideoSizeBytes: 50 * 1024 * 1024
    }, this.db);
    this.aiExtractor = options.aiExtractor || new AIExtractionService();
    this.dedupService = options.dedupService || new DeduplicationService(this.db);
    this.mediaDownloader = options.mediaDownloader;
  }

  // 1. Webhook Verification (GET)
  public verify(mode?: string, token?: string, challenge?: string): string | null {
    if (mode === 'subscribe' && token === this.verifyToken && challenge !== undefined) {
      return challenge;
    }
    return null;
  }

  // 2. Validate Signature
  public validateSignature(rawBody: string, signatureHeader?: string): boolean {
    if (!signatureHeader) {
      if (process.env.NODE_ENV === 'test') return true;
      return false;
    }

    const cleanSig = signatureHeader.startsWith('sha256=') ? signatureHeader.slice(7) : signatureHeader;
    const hmac = crypto.createHmac('sha256', this.appSecret);
    hmac.update(rawBody);
    const calculatedSig = hmac.digest('hex');

    try {
      const expectedBuf = Buffer.from(cleanSig, 'hex');
      const calculatedBuf = Buffer.from(calculatedSig, 'hex');
      if (expectedBuf.length !== calculatedBuf.length) return false;
      return crypto.timingSafeEqual(expectedBuf, calculatedBuf);
    } catch {
      return false;
    }
  }

  // 3. Download Media from Meta Graph API
  public async downloadMedia(mediaId: string): Promise<{ buffer: Buffer; mimeType: string }> {
    if (this.mediaDownloader) {
      return this.mediaDownloader(mediaId);
    }

    if (!this.accessToken) {
      throw new Error('WHATSAPP_ACCESS_TOKEN not configured for media download');
    }

    // Call Meta Graph API to get media download URL
    const metaUrl = `https://graph.facebook.com/v20.0/${mediaId}`;
    const metaRes = await fetch(metaUrl, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`
      }
    });

    if (!metaRes.ok) {
      throw new Error(`Failed to fetch media metadata from Graph API: ${metaRes.statusText}`);
    }

    const metaData = (await metaRes.json()) as { url: string; mime_type?: string };
    if (!metaData.url) {
      throw new Error(`Download URL missing for media ID ${mediaId}`);
    }

    // Download the binary media stream
    const fileRes = await fetch(metaData.url, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`
      }
    });

    if (!fileRes.ok) {
      throw new Error(`Failed to download binary stream from ${metaData.url}: ${fileRes.statusText}`);
    }

    const arrayBuf = await fileRes.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuf),
      mimeType: metaData.mime_type || fileRes.headers.get('content-type') || 'application/octet-stream'
    };
  }

  // 4. Process Inbound Payload
  public async processPayload(payload: any, rawPayloadJson: string): Promise<{
    status: 'PROCESSED' | 'REPLAY_IGNORED' | 'NO_MESSAGES';
    results: IngestedProductResult[];
  }> {
    const entry = payload?.entry?.[0];
    const change = entry?.changes?.[0];
    const val = change?.value;
    const messages = val?.messages;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return { status: 'NO_MESSAGES', results: [] };
    }

    const results: IngestedProductResult[] = [];

    for (const msg of messages) {
      const wamid = msg.id;
      if (!wamid) continue;

      // 4a. Idempotency Check & Insert into webhook_events
      try {
        const eventId = `wh_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
        this.db.prepare(`
          INSERT INTO webhook_events (
            id, provider, event_type, idempotency_key, payload, processed
          ) VALUES (?, 'WHATSAPP', 'INBOUND_MESSAGE', ?, ?, 1)
        `).run(eventId, wamid, rawPayloadJson);
      } catch (err: any) {
        if (err.message && (err.message.includes('UNIQUE') || err.message.includes('idempotency_key'))) {
          // Silent drop of replay deliveries
          return { status: 'REPLAY_IGNORED', results: [] };
        }
        throw err;
      }

      // Also record in whatsapp_messages
      const internalMsgId = `wa_msg_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
      const sender = msg.from || '+919988776655';
      const msgType = msg.type || 'text';
      let rawText: string | undefined;
      let caption: string | undefined;
      let mediaId: string | undefined;

      if (msgType === 'text') {
        rawText = msg.text?.body;
        caption = rawText;
      } else if (msgType === 'image') {
        mediaId = msg.image?.id;
        caption = msg.image?.caption;
        rawText = caption;
      } else if (msgType === 'video') {
        mediaId = msg.video?.id;
        caption = msg.video?.caption;
        rawText = caption;
      }

      this.db.prepare(`
        INSERT OR IGNORE INTO whatsapp_messages (
          id, source_id, meta_message_id, sender_phone,
          message_type, raw_text, caption, media_id,
          processing_status, received_at
        ) VALUES (?, 'src_wa_meta', ?, ?, ?, ?, ?, ?, 'PENDING', CURRENT_TIMESTAMP)
      `).run(
        internalMsgId,
        wamid,
        sender,
        msgType,
        rawText || null,
        caption || null,
        mediaId || null
      );

      // 4b. Media Pipeline Integration
      let processedMedia: any = null;
      if (mediaId && (msgType === 'image' || msgType === 'video')) {
        try {
          const { buffer } = await this.downloadMedia(mediaId);
          processedMedia = this.mediaPipeline.processBuffer(
            buffer,
            `${mediaId}.${msgType === 'video' ? 'mp4' : 'jpg'}`
          );
        } catch (mediaErr: any) {
          console.warn(`[WhatsApp Media Warning]: ${mediaErr.message}`);
        }
      }

      // 4c. AI Extraction
      const broadcastText = caption || rawText || '';
      const extracted: StructuredProductAttributes = await this.aiExtractor.extract(broadcastText);

      // 4d. Deduplication Check (Jaccard similarity)
      const duplicates = this.dedupService.findDuplicates({
        title: extracted.title,
        brand: extracted.brand,
        model: extracted.model,
        specs: extracted.specifications,
        selling_price: extracted.selling_price
      });

      // 4e. Confidence Check & Catalog Insertion
      const isHighConfidence = extracted.confidence_score > 0.85;
      const status = isHighConfidence ? 'PUBLISHED' : 'NEEDS_REVIEW';
      const is_published = isHighConfidence ? 1 : 0;
      const is_featured = isHighConfidence ? 1 : 0;

      const productId = `prod_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
      const brandCode = (extracted.brand || 'IMP').slice(0, 3).toUpperCase().replace(/[^A-Z]/g, '');
      const sku = `GV-${brandCode || 'GV'}-${Math.floor(1000 + Math.random() * 9000)}`;

      // Resolve category
      let categoryId = extracted.suggested_category_id;
      const catCheck = this.db.prepare('SELECT id FROM categories WHERE id = ?').get(categoryId);
      if (!catCheck) {
        categoryId = extracted.category.toLowerCase().includes('watch') ? 'cat_watches' : 'cat_phones';
      }

      // Resolve or insert brand
      let brandId: string | null = null;
      if (extracted.brand) {
        const brandRow = this.db.prepare('SELECT id FROM brands WHERE LOWER(name) = LOWER(?)').get(extracted.brand) as any;
        if (brandRow) {
          brandId = brandRow.id;
        } else {
          brandId = `brand_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
          const brandSlug = extracted.brand.toLowerCase().replace(/[^a-z0-9]+/g, '-');
          this.db.prepare(`
            INSERT OR IGNORE INTO brands (id, name, slug) VALUES (?, ?, ?)
          `).run(brandId, extracted.brand, brandSlug);
        }
      }

      // Insert product into catalog
      this.db.prepare(`
        INSERT INTO products (
          id, sku, title, short_description, full_description,
          category_id, brand_id, model, original_price, selling_price,
          discount_amount, discount_percent, stock_quantity, stock_status,
          is_published, is_featured, origin_source, source_reference_id
        ) VALUES (
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, 'WHATSAPP_INGESTION', ?
        )
      `).run(
        productId,
        sku,
        extracted.title || 'Imported Premium Hardware',
        extracted.description.slice(0, 160),
        extracted.description,
        categoryId,
        brandId,
        extracted.model || null,
        extracted.mrp || extracted.selling_price,
        extracted.selling_price,
        extracted.discount_amount || 0,
        extracted.discount_percent || 0,
        isHighConfidence ? 10 : 0,
        isHighConfidence ? 'IN_STOCK' : 'OUT_OF_STOCK',
        is_published,
        is_featured,
        wamid
      );

      // Insert specifications
      if (extracted.specifications && typeof extracted.specifications === 'object') {
        const insertSpec = this.db.prepare(`
          INSERT INTO product_specifications (id, product_id, spec_key, spec_value, display_order)
          VALUES (?, ?, ?, ?, ?)
        `);
        let order = 0;
        for (const [key, val] of Object.entries(extracted.specifications)) {
          insertSpec.run(`spec_${Date.now()}_${order}`, productId, key, String(val), order);
          order++;
        }
      }

      // Insert media if present
      if (processedMedia) {
        if (msgType === 'video') {
          this.db.prepare(`
            INSERT INTO product_videos (id, product_id, video_url, poster_url, is_primary)
            VALUES (?, ?, ?, ?, 1)
          `).run(
            `pvid_${Date.now()}`,
            productId,
            processedMedia.cdnUrl,
            processedMedia.thumbnailUrl
          );
        } else {
          this.db.prepare(`
            INSERT INTO product_images (id, product_id, image_url, thumbnail_url, is_primary)
            VALUES (?, ?, ?, ?, 1)
          `).run(
            `pimg_${Date.now()}`,
            productId,
            processedMedia.cdnUrl,
            processedMedia.thumbnailUrl
          );
        }
      }

      // Also record in extracted_products for Admin Queue tracking
      const extractedRowId = `ext_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
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
        extractedRowId,
        internalMsgId,
        extracted.title,
        extracted.category,
        categoryId,
        extracted.brand || 'Imported',
        extracted.model || null,
        extracted.mrp,
        extracted.selling_price,
        extracted.discount_amount,
        JSON.stringify(extracted.specifications),
        extracted.description,
        JSON.stringify(processedMedia ? [processedMedia.cdnUrl] : extracted.media_urls),
        extracted.confidence_score,
        isHighConfidence ? 'APPROVED' : 'NEEDS_REVIEW'
      );

      // Update whatsapp_messages processing status
      this.db.prepare(`
        UPDATE whatsapp_messages SET processing_status = 'PROCESSED' WHERE id = ?
      `).run(internalMsgId);

      results.push({
        productId,
        sku,
        title: extracted.title,
        status,
        is_published,
        is_featured,
        confidence_score: extracted.confidence_score,
        duplicates,
        media: processedMedia
      });
    }

    return { status: 'PROCESSED', results };
  }
}

export function createWhatsAppWebhookRouter(service?: WhatsAppWebhookService): Router {
  const router = Router();
  const webhookService = service || new WhatsAppWebhookService();

  // 1. GET /webhook - Webhook verification handshake
  router.get('/webhook', (req: Request, res: Response) => {
    const mode = req.query['hub.mode'] as string | undefined;
    const token = req.query['hub.verify_token'] as string | undefined;
    const challenge = req.query['hub.challenge'] as string | undefined;

    const verified = webhookService.verify(mode, token, challenge);
    if (verified !== null) {
      // Return raw challenge integer/string with 200 HTTP status (Meta requirement)
      return res.status(200).send(verified);
    }
    return res.status(403).json({ error: 'Verification token mismatch or invalid mode' });
  });

  // 2. POST /webhook - Secure payload ingestion & idempotency
  router.post('/webhook', async (req: Request, res: Response) => {
    const signature = req.headers['x-hub-signature-256'] as string | undefined;
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);

    if (signature && !webhookService.validateSignature(rawBody, signature)) {
      return res.status(401).json({ error: 'Invalid HMAC signature' });
    }

    try {
      const result = await webhookService.processPayload(req.body, rawBody);
      if (result.status === 'REPLAY_IGNORED') {
        // Return 200 OK immediately to silently drop replay deliveries
        return res.status(200).json({ success: true, message: 'Replay ignored' });
      }

      return res.status(200).json({
        success: true,
        ...result
      });
    } catch (err: any) {
      console.error('[WhatsApp Webhook Ingestion Error]:', err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
}
