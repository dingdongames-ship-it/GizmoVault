# GizmoVault — Security Architecture & Threat Model

This document specifies the security controls, data protection policies, and compliance measures governing the GizmoVault platform, including Google Play Store Data Safety and PCI DSS payment security standards.

---

## 1. Security Principles

1. **Defense in Depth:** Multiple layers of security across network, edge, application, data, and mobile runtime.
2. **Zero Trust for Client Data:** The frontend client is never trusted for pricing, discounts, stock levels, or payment authorization. All business rules are enforced authoritatively on the backend.
3. **Principle of Least Privilege:** Users, admin roles, and external integrations possess only the minimum permissions necessary.
4. **Secret Isolation:** API keys, database credentials, JWT secrets, and webhook secrets are exclusively stored in server environment variables. Zero secrets exist in client or mobile bundles.

---

## 2. Authentication & Authorization Framework

### 2.1 Password Hashing & Credentials
- Customer and Admin passwords are encrypted using `bcrypt` with a salt work factor of `12`.
- Plaintext passwords are never logged, cached, or persisted.

### 2.2 JWT Session Management
- Tokens are signed with HMAC-SHA256 (`HS256`) or asymmetric RSA (`RS256`).
- Standard claims:
  - `sub`: User ID
  - `role`: Role identifier (`CUSTOMER`, `ADMIN`, `CATALOG_MANAGER`)
  - `iat`: Issued at timestamp
  - `exp`: Expiration timestamp (1 hour for customer access tokens, 15 minutes for admin access tokens)
- Refresh token rotation prevents session hijacking.

### 2.3 Role-Based Access Control (RBAC)
Endpoint access is strictly guarded by middleware:
- `requireAuth`: Validates JWT token presence and signature.
- `requireRole('ADMIN')`: Verifies administrative claims for modifying catalog, orders, and system configurations.

---

## 3. Web & Mobile Application Security Controls

### 3.1 HTTP Security Headers (Helmet)
```typescript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https://cdn.gizmovault.com", "https://images.unsplash.com"],
      connectSrc: ["'self'", "https://api.gizmovault.com"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    }
  },
  crossOriginEmbedderPolicy: false,
  hsts: { maxAge: 31536000, includeSubDomains: true }
}));
```

### 3.2 Rate Limiting (DDoS & Brute Force Prevention)
- **General API Endpoints:** 100 requests per minute per IP.
- **Authentication Endpoints (`/login`, `/register`, `/otp`):** 5 requests per minute per IP to prevent credential stuffing.
- **Webhook Endpoints:** 300 requests per minute per verified source.

### 3.3 SQL Injection & XSS Prevention
- All database queries employ parameterized prepared statements. Raw string interpolation in SQL queries is prohibited.
- User-supplied HTML/text inputs are sanitized before rendering; React's native JSX escaping prevents DOM-based XSS.

---

## 4. Payment Security & PCI DSS Compliance

Per `GizmoVault.txt` Phase 18 and Google Play Store policies:
1. **Zero Cardholder Data Storage:** GizmoVault servers never see, process, or store raw credit/debit card numbers, CVVs, or bank PINs.
2. **Gateway Hosted / Tokenized Elements:** Card collection occurs through PCI-DSS Level 1 compliant gateway SDKs/iframes.
3. **Server-Side Verification:** Orders are transitioned to `PAID` state exclusively upon cryptographically verified webhook signatures or verified server-to-server gateway callback queries. Client reports of payment success are treated solely as UI feedback.

---

## 5. Webhook Security (Meta & Payment Providers)

Every incoming webhook must pass signature verification before execution:
```typescript
export function verifyMetaSignature(rawBody: string, signatureHeader: string, appSecret: string): boolean {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false;
  const signature = signatureHeader.substring(7);
  const expectedSignature = crypto
    .createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSignature, 'hex'));
}
```

---

## 6. Google Play Store Compliance & Data Safety

### 6.1 Account Deletion Standard
In compliance with Google Play’s Account Deletion Policy:
1. **In-App Account Deletion:** Accessible within `Profile -> Settings -> Account Security -> Delete Account`.
2. **Public Web URL:** Accessible without requiring the mobile app at `https://gizmovault.com/account/delete-request`.
3. **Data Deletion Protocol:**
   - User profile credentials, addresses, and wishlist items are permanently erased.
   - Completed financial orders are retained in an anonymized state for legally required statutory tax/accounting periods (e.g. 7 years), stripped of all personally identifiable contact information (PII).

### 6.2 Data Safety Disclosures
- **Collected Data:** Name, Phone, Email, Shipping Address, Purchase History, Device ID (for push notifications).
- **Data Sharing:** Data is shared exclusively with verified operational partners (courier delivery logistics and payment gateways). Zero personal data is sold to third parties.
- **Data Encryption:** TLS 1.3 enforced for all data in transit; encrypted disk storage for data at rest.
