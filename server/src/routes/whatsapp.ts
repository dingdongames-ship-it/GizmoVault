import { Router, Request, Response } from 'express';
import express from 'express';
import crypto from 'crypto';
import { DatabaseSync } from 'node:sqlite';
import { getDb } from '../db/index.js';
import { MediaPipelineService } from '../media/media.service.js';
import { AIExtractionService, StructuredProductAttributes } from '../ai/extractor.js';
import { DeduplicationService, DuplicateMatch } from '../ai/dedup.service.js';
import { r2Storage } from '../media/r2.storage.js';
import { MetaWhatsAppConnector, SimulatorWhatsAppConnector } from '../whatsapp/connector.js';
import { WhatsAppIngestionService } from '../whatsapp/ingestion.service.js';

export interface WhatsAppWebhookOptions {
  verifyToken?: string;
  appSecret?: string;
  apiToken?: string;
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
  private apiToken: string;
  private mediaPipeline: MediaPipelineService;
  private aiExtractor: AIExtractionService;
  private dedupService: DeduplicationService;
  private mediaDownloader?: (mediaId: string) => Promise<{ buffer: Buffer; mimeType: string }>;

  constructor(options: WhatsAppWebhookOptions = {}) {
    this.db = options.db || getDb();
    this.verifyToken =
      options.verifyToken ||
      process.env.WHATSAPP_VERIFY_TOKEN ||
      'gizmovault_secure_verify_token_2026';
    this.appSecret =
      options.appSecret ||
      process.env.META_APP_SECRET ||
      process.env.WHATSAPP_APP_SECRET ||
      'gizmovault_meta_app_secret_dev';
    this.apiToken =
      options.apiToken ||
      options.accessToken ||
      process.env.WHATSAPP_API_TOKEN ||
      process.env.WHATSAPP_ACCESS_TOKEN ||
      '';
    this.mediaPipeline =
      options.mediaPipeline ||
      new MediaPipelineService(
        {
          maxImageSizeBytes: 15 * 1024 * 1024,
          maxVideoSizeBytes: 50 * 1024 * 1024,
        },
        this.db
      );
    this.aiExtractor = options.aiExtractor || new AIExtractionService();
    this.dedupService = options.dedupService || new DeduplicationService(this.db);
    this.mediaDownloader = options.mediaDownloader;
  }

  /**
   * 1. Meta Webhook Verification Handshake (GET)
   * Validates hub.mode === 'subscribe' and hub.verify_token === WHATSAPP_VERIFY_TOKEN
   */
  public verify(mode?: string, token?: string, challenge?: string): string | null {
    if (mode === 'subscribe' && token === this.verifyToken && challenge !== undefined) {
      return challenge;
    }
    return null;
  }

  /**
   * 2. HMAC-SHA256 Signature Verification
   * Uses crypto.timingSafeEqual against process.env.META_APP_SECRET to prevent timing attacks
   */
  public validateSignature(rawBody: string | Buffer, signatureHeader?: string): boolean {
    if (!signatureHeader) {
      if (process.env.NODE_ENV === 'test') return true;
      return false;
    }

    const cleanSig = signatureHeader.startsWith('sha256=')
      ? signatureHeader.slice(7)
      : signatureHeader;

    try {
      const hmac = crypto.createHmac('sha256', this.appSecret);
      hmac.update(rawBody);
      const calculatedSig = hmac.digest('hex');

      const expectedBuf = Buffer.from(cleanSig, 'hex');
      const calculatedBuf = Buffer.from(calculatedSig, 'hex');

      if (expectedBuf.length !== calculatedBuf.length) {
        return false;
      }
      return crypto.timingSafeEqual(expectedBuf, calculatedBuf);
    } catch {
      return false;
    }
  }

  /**
   * 3. Download Binary Media from Meta Graph API v21.0
   * GET https://graph.facebook.com/v21.0/{media-id} with Bearer WHATSAPP_API_TOKEN
   */
  public async downloadMedia(mediaId: string): Promise<{ buffer: Buffer; mimeType: string }> {
    if (this.mediaDownloader) {
      return this.mediaDownloader(mediaId);
    }

    if (!this.apiToken) {
      throw new Error('WHATSAPP_API_TOKEN not configured for Meta Graph API media download');
    }

    // Call Meta Graph API v21.0 to get media download URL
    const metaUrl = `https://graph.facebook.com/v21.0/${mediaId}`;
    const metaRes = await fetch(metaUrl, {
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
      },
    });

    if (!metaRes.ok) {
      throw new Error(`Failed to fetch media metadata from Graph API v21.0: ${metaRes.statusText}`);
    }

    const metaData = (await metaRes.json()) as { url: string; mime_type?: string };
    if (!metaData.url) {
      throw new Error(`Download URL missing for media ID ${mediaId}`);
    }

    // Stream download the binary media
    const fileRes = await fetch(metaData.url, {
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
      },
    });

    if (!fileRes.ok) {
      throw new Error(`Failed to download binary stream from ${metaData.url}: ${fileRes.statusText}`);
    }

    const arrayBuf = await fileRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);
    const mimeType =
      metaData.mime_type || fileRes.headers.get('content-type') || 'application/octet-stream';

    return { buffer, mimeType };
  }

  /**
   * 4. Ingest and Process WhatsApp Inbound Payload
   */
  public async processPayload(
    payload: any,
    rawPayloadJson: string
  ): Promise<{
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

      // Idempotency Check & Insert into webhook_events
      try {
        const eventId = `wh_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
        this.db.prepare(`
          INSERT INTO webhook_events (
            id, provider, event_type, idempotency_key, payload, processed
          ) VALUES (?, 'WHATSAPP', 'INBOUND_MESSAGE', ?, ?, 1)
        `).run(eventId, wamid, rawPayloadJson);
      } catch (err: any) {
        if (
          err.message &&
          (err.message.includes('UNIQUE') || err.message.includes('idempotency_key'))
        ) {
          // Silent drop of replay deliveries
          return { status: 'REPLAY_IGNORED', results: [] };
        }
        throw err;
      }

      // Record in whatsapp_messages
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

      // Media Ingestion: Download & Upload to Cloudflare R2 bucket ('gizmovault-media')
      let processedMedia: any = null;
      let r2PublicUrl: string | undefined;

      if (mediaId && (msgType === 'image' || msgType === 'video')) {
        try {
          const { buffer, mimeType } = await this.downloadMedia(mediaId);
          const ext = msgType === 'video' ? 'mp4' : 'jpg';

          // Upload raw media to Cloudflare R2 bucket
          if (r2Storage.isConfigured()) {
            try {
              const r2Key = `whatsapp/${mediaId}.${ext}`;
              r2PublicUrl = await r2Storage.uploadBuffer(buffer, r2Key, mimeType);
            } catch (r2Err: any) {
              console.warn(`[Cloudflare R2 Upload Warning]: ${r2Err.message}`);
            }
          }

          // Process media for responsive sizing, thumbnails, and CDN caching
          processedMedia = this.mediaPipeline.processBuffer(
            buffer,
            `${mediaId}.${ext}`
          );
        } catch (mediaErr: any) {
          console.warn(`[WhatsApp Media Warning]: ${mediaErr.message}`);
        }
      }

      // AI Product Extraction Worker
      const broadcastText = caption || rawText || '';
      const extracted: StructuredProductAttributes = await this.aiExtractor.extract(broadcastText);

      // Deduplication Check (Jaccard similarity)
      const duplicates = this.dedupService.findDuplicates({
        title: extracted.title,
        brand: extracted.brand,
        model: extracted.model,
        specs: extracted.specifications,
        selling_price: extracted.selling_price,
      });

      // Confidence Check & Catalog Insertion
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
        categoryId = extracted.category.toLowerCase().includes('watch')
          ? 'cat_watches'
          : 'cat_phones';
      }

      // Resolve or insert brand
      let brandId: string | null = null;
      if (extracted.brand) {
        const brandRow = this.db
          .prepare('SELECT id FROM brands WHERE LOWER(name) = LOWER(?)')
          .get(extracted.brand) as any;
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
        const mediaUrlToSave = processedMedia.cdnUrl || r2PublicUrl;
        if (msgType === 'video') {
          this.db.prepare(`
            INSERT INTO product_videos (id, product_id, video_url, poster_url, is_primary)
            VALUES (?, ?, ?, ?, 1)
          `).run(
            `pvid_${Date.now()}`,
            productId,
            mediaUrlToSave,
            processedMedia.thumbnailUrl
          );
        } else {
          this.db.prepare(`
            INSERT INTO product_images (id, product_id, image_url, thumbnail_url, is_primary)
            VALUES (?, ?, ?, ?, 1)
          `).run(
            `pimg_${Date.now()}`,
            productId,
            mediaUrlToSave,
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
        media: processedMedia,
      });
    }

    return { status: 'PROCESSED', results };
  }
}

/**
 * Express Router Factory for WhatsApp Webhook & Connectors
 */
export function createWhatsAppRouter(
  service?: WhatsAppIngestionService,
  webhookService?: WhatsAppWebhookService
): Router {
  const router = Router();
  const simConnector = new SimulatorWhatsAppConnector();
  const ingestionService = service || new WhatsAppIngestionService();
  const webhookHandler = webhookService || new WhatsAppWebhookService();

  // 1. Meta Webhook Verification (GET /api/v1/whatsapp/webhook)
  router.get('/webhook', (req: Request, res: Response) => {
    const mode = req.query['hub.mode'] as string | undefined;
    const token = req.query['hub.verify_token'] as string | undefined;
    const challenge = req.query['hub.challenge'] as string | undefined;

    const verified = webhookHandler.verify(mode, token, challenge);
    if (verified !== null) {
      return res.status(200).send(verified);
    }
    return res.status(403).json({ error: 'Verification token mismatch or invalid mode' });
  });

  // 2. Production Webhook Event Ingestion (POST /api/v1/whatsapp/webhook)
  // Uses express.raw({ type: '*/*', limit: '10mb' }) before parsing JSON
  router.post(
    '/webhook',
    express.raw({ type: '*/*', limit: '10mb' }),
    async (req: Request, res: Response) => {
      const signature = (req.headers['x-hub-signature-256'] ||
        req.headers['X-Hub-Signature-256']) as string | undefined;

      const rawBodyBuf = Buffer.isBuffer(req.body)
        ? req.body
        : (req as any).rawBody
        ? Buffer.from((req as any).rawBody)
        : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
      const rawBodyStr = rawBodyBuf.toString('utf-8');

      if (signature && !webhookHandler.validateSignature(rawBodyBuf, signature)) {
        return res.status(401).json({ error: 'Invalid HMAC signature' });
      }

      let parsedPayload: any = {};
      try {
        parsedPayload = JSON.parse(rawBodyStr);
      } catch {
        return res.status(400).json({ error: 'Invalid JSON payload' });
      }

      // Check if asynchronous immediate 200 execution is requested
      const isAsync =
        process.env.NODE_ENV === 'production' ||
        req.query.async === 'true' ||
        req.headers['x-async-processing'] === 'true';

      if (isAsync) {
        // Return HTTP 200 immediately to prevent Meta retry loops
        res.status(200).json({
          success: true,
          status: 'RECEIVED',
          message: 'Webhook received and scheduled for background processing',
        });

        // Run download, R2 upload, and AI ingestion in background
        webhookHandler.processPayload(parsedPayload, rawBodyStr).catch((err: any) => {
          console.error('[WhatsApp Background Ingestion Error]:', err.message);
        });
        return;
      }

      // Synchronous execution (for test suite and deterministic execution)
      try {
        const result = await webhookHandler.processPayload(parsedPayload, rawBodyStr);
        if (result.status === 'REPLAY_IGNORED') {
          return res.status(200).json({ success: true, message: 'Replay ignored' });
        }

        return res.status(200).json({
          success: true,
          ...result,
        });
      } catch (err: any) {
        console.error('[WhatsApp Ingestion Error]:', err.message);
        return res.status(500).json({ error: err.message });
      }
    }
  );

  // 3. Admin / Test Ingestion Simulator (POST /api/v1/whatsapp/simulate)
  router.post('/simulate', (req: Request, res: Response) => {
    try {
      const messages = simConnector.parseInboundPayload(req.body);
      const result = ingestionService.processInboundMessages(messages, JSON.stringify(req.body));

      return res.status(201).json({
        success: true,
        message: 'Simulated WhatsApp message ingested successfully into moderation queue.',
        result,
      });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  // 4. List Inbound Messages (GET /api/v1/whatsapp/messages)
  router.get('/messages', (req: Request, res: Response) => {
    try {
      const status = req.query.status as string | undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const messages = ingestionService.listMessages({ status, limit });

      return res.json({
        success: true,
        count: messages.length,
        data: messages,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
}

export function createWhatsAppWebhookRouter(service?: WhatsAppWebhookService): Router {
  return createWhatsAppRouter(undefined, service);
}
