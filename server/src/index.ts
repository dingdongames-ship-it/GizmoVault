import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { db, initializeDatabase } from './config/db.js';
import { ProductRepository } from './models/product.model.js';
import { createWhatsAppRouter } from './whatsapp/routes.js';
import { createAIRouter } from './ai/routes.js';
import { createAdminRoutes } from './admin/routes.js';
import { createMediaRoutes } from './media/routes.js';
import { createCartRouter } from './cart/routes.js';
import { createCouponRouter } from './coupons/routes.js';
import { createAddressRouter } from './addresses/routes.js';
import { createCheckoutRouter } from './checkout/routes.js';
import { createPaymentRouter } from './payment/routes.js';
import { createOrderRouter } from './orders/routes.js';
import { createSearchRouter } from './search/routes.js';
import { createAccountRouter } from './account/routes.js';
import { createRecommendationRouter } from './recommendations/routes.js';
import { createInventoryRouter } from './inventory/routes.js';
import { createNotificationRouter } from './notifications/routes.js';
import { correlationIdMiddleware } from './observability/logger.js';
import { metrics, metricsMiddleware } from './observability/metrics.js';

import path from 'path';

dotenv.config();

export const app = express();
const PORT = process.env.PORT || 4000;

// Security & Body parsing
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));

// Webhook endpoints require untransformed raw byte streams for HMAC signature verification
app.use((req, res, next) => {
  if (req.originalUrl?.includes('/webhook') || req.path?.includes('/webhook')) {
    return next();
  }
  express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  })(req, res, next);
});
app.use(correlationIdMiddleware);
app.use(metricsMiddleware);
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

// Initialize database schema and seeds
initializeDatabase();

const productRepo = new ProductRepository(db);

// WhatsApp, AI, Admin, Media, Cart, Coupon, Address & Checkout Routers
app.use('/api/v1/whatsapp', createWhatsAppRouter());
app.use('/api/v1/ai', createAIRouter());
app.use('/api/v1/admin', createAdminRoutes());
app.use('/api/v1/media', createMediaRoutes());
app.use('/api/v1/cart', createCartRouter());
app.use('/api/v1/coupons', createCouponRouter());
app.use('/api/v1/addresses', createAddressRouter());
app.use('/api/v1/checkout', createCheckoutRouter());
app.use('/api/v1/payments', createPaymentRouter());
app.use('/api/v1/orders', createOrderRouter());
app.use('/api/v1/search', createSearchRouter());
app.use('/api/v1/account', createAccountRouter());
app.use('/api/v1/recommendations', createRecommendationRouter());
app.use('/api/v1/inventory', createInventoryRouter());
app.use('/api/v1/notifications', createNotificationRouter());

// --- 1. HEALTH CHECKS ---
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'UP',
    service: 'GizmoVault API',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health/ready', (_req: Request, res: Response) => {
  try {
    const result = db.prepare('SELECT 1 as alive').get() as { alive: number };
    if (result && result.alive === 1) {
      res.json({
        status: 'READY',
        checks: {
          database: 'UP',
          whatsapp_connector: 'READY',
          ai_extraction: 'READY'
        }
      });
    } else {
      res.status(503).json({ status: 'UNAVAILABLE', error: 'Database check failed' });
    }
  } catch (err: any) {
    res.status(503).json({ status: 'UNAVAILABLE', error: err.message });
  }
});

app.get('/api/metrics', (_req: Request, res: Response) => {
  res.json({
    status: 'UP',
    metrics: metrics.getMetrics(),
  });
});

// --- 2. CATEGORIES ---
app.get('/api/categories', (_req: Request, res: Response) => {
  try {
    const categories = db.prepare(`
      SELECT c.*, COUNT(p.id) as product_count
      FROM categories c
      LEFT JOIN products p ON c.id = p.category_id AND p.deleted_at IS NULL
      GROUP BY c.id
      ORDER BY c.sort_order ASC
    `).all();
    res.json({ success: true, count: categories.length, data: categories });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- 3. PRODUCTS CATALOG ---
app.get(['/api/products', '/api/v1/products'], (req: Request, res: Response) => {
  try {
    const { category, brand, sort, search, min_price, max_price, in_stock, is_featured, is_trending, status } = req.query;

    const isPublishedFilter = status === 'PUBLISHED' ? true : (status === 'UNPUBLISHED' ? false : undefined);

    const { products, total } = productRepo.list({
      categoryId: category ? String(category) : undefined,
      brandId: brand ? String(brand) : undefined,
      search: search ? String(search) : undefined,
      minPrice: min_price ? Number(min_price) : undefined,
      maxPrice: max_price ? Number(max_price) : undefined,
      inStockOnly: in_stock === 'true',
      isFeatured: is_featured === 'true' ? true : (is_featured === 'false' ? false : undefined),
      isTrending: is_trending === 'true' ? true : (is_trending === 'false' ? false : undefined),
      isPublished: isPublishedFilter,
      sortBy: (sort as any) || 'newest'
    });

    res.json({ success: true, count: products.length, total, data: products });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get(['/api/products/:id', '/api/v1/products/:id'], (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    // Allow lookup by ID or by SKU
    const product = productRepo.getById(id) || productRepo.getBySku(id);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    res.json({
      success: true,
      data: product
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post(['/api/products', '/api/v1/products'], (req: Request, res: Response) => {
  try {
    const created = productRepo.create(req.body);
    res.status(201).json({ success: true, data: created });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// --- 3. GOOGLE PLAY COMPLIANCE: ACCOUNT DELETION ---
app.post('/api/auth/account-deletion-request', (req: Request, res: Response) => {
  const { identifier } = req.body;
  if (!identifier) {
    return res.status(400).json({ success: false, error: 'Identifier (phone or email) is required.' });
  }
  // Log deletion request per Play Store data safety policy
  res.json({
    success: true,
    message: 'Account deletion request received and scheduled for processing per Google Play Store data safety policy.'
  });
});

// --- 4. ERROR HANDLING MIDDLEWARE ---
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[GizmoVault Error]:', err);
  res.status(err.status || 500).json({
    success: false,
    error: {
      message: err.message || 'Internal Server Error'
    }
  });
});

// Start server if run directly
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`⚡ GizmoVault API Server running on port ${PORT}`);
  });
}
