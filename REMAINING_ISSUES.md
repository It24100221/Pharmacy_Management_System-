# Remaining Issues (Current Handoff)

Updated: 2026-10-09 (Asia/Colombo)

> The first sections below are retained historical planning notes from before the operational-domain sprint. The current verified status is in [FINAL_EVALUATION_READINESS.md](FINAL_EVALUATION_READINESS.md). Implemented domains include billing/invoice records, notifications, purchase orders/goods receipts, stock batches/movements, and prescription-to-POS handoff. The remaining work is primarily disposable-database mutation/concurrency verification and explicitly deferred provider features.

## Critical/high functional gaps

1. **Payment/billing domain is missing.** Implement separate customer invoices, payment attempts/records, statuses, unique provider/idempotency references, confirmation, failure, cancellation/refund, and receipt linkage. Supplier payables must be separate.
2. **Notifications are missing.** Add persistent notifications, recipient/type/deduplication keys, read/unread state, retry/outbox handling, and truthful delivery-channel status.
3. **Supplier purchase-order lifecycle is missing.** Add low-stock request, PO creation/approval, supplier response, delivery/goods receipt, supplier invoice, and payable transitions.
4. **Inventory history is missing.** Add an append-only stock ledger/adjustment model tied to purchases, sales, returns, expiries, and manual corrections.
5. **Successful write/E2E verification is incomplete.** Create an isolated test database and run all success, failure, rollback, and concurrency flows.

## High/medium reliability and security work

- Add idempotency keys/unique constraints for direct sales, purchases, payments, and notification creation.
- Add real concurrent SQL tests for competing sales, duplicate payment callbacks, and receiving versus selling.
- Implement rate limiting, especially on login, registration, and upload routes. Use a shared store when deployed on multiple instances.
- Add server-side logout/token revocation or document the short-lived-token-only security model and add refresh-token rotation.
- Add structured request IDs, security event logging, and redaction rules.
- Add product image upload/download, authenticated management, storage validation, and fallback behavior. Public product `image_url` is currently always null.
- Add medicine deactivation/deletion with relationship-safe behavior.
- Prefer customer deactivation over destructive deletion where audit/history retention is required.
- Replace the legacy SQL syntax conversion layer with native SQL Server queries and explicit `mssql` parameter types.
- Review CORS production origin configuration and add security headers (for example Helmet or equivalent).

## Dependency issue

The final npm audit reports 3 moderate findings through `mssql` 11.0.2 → `tedious` 18.6.2 → `sprintf-js` 1.1.3. The published advisory states that no patched `sprintf-js` release exists. Monitor upstream `tedious`/`mssql`; do not use npm’s proposed forced downgrade to `mssql` 4.2.0 without a compatibility/security review.

## Database cleanup awaiting approval

Delete only test sale `24` and test purchase `17`, and restore medicine `1` quantity by `+1`, inside one asserted transaction. This action has not been run because explicit permission is required.

## Exact production-readiness sequence

1. Provision a disposable SQL Server integration database from migrations 001–005; never point destructive tests at shared data.
2. Implement the payment/invoice, notification/outbox, supplier PO/goods-receipt/payable, and inventory-ledger schemas and services with reviewed migrations.
3. Add the missing APIs and RBAC rules; publish an OpenAPI contract.
4. Add success/error/unauthorized tests for every endpoint using the isolated database, including file downloads and mutation cleanup.
5. Add idempotency and real concurrent-session tests for stock and payment operations.
6. Add rate limiting, security headers, token-revocation strategy, structured logs, and secret rotation/deployment controls.
7. Implement product media storage and access controls.
8. Run `npm.cmd test`, the full isolated integration suite, migrations from an empty database, dependency audit, and all three required E2E workflows.
9. Verify database state and test cleanup after every run.
10. Obtain a final security review and backup/restore rehearsal before production deployment.

## Current command set

```powershell
cd backend
npm.cmd ci
npm.cmd run migrate
npm.cmd test
npm.cmd start
npm.cmd run verify:api-readonly
npm.cmd audit --omit=dev
```

Do not run the existing write-capable verification scripts against shared data until cleanup permission and an isolated database are available.

