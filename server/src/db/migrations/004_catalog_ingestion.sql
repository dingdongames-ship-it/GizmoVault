-- ============================================================
-- GIZMOVAULT CATALOG INGESTION SCHEMA (MIGRATION 004)
-- Shopify-Style Catalog Products & Media for WhatsApp Ingestion
-- ============================================================

CREATE TABLE IF NOT EXISTS catalog_products (
    id TEXT PRIMARY KEY,
    merchant_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description_html TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'DRAFT',
    category TEXT NOT NULL,
    price REAL NOT NULL DEFAULT 0.0,
    currency TEXT NOT NULL DEFAULT 'INR',
    media TEXT NOT NULL DEFAULT '[]',
    raw_whatsapp_source TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_catalog_merchant ON catalog_products(merchant_id);
CREATE INDEX IF NOT EXISTS idx_catalog_status ON catalog_products(status);
CREATE INDEX IF NOT EXISTS idx_catalog_category ON catalog_products(category);
CREATE INDEX IF NOT EXISTS idx_catalog_created_at ON catalog_products(created_at DESC);
