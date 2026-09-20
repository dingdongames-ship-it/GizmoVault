import { Router, Request, Response } from 'express';
import { RecommendationEngine } from './recommendation.engine.js';
import { db } from '../config/db.js';

export function createRecommendationRouter(engine?: RecommendationEngine): Router {
  const router = Router();
  const recEngine = engine || new RecommendationEngine(db);

  // GET /api/v1/recommendations/product/:productId
  router.get('/product/:productId', (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 6;
      const recs = recEngine.getRecommendations({
        currentProductId: String(req.params.productId),
        limit,
      });
      res.json({ success: true, recommendations: recs });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/v1/recommendations/trending
  router.get('/trending', (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 8;
      const recs = recEngine.getRecommendations({ limit });
      res.json({ success: true, recommendations: recs });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/v1/recommendations/cart
  router.post('/cart', (req: Request, res: Response) => {
    try {
      const { productIds, limit } = req.body;
      const recs = recEngine.getRecommendations({
        cartProductIds: productIds || [],
        limit: limit || 4,
      });
      res.json({ success: true, recommendations: recs });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
