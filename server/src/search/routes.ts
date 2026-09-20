import { Router, Request, Response } from 'express';
import { SearchService } from './search.service.js';

export function createSearchRouter(searchServiceInstance?: SearchService): Router {
  const router = Router();
  const searchService = searchServiceInstance || new SearchService();

  /**
   * GET /api/v1/search?q=smartwatch&category=...&min_price=...&max_price=...&in_stock=true&sort=relevance&page=1
   */
  router.get('/', (req: Request, res: Response) => {
    try {
      const {
        q, category, min_price, max_price,
        in_stock, sort, page, page_size
      } = req.query;

      if (!q) {
        return res.status(400).json({ success: false, error: 'Query parameter "q" is required.' });
      }

      const result = searchService.search({
        query: String(q),
        categoryId: category ? String(category) : undefined,
        minPrice: min_price ? Number(min_price) : undefined,
        maxPrice: max_price ? Number(max_price) : undefined,
        inStock: in_stock === 'true',
        sortBy: (sort as any) || 'relevance',
        page: page ? Number(page) : 1,
        pageSize: page_size ? Number(page_size) : 20
      });

      res.json({
        success: true,
        query: result.query,
        total: result.total,
        count: result.results.length,
        data: result.results
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  /**
   * GET /api/v1/search/autocomplete?q=smart
   */
  router.get('/autocomplete', (req: Request, res: Response) => {
    try {
      const { q } = req.query;
      const suggestions = searchService.autocomplete(String(q || ''));
      res.json({ success: true, count: suggestions.length, data: suggestions });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  /**
   * GET /api/v1/search/suggestions
   * Returns popular, recent, and trending search terms.
   */
  router.get('/suggestions', (_req: Request, res: Response) => {
    try {
      const suggestions = searchService.getSuggestions();
      res.json({ success: true, data: suggestions });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}
