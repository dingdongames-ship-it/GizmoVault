import { Router, Request, Response } from 'express';
import { AIPipelineService } from './pipeline.service.js';
import { SmartCategoryService } from './category.service.js';
import { DeduplicationService } from './dedup.service.js';

export function createAIRouter(
  service?: AIPipelineService,
  catService?: SmartCategoryService,
  dedup?: DeduplicationService
): Router {
  const router = Router();
  const pipeline = service || new AIPipelineService();
  const categoryService = catService || new SmartCategoryService();
  const dedupService = dedup || new DeduplicationService();

  // 1. Trigger extraction on a WhatsApp message (POST)
  router.post('/extract/:messageId', async (req: Request, res: Response) => {
    try {
      const messageId = String(req.params.messageId);
      const extracted = await pipeline.processMessage(messageId);

      return res.status(200).json({
        success: true,
        data: extracted
      });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  });

  // 2. List Extracted Products (GET)
  router.get('/extracted', (req: Request, res: Response) => {
    try {
      const status = req.query.status as string | undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

      const { items, total } = pipeline.listExtracted({ status, limit, offset });

      return res.json({
        success: true,
        count: items.length,
        total,
        data: items
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 3. Get single extracted item (GET)
  router.get('/extracted/:id', (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      const item = pipeline.getExtractedById(id);
      if (!item) {
        return res.status(404).json({ success: false, error: 'Extracted product not found' });
      }

      return res.json({ success: true, data: item });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 4. Smart Category Classification (POST)
  router.post('/classify-category', (req: Request, res: Response) => {
    try {
      const { title, description, specs, brand } = req.body;
      if (!title) {
        return res.status(400).json({ success: false, error: 'Product title is required' });
      }

      const result = categoryService.classify(title, description, specs, brand);
      return res.json({ success: true, data: result });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 5. List Master Categories (GET)
  router.get('/categories', (_req: Request, res: Response) => {
    try {
      const categories = categoryService.getAllCategories();
      return res.json({ success: true, count: categories.length, data: categories });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 6. Check Product Deduplication (POST)
  router.post('/check-duplicate', (req: Request, res: Response) => {
    try {
      const { title, brand, model, specs } = req.body;
      if (!title) {
        return res.status(400).json({ success: false, error: 'Title is required for deduplication check' });
      }

      const matches = dedupService.findDuplicates({ title, brand, model, specs });
      const fingerprint = dedupService.generateFingerprint({ title, brand, model, specs });

      return res.json({
        success: true,
        fingerprint,
        isDuplicate: matches.some((m) => m.similarityScore >= 0.80),
        matchCount: matches.length,
        matches
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}
