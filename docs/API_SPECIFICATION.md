# GizmoVault — REST API Specification

This document details the RESTful API contract for GizmoVault. All requests and responses use `application/json` unless otherwise specified. Standard HTTP status codes are employed throughout.

---

## 1. Global Standards & Error Format

### 1.1 Base URL
- Development: `http://localhost:4000/api/v1`
- Production: `https://api.gizmovault.com/api/v1`

### 1.2 Authentication Header
Requests to protected endpoints must provide the Bearer token in the `Authorization` header:
```http
Authorization: Bearer <jwt_token>
```

### 1.3 Standard Error Response Structure
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request payload failed validation.",
    "details": [
      {
        "field": "phone",
        "message": "Phone number must be a valid E.164 format (+91XXXXXXXXXX)"
      }
    ]
  },
  "timestamp": "2026-09-19T10:30:00.000Z"
}
```

---

## 2. Authentication & User Account Endpoints

### 2.1 Register New Customer
- **Endpoint:** `POST /auth/register`
- **Access:** Public
- **Request Body:**
  ```json
  {
    "full_name": "Aarav Sharma",
    "email": "aarav@example.com",
    "phone": "+919876543210",
    "password": "SecurePassword123!"
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "success": true,
    "data": {
      "user": {
        "id": "usr_8fa9c7b1-2e1f-4d2a-8b1e-92c730e70001",
        "full_name": "Aarav Sharma",
        "email": "aarav@example.com",
        "phone": "+919876543210",
        "is_phone_verified": false
      },
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6..."
    }
  }
  ```

### 2.2 Customer & Admin Login
- **Endpoint:** `POST /auth/login`
- **Access:** Public
- **Request Body:**
  ```json
  {
    "identifier": "+919876543210",
    "password": "SecurePassword123!"
  }
  ```
- **Response (200 OK):** Returns JWT token and user profile including assigned role (`CUSTOMER` or `ADMIN`).

### 2.3 Account Deletion (Google Play Store Compliance)
- **In-App Endpoint:** `DELETE /auth/me`
  - **Access:** Authenticated (Customer)
  - **Action:** Soft-deletes user account, cancels open sessions, schedules data anonymization.
- **Public Web Endpoint:** `POST /auth/account-deletion-request`
  - **Access:** Public (Web portal for Play Store compliance)
  - **Request Body:**
    ```json
    {
      "identifier": "+919876543210",
      "reason": "No longer need the service"
    }
    ```
  - **Response (200 OK):** Initiates verification code before permanent deletion.

---

## 3. Product Catalog & Search Endpoints

### 3.1 List Products (Catalog Browsing)
- **Endpoint:** `GET /products`
- **Access:** Public
- **Query Parameters:**
  - `category_slug`: Filter by category (e.g. `imported-watches`, `electronic-gadgets`)
  - `min_price`: Minimum selling price
  - `max_price`: Maximum selling price
  - `brand`: Filter by brand slug
  - `sort`: `price_asc`, `price_desc`, `popular`, `newest` (default)
  - `page`: Page number (default: 1)
  - `limit`: Items per page (default: 20, max: 50)
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "items": [
        {
          "id": "prod_1",
          "sku": "GV-WTC-AMOLED-01",
          "title": "Aura Chrono AMOLED Smartwatch",
          "category": "Imported Watches",
          "brand": "Aura",
          "original_price": 4999.00,
          "selling_price": 2999.00,
          "discount_amount": 2000.00,
          "discount_percent": 40.0,
          "primary_image": "https://cdn.gizmovault.com/products/aura-1.webp",
          "has_video": true,
          "stock_status": "IN_STOCK",
          "rating": 4.8
        }
      ],
      "pagination": {
        "page": 1,
        "limit": 20,
        "total_items": 45,
        "total_pages": 3
      }
    }
  }
  ```

### 3.2 Product Details
- **Endpoint:** `GET /products/:id`
- **Access:** Public
- **Response (200 OK):** Returns full product entity, specifications array, image gallery array, video URL, warranty, and related products list.

### 3.3 Search Products & Autocomplete
- **Endpoint:** `GET /products/search`
- **Query Parameters:** `q` (query string), `limit` (default: 10)
- **Response (200 OK):** Returns matching products, category suggestions, and popular tags.

---

## 4. Shopping Cart & Coupon Endpoints

### 4.1 Get User Cart
- **Endpoint:** `GET /cart`
- **Access:** Authenticated or Guest (via `x-session-id` header)
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "cart_id": "crt_01",
      "items": [
        {
          "product_id": "prod_1",
          "title": "Aura Chrono AMOLED Smartwatch",
          "selling_price": 2999.00,
          "quantity": 1,
          "item_total": 2999.00,
          "stock_available": 18
        }
      ],
      "subtotal": 2999.00,
      "discount_total": 0.00,
      "estimated_shipping": 0.00,
      "grand_total": 2999.00
    }
  }
  ```

### 4.2 Add Item to Cart
- **Endpoint:** `POST /cart/items`
- **Request Body:** `{ "product_id": "prod_1", "quantity": 1 }`
- **Response (200 OK):** Updated cart object with server-verified prices.

### 4.3 Apply Coupon
- **Endpoint:** `POST /cart/apply-coupon`
- **Request Body:** `{ "code": "GIZMO10" }`
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "coupon_code": "GIZMO10",
      "discount_amount": 299.90,
      "subtotal": 2999.00,
      "grand_total": 2699.10
    }
  }
  ```

---

## 5. Checkout, Order & Payment Endpoints

### 5.1 Checkout Pre-Validation
- **Endpoint:** `POST /checkout/validate`
- **Action:** Re-validates active stock, current prices, delivery pin availability, and coupon validity.

### 5.2 Create Order
- **Endpoint:** `POST /orders`
- **Request Body:**
  ```json
  {
    "address_id": "addr_91",
    "coupon_code": "GIZMO10",
    "payment_method": "UPI"
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "success": true,
    "data": {
      "order_id": "ord_5521",
      "order_number": "GV-2026-000102",
      "grand_total": 2699.10,
      "currency": "INR",
      "payment_order": {
        "provider": "MOCK",
        "provider_order_id": "order_mock_99231",
        "amount": 2699.10,
        "currency": "INR"
      }
    }
  }
  ```

### 5.3 Verify Payment
- **Endpoint:** `POST /payments/verify`
- **Request Body:**
  ```json
  {
    "order_id": "ord_5521",
    "provider_payment_id": "pay_mock_12345",
    "signature": "simulated_secure_sig"
  }
  ```
- **Response (200 OK):** Returns payment status `PAID`, confirms inventory deduction, and triggers order processing.

---

## 6. WhatsApp Webhook & Ingestion Endpoints

### 6.1 Meta Webhook Verification
- **Endpoint:** `GET /whatsapp/webhook`
- **Query Parameters:** `hub.mode`, `hub.verify_token`, `hub.challenge`
- **Response:** Returns `hub.challenge` if token matches environment variable `WHATSAPP_VERIFY_TOKEN`.

### 6.2 Meta Webhook Receiver
- **Endpoint:** `POST /whatsapp/webhook`
- **Headers:** `X-Hub-Signature-256: sha256=...`
- **Action:** Validates signature, ingests message, extracts media/text, triggers AI normalization worker.
- **Response (200 OK):** `{ "status": "EVENT_RECEIVED" }`

### 6.3 Authorized Ingestion Simulator (Sandbox / Dev)
- **Endpoint:** `POST /whatsapp/simulate-message`
- **Access:** Admin
- **Request Body:**
  ```json
  {
    "sender_phone": "+919988776655",
    "message_type": "text",
    "text": "New Imported Tachymeter Quartz Chronograph Watch\nSolid 316L Stainless Steel\n100m Water Resistant\nPrice Rs 3499\nDiscount Rs 2799",
    "media_urls": ["https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=800&q=80"]
  }
  ```
- **Response (201 Created):** Returns extraction ID, extracted fields, confidence score, and approval status.

---

## 7. Admin Ingestion & Moderation Endpoints

### 7.1 List Ingestion Queue
- **Endpoint:** `GET /admin/ingestion/queue`
- **Query Parameters:** `status` (`NEEDS_REVIEW`, `APPROVED`, `ALL`), `page`, `limit`

### 7.2 Approve & Publish Extracted Product
- **Endpoint:** `POST /admin/ingestion/:id/approve`
- **Request Body:** Optional override fields for title, category, price, or specifications.
- **Response (200 OK):** Publishes product into live ecommerce catalog.

### 7.3 Reject Extracted Product
- **Endpoint:** `POST /admin/ingestion/:id/reject`
- **Request Body:** `{ "reason": "Low quality media / pricing unconfirmed" }`

---

## 8. System Health & Observability Endpoints

### 8.1 Health Status
- **Endpoint:** `GET /health`
- **Response (200 OK):** `{ "status": "UP", "timestamp": "..." }`

### 8.2 Readiness Check
- **Endpoint:** `GET /health/ready`
- **Checks:** Database connectivity, storage accessibility, queue health.
- **Response (200 OK / 503 Unavailable):**
  ```json
  {
    "status": "READY",
    "checks": {
      "database": "UP",
      "storage": "UP",
      "whatsapp_connector": "READY"
    }
  }
  ```
