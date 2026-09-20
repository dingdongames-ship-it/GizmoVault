import { Router, Request, Response } from 'express';
import { MediaPipelineService } from './media.service.js';

export function createMediaRoutes(customService?: MediaPipelineService): Router {
  const router = Router();
  const service = customService || new MediaPipelineService();

  // 1. Upload & Process Media (Base64 or JSON buffer payload)
  router.post('/process', (req: Request, res: Response) => {
    try {
      const { base64Data, filename, type } = req.body;
      if (!base64Data) {
        return res.status(400).json({ success: false, error: 'base64Data is required' });
      }

      const buffer = Buffer.from(base64Data, 'base64');
      const validation = service.validateMediaBuffer(buffer, filename);

      if (!validation.valid) {
        return res.status(400).json({ success: false, error: validation.error });
      }

      if (validation.mediaType === 'IMAGE') {
        const result = service.processImage(buffer, filename);
        return res.json({ success: true, mediaType: 'IMAGE', ...result });
      } else if (validation.mediaType === 'VIDEO') {
        const result = service.processVideo(buffer, filename);
        return res.json({ success: true, mediaType: 'VIDEO', ...result });
      }

      res.status(400).json({ success: false, error: 'Unsupported media type' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 2. Cloak upstream private source URLs
  router.post('/cloak-url', (req: Request, res: Response) => {
    try {
      const { sourceUrl } = req.body;
      if (!sourceUrl) {
        return res.status(400).json({ success: false, error: 'sourceUrl is required' });
      }
      const cloaked = service.cloakSourceUrl(sourceUrl);
      res.json({ success: true, ...cloaked });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 3. Generate signed temporary token for secure streaming/access
  router.get('/secure-token', (req: Request, res: Response) => {
    try {
      const resourcePath = req.query.path ? String(req.query.path) : '/media/products/sample.webp';
      const expiresIn = req.query.expiresIn ? Number(req.query.expiresIn) : 86400;
      const token = service.generateSecureToken(resourcePath, expiresIn);
      res.json({ success: true, resourcePath, token, expiresIn });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 4. Verify secure media token
  router.post('/verify-token', (req: Request, res: Response) => {
    try {
      const { token, resourcePath } = req.body;
      if (!token || !resourcePath) {
        return res.status(400).json({ success: false, error: 'token and resourcePath are required' });
      }
      const isValid = service.verifySecureToken(token, resourcePath);
      res.json({ success: true, valid: isValid });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}
