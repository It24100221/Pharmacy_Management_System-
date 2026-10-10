# Missing Features and Quality Gaps

Audit date: 2026-10-09

This report separates absent/incomplete scope from confirmed runtime defects. It does not assume enterprise features are required unless the existing design or project documentation already claims them.

## Fully implemented and practically verified

| Capability | Evidence |
|---|---|
| Staff JWT login for Admin, Pharmacist, Inventory, Sales, Supplier | Five real browser logins and role redirects pass |
| Customer logout/session clearing | Browser interaction passes |
| Public product catalogue search and category presentation | Browser search and public APIs pass |
| Medicine/supplier/customer/sale/purchase read APIs | Authorized read cases pass |
| Input validation and parameterization | Unit tests plus 14 live validation/security cases pass |
| Private order ownership check | Owned order fixture loads; controller enforces customer ID |
| Responsive layout baseline | 255 runs at five sizes, no horizontal overflow |
| Schema migrations and core referential integrity | Migrations 001–009; no untrusted constraints or tested orphans |

## Implemented but broken

| Capability | State | Reference |
|---|---|---|
| Prescription list/review queue | SQL error prevents list loading | BUG-001 |
| Billing-order queue | React effect crash produces blank page | BUG-002 |
| Customer self-registration | Public endpoint intercepted by auth | BUG-003 |
| Health/readiness probe | Public endpoint intercepted by auth | BUG-003 |
| Auditable stock editing | Direct quantity create/update bypasses ledger | BUG-004 |
| Cumulative customer payment accounting | Outstanding balance is not calculated | BUG-005 |

## Partially implemented or not fully verified

| Capability | What exists | Missing proof or functionality |
|---|---|---|
| FEFO batch allocation | Schema, service logic, unit tests, read APIs | No live batch rows; no disposable-DB sale or concurrent final-unit test |
| Stock movement ledger | Schema and transactional writes in purchase/sale/adjustment paths | Zero live rows; medicine metadata path bypasses it |
| Prescription-to-POS | Status schema, billing endpoint, sale link, unit tests | List bug blocks practical queue; no isolated end-to-end dispense test |
| Purchase orders | CRUD/status APIs and pages | Zero fixtures; creation/transition/receiving success paths blocked |
| Goods receipts | Transactional repository and pages | No confirmed PO fixture; no live partial receipt verification |
| Supplier inquiries/messages | APIs and pages | Zero fixtures; successful message/status paths unverified |
| Supplier invoices/payments | Schema, APIs, page routes | Zero fixtures; successful balance/payment flow unverified |
| Customer invoices/payments | Sale-time schema/repository and payment API | Tables empty; cumulative-payment defect; no refund API/UI |
| In-app notifications | Schema, list/read API, top-nav menu | Zero rows; creation/deduplication and lifecycle not exercised |
| Product images | Secure upload/read endpoints and frontend fallback | No image fixture; management UI not exposed in normal medicine forms |
| Prescription files | MIME/signature/storage unit tests and protected endpoints | Live valid download/preview not opened to avoid private data exposure |
| Customer cart/checkout | APIs and pages | No safe disposable cart/order mutation run |
| Print receipt | Button renders | Native print dialog behavior not automated |

## Not implemented or explicitly external

- External card/mobile/online payment-provider confirmation and webhook verification.
- Email/SMS outbox processing and provider delivery confirmation.
- Malware scanning or content disarm for uploaded files.
- Refund processing API/UI despite the presence of a `sale_refunds` table.
- Server-side token revocation/logout or refresh-token rotation.
- Rate limiting for login, registration, and upload endpoints.
- Security headers such as Helmet/CSP/HSTS configuration.
- Structured request IDs, centralized redaction, and operational audit-log writes; `audit_logs` exists but is empty and no writer was found.
- OpenAPI/API contract publication.
- Automated WCAG scanning, screen-reader testing, and full keyboard/focus-trap coverage.
- An isolated, automatically provisioned SQL Server integration database.

## Data and environment gaps

- All 598 medicine units are legacy/unallocated stock. No current row can prove batch reconciliation or FEFO behavior.
- Purchase-order, goods-receipt, supplier-inquiry, supplier-invoice, customer-invoice/payment, notification, and movement tables have no live fixtures.
- A valid customer password was not available; customer authorization was tested with a short-lived JWT derived from the canonical database identity, while invalid customer login was tested through the UI.
- The repository working tree was already heavily modified and uncommitted. The audit tested that exact state and did not attempt to normalize it.
- Current duplicate medicine and supplier names require business-rule clarification before adding uniqueness constraints.

## Recommended scope decisions

1. Decide whether medicine identity is name-only or a compound identity (generic, strength, form, manufacturer).
2. Decide whether customer and medicine deletion should be deactivation to retain pharmacy audit history.
3. Define partial customer-payment behavior and whether invoices may be partially paid.
4. Define whether legacy stock must be migrated to explicit opening batches before demonstration.
5. Define which external capabilities are demonstration stubs versus required integrations.
