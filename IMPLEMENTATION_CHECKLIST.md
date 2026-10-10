# Complete System Implementation Checklist

Updated: 2026-10-09 (Asia/Colombo)

This checklist reconciles the current `dev-2` worktree, migrations 001-005, the existing audit reports, and the ten required functional epics. The referenced PDF was not present in the repository or the supplied attachment directory, so its contents could not be independently reviewed.

| Epic | Existing verified foundation | Remaining implementation work |
|---|---|---|
| 1. Authentication and roles | Customer/staff login, registration, JWT validation, session restore, route and API RBAC | Rate limiting, security headers, auditable security events, documented token revocation policy |
| 2. Medicine management | SQL-backed create/read/update, search, low-stock and expiry views, canonical product mapping | `MED-000001` identifier, safe deactivation, batch inventory, image management, remove category from medicine forms |
| 3. Inventory control | Transactional direct purchase increase and sale decrease; stock/expiry guards | Append-only stock ledger, adjustment API, reconciliation, batch-level balances, idempotent receipt movements |
| 4. Supplier procurement | Supplier CRUD and legacy direct purchase receipt | Supplier-medicine mapping, reorder requests, supplier queries/messages, purchase orders, confirmation, partial goods receipt, invoice and supplier payment |
| 5. Customers | SQL-backed registration/profile/admin CRUD with ownership checks | Safe deactivation policy and customer-facing notification integration |
| 6. Prescriptions | Private JPG/PNG upload, ownership checks, pharmacist approve/reject, durable order/POS handoff | PDF validation/storage, persistent pharmacist/customer notifications, structured review audit |
| 7. Sales, billing and payments | Database-priced transactional sales, receipts, stock lock/decrement, order reference | Tax/invoice records, payment confirmation/failure, idempotency, cancellation/refund and post-payment notification |
| 8. Notifications | None persisted | Notification/outbox tables, recipient targeting, deduplication, unread count, mark-read APIs, dashboard polling |
| 9. Product media | Product metadata columns and catalogue image URL projection | Secure upload/read API, signature validation, fallback assets, medicine and baby-care imagery |
| 10. Reporting and audit | Sales summaries and role dashboards | Purchase/payment/inventory reporting, append-only audit log, full frontend operational screens |

## Cross-layer acceptance work

- [x] Correct the frontend development proxy and verify frontend/API/SQL localhost connectivity.
- [x] Run the current backend tests, frontend tests, production build, live read-only API verifier, and browser public-route smoke test.
- [ ] Add versioned migrations for the missing operational domains.
- [ ] Implement and mount the corresponding repositories, controllers, validators, and RBAC routes.
- [ ] Complete frontend routes, navigation, forms, loading/error/empty states, and real API services.
- [ ] Provision a disposable SQL Server test database without copying production rows.
- [ ] Run successful mutation, rollback, duplicate, authorization, and concurrency tests against the disposable database.
- [ ] Run workflows A, B, and C end to end and reconcile stock/payment/notification records.
- [ ] Inspect sale 24 and purchase 17 fully and prepare a cleanup transaction; execute it only after explicit approval.
- [ ] Produce the seven required final reports with evidence-based status values.
