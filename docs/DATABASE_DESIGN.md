# GizmoVault — Relational Database Design & Schema Specification

This document specifies the complete, production-grade relational database architecture for GizmoVault. The schema is defined with strict foreign key integrity, index optimization for ecommerce search and filtering, auditing support, and idempotency guarantees.

---

## 1. Entity Relationship Overview

The schema is structured into six functional domains:
1. **Identity & Access Management (IAM):** `users`, `addresses`, `admin_users`, `admin_roles`.
2. **Product Catalog & Media:** `categories`, `brands`, `products`, `product_variants`, `product_images`, `product_videos`, `product_specifications`.
3. **Pricing, Inventory & Coupons:** `inventory`, `prices`, `discounts`, `coupons`, `coupon_usages`.
4. **Shopping Cart & Wishlist:** `carts`, `cart_items`, `wishlists`.
5. **Orders, Payments & Fulfillment:** `orders`, `order_items`, `payments`, `payment_attempts`, `shipments`, `shipment_trackings`.
6. **WhatsApp Ingestion & Product Moderation:** `whatsapp_sources`, `whatsapp_messages`, `whatsapp_media`, `ingestion_jobs`, `extracted_products`, `product_approvals`, `webhook_events`, `audit_logs`, `notifications`.

---

## 2. Table Specifications & DDL Definitions

### 2.1 Identity & Access Management (IAM)

#### `users`
Represents registered mobile and web consumers.
```sql
CREATE TABLE users (
    id TEXT PRIMARY KEY,                       -- UUID v4
    full_name TEXT NOT NULL,
    email TEXT UNIQUE,
    phone TEXT NOT NULL UNIQUE,                -- E.164 format (e.g. +919876543210)
    password_hash TEXT NOT NULL,               -- bcrypt hashed password
    is_phone_verified INTEGER DEFAULT 0,       -- 0: False, 1: True
    is_email_verified INTEGER DEFAULT 0,
    status TEXT DEFAULT 'ACTIVE',              -- ACTIVE, SUSPENDED, DELETED
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL                   -- Soft delete support for Play Store account deletion
);

CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_email ON users(email);
```

#### `addresses`
User shipping and billing address book.
```sql
CREATE TABLE addresses (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    address_line1 TEXT NOT NULL,
    address_line2 TEXT,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    postal_code TEXT NOT NULL,
    country TEXT NOT NULL DEFAULT 'IN',        -- ISO Alpha-2 (IN, US, AE, etc.)
    is_default INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_addresses_user ON addresses(user_id);
```

#### `admin_roles` & `admin_users`
Internal administration and staff access control.
```sql
CREATE TABLE admin_roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,                 -- SUPER_ADMIN, CATALOG_MANAGER, ORDER_MANAGER, SUPPORT
    permissions TEXT NOT NULL,                 -- JSON array of allowed scopes
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE admin_users (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role_id TEXT NOT NULL,
    status TEXT DEFAULT 'ACTIVE',
    last_login DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES admin_roles(id)
);
```

---

### 2.2 Product Catalog & Taxonomy

#### `categories`
Hierarchical product taxonomy supporting nested categories (e.g. Watches -> Imported Watches -> Chronograph).
```sql
CREATE TABLE categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    parent_id TEXT NULL,
    description TEXT,
    icon_url TEXT,
    banner_url TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE INDEX idx_categories_slug ON categories(slug);
CREATE INDEX idx_categories_parent ON categories(parent_id);
```

#### `brands`
Product brands and manufacturers.
```sql
CREATE TABLE brands (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    logo_url TEXT,
    origin_country TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### `products`
Core product catalog table.
```sql
CREATE TABLE products (
    id TEXT PRIMARY KEY,
    sku TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    short_description TEXT,
    full_description TEXT NOT NULL,
    category_id TEXT NOT NULL,
    brand_id TEXT NULL,
    model TEXT,
    currency TEXT DEFAULT 'INR',
    original_price REAL NOT NULL,              -- MRP / Compare at price
    selling_price REAL NOT NULL,               -- Actual customer price
    discount_amount REAL DEFAULT 0.0,
    discount_percent REAL DEFAULT 0.0,
    stock_quantity INTEGER DEFAULT 0,
    stock_status TEXT DEFAULT 'IN_STOCK',      -- IN_STOCK, LOW_STOCK, OUT_OF_STOCK
    low_stock_threshold INTEGER DEFAULT 5,
    is_published INTEGER DEFAULT 0,            -- 0: Draft/Unpublished, 1: Active in Catalog
    is_featured INTEGER DEFAULT 0,
    is_trending INTEGER DEFAULT 0,
    warranty_info TEXT,
    shipping_class TEXT DEFAULT 'STANDARD',
    origin_source TEXT DEFAULT 'MANUAL',       -- MANUAL, WHATSAPP_INGESTION
    source_reference_id TEXT NULL,             -- Links to extracted_products.id
    tags TEXT,                                 -- JSON or comma-separated search keywords
    rating_avg REAL DEFAULT 4.5,
    rating_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,
    FOREIGN KEY (category_id) REFERENCES categories(id),
    FOREIGN KEY (brand_id) REFERENCES brands(id)
);

CREATE INDEX idx_products_category ON products(category_id, is_published);
CREATE INDEX idx_products_price ON products(selling_price);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_published ON products(is_published, created_at);
```

#### `product_specifications`
Dynamic key-value specifications (Display, Bluetooth, Movement, Battery, etc.).
```sql
CREATE TABLE product_specifications (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    spec_key TEXT NOT NULL,                    -- e.g. "Display", "Water Resistance"
    spec_value TEXT NOT NULL,                  -- e.g. "1.43 AMOLED 466x466", "IP68"
    display_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX idx_specs_product ON product_specifications(product_id);
```

#### `product_images` & `product_videos`
Rich media attached to products.
```sql
CREATE TABLE product_images (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    image_url TEXT NOT NULL,
    thumbnail_url TEXT,
    alt_text TEXT,
    is_primary INTEGER DEFAULT 0,
    display_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE product_videos (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    video_url TEXT NOT NULL,
    thumbnail_url TEXT,
    duration_seconds INTEGER,
    format TEXT DEFAULT 'mp4',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX idx_product_images_prod ON product_images(product_id);
CREATE INDEX idx_product_videos_prod ON product_videos(product_id);
```

---

### 2.3 Cart, Wishlist & Coupons

#### `carts` & `cart_items`
Persistent user shopping cart.
```sql
CREATE TABLE carts (
    id TEXT PRIMARY KEY,
    user_id TEXT UNIQUE NULL,                  -- NULL for guest carts
    session_id TEXT UNIQUE NULL,               -- For guest device identification
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE cart_items (
    id TEXT PRIMARY KEY,
    cart_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    UNIQUE(cart_id, product_id)
);
```

#### `coupons` & `coupon_usages`
Promotional discount engine.
```sql
CREATE TABLE coupons (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,                 -- e.g. "GIZMO10", "WELCOME500"
    discount_type TEXT NOT NULL,               -- PERCENTAGE, FLAT
    discount_value REAL NOT NULL,
    min_order_amount REAL DEFAULT 0.0,
    max_discount_amount REAL NULL,
    category_id TEXT NULL,                     -- Optional restriction
    valid_from DATETIME NOT NULL,
    valid_until DATETIME NOT NULL,
    usage_limit INTEGER DEFAULT 1000,
    per_user_limit INTEGER DEFAULT 1,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE TABLE coupon_usages (
    id TEXT PRIMARY KEY,
    coupon_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    order_id TEXT NOT NULL,
    discount_applied REAL NOT NULL,
    used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (coupon_id) REFERENCES coupons(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

### 2.4 Orders, Payments & Fulfillment

#### `orders` & `order_items`
```sql
CREATE TABLE orders (
    id TEXT PRIMARY KEY,
    order_number TEXT NOT NULL UNIQUE,         -- e.g. "GV-2026-000102"
    user_id TEXT NOT NULL,
    address_id TEXT NOT NULL,
    subtotal REAL NOT NULL,
    discount_total REAL DEFAULT 0.0,
    coupon_id TEXT NULL,
    shipping_fee REAL DEFAULT 0.0,
    tax_amount REAL DEFAULT 0.0,
    grand_total REAL NOT NULL,
    currency TEXT DEFAULT 'INR',
    order_status TEXT DEFAULT 'PAYMENT_PENDING', -- PAYMENT_PENDING, PAID, PROCESSING, PACKED, SHIPPED, OUT_FOR_DELIVERY, DELIVERED, CANCELLED, REFUNDED
    payment_status TEXT DEFAULT 'PENDING',       -- PENDING, AUTHORIZED, PAID, FAILED, REFUNDED
    shipping_address_snapshot TEXT NOT NULL,   -- Complete JSON snapshot of delivery address
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (coupon_id) REFERENCES coupons(id)
);

CREATE TABLE order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    title_snapshot TEXT NOT NULL,
    sku_snapshot TEXT NOT NULL,
    unit_price REAL NOT NULL,
    quantity INTEGER NOT NULL,
    total_price REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE INDEX idx_orders_user ON orders(user_id, created_at);
CREATE INDEX idx_orders_status ON orders(order_status);
```

#### `payments` & `payment_attempts`
```sql
CREATE TABLE payments (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    provider TEXT NOT NULL,                    -- MOCK, RAZORPAY, STRIPE
    provider_payment_id TEXT UNIQUE,
    provider_order_id TEXT,
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'INR',
    status TEXT NOT NULL,                      -- INITIATED, AUTHORIZED, PAID, FAILED, REFUNDED
    payment_method TEXT,                       -- UPI, CARD, NETBANKING, WALLET
    error_message TEXT,
    raw_response TEXT,                         -- Audit payload
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id)
);

CREATE INDEX idx_payments_order ON payments(order_id);
```

---

### 2.5 WhatsApp Ingestion & AI Moderation

#### `whatsapp_sources` & `whatsapp_messages`
Tracks authorized vendor channels and raw incoming payloads.
```sql
CREATE TABLE whatsapp_sources (
    id TEXT PRIMARY KEY,
    phone_number_id TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    business_account_id TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE whatsapp_messages (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL,
    meta_message_id TEXT NOT NULL UNIQUE,      -- Idempotency key from WhatsApp webhook
    sender_phone TEXT NOT NULL,
    message_type TEXT NOT NULL,                -- text, image, video, document
    raw_text TEXT,
    caption TEXT,
    media_id TEXT,                             -- Meta media identifier
    processing_status TEXT DEFAULT 'PENDING',  -- PENDING, PROCESSING, EXTRACTED, FAILED
    received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (source_id) REFERENCES whatsapp_sources(id)
);

CREATE INDEX idx_wa_msg_meta_id ON whatsapp_messages(meta_message_id);
```

#### `extracted_products` & `product_approvals`
AI extraction intermediary holding structured attributes prior to catalog publication.
```sql
CREATE TABLE extracted_products (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL,
    extracted_title TEXT,
    extracted_category TEXT,
    suggested_category_id TEXT,
    extracted_brand TEXT,
    extracted_model TEXT,
    extracted_original_price REAL,
    extracted_selling_price REAL,
    extracted_discount REAL,
    extracted_specs TEXT,                      -- JSON key-value pairs
    extracted_description TEXT,
    media_urls TEXT,                           -- JSON array of resolved image/video URLs
    confidence_score REAL DEFAULT 0.0,         -- 0.0 to 1.0
    duplicate_of_product_id TEXT NULL,
    approval_status TEXT DEFAULT 'NEEDS_REVIEW', -- NEW, EXTRACTED, NEEDS_REVIEW, APPROVED, REJECTED, PUBLISHED
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (message_id) REFERENCES whatsapp_messages(id),
    FOREIGN KEY (suggested_category_id) REFERENCES categories(id)
);

CREATE TABLE product_approvals (
    id TEXT PRIMARY KEY,
    extracted_product_id TEXT NOT NULL,
    admin_user_id TEXT NOT NULL,
    action TEXT NOT NULL,                      -- APPROVE, REJECT, EDIT_APPROVE
    modification_notes TEXT,
    resulting_product_id TEXT NULL,
    action_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (extracted_product_id) REFERENCES extracted_products(id),
    FOREIGN KEY (admin_user_id) REFERENCES admin_users(id),
    FOREIGN KEY (resulting_product_id) REFERENCES products(id)
);
```

#### `audit_logs`
Full auditing for administrative actions, inventory modifications, and security events.
```sql
CREATE TABLE audit_logs (
    id TEXT PRIMARY KEY,
    actor_type TEXT NOT NULL,                  -- ADMIN, USER, SYSTEM
    actor_id TEXT NOT NULL,
    action TEXT NOT NULL,                      -- e.g. "PRODUCT_APPROVED", "PRICE_CHANGED", "ORDER_CANCELLED"
    entity_type TEXT NOT NULL,                 -- "products", "orders", "inventory"
    entity_id TEXT NOT NULL,
    changes_json TEXT,                         -- Diffs of before/after
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```
