# GizmoVault — Comprehensive Project Requirements

**Project Name:** GizmoVault  
**Tagline:** "Discover. Compare. Shop."  
**Project Classification:** Production-grade AI-powered Ecommerce Platform with WhatsApp/Business-content ingestion, automated catalog generation, and Google Play Store mobile deployment.  
**Initial Primary Market:** India (INR currency, UPI / Cards / NetBanking / COD), architected for international expansion (multi-currency, cross-border shipping).  
**Primary Launch Categories:** Electronic Gadgets and Imported Watches.

---

## 1. Executive Summary & Vision

GizmoVault bridges the gap between conversational social commerce and structured modern ecommerce. In today's retail landscape—especially across emerging markets like India—thousands of high-quality electronics, smart gadgets, and imported watches are marketed through direct vendor communications, WhatsApp groups, and vendor broadcast catalogs. However, these channels lack standardized checkout, searchable catalogs, reliable payment gateways, inventory reservation, and order tracking.

GizmoVault provides:
1. **Authorized Ingestion Engine:** Captures product announcements, images, videos, pricing, and descriptions from official WhatsApp Business Platform integrations and authorized webhooks.
2. **AI-Assisted Normalization & Extraction:** Automatically parses messy, unstructured chat messages into standardized product specifications, calculates discounts, classifies items into structured categories, detects duplicates, and routes items to an Admin Approval Queue.
3. **Consumer Ecommerce Mobile Application:** A fast, responsive, mobile-first shopping experience built for the web and packaged for the **Google Play Store**, complete with dynamic filtering, rich media galleries (supporting product videos), server-validated cart, flexible coupons, streamlined 6-step checkout, and real-time order tracking.
4. **Comprehensive Admin Portal:** Provides centralized oversight for reviewing incoming WhatsApp extractions, approving products, managing inventory, issuing coupons, fulfilling orders, monitoring system health, and viewing real-time sales analytics.

---

## 2. Target Audience & Personas

### 2.1 The Customer (Mobile Shopper)
- **Profile:** Tech-savvy shoppers, watch enthusiasts, and gadget collectors seeking curated, authentic imported electronics and trending smartwatches.
- **Key Needs:**
  - Fast, responsive browsing on Android phones and tablets.
  - Transparent pricing with clear original vs. discounted prices.
  - Video previews and high-resolution image galleries.
  - Frictionless checkout supporting UPI, Credit/Debit cards, Net Banking, and popular wallets.
  - Direct order tracking and status notifications.
  - Privacy guarantees, easy account management, and one-click account deletion complying with Google Play Store standards.

### 2.2 The Store Administrator / Catalog Manager
- **Profile:** Business operators sourcing inventory from global electronics hubs and watch manufacturers via authorized WhatsApp Business channels.
- **Key Needs:**
  - Automated ingestion of vendor messages containing photos, videos, and specifications.
  - Confidence scoring to review uncertain extracts before public listing.
  - Deduplication prevention to avoid redundant listings of the same model.
  - Full control over pricing, inventory levels, order status updates, and coupons.
  - Real-time visibility into ingestion metrics, sales figures, and operational health.

---

## 3. Product Catalog & Category Taxonomy

### 3.1 Primary Launch Categories
1. **Electronic Gadgets**
   - *Audio:* ANC Wireless Headphones, TWS Earbuds, Hi-Res Neckbands, Bluetooth Soundbars.
   - *Smart Devices:* Smart Home Plugs, Ambient LED Bars, Wireless Charging Docks, Mini Projectors.
   - *Mobile Accessories:* Fast GaN Chargers, Braided Type-C/Lightning Cables, MagSafe Power Banks, Phone Gimbals.
   - *Computer & Gaming:* Mechanical Keyboards, Ergonomic Wireless Mice, USB-C Hubs, RGB Headsets.
2. **Imported Watches**
   - *Smartwatches:* AMOLED Bluetooth Calling Watches, Rugged Outdoor GPS Watches, Stainless Steel Smartwatches.
   - *Chronograph:* Tachymeter Chronographs, Triple Sub-Dial Sport Watches, Quartz Chronometers.
   - *Analog & Automatic:* Skeleton Mechanical Automatics, Classic Dress Watches, Sapphire Crystal Automatics.
   - *Luxury-Inspired & Sports:* Ceramic Bezel Divers, Tactical Military Watches, Ultra-Thin Minimalist Watches.

### 3.2 Dynamic Specification Schema
Every product supports a flexible key-value specification schema adapted to its category:
- **Smartwatches / Wearables:** Display Type (AMOLED/TFT), Battery Life, Bluetooth Version, Water Resistance (e.g., IP68, 5ATM), Sensors, Compatibility (iOS/Android).
- **Audio:** Driver Size, Noise Cancellation (ANC/ENC dB), Latency, Codecs (aptX, LDAC, AAC), Playback Time.
- **Watches:** Movement (Automatic / Quartz), Case Diameter, Case Material (316L Stainless Steel / Titanium), Water Resistance, Strap Material (Leather / Silicone / Steel), Glass (Sapphire / Mineral).
- **General Electronics:** Power Input, Dimensions, Weight, Warranty Period, Certifications (CE, FCC, RoHS, BIS).

---

## 4. Google Play Store Compliance Requirements

The application is targeted for publication on the Google Play Store as an Android App (packaged via Capacitor / Android Trusted Web Activity / Native wrapper) and must adhere strictly to Google Play Developer Policies:

### 4.1 Payment Policy (Physical Goods Exemption)
- **Policy Standard:** Google Play’s billing system is required *only* for digital goods and services. For physical goods (such as physical electronic gadgets, physical watches, and tangible merchandise delivered to a physical address), Google Play Developer Policy explicitly permits and expects developers to use alternative payment processors (e.g., Razorpay, Stripe, Cashfree, UPI, Credit Cards).
- **GizmoVault Implementation:** Integrated server-verified payment gateway supporting UPI, Credit/Debit Cards, NetBanking, and Wallets for physical goods delivery without violating Play Store billing policies.

### 4.2 Account Deletion Policy
- **Policy Standard:** Under Google Play's User Data policy, apps that allow account creation must provide users with an accessible in-app path to delete their account and associated data, along with a publicly accessible web link for account deletion requests outside the app.
- **GizmoVault Implementation:**
  - **In-App:** Customer Profile -> Settings -> "Delete Account" with double-confirmation modal, clearing sessions and triggering soft-deletion / data anonymization.
  - **Public Web Link:** Dedicated route `/account/delete-request` accessible without logging in, allowing users to submit an account deletion request using their registered email/phone.

### 4.3 Data Safety & Privacy Policy
- **Policy Standard:** Clear disclosure of data collection (Name, Phone, Email, Delivery Address, Order History), purpose of use, encryption in transit (HTTPS/TLS), and zero sale of personal data to third parties.
- **GizmoVault Implementation:** Complete public pages for Privacy Policy (`/privacy`), Terms of Service (`/terms`), Refund Policy (`/refund-policy`), and Shipping Policy (`/shipping-policy`), linked from app onboarding, checkout, and footer navigation.

### 4.4 Target SDK & Technical Requirements
- Minimum Target SDK: Android 14+ (API Level 34 or API Level 35) per Google Play submission mandates.
- 64-bit architecture support.
- Responsive layout handling across mobile phones, foldable devices, and tablets.
- Android Back Button hardware handling and graceful offline/network failure state.

---

## 5. WhatsApp Integration & Meta Compliance

### 5.1 Permitted Integrations
- Integration is strictly restricted to **official WhatsApp Business Platform / Cloud API** webhooks and registered Meta Graph API credentials.
- Authorized business channels receive vendor broadcast messages containing authorized product imagery, video demos, and pricing updates.

### 5.2 Strict Non-Compliance Prohibitions
Per `GizmoVault.txt` Rule 7, 8 & Section 115:
- **NO** scraping of private WhatsApp groups.
- **NO** unauthorized WhatsApp Web automation (e.g., Puppeteer/Playwright headless session hijacking).
- **NO** extraction of content from private personal conversations without explicit business authorization.
- **NO** circumventing Meta rate limits or security controls.
- **NO** storage of personal user chat history unrelated to authorized product catalog items.

### 5.3 Fallback Architecture
When live Meta API credentials are not yet configured in a development/staging environment, the system provides a clean, fully typed `WhatsAppConnector` interface with an authorized sandbox mock adapter for deterministic testing and validation.

---

## 6. Functional Requirements Matrix

| Module | Requirement Code | Description | Priority |
|---|---|---|---|
| **Auth** | REQ-AUTH-01 | Customer registration, password hashing (bcrypt), JWT session management. | P0 |
| **Auth** | REQ-AUTH-02 | OTP verification flow for customer phone/email. | P0 |
| **Auth** | REQ-AUTH-03 | Admin role-based access control (RBAC) separating customers from admins. | P0 |
| **Auth** | REQ-AUTH-04 | User account deletion (in-app + web URL) per Play Store policy. | P0 |
| **Catalog** | REQ-CAT-01 | Product listing with pagination, sorting (price, popularity, newest), and filtering. | P0 |
| **Catalog** | REQ-CAT-02 | Rich product detail page with multi-image gallery, video player, specs, and stock. | P0 |
| **Catalog** | REQ-CAT-03 | Dynamic category hierarchy (Electronics, Imported Watches, Subcategories). | P0 |
| **Search** | REQ-SCH-01 | Full-text search across titles, brands, models, tags, and specifications. | P0 |
| **Search** | REQ-SCH-02 | Autocomplete suggestions, recent searches, and popular search tags. | P1 |
| **Cart** | REQ-CRT-01 | Add to cart, quantity adjustment, remove item, save for later. | P0 |
| **Cart** | REQ-CRT-02 | Server-side validation of prices, discounts, stock levels, and cart totals. | P0 |
| **Coupons** | REQ-CPN-01 | Dynamic coupon engine supporting percentage, flat, and minimum order rules. | P1 |
| **Checkout**| REQ-CHK-01 | 6-step streamlined mobile-first checkout (Cart -> Address -> Shipping -> Coupon -> Payment -> Confirmation). | P0 |
| **Orders** | REQ-ORD-01 | Order creation, unique tracking code generation (`GV-2026-XXXXXX`), order history. | P0 |
| **Orders** | REQ-ORD-02 | Inventory reservation on order initiation, confirmed on payment, released on failure. | P0 |
| **Payment**| REQ-PAY-01 | Pluggable `PaymentProvider` abstraction with mock and live gateway support. | P0 |
| **Payment**| REQ-PAY-02 | Server-verified payment status, webhook signature validation, idempotency. | P0 |
| **WhatsApp**|REQ-WA-01 | Meta Cloud API webhook endpoint with verification token and signature checks. | P0 |
| **WhatsApp**|REQ-WA-02 | Authorized media resolution (download and storage of incoming images/videos). | P0 |
| **AI Ingestion**|REQ-AI-01| Extraction of product title, price, discount, specs, and category from raw text. | P0 |
| **AI Ingestion**|REQ-AI-02| Confidence scoring and automated routing to Admin Approval Queue. | P0 |
| **Admin** | REQ-ADM-01 | Executive dashboard with metrics (Revenue, Orders, Ingestion stats, Inventory). | P0 |
| **Admin** | REQ-ADM-02 | WhatsApp Ingestion Center (Review, Edit, Approve, Reject, Publish). | P0 |
| **Admin** | REQ-ADM-03 | Product, category, inventory, and coupon management CRUD. | P0 |
| **System** | REQ-SYS-01 | Health endpoints (`/health`, `/health/ready`), structured logging, error handling. | P0 |

---

## 7. Non-Functional Requirements (NFRs)

- **Performance:** Sub-100ms API response time for catalog browsing; client bundle optimized under 200KB initial chunk; lazy loading of images and media.
- **Reliability & Resilience:** All external API calls (WhatsApp, Payment, AI) must implement exponential backoff, timeout limits (5s max for sync requests), and fallback graceful degradation.
- **Security:** Zero plaintext credentials in code; environment variables for secrets; secure HTTP headers (Helmet); rate limiting (express-rate-limit); input sanitization to eliminate SQL injection and XSS.
- **Scalability:** Stateless API design allowing horizontal scaling; relational database design with indexed foreign keys and query optimization.
- **Accessibility:** WCAG 2.1 AA compliant color contrast, ARIA labels on all interactive controls, keyboard accessibility, touch targets ≥ 48x48dp for mobile displays.
