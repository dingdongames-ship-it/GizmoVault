-- Migration: 003_coupon_engine_enhancement.sql
-- Adds product_id, is_first_order_only, times_used to coupons table and creates coupon_usages table

ALTER TABLE coupons ADD COLUMN product_id TEXT NULL REFERENCES products(id);
ALTER TABLE coupons ADD COLUMN is_first_order_only INTEGER NOT NULL DEFAULT 0;
ALTER TABLE coupons ADD COLUMN times_used INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS coupon_usages (
    id TEXT PRIMARY KEY,
    coupon_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    order_id TEXT NULL,
    discount_amount REAL NOT NULL,
    used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_coupon_usages_lookup ON coupon_usages(coupon_id, user_id);
