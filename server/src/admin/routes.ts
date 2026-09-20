import fs from 'fs';
import path from 'path';
import { Router, Request, Response } from 'express';
import formidable from 'formidable';
import { AdminApprovalService, WorkflowStatus } from './approval.service.js';
import { CatalogProductRepository } from '../models/catalog.model.js';
import { CatalogClassifierService } from './classifier.service.js';
import { ingestionEventBus } from './ingestion-stream.js';
import { r2Storage } from '../media/r2.storage.js';

export function createAdminRoutes(
  approvalService?: AdminApprovalService,
  customCatalogRepo?: CatalogProductRepository,
  customClassifier?: CatalogClassifierService
): Router {
  const router = Router();
  const service = approvalService || new AdminApprovalService();
  const catalogRepo = customCatalogRepo || new CatalogProductRepository();
  const classifier = customClassifier || new CatalogClassifierService();

  const catalogUploadDir = path.resolve(process.cwd(), 'uploads/catalog');
  if (!fs.existsSync(catalogUploadDir)) {
    fs.mkdirSync(catalogUploadDir, { recursive: true });
  }

  // Helper to resolve admin user ID (from auth header or default to seed admin)
  const getAdminUserId = (req: Request): string => {
    return (req.headers['x-admin-user-id'] as string) || 'admin_001';
  };

  // 1. Queue listing with filters
  router.get('/approvals/queue', (req: Request, res: Response) => {
    try {
      const { status, categoryId, search, limit, offset } = req.query;
      const result = service.getQueue({
        status: status ? String(status) : undefined,
        categoryId: categoryId ? String(categoryId) : undefined,
        search: search ? String(search) : undefined,
        limit: limit ? Number(limit) : 20,
        offset: offset ? Number(offset) : 0
      });
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 2. Queue metrics and status counts
  router.get('/approvals/stats', (_req: Request, res: Response) => {
    try {
      const stats = service.getQueueStats();
      res.json({ success: true, stats });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 3. Bulk operations
  router.post('/approvals/bulk-approve', (req: Request, res: Response) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ success: false, error: 'Array of ids required for bulk-approve' });
      }
      const adminUserId = getAdminUserId(req);
      const result = service.bulkApprove(ids, adminUserId);
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/approvals/bulk-reject', (req: Request, res: Response) => {
    try {
      const { ids, reason } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ success: false, error: 'Array of ids required for bulk-reject' });
      }
      const adminUserId = getAdminUserId(req);
      const result = service.bulkReject(ids, adminUserId, reason || 'Bulk rejected by admin');
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/approvals/bulk-archive', (req: Request, res: Response) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ success: false, error: 'Array of ids required for bulk-archive' });
      }
      const adminUserId = getAdminUserId(req);
      const result = service.bulkArchive(ids, adminUserId);
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 4. Single item retrieval
  router.get('/approvals/:id', (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      const item = service.getExtractedProduct(id);
      if (!item) {
        return res.status(404).json({ success: false, error: `Extracted product ${id} not found` });
      }
      res.json({ success: true, item });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 5. Edit extracted product before approval
  router.put('/approvals/:id', (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      const adminUserId = getAdminUserId(req);
      const updated = service.editExtractedProduct(id, req.body, adminUserId);
      res.json({ success: true, item: updated });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // 6. Manual state transition
  router.post('/approvals/:id/transition', (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      const { status, notes } = req.body;
      if (!status) {
        return res.status(400).json({ success: false, error: 'Target status is required' });
      }
      const adminUserId = getAdminUserId(req);
      const updated = service.transitionStatus(id, status as WorkflowStatus, adminUserId, notes);
      res.json({ success: true, item: updated });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // 7. Approve and publish to catalog
  router.post('/approvals/:id/approve', (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      const adminUserId = getAdminUserId(req);
      const result = service.approveAndPublish(id, adminUserId, req.body.overrides);
      res.json({
        success: true,
        extractedProduct: result.extractedProduct,
        publishedProduct: result.publishedProduct
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // 8. Reject extracted product
  router.post('/approvals/:id/reject', (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      const { reason } = req.body;
      const adminUserId = getAdminUserId(req);
      const rejected = service.rejectProduct(id, adminUserId, reason || 'Rejected by admin moderation');
      res.json({ success: true, item: rejected });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // 9. Archive extracted product
  router.post('/approvals/:id/archive', (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      const { reason } = req.body;
      const adminUserId = getAdminUserId(req);
      const archived = service.archiveProduct(id, adminUserId, reason);
      res.json({ success: true, item: archived });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // 10. Merge duplicate with existing catalog product
  router.post('/approvals/:id/merge', (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      const { targetProductId, options } = req.body;
      if (!targetProductId) {
        return res.status(400).json({ success: false, error: 'targetProductId is required for merge' });
      }
      const adminUserId = getAdminUserId(req);
      const result = service.mergeWithExisting(id, targetProductId, adminUserId, options);
      res.json({
        success: true,
        extractedProduct: result.extractedProduct,
        targetProduct: result.targetProduct
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // 11. Real-Time Ingestion Event Stream (Server-Sent Events)
  router.get('/ingestion-stream', (req: Request, res: Response) => {
    ingestionEventBus.handleSseConnection(req, res);
  });

  // 12. WhatsApp / Media Catalog Ingestion Endpoint (Streaming Multipart)
  router.post('/ingest-product', async (req: Request, res: Response) => {
    const startTime = performance.now();
    const trackingId = `ingest_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Broadcast ingestion initiated
    ingestionEventBus.broadcast({
      type: 'INGESTION_STARTED',
      timestamp: new Date().toISOString(),
      trackingId,
      message: 'Multipart payload stream received; beginning parsing and AI extraction.'
    });

    try {
      const form = formidable({
        uploadDir: catalogUploadDir,
        keepExtensions: true,
        maxFileSize: 150 * 1024 * 1024
      });

      const [fields, files] = await form.parse(req);

      // Resolve payload JSON
      let payloadData: any = {};
      const rawPayload = Array.isArray(fields.payload) ? fields.payload[0] : fields.payload;
      if (rawPayload) {
        try {
          payloadData = typeof rawPayload === 'string' ? JSON.parse(rawPayload) : rawPayload;
        } catch {
          payloadData = { raw_text: String(rawPayload) };
        }
      }

      // Also support direct fields if not packed in payload JSON
      const rawText = payloadData.raw_text || (Array.isArray(fields.raw_text) ? fields.raw_text[0] : fields.raw_text) || '';
      const merchantId = payloadData.merchant_id || (Array.isArray(fields.merchant_id) ? fields.merchant_id[0] : fields.merchant_id) || 'default_merchant';
      const tags = payloadData.tags || [];

      // Resolve uploaded file
      const uploadedFileObj = Array.isArray(files.file) ? files.file[0] : files.file;
      let mediaUrl = '';
      let mediaType: 'IMAGE' | 'VIDEO' = 'IMAGE';
      let originalFilename = '';

      if (uploadedFileObj) {
        const savedFilename = path.basename(uploadedFileObj.filepath);
        originalFilename = uploadedFileObj.originalFilename || savedFilename;
        const mime = uploadedFileObj.mimetype || '';
        mediaType = mime.startsWith('video/') || originalFilename.endsWith('.mp4') ? 'VIDEO' : 'IMAGE';

        // Upload to Cloudflare R2 if configured and driver is r2
        if (process.env.MEDIA_STORAGE_DRIVER === 'r2' && r2Storage.isConfigured()) {
          try {
            const r2Key = `catalog/${savedFilename}`;
            mediaUrl = await r2Storage.uploadFile(uploadedFileObj.filepath, r2Key, mime || 'application/octet-stream');
          } catch (r2Err) {
            console.warn('[R2 Upload Warning]: Failed to upload to Cloudflare R2, falling back to local URL', r2Err);
            mediaUrl = `/uploads/catalog/${savedFilename}`;
          }
        } else {
          mediaUrl = `/uploads/catalog/${savedFilename}`;
        }
      }

      // Automated Classification Step
      const draft = classifier.classifyCatalogItem(rawText, mediaUrl, mediaType, {
        merchantId,
        originalFilename,
        tags
      });

      // Persist to Shopify-style catalog schema
      const created = catalogRepo.create(draft);
      const latencyMs = Math.round(performance.now() - startTime);

      // Broadcast real-time event to merchant dashboard
      ingestionEventBus.broadcast({
        type: 'INGESTION_COMPLETED',
        timestamp: new Date().toISOString(),
        trackingId,
        product: created,
        latencyMs
      });

      res.status(201).json({
        success: true,
        trackingId,
        product: created,
        latencyMs
      });
    } catch (err: any) {
      console.error('[Ingest Error]:', err);
      ingestionEventBus.broadcast({
        type: 'INGESTION_FAILED',
        timestamp: new Date().toISOString(),
        trackingId,
        error: err.message || 'Failed to ingest catalog item'
      });
      res.status(500).json({ success: false, trackingId, error: err.message || 'Failed to ingest catalog item' });
    }
  });

  // 13. Catalog Products Query & Filter Endpoint
  router.get('/products', (req: Request, res: Response) => {
    try {
      const { merchant_id, category, status, search, page, limit } = req.query;
      const result = catalogRepo.list({
        merchant_id: merchant_id ? String(merchant_id) : undefined,
        category: category ? String(category) : undefined,
        status: status ? String(status) : undefined,
        search: search ? String(search) : undefined,
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 20
      });
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 14. Single Product Details
  router.get('/products/:id', (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      const product = catalogRepo.findById(id);
      if (!product) {
        return res.status(404).json({ success: false, error: 'Product not found' });
      }
      res.json({ success: true, product });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 15. Single Product Quick Edit & Status Update
  router.patch('/products/:id', (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      const updates = req.body;
      const updated = catalogRepo.update(id, updates);
      if (!updated) {
        return res.status(404).json({ success: false, error: 'Product not found' });
      }

      // Broadcast update event to all connected dashboard clients
      ingestionEventBus.broadcast({
        type: 'CATALOG_UPDATED',
        timestamp: new Date().toISOString(),
        product: updated
      });

      res.json({ success: true, product: updated });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // 16. Single Product Deletion / Archive
  router.delete('/products/:id', (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      const deleted = catalogRepo.delete(id);
      if (!deleted) {
        return res.status(404).json({ success: false, error: 'Product not found' });
      }

      // Broadcast deletion event to connected dashboards
      ingestionEventBus.broadcast({
        type: 'CATALOG_DELETED',
        timestamp: new Date().toISOString(),
        productId: id
      });

      res.json({ success: true, message: 'Product deleted' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 17. Bulk Operations (Publish, Archive, Delete)
  router.post('/products/bulk', (req: Request, res: Response) => {
    try {
      const { action, ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ success: false, error: 'Array of product IDs is required' });
      }

      if (action === 'publish') {
        const count = catalogRepo.batchUpdateStatus(ids, 'ACTIVE');
        ingestionEventBus.broadcast({
          type: 'CATALOG_UPDATED',
          timestamp: new Date().toISOString(),
          metadata: { action: 'bulk_publish', ids, count }
        });
        return res.json({ success: true, action: 'publish', affected: count });
      } else if (action === 'archive') {
        const count = catalogRepo.batchUpdateStatus(ids, 'ARCHIVED');
        ingestionEventBus.broadcast({
          type: 'CATALOG_UPDATED',
          timestamp: new Date().toISOString(),
          metadata: { action: 'bulk_archive', ids, count }
        });
        return res.json({ success: true, action: 'archive', affected: count });
      } else if (action === 'delete') {
        const count = catalogRepo.batchDelete(ids);
        ingestionEventBus.broadcast({
          type: 'CATALOG_DELETED',
          timestamp: new Date().toISOString(),
          metadata: { action: 'bulk_delete', ids, count }
        });
        return res.json({ success: true, action: 'delete', affected: count });
      } else {
        return res.status(400).json({ success: false, error: 'Invalid action: must be publish, archive, or delete' });
      }
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}
