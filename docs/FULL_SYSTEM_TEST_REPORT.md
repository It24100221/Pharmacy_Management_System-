# Full System QA Report

Audit date: 2026-10-03  
System: Senevirathna Medical Pharmacy Management System  
Overall status: **FAIL**

## Executive result

The implemented SQL Server transaction paths are generally strong: purchase and sale mutations are atomic, stock changes exactly once, rollback works, concurrent limited-stock sales do not oversell, product identity remains stable across modules, and prescription file ownership is enforced. Automated tests and the production frontend build pass.

The system is not releasable as a complete final workflow. A tracked documentation credential currently authenticates every original staff role, including ADMIN (**CRITICAL**). The prescription-to-billing handoff is transient, stock-changing forms lack duplicate-intent protection, registration and medicine validation have reproducible failures, and the today-sales report overcounts revenue. Cart, order, approval, notification, supplier supply-flow, and several reporting requirements are not implemented.

No product defect was fixed during this testing phase.

## Source and environment

| Item | Result |
|---|---|
| Branch | `dev` |
| Audited source commit | `95790ddde96501edb9ed6484ab0437b9a6e82bbb` |
| Initial worktree | Clean |
| Node | `v24.21.0` |
| npm | `11.19.0` |
| Frontend | React 18 + Vite 5 |
| Backend | Node.js + Express 4 |
| Database | Microsoft SQL Server, database `pharmacy_management` |
| SQL Server | `DESKTOP-79MG1Q7\SQLEXPRESS`, SQL Server Express 17.0.1135.8 |

`backend/.env` is ignored. No tracked `.env`, JWT secret, or SQL Server password was observed. The repository-secret requirement nevertheless **FAILS** because a documented plaintext credential is live; see `QA-SEC-001`.

## Automated verification

| Check | Result | Evidence |
|---|---|---|
| Backend dependency tree | PASS | `npm ls --depth=0` |
| Frontend dependency tree | PASS | `npm ls --depth=0` |
| Backend clean-install resolution | PASS | `npm ci --dry-run --ignore-scripts --no-audit --no-fund` |
| Frontend clean-install resolution | PASS | same command |
| Backend tests | PASS | 29 passed, 0 failed, 0 skipped |
| Frontend tests | PASS | 15 passed, 0 failed, 0 skipped |
| Frontend production build | PASS | 1,981 modules; JS bundle 409.51 kB |
| Backend startup | PASS | server started and `/api/health` returned 200 |
| Frontend startup | PASS | Vite served the application with HTTP 200 |

## Live SQL Server verification

The backend pool—not a mock—executed `SELECT 1`, `@@SERVERNAME`, and `DB_NAME()`. Server and database matched the required values.

Live structure:

- 15 tables: `categories`, `customers`, `medicines`, `prescription_items`, `prescription_uploads`, `prescriptions`, `products`, `purchase_items`, `purchases`, `sale_items`, `sales`, `schema_migrations`, `staff`, `suppliers`, `users`;
- 122 columns, 14 foreign keys, 39 indexes, 29 CHECK constraints, and 8 triggers;
- migrations `001`, `002`, and `003` recorded exactly;
- migration runner safely skipped all three already-applied migrations;
- no cart, order, payment, or notification tables.

The structure matches the current three migrations for the implemented scope. No pending migration or unexpected application table was found. Full object details remain in `docs/DATABASE_STATE.md`.

## Temporary-data and persistence audit

A unique QA namespace was used for customer, role users, medicines/products, supplier, purchase, structured prescription, sales, and upload records. Direct SQL counts before and after were identical:

| Table | Before | After |
|---|---:|---:|
| users | 5 | 5 |
| staff | 5 | 5 |
| customers | 4 | 4 |
| medicines | 10 | 10 |
| products | 10 | 10 |
| suppliers | 5 | 5 |
| purchases | 6 | 6 |
| purchase_items | 6 | 6 |
| prescriptions | 9 | 9 |
| prescription_items | 9 | 9 |
| sales | 5 | 5 |
| sale_items | 5 | 5 |
| prescription_uploads | 0 | 0 |

Create/read/update and supported delete operations passed for customer, medicine/product, and supplier. Records survived backend restart and remained API-readable. Medicine delete is **NOT IMPLEMENTED**. Browser-refresh persistence is **BLOCKED** in the non-interactive authenticated harness, but persistence was independently proven in SQL and after backend restart.

## Authentication and authorization

Temporary users for CUSTOMER, ADMIN, PHARMACIST, SUPPLIER, INVENTORY, and SALES were tested. For every role:

- valid login and valid JWT: **PASS**;
- invalid password, wrong identity, and missing password: **PASS** with 401/400 as appropriate;
- missing JWT, malformed JWT, bad signature, expired JWT, and token for an unknown user: **PASS**, all 401;
- representative read access across medicine, supplier, purchase, sale, prescription, and customer routes: **PASS**, with allowed roles returning success and authenticated disallowed roles returning 403.

Customer ownership passed for own-profile read/update and rejected arbitrary list/read/edit/delete with 403. Prescription-file owner and role checks also passed. Frontend route guards align with backend permissions for the routes that exist.

## Public site and frontend

Home, About and Services anchors, Pharmacy Items, login choices, customer/staff login, and registration routes render. The public navigation does not expose internal staff functions. Headless Edge verified the live public site at desktop, tablet, and mobile widths:

- home at 1440×1000: **PASS**;
- home at 768×1024: **PASS**;
- catalogue data load at 390×844: **PASS**;
- catalogue mobile layout at 390×844: **FAIL**, horizontal overflow (`QA-UI-008`);
- invalid frontend route handling: **NOT IMPLEMENTED**.

The production build completed and no public-page console output was observed from headless Edge. Authenticated interactive-browser session/Back/retry tests are **BLOCKED** and are not inferred from component existence.

## Customer

- Registration happy path, bcrypt storage, user/customer relationship, subsequent login, and cleanup: **PASS**.
- Invalid email, duplicate email, duplicate username response, required phone, and required address: **FAIL** (`QA-REG-004`).
- Password mismatch is blocked in the frontend; missing/weak inputs covered according to current rules.
- Own profile read/update and SQL persistence: **PASS**.
- Public catalogue list/search/category/product code/price/availability: **PASS**.
- Persistent cart: **NOT IMPLEMENTED**.
- Order, checkout, status, ownership, history, and payment lifecycle: **NOT IMPLEMENTED**.
- JPEG/PNG prescription upload and upload history: **PASS**.
- Notifications: **NOT IMPLEMENTED**.

## Product, inventory, and supplier

Three live products matched exactly between SQL, API, and UI model. Required categories exist. Permanent product codes were unique and stable across restart and through inventory, purchase, prescription, sale, and receipt records.

Medicine create/read/update/search, stock, low-stock, expiry, expiring-soon, out-of-stock, SQL writes, and product trigger mapping passed. Strict malformed/type validation failed as documented in `QA-VAL-005`. Medicine delete is absent.

Supplier login, list/search/create/update, SQL persistence, unreferenced delete, and referenced-delete 409 passed. SUPPLIER is correctly read-only for supplier and purchase data. Supply requests, supplier receive actions, and supply history are **NOT IMPLEMENTED**.

## Purchase and inventory transaction

A controlled purchase increased stock by exactly 20 once and persisted one header and one item. Invalid product, zero/negative quantity, invalid supplier, and a multi-line request containing an invalid line were rejected with unchanged counts and stock. Transaction rollback passed.

The stock-changing endpoint is atomic, but duplicate user intent is not protected (`QA-TXN-003`).

## Prescription

Structured creation, item quantities, and real-inventory availability states—`available`, `insufficient`, `out_of_stock`, and `expired`—passed.

File storage passed for JPEG/PNG round trips. PDF returned 415 and oversized input 413. Missing, empty, unsupported/fake/mismatched, malformed multipart, traversal, file-write failure, and database-failure cleanup were covered by live or automated tests. SQL stores metadata rather than base64; generated relative filenames are used; normal responses do not leak absolute paths.

Access results: owner CUSTOMER 200, another CUSTOMER 403, PHARMACIST 200, ADMIN 200, INVENTORY 403, SALES 403, SUPPLIER 403, unauthenticated 401, missing file 404.

Approval/rejection/completion state changes and the pharmacist upload-review queue are **NOT IMPLEMENTED**. Billing preparation exists, but durable handoff **FAILS** (`QA-RX-002`).

## POS, sales, receipt, and reports

Direct POS passed medicine selection, quantity, discount, payment method, totals, and authoritative server pricing. A manipulated client price was ignored. A controlled sale reduced stock by exactly 10 once and persisted the sale header/items.

Invalid medicine, zero/negative quantity, duplicate medicine line, insufficient/out-of-stock, and expired medicine failures left stock and sale counts unchanged. A parallel two-sale test against stock 1 produced one HTTP 201, one HTTP 409, and final stock 0: oversale prevention **PASS**.

Receipt retrieval by direct persisted route passed transaction/customer/product/quantity/unit-price/discount/total/payment/date fields. Browser print-dialog rendering is **BLOCKED**.

Sales list/custom-date querying exists. There is no dedicated history UI with today/week/month views. Today-summary revenue **FAILS** because of join multiplication (`QA-RPT-006`); monthly, paid/pending, and top-product reports are **NOT IMPLEMENTED**.

## Critical cross-module demonstration

A controlled permanent product began at stock 100, purchase receipt added 20, and sale removed 10. SQL Server finished at **110**. Catalogue, inventory, and prescription availability all reported 110; the purchase and sale rows existed; the same product code flowed through the receipt. Result: **PASS**.

## Failure behavior and recovery

- Controlled database pool shutdown: read and write returned HTTP 500, no fake ID/success/write occurred, and data remained unchanged: **PASS**. Public error-detail handling: **FAIL** (`QA-ERR-007`).
- Backend stop: health became unreachable rather than returning fake success; restart restored health and products HTTP 200: **PASS**.
- CORS: allowed origin received its origin; an attacker origin did not receive attacker-origin authorization: **PASS**.
- Same-browser UI retry after outage: **BLOCKED**.

## Final journey status

Customer journey:

- Home → Register → Login → Browse products: **PASS**.
- Upload prescription and view own upload history: **PASS** as a separate implemented path.
- Add to Cart: **NOT IMPLEMENTED** and is the first missing step in the required linear final journey.
- Order, prescription-required decision, notifications, review state transition, durable billing, customer payment/invoice/completion: **NOT IMPLEMENTED**.

Staff journeys:

- INVENTORY: login/dashboard/stock/low-stock/expiry/purchase receipt **PASS**; supply requirement **NOT IMPLEMENTED**.
- SUPPLIER: login and authorized directory/purchase reads **PASS**; supply request/receive/history **NOT IMPLEMENTED**.
- PHARMACIST: login/customer/structured prescription/availability **PASS**; upload queue, approval/rejection **NOT IMPLEMENTED**; durable billing handoff **FAIL**.
- SALES: login/direct POS/payment field/receipt/transaction persistence **PASS**; approved-order queue **NOT IMPLEMENTED**; history/report scope incomplete and today revenue **FAIL**.

## Defects and missing scope

Defects: 1 CRITICAL, 2 HIGH, 4 MEDIUM, 3 LOW. See `docs/KNOWN_DEFECTS.md`.

Required final features not implemented:

1. persistent cart;
2. order/order-items, ownership, statuses, history, and prescription-required enforcement;
3. customer checkout and payment lifecycle;
4. persistent notifications;
5. structured-prescription approval/rejection/completion and pharmacist upload queue;
6. durable prescription-to-billing/sales handoff;
7. supplier supply-request/receive/history and inventory supply-requirements;
8. medicine delete;
9. full sales-history UI and monthly/paid-pending/top-product reports;
10. product image management;
11. frontend 404 route.

## Cleanup and conclusion

All audit-created users, customers, products, suppliers, purchases, prescriptions, sales, upload rows/files, scripts, profiles, and screenshots were removed. Original table counts were restored exactly.

**Final conclusion: FAIL.** The core database transaction foundation is credible, but the working credential disclosure alone prevents release. After credentials are removed and rotated, the next development priority is a persistent Order + Prescription Review + Billing Handoff model; it is the dependency for the missing customer, pharmacist, and sales journey. That next step was not implemented during this audit.
