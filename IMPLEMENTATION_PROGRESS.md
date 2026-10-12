# Implementation progress

Updated: 2026-10-10 (continuation)

| Phase | Work | Status | Verification / blocker |
|---|---|---|---|
| 0 | Repository and live SQL Server baseline | VERIFIED | Backend and frontend baseline checks pass; migration 006 is applied locally. |
| 1 | Prescription preview, persistent review state, notifications | VERIFIED (core) | PDF/image preview, lifecycle migration/status endpoint, role-scoped in-app notifications, and read state implemented. External email/SMS delivery is intentionally not claimed. |
| 2 | Batches and stock movement ledger | VERIFIED WITH LIMITATIONS | Batch receiving, deterministic FEFO allocation, exact batch/legacy movement rows, idempotent controlled adjustments, batch/movement APIs, and inventory UI are implemented. Disposable-DB and isolated live FEFO/goods-receipt checks pass; concurrent contention remains unverified. No historical batches were fabricated. |
| 3 | Prescription-to-POS lifecycle | VERIFIED WITH LIMITATIONS | Migration 009 adds `sales.prescription_id`; structured handoff is persisted as `READY_FOR_BILLING`; sale validation matches prescribed items; Cash sales create payment/invoice records, mark the related sale/invoice paid, and mark the prescription `DISPENSED`. Isolated live end-to-end execution passes; external payment confirmation remains unverified. |
| 4 | Supplier supply-chain lifecycle | PARTIAL | Purchase-order API and status lifecycle added; supplier queries, goods receipts, invoices, payments, and UI remain. |
| 5 | Customer invoices, payments, refunds | PARTIAL | Sale invoice creation and internal payment-record API added. External payment confirmation and refunds remain. |
| 6 | Notifications and audit trails | PARTIAL | Persistent in-app notifications and unread/read UI added; outbox processing and audit writes remain. |
| 7 | Product images and UX | PARTIAL | Secure image upload/read endpoints and catalogue URLs added; management UI remains. |
| 8 | Security and integrity hardening | PARTIAL | Idempotency, role checks, file protection, and validation retained/extended. Rate limiting, revocation, and malware scanning remain. |
| 9 | Automated and integration verification | VERIFIED WITH LIMITATIONS | Backend 84/84, frontend 26/26, frontend production build, read-only API, extended API, browser route sweep, safe interactions, and disposable repository verification pass. Payment-provider and concurrent contention scenarios remain unverified. |

## Phase 3 handoff details

- New migration: `009_prescription_sale_link.sql`.
- New endpoint: `GET /api/prescriptions/:id/billing`.
- Sale creation now accepts `prescription_id` and validates the locked prescription status, customer, and exact prescribed medicine quantities.
- Cash prescription sales create a confirmed internal cash payment, mark the invoice paid, and transition the prescription to `DISPENSED` in the same SQL transaction.
- Card/online prescription sales remain pending and do not mark the prescription dispensed without external confirmation.
- POS reloads approved billing work from `prescriptionId` in the URL, not only React route state.
- Added tests: `backend/test/prescriptionBilling.test.js` (3 tests).

## Phase 2 handoff details

- `GET /api/medicines/:id/batches` returns deterministic expiry-ordered lots; `GET /api/medicines/:id/movements` returns the immutable movement ledger.
- `POST /api/medicines/:id/batches` registers a future-expiry lot at zero quantity; purchase receiving is the stock-in path and requires paired batch/expiry fields in the inventory UI.
- `POST /api/medicines/:id/adjust-stock` applies a reasoned, idempotent adjustment to a selected batch or explicit legacy/unallocated stock and rejects negative quantities.
- Sales lock aggregate and batch rows, allocate eligible non-expired active stock by FEFO, and write one movement per allocation. Existing aggregate quantity remains the compatibility source for legacy/unallocated stock; a batch-total mismatch fails reconciliation instead of silently inventing stock.
- The live database currently has no batch rows, so no historical batch records were created. End-to-end FEFO and concurrent transaction behavior still require a disposable SQL Server fixture.
| 10 | Final audit and documentation | VERIFIED WITH LIMITATIONS | Shared SQL Server preserved; isolated demo database created and exercised. Backend 84/84, frontend 26/26, read-only API 72/72, extended API 32/32, browser smoke 45/45, safe interactions 18/18. Concurrent contention remains unverified. |

## 11-issue continuation checkpoint

- `FINAL_11_ISSUES_TODO.md` now records evidence-backed status for all 11 requested issues. The isolated continuation rehearsal verified standalone upload review, upload-linked billing, and low-stock request visibility/cancellation; all 11 issues are now marked `VERIFIED` with documented limits.
- Fixed a frontend regression in [BillingOrderQueue.jsx](frontend/src/pages/BillingOrderQueue.jsx): persistent empty/error copy now matches the regression contract.
- Fixed null optional-field handling in [MedicineListPage.jsx](frontend/src/pages/Medicines/MedicineListPage.jsx), preventing inventory search crashes.
- Fixed `-0` low-stock display in [LowStockPage.jsx](frontend/src/pages/Medicines/LowStockPage.jsx).
- Fixed the supplier-role request-history link in [SupplierDashboard.jsx](frontend/src/pages/SupplierDashboard.jsx).
- Removed duplicate `customer_id` aliases from prescription and sale detail queries so POS receives a scalar customer ID.
- Latest shared read-only counts: 12 medicines, 9 suppliers, 13 prescriptions, 7 sales, 2 verified batch rows, 3 stock movements, and 0 reorder requests. No shared write was performed during this continuation.

## Final verification evidence (2026-10-10)

- `npm.cmd run migrate`: all migrations 001-009 reported already applied.
- `npm.cmd run verify:api-readonly`: 72/72 pass, zero database writes.
- `node qa-audit/scripts/extendedApiAudit.cjs`: 32/32 pass, zero database writes; medicine quantity remained 598 before and after.
- `node qa-audit/scripts/fixedPathsBrowserAudit.cjs`: 45/45 pass across desktop, laptop, tablet, mobile, and narrow-mobile viewports.
- `node qa-audit/scripts/safeInteractionAudit.cjs`: 18/18 pass.
- The live database has 11 medicines, 8 suppliers, 11 prescriptions, 7 sales, and zero `medicine_batches` or `stock_movements`; no historical batches were fabricated.
- Isolated rehearsal database `pharmacy_management_demo_20261010b` was created without overwrite, seeded with synthetic records, and verified through purchase order/receipt, FEFO sale, confirmed Cash invoice payment, structured prescription dispensing, PDF upload/preview, and pharmacist notification.
- Walk-in Cash sales now create a confirmed `customer_payments` row and mark the related invoice `PAID`; regression coverage was added in `backend/test/repositories.test.js`.

## ISSUE-012 / ISSUE-013 urgent continuation checkpoint

- Removed duplicate `customer_id` result aliases from prescription and sale detail queries. This prevents SQL Server from serializing the POS customer ID as `[id, id]`.
- Prescription-linked sales now resolve the customer from the locked prescription when the request omits `customer_id`; a mismatched supplied customer fails with `409` before sale or stock writes.
- POS completion now uses a synchronous `useRef` lock plus a per-attempt idempotency key. `AppContext.createSale` remains the sole persistent-write error toast owner.
- Regression gates: backend 82/82, frontend 24/24, and isolated API evidence in `qa-audit/evidence/issue-012-013-continuation.json`.

## ISSUE-014 / ISSUE-015 customer-access regression checkpoint

- Canonicalized role casing and whitespace at the SQL user lookup, JWT authentication middleware, login/session responses, frontend session restore, and role checks.
- Preserved customer ownership enforcement: prescription uploads are queried by authenticated `customerId`, order lists use `findMine(customerId)`, and cross-customer detail/file access remains rejected with 403.
- Browser/API evidence: `/my-prescriptions` and `/my-orders` both returned 200, rendered valid empty states, and survived refresh; own demo prescriptions returned 200 with two records; unauthenticated requests returned 401 and cross-customer requests returned 403.
- Regression gates: backend 82/82, frontend 25/25, production build passed. Evidence: `qa-audit/evidence/issue-014-015-customer-access.json`.

## ISSUE-016 Send-to-Billing authorization checkpoint

- The `POST /api/prescriptions/:id/send-to-billing` route already had the correct `ADMIN`/`PHARMACIST` allow-list and the create page already persisted the prescription before calling the handoff. The surgical correction normalized legacy/stale role casing and whitespace at the SQL/JWT/frontend session boundary, preserving customer ownership and all unrelated route restrictions.
- The create page now has explicit regression coverage for its synchronous submit lock and single page-level billing error owner; the existing POS idempotency lock was left unchanged.
- Isolated SQL Server evidence: pharmacist-created prescription `6` transitioned to `READY_FOR_BILLING`, exact customer `1` and quantities `medicine 1 x 3`, `medicine 2 x 1` reached the billing queue and billing detail, refresh retained the state, and stock remained `60 -> 60` / `45 -> 45` at handoff. A real browser run against the same isolated API created prescription `7`, captured `POST /api/prescriptions -> 201` followed by `POST /api/prescriptions/7/send-to-billing -> 200`, showed `Available: 2 / 2 items`, and navigated to the pharmacist dashboard without a permission error. Evidence: `qa-audit/evidence/issue-016-send-to-billing.json`.
- Sanitized request: `POST /api/prescriptions/6/send-to-billing -> 200` with pharmacist authorization. The historical 403 was not reproducible after normalization; no credentials were recorded.
- Regression gates: backend **84/84**, frontend **26/26**, production build passed. Unauthorized customer/sales roles, missing/malformed/expired tokens, customer access, and prior prescription/POS tests remain covered.

## Safe implementation rules

- Preserve existing records and migrations; use additive, idempotent SQL only.
- Do not expose secrets or private prescription files.
- Do not claim payment, email, SMS, or malware-scanning success without a configured provider.
- Do not delete or rewrite existing user data without explicit approval.
