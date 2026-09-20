# GizmoVault — Comprehensive Testing Strategy

This document outlines the testing strategy, test pyramid, automated test suites, and validation protocols for GizmoVault, including end-to-end verification of all 25 critical scenarios mandated in Phase 31 of the project specification.

---

## 1. Testing Pyramid & Tooling

```
            / \
           /   \
          / E2E \         Vitest / Playwright (Full User Flow)
         /-------\
        /  Integ  \       Supertest + In-Memory SQLite (API & Webhook Contracts)
       /-----------\
      /    Unit     \     Vitest (Calculations, AI Extractors, Deduplication)
     /---------------\
```

| Layer | Framework / Tool | Scope | Target Execution Time |
|---|---|---|---|
| **Unit Tests** | Vitest | Pricing math, coupon rules, specs parser, deduplication hashing, validation schema | < 3 seconds |
| **Integration Tests** | Supertest + Express + SQLite | Auth, Catalog, Cart, Order, Payment provider, WhatsApp webhook endpoints | < 8 seconds |
| **End-to-End Tests** | Vitest Test Runner | Complete lifecycle: WhatsApp Broadcast -> Extraction -> Approval -> Catalog -> Cart -> Checkout -> Payment -> Order | < 15 seconds |
| **Static Analysis** | TypeScript compiler (`tsc --noEmit`), ESLint | Type safety, dead code detection, lint compliance | < 5 seconds |

---

## 2. The 25 Critical Test Scenarios (Phase 31 Validation Suite)

All 25 scenarios are mapped to automated test cases in the test suite (`tests/scenarios.test.ts`):

| # | Scenario | Test Case Implementation | Expected Outcome |
|---|---|---|---|
| **1** | Import product with image | Feed incoming message with valid image media payload. | Media resolved, attached to extracted draft with status `EXTRACTED`. |
| **2** | Import product with video | Feed incoming message with video media payload. | Video URL stored, `has_video = true`, thumbnail generated. |
| **3** | Import product with image + text | Combined message with photo and pricing/specs description. | Both media and structured attributes parsed into single draft. |
| **4** | Extract price | Message containing `Price ₹2,999` or `Rs 2999`. | Normalized `original_price: 2999.00`, currency `INR`. |
| **5** | Extract discount | Message containing `Discount ₹2,499` or `Deal 2499`. | Normalized `selling_price: 2499.00`, `discount: 500.00` (16.7%). |
| **6** | Extract category | "AMOLED Bluetooth Calling Smartwatch" text. | Classified as `Imported Watches` -> `Smart Watches`. |
| **7** | Detect missing price | Product announcement with specs and images but zero price. | Flagged as `NEEDS_REVIEW`, marked `missingFields: ['price']`. Never auto-published. |
| **8** | Detect duplicate product | Ingest message with identical SKU or Brand+Model fingerprint. | Matched with existing product ID, updates price/stock without creating new product. |
| **9** | Reject low-confidence category | Ambiguous product text with confidence score < 0.85. | Assigned status `NEEDS_REVIEW`, routed to Admin Moderation Queue. |
| **10** | Approve product | Admin triggers `POST /admin/ingestion/:id/approve`. | Status changed to `APPROVED`, approval recorded in audit log. |
| **11** | Publish product | Approved product transitioned to live store. | `is_published = 1`, searchable and browseable in public catalog. |
| **12** | Add one product to cart | Customer adds 1 unit of published item to cart. | Item added, subtotal equals product selling price. |
| **13** | Add multiple products | Customer adds multiple distinct products and increments quantities. | Correctly sums subtotal, enforces per-product limits. |
| **14** | Apply coupon | Customer applies valid coupon `GIZMO10`. | Validates min-order threshold, deducts discount, recalculates grand total. |
| **15** | Invalid coupon | Expired coupon, unknown code, or order below min threshold. | Returns `400 Bad Request` with descriptive error; cart prices unchanged. |
| **16** | Checkout | Cart transitioned to checkout with shipping address selected. | Re-validates inventory and prices; locks checkout snapshot. |
| **17** | Payment success | Gateway callback verifies valid payment signature. | Order marked `PAID`, inventory deducted, tracking code issued. |
| **18** | Payment failure | Gateway returns payment failure or cancelled callback. | Order marked `PAYMENT_FAILED`, reserved stock released back to inventory. |
| **19** | Stock unavailable | Item stock becomes 0 between cart addition and checkout. | Checkout blocked with `OUT_OF_STOCK` error; prompts user to update cart. |
| **20** | Duplicate payment callback | Webhook delivers identical payment callback twice. | Idempotency check detects duplicate; skips re-processing, returns `200 OK`. |
| **21** | Order cancellation | Customer or admin cancels eligible unfulfilled order. | Order marked `CANCELLED`, inventory restored, refund initiated. |
| **22** | Refund | Process full or partial refund on paid order. | Order marked `REFUNDED`, payment state updated, audit log created. |
| **23** | Media processing failure | Corrupted or inaccessible image URL from external vendor. | Gracefully flagged with `media_error`, product staged for admin re-upload. |
| **24** | WhatsApp API failure | External Meta endpoint times out or returns HTTP 500. | Exponential backoff retry triggered; pipeline does not crash. |
| **25** | Database failure | Database locks or query failure during transaction. | Transaction rolled back cleanly, atomic state preserved, 503 returned. |

---

## 3. Automated Test Execution Commands

```bash
# Run complete test suite (Unit + Integration + Scenarios)
npm test

# Run tests in watch mode during development
npm run test:watch

# Run static type checking
npm run typecheck

# Run code coverage report
npm run test:coverage
```

---

## 4. Phase Verification Gate

Per `GizmoVault.txt` Rule 3 & 4:
Before completing any development phase:
1. Compile / Build must exit with code `0`.
2. Automated test suite must complete with `0` failures.
3. Linting and static analysis must have `0` errors.
4. Phase documentation must be synchronized with `PHASE_STATUS.md`.
