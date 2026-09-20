-- Migration: 002_cart_saved_items.sql
-- Adds is_saved_for_later flag to cart_items table

ALTER TABLE cart_items ADD COLUMN is_saved_for_later INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_cart_items_saved ON cart_items(cart_id, is_saved_for_later);
