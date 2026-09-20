# GizmoVault — Deployment & Production Release Plan

This document details the infrastructure architecture, containerization, environment configuration, database management, and Android Google Play Store release procedures for GizmoVault.

---

## 1. Production Architecture Topology

```
                      [ User Traffic ]
                             │
                      [ Cloudflare CDN ]
                      (DDoS, WAF, SSL)
                             │
              ┌──────────────┴──────────────┐
              ▼                             ▼
       [ Frontend Web ]              [ Backend API ]
       React SPA on Edge             Node.js / Express Cluster
       (Vercel / Cloudflare)         (Docker / Cloud Run / VPS)
                                            │
                             ┌──────────────┼──────────────┐
                             ▼              ▼              ▼
                        [ SQLite / ]   [ Redis / ]    [ Cloud Object ]
                        [ Postgres ]   [ Queue   ]    [ Storage (CDN)]
```

---

## 2. Environment Variables Specification (`.env.example`)

```bash
# Server Configuration
NODE_ENV=production
PORT=4000
API_BASE_URL=https://api.gizmovault.com
CLIENT_BASE_URL=https://gizmovault.com

# Database
DATABASE_URL=file:./data/gizmovault.db
# DATABASE_URL=postgresql://user:password@host:5432/gizmovault

# Authentication & Security
JWT_SECRET=replace_with_strong_64_character_hex_secret
JWT_EXPIRES_IN=1h
REFRESH_TOKEN_EXPIRES_IN=7d
CORS_ORIGIN=https://gizmovault.com,capacitor://localhost

# WhatsApp Business / Meta Cloud API
WHATSAPP_ENABLED=true
WHATSAPP_ACCESS_TOKEN=replace_with_meta_system_user_token
WHATSAPP_PHONE_NUMBER_ID=replace_with_registered_phone_number_id
WHATSAPP_BUSINESS_ACCOUNT_ID=replace_with_waba_id
WHATSAPP_VERIFY_TOKEN=replace_with_custom_webhook_verify_token
WHATSAPP_APP_SECRET=replace_with_meta_app_secret

# Payment Gateways (Physical Goods Ecommerce)
PAYMENT_PROVIDER=MOCK  # Options: MOCK, RAZORPAY, STRIPE
RAZORPAY_KEY_ID=rzp_live_xxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxx
RAZORPAY_WEBHOOK_SECRET=xxxxxxxxxxxxxxxx
STRIPE_SECRET_KEY=sk_live_xxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxx

# Media & Storage
STORAGE_PROVIDER=LOCAL  # Options: LOCAL, S3, GCS
MEDIA_UPLOAD_DIR=./uploads
CDN_BASE_URL=https://cdn.gizmovault.com

# Observability & Logging
LOG_LEVEL=info
```

---

## 3. Google Play Store Release & Packaging Workflow

To publish GizmoVault on the Google Play Store:

```mermaid
graph LR
    A[Build Vite React Web App<br>npm run build] --> B[Sync to Android Assets<br>npx cap sync android]
    B --> C[Configure AndroidManifest & Build.gradle<br>API 34+, 64-bit]
    C --> D[Sign with Production Keystore]
    D --> E[Generate Android App Bundle<br>.aab]
    E --> F[Upload to Google Play Console]
    F --> G[Internal / Closed Testing]
    G --> H[Production Track Release]
```

### 3.1 Android Capacitor Configuration
1. Initialize Capacitor: `npx cap init GizmoVault com.gizmovault.app --web-dir dist`
2. Add Android Platform: `npx cap add android`
3. Target SDK Version: Set `targetSdkVersion = 34` (or `35`) in `android/variables.gradle`.
4. Permissions: Declare only minimal necessary permissions in `AndroidManifest.xml` (`INTERNET`, `POST_NOTIFICATIONS`). No invasive storage or SMS permissions are required.

### 3.2 Google Play Console Declarations
- **App Category:** Shopping (Ecommerce).
- **Physical Goods Policy:** Complete financial services / payment declaration indicating the app sells physical electronic gadgets and watches delivered via physical shipping. In-app Google Play Billing is not applicable for physical merchandise.
- **Account Deletion Link:** Provide live URL: `https://gizmovault.com/account/delete-request`.
- **Privacy Policy Link:** Provide live URL: `https://gizmovault.com/privacy`.
- **Data Safety Form:** Disclose collection of Name, Phone, Email, Delivery Address, and Order History for app functionality and order fulfillment.

---

## 4. Disaster Recovery & Backup Procedures

1. **Automated Database Backups:**
   - Daily automated database snapshots with 30-day point-in-time retention.
   - For SQLite: Safe point-in-time vacuum backup using `VACUUM INTO '/backups/gizmovault_backup_YYYYMMDD.db'`.
2. **Media Redundancy:**
   - Stored media is mirrored across geo-redundant storage with standard lifecycle policies.
3. **Rollback Strategy:**
   - Stateless Docker images tagged by Git commit SHA.
   - Blue/Green deployments allow instant rollback within 60 seconds if health checks fail.
   - Database migrations maintain backward compatibility (`expand/contract` pattern).
