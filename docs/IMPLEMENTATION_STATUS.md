# Implementation status — Senevirathna Medical Pharmacy

Last audited: **2026-10-02 (Asia/Colombo)**. Scope: **Stage 2 complete at code level**.

## Official current status (supersedes historical gate notes below)

- **Stage 0A — Repository Audit: PASS.**
- **Stage 0B — MSSQL Code Migration: PASS.**
- **Stage 0C — Live Environment Verification: DEFERRED.** Each team member manages SQL Server locally. Live connection, schema inspection, CRUD persistence, transaction and rollback checks remain required team environment verification, but do not block implementation.
- **Stage 1 — Authentication, authorization and database foundation: PASS (code-level gate).**
- **Stage 2 — Public website and pharmacy items: PASS at code level.** Migration 002 and the local SQL Server verification remain for each team environment.
- **NEXT STAGE: Stage 3 — Customer portal, cart and persistent orders**, only after Stage 2 passes. Stage 3 has not started.

Stage 0 code-level foundation is complete. The live MSSQL verification task is deferred to each team member's local environment. Historical Stage 0B/0C notes below record the earlier connection-dependent gate interpretation and are not the current development policy.

### Stage 2 pre-implementation audit (2026-10-02)

| Requirement | Baseline | Evidence / missing work |
| --- | --- | --- |
| Public home | PARTIAL | `Dashboard.jsx` has a marketing hero, About/Services sections, but staff shortcuts, operational metrics and activity are mixed into the public page; hero buttons open staff routes |
| Public navbar | PARTIAL | `TopNav.jsx` and `navigation.js` expose the required labels, but About/Services are hash links rather than pages and Login/Register sit in the same group; no dedicated customer links beyond Dashboard |
| About and Services pages | MISSING | No `/about` or `/services` route or page |
| Pharmacy Items | MISSING | `/pharmacy-items` is a placeholder without API data, cards, search or filters |
| Product data and categories | PARTIAL | `medicines` has name, free-text subcategory, price, quantity, expiry and stock status; no four-way product type or public catalog API |
| Permanent Product ID | MISSING | `medicines.id` is only an integer database key; no immutable `product_code` |
| Product image and prescription flag | MISSING | No `image_url` or `requires_prescription` column; no card fallback |
| Search/filter/availability | PARTIAL | Staff medicine API supports search/category/stock but requires authentication and has no public projection; catalog behavior missing |
| Public/staff separation | PARTIAL | Stage 1 guards staff routes and API, yet homepage marketing links and metrics target internal operations |
| Responsive verification | MISSING | Existing CSS has breakpoints; Stage 2 public pages and catalog have not been checked at desktop/tablet/mobile widths |

Stage 2 extends the existing `medicines` product master and adds a read-only public catalog. Cart, orders, checkout, uploads, notifications and payment workflows remain outside this stage.

### Stage 2 implementation gate (2026-10-02)

**PASS at code level.** The public homepage is customer-facing, with the required hero and working links. `/about`, `/services`, and `/pharmacy-items` are routed and public. The desktop navbar has brand, four public links and account actions; mobile drawer provides the same routes. Authenticated staff links remain role-scoped, and Stage 1 route/API guards still deny signed-out and cross-role access.

The read-only `/api/catalog` uses the SQL Server product master, returns only active public fields, supports bound and escaped search, four main product types and pagination, and derives availability from stock and expiry. Cards show image with fallback, Product ID, type/subcategory, server price, availability and prescription badge. Inventory Staff can assign a permanent `product_code` on creation, choose a main type, image and flags, and cannot change the code on edit. Migration 002 enforces `NOT NULL`, uniqueness, format and update immutability; seven known seed rows get stable P001–P007 codes. Unknown local rows require explicit shared code assignment before the migration completes.

Verification: backend **37/37 PASS**, frontend **16/16 PASS**, production build **PASS**. Browser smoke used a test-only catalog fixture because no reachable team SQL Server was available here. Desktop 1440px, tablet 800px and mobile 375px layouts showed no horizontal overflow. Browser checks covered homepage/nav, About/Services, product cards, image fallback, price, stock and prescription labels, Product ID search, category filter, empty state, special-character query and signed-out staff-route redirect. No real SQL Server migration or live persistence was claimed. Each team member must run migration 002 and the live checklist in the SQL Server guide before operational deployment.

### Team environment verification (deferred, retained)

On each member's SQL Server instance, run the MSSQL scripts and migration in order; confirm Windows Authentication, schema metadata, create/read/update/restart persistence, purchase and sale stock changes, rollback, and concurrent/repeated request behavior. Record results before claiming live database acceptance.

### Stage 1 implementation gate (2026-10-02)

**PASS under the team's code-level development policy.** Stage 2 has not been started. The live MSSQL checks above remain deferred and are not claimed as passing.

| Requirement | Evidence / result |
| --- | --- |
| MSSQL auth schema and migration | `database/mssql/migrations/001_add_users_authentication.sql`: `users`, five-role CHECK, account status, unique username/email, nullable unique customer/supplier links, timestamps; rerunnable guards |
| Registration | `/api/auth/register` validates full name, email, phone, address, username, password and confirmation; bcrypt hash; customer + user inserted in one transaction; duplicate identity returns 409 |
| Login and session | `/api/auth/login` compares bcrypt, rejects inactive accounts, issues an 8-hour signed bearer token; `/api/auth/me` restores identity from DB on each request; logout removes the browser token |
| Backend authorization | Reusable `requireAuth` and `requireRole` guard all business routes; 401 without a token, 403 for another role; role/status are read from the database for each request |
| Frontend | Separate `AuthContext`, login/register pages, five role dashboards, `ProtectedRoute`, role redirects, public-only navbar/footer, and role-appropriate links |
| Prescription → sales regression | Prescription Staff prepares a saved prescription ID; Sales Staff loads its available items through `/api/sales/prescription/:id/billing` without opening prescription management |
| Demo staff | Interactive `backend/scripts/createStaffAccount.js` prompts privately for a password and stores only bcrypt hashes; no credentials committed |
| Tests | Backend 32/32, frontend 13/13, production build pass; browser smoke: public nav, unauthenticated redirect, registration fields |

Security assumptions and execution order are in `database/mssql/TEAM_DATABASE_UPDATE_GUIDE.md`. Known work outside Stage 1: rate limiting/lockout and stronger session revocation before public deployment; supplier row-level ownership and durable billing lifecycle in later stages; live SQL Server acceptance remains the deferred team task.

## Database architecture decision (FINAL, recorded 2026-10-02)

The project team formally selected Microsoft SQL Server as the final and permanent
runtime database for this project. The decision is final for the current project
architecture (reason: the team is experienced with SQL Server scripts,
administration and SSMS).

Final database stack: **Microsoft SQL Server** engine · **SSMS** administration ·
Node.js + Express backend · React + Vite frontend.

| Record | Value |
| --- | --- |
| Earlier Planned Database | **MySQL** — legacy implementation reference code only (`database/schema.sql`, `database/seed.sql` retained until migration is fully verified; not deleted) |
| Final Implemented Database | **Microsoft SQL Server** — `database/mssql/` scripts are the source of truth for all schema changes |

Standing rules now in force:

- `mysql2` must not remain the active runtime persistence layer (removed from `backend/package.json`).
- No dual MySQL/MSSQL runtime support and no new MySQL-specific functionality.
- All active repositories and database operations are migrated to SQL Server; all future database development uses SQL Server-compatible SQL.
- Parameterized SQL only; SQL Server transactions protect every stock-changing operation.
- The MSSQL database is the system's persistent source of truth.
- Obsolete MySQL runtime dependencies may be removed only after migration and verification; old MySQL files are kept until their logic is safely migrated and verified.
- **Stage 1 must not start until the MSSQL implementation passes all Stage 0 persistence and regression checks.**

## Stage 0B baseline (recorded before any migration change)

Recorded on 2026-10-02 before the MySQL → SQL Server migration work began.

| Check | Command | Result |
| --- | --- | --- |
| Working tree | `git status --short` | Clean (only untracked `.freebuff/`) |
| Branch | `git branch --show-current` | `dev` |
| HEAD | `git log --oneline -1` | `f2cb37f chore: audit current dev implementation` |
| Backend tests | `cd backend && npm test` | **13/13 PASS**, 0 fail |
| Frontend tests | `cd frontend && npm test` | **9/9 PASS**, 0 fail |
| Frontend production build | `cd frontend && npm run build` | **PASS** — 1960 modules, 3.48s, no errors |

Environment observed at baseline: Windows (Git Bash/MSYS), Node v24.14.1, npm 11.11.0.
No pre-existing failures were present; migration work proceeded from this baseline.

## Stage 0B — SQL Server migration (worked 2026-10-02)

### What changed

- **One runtime database.** `mysql2` removed from `backend/package.json`. The
  persistence layer is now `mssql` + `msnodesqlv8` (the only maintained Node
  driver that performs **Windows Authentication** with the current process
  token). Central module: [`backend/src/config/database.js`](../backend/src/config/database.js).
- **All six repositories translated** to SQL Server syntax: `CAST(GETDATE() AS DATE)`,
  `DATEADD`, `DATEDIFF(DAY, …)`, `SYSDATETIME()`, `OFFSET … FETCH`,
  `OUTPUT INSERTED.id`, derived-table aggregation (SQL Server rejects the old
  bare-column `GROUP BY p.id`), and `WITH (UPDLOCK, ROWLOCK)` inside a
  SERIALIZABLE transaction in place of MySQL `SELECT … FOR UPDATE`.
- **Parameter binding preserved:** repository `?` markers are converted to
  named `@pN` markers in the central module and bound with
  `request.input()` — no value is ever concatenated into SQL.
- **False-success offline writes removed** (`frontend/src/context/AppContext.jsx`):
  business collections start empty and are API-only; every mutation either
  persists on the server or returns `success:false` + an error toast; no local
  record, no `max(id)+1` id, no "(offline)" success. The connection flag no
  longer latches: every request is still attempted and the next success flips
  it back and re-syncs server data.
- **Truthful health/startup:** `/api/health` reports `database.status`,
  `server`, `name`, `login`, `base_tables` and `ready`; `server.js` probes the
  database at boot and prints an explicit failure line.
- Migration matrix and design record: [`docs/SQLSERVER_MIGRATION.md`](SQLSERVER_MIGRATION.md).
  Failure-path evidence: [`docs/audits/stage-0b/db-failure-probes.txt`](audits/stage-0b/db-failure-probes.txt).

### Stage 0 gate record after Stage 0B

- [x] Backend test suite passes — **23/23** (13 baseline + 10 new migration tests)
- [x] Frontend test suite passes — **9/9**
- [x] Frontend production build passes — 1956 modules, no errors
- [x] Backend uses SQL Server runtime persistence (single implementation)
- [x] MySQL is no longer the active runtime database (`mysql2` removed)
- [ ] **Node backend successfully connects to actual SQL Server** — BLOCKED (no server details)
- [ ] **Windows Authentication verified** — BLOCKED (needs the same connection)
- [ ] **Real database schema verified** — scripts reviewed (`database/mssql/`), live metadata not inspected
- [ ] CREATE persists · [ ] READ works · [ ] UPDATE persists · [ ] Restart preserves data — BLOCKED
- [ ] Purchase increases stock exactly once · [ ] Sale decreases stock exactly once — BLOCKED
- [ ] Failed transaction rolls back correctly — BLOCKED (unit-tested with stubs only)
- [x] Database outage does not create false-success frontend data — proven in browser (see evidence file)
- [x] API can recover after a temporary outage — request path re-issued after backend restart; full "connected + resync" proof needs a live database
- [x] No major existing functionality regression — routes, APIs, validation, 404s unchanged
- [x] `SQLSERVER_MIGRATION.md` written
- [x] `IMPLEMENTATION_STATUS.md` updated
- [x] `STAGE_0_AUDIT.md` updated
- [ ] Working tree clean or changes committed — done as part of this update

**Historical Stage 0B gate interpretation (superseded):** Code-level checks passed;
connection-dependent checks were pending. The team subsequently deferred live SQL
Server verification to each member's own environment and cleared the development gate.

## Historical Stage 0C environment probe

**Stage 0C — Live SQL Server verification: DEFERRED (probe attempted 2026-10-02).**

Phase A (baseline) and Phase C (local client) were completed; Phase B (connection
values) found **no real connection values anywhere locally** — searched
`backend/.env` (does not exist), `backend/.env.example` (placeholders only:
`CHANGE_ME_HOSTNAME_OR_IP`), `README.md` (example format `HOST\SQLEXPRESS`),
`docs/`, `database/`, and all config files. No SQL Server instance runs on this
machine (no `MSSQLSERVER`, `MSSQL$SQLEXPRESS`, or `SqlBrowser` service). No
values were invented; no `.env` was created.

Stage 0C baseline + environment probe evidence:

| Check | Result |
| --- | --- |
| Branch / starting commit | `dev` / `1cb835a` |
| Working tree | clean (only untracked `.freebuff/`) |
| Backend tests | **23/23 PASS** |
| Frontend tests | **9/9 PASS** |
| Frontend production build | **PASS** (2.89s) |
| Node / npm / arch | v24.14.1 / 11.11.0 / x64 win32 |
| Windows identity running Node | `DESKTOP-9VVH8AE\ASUS` (workgroup machine; `whoami` via cmd) |
| ODBC drivers installed | legacy **`SQL Server`** only (matches `DB_DRIVER={SQL Server}` default); no Native Client, no ODBC 17/18 |
| `mssql` / `msnodesqlv8` | 12.7.2 / 5.5.0 installed |
| `mysql2` | absent (verified by require probe) |
| SQL Server on this machine | none (no service) |
| `sqlcmd` | not on PATH |

**This machine has no configured SQL Server target. Each team member will exercise
the persistence layer on their own configured local environment.**

## Historical Stage 0C follow-up (now team environment verification)

Each team member supplies their own SQL Server connection details and runs the
connection, CRUD, purchase/sale, rollback and outage checks. Stage 1 implementation
continues independently of these deferred live checks.

## Historical environment findings (not development blockers)

1. **This checkout has no SQL Server connection details.** The runtime is SQL Server (`mssql` + `msnodesqlv8`, Windows Authentication) and the MySQL runtime dependency is gone. Each member configures their own `backend/.env` and permissions. See [the team database guide](../database/mssql/TEAM_DATABASE_UPDATE_GUIDE.md).
2. **No live persistence baseline.** No backend `.env` or database environment variables were found. Every database-backed request now fails explicitly with **HTTP 503 `Database unavailable: …`** (previously an ambiguous 500). This still establishes nothing about the user's remote database — only that this checkout is not connected to it.
3. ~~False success during outages.~~ **RESOLVED in Stage 0B.** The frontend no longer seeds mock business records, no longer writes business data to localStorage, and never reports a local mutation as saved. Proven in the browser: error toast + unchanged localStorage + empty list (`docs/audits/stage-0b/db-failure-probes.txt`).
4. **Remaining baseline defects** (scope unchanged, recorded as known future issues below): validator type weaknesses, today-summary double-count, no catch-all route, no sale/purchase idempotency, transient prescription→POS handoff, dead/duplicate front-end modules. Health now reports database readiness; invalid-type handling and route coverage are still open.

## LAST VERIFIED COMMIT

Stage 0B migration commit on branch `dev` (see `git log`). It passes **23/23 backend tests, 9/9 frontend tests and the production build**, and it produced the failure-path evidence recorded in `docs/audits/stage-0b/db-failure-probes.txt`. It does **not** pass the full Stage 0 database gate: no live SQL Server connection has been established, so CRUD / transaction / rollback evidence is outstanding. No fully verified end-to-end commit exists yet.

## Status definitions

- **NOT STARTED:** no implementation located for the requirement.
- **PARTIAL:** some code/UI exists, but required behavior or integration is missing.
- **IMPLEMENTED:** implementation exists; required verification is still pending.
- **TESTED:** the narrowly stated requirement was exercised successfully, with evidence.
- **BLOCKED:** required verification or implementation depends on an unresolved prerequisite.

An individual TESTED row is not a stage PASS. The supplied SQL Server scripts and the original MySQL schema share the nine core entities listed below; the live SQL Server database has not been inspected. Stages 1–8 below are an inventory of pre-existing code and missing work, not authorization to skip Stage 0.

## Stage 0 — baseline

> **Snapshot taken before Stage 0B.** The rows below describe the MySQL-era
> baseline and are kept as the historical starting point. Current values after
> the SQL Server migration are in the **Stage 0B** section above; where a row
> says BLOCKED for a database reason, re-read it there.

| Requirement | Current State | Evidence | Missing Work | Testing Status | Status |
| --- | --- | --- | --- | --- | --- |
| Inspect current dev checkout | 107 tracked baseline files; clean before audit; frontend/backend/database mapped; supplied SQL Server scripts reviewed | Git inventory in `audits/stage-0/repository-inventory.txt`; audit architecture and query tables; schema review | Reconcile running database metadata | Source inspection, supplied schema comparison and Git checks performed | TESTED |
| Check installed dependencies | Both `npm ls --depth=0` checks pass | Audit records exact installed versions | Resolve audited vulnerabilities with compatible upgrades and regression tests | Frontend: 4 affected packages; backend: 2; raw reports saved | PARTIAL |
| Frontend starts and builds | Vite starts on port 3000; production build succeeds | 1,960 modules transformed; audit build result | Reverify after stabilization changes | Sandbox esbuild permission issue resolved by approved execution outside sandbox | TESTED |
| Backend starts | Express listens on port 5000 | `/api/health` responds 200 | Add truthful database readiness/startup diagnostics | Process startup verified; health is liveness only | PARTIAL |
| Database connects | Code targets MySQL; actual project uses SQL Server; supplied schema now reviewed | `backend/src/config/database.js`, user clarification, `database/mssql/`, direct connection failure | Server/auth configuration; driver and query compatibility; successful connection | No live schema inspected | BLOCKED |
| Existing routes load | All 18 declared routes visited; most render mock-backed UI; prescription/receipt details fail to load real records | Browser route inventory in audit | Real-data route verification; clear outage states; unknown-route page | Browser smoke only; not functional acceptance | PARTIAL |
| Existing APIs respond correctly | Health/404/basic validation work; database GETs fail | `audits/stage-0/api-probes.json`: 34 probes | Successful real-database responses and boundary/error checks | 1×200, 11×400, 1×404, 21×500 | BLOCKED |
| Existing CRUD persists | SQL writes exist; frontend also has independent local writes | Repositories and `AppContext.jsx`; browser offline customer reproduction | Create/update/read through database; refresh and restart checks | LocalStorage survives refresh; database persistence unverified | BLOCKED |
| Existing unit regression suites | Backend 13/13, frontend 9/9; backend syntax 32/32 | Audit test inventory | Real-database integration and enabled component tests | Backend repository tests stub the database | TESTED |
| No fake workflows/application records | Automatic mock/localStorage fallback is active | `frontend/src/data/`, `AppContext.jsx` | Stop normal operation from reporting local mutations as completed database work | Reproduced offline success and mock dashboard numbers | PARTIAL |
| Tracker and audit report | Current findings and future requirements recorded with evidence | This file; `STAGE_0_AUDIT.md`; saved probe/audit evidence | Update after every verified change/stage | Checked against observed baseline | TESTED |

## Stage 1 — foundation and security (historical pre-implementation inventory)

| Requirement | Current State | Evidence | Missing Work | Testing Status | Status |
| --- | --- | --- | --- | --- | --- |
| Authoritative relational schema | Supplied SQL Server DDL has nine tables, FKs, checks and six timestamp triggers; runtime still MySQL | `database/mssql/`; SQL Server schema review | Compare live metadata; connect existing CRUD without changing identities | Supplied DDL reviewed; live database unavailable | PARTIAL |
| Users, roles and customer identities | Customer demographics only; no accounts/roles in checked-in schema | Schema and route inventory | Backend account model; CUSTOMER, PRESCRIPTION_STAFF, SUPPLIER, INVENTORY_STAFF, SALES_STAFF | No login endpoints/pages to test | NOT STARTED |
| Password hashing and backend login/session | No password hashing, credential verification or token/session code | Backend dependencies and routes | Hashing, login/logout, session/token lifecycle and authenticated identity | Not implemented | NOT STARTED |
| Role-separated API and frontend access | All current routes unguarded | `backend/src/routes/`; `frontend/src/App.jsx` | Backend authorization and reusable ProtectedRoute; cross-role denial tests | Public staff routes observed | NOT STARTED |
| Permanent Product ID | `medicines.id` referenced by all three item tables; locally fabricated IDs can collide; receipts omit medicine ID | Schema, `AppContext.jsx`, `salesController.getReceipt` | Reconcile real product master; one immutable identity across all modules and visible outputs | Referential structure inspected; no live identity verification | PARTIAL |
| Required shared entities | Medicines, customers, suppliers, purchases/items, prescriptions/items, sales/items exist as proposed schema | Schema | Accounts/roles, category management, carts, orders/items, supply requests, notifications, payment/invoice relationships as needed without duplicate entities | Static schema inspection only | PARTIAL |
| API validation and error handling | Async wrapper, structured errors, input validators and parameterized SQL exist | Controllers/validators/repositories | Strict types/integers/finite amounts/date/length/ID/pagination checks; safe diagnostics | Empty requests reject; numeric name returns 500; invalid numeric strings accepted | PARTIAL |

## Stage 2 — public website and customer portal (not entered)

| Requirement | Current State | Evidence | Missing Work | Testing Status | Status |
| --- | --- | --- | --- | --- | --- |
| Customer-facing home and public navigation | Hero/about/services exist; public navigation exposes staff operations | `Dashboard.jsx`, `TopNav.jsx`, `MobileDrawer.jsx` | Home/About/Services/Pharmacy Items/Login/Register; staff navigation separation | Homepage and links rendered | PARTIAL |
| Medicine/baby/lab/accessory catalog | Staff inventory table exists; no customer product catalog or images per product | Medicine pages; schema | Customer catalog, four category groups, images, permanent IDs, prices and availability | Staff search works on mock records only | PARTIAL |
| Customer registration and login | Add Customer is a demographics form, not account registration | `AddCustomerPage.jsx`, customer controller | Full name/email/phone/address/username/password/confirmation and backend authentication | Required-name validation observed | NOT STARTED |
| Customer dashboard, profile and logout | No authenticated customer area | Route inventory | Customer home/profile/logout and isolated account data | Not implemented | NOT STARTED |
| Customer search/filter/quantity/add to cart | POS has staff search and a temporary cart only | `POSPage.jsx` | Real-data customer shopping workflow and prescription flags | POS source inspected; not customer functionality | NOT STARTED |
| Cart and order persistence | No cart/order tables or APIs; POS cart is React state | Schema, `POSPage.jsx` | Cart update/remove/subtotal, order creation and refresh persistence | No customer order exists to test | NOT STARTED |
| My Orders, prescription status, notifications, payment history | No routes, APIs or persisted entities | Route/schema inventory | Account-linked views and lifecycle data | Not implemented | NOT STARTED |

## Stage 3 — inventory (not entered)

| Requirement | Current State | Evidence | Missing Work | Testing Status | Status |
| --- | --- | --- | --- | --- | --- |
| Inventory staff dashboard and metrics | Public inventory/low-stock/expiry screens; no role isolation | Medicine pages and SQL CASE expressions | Staff access; accurate availability/expiry metric labels; Product ID display | UI renders mocks; live values blocked | PARTIAL |
| Product create/update/view/search and stock | Forms, list and create/update SQL exist; no delete endpoint or dedicated product detail page | Medicine controller/repository/pages | Persistent verification, null-safe search, safe stock edits and validation | Unit checks pass; actual CRUD blocked | PARTIAL |
| Categories | Free-text category per medicine; no category entity/API | Schema, medicine forms | Persisted category management consistent with catalog | Not verified against database | PARTIAL |
| Low-stock/out-of-stock/expiry | SQL and frontend calculations exist | `medicineRepository.js`, normalization utilities, stock/expiry pages | Live threshold/date boundaries; accurate labeling; batch/product identity reconciliation | Pure utility tests pass | PARTIAL |
| Inventory and low-stock reports | Low-stock/expiry tables exist; no report export workflow | `LowStockPage.jsx`, `ExpiryPage.jsx` | Product IDs and real-data report generation | Mock-backed views only | PARTIAL |
| Customer browsing regression | Customer browsing not implemented | Stage 2 inventory | Implement only in stage sequence, then regression test | Blocked by earlier stages | BLOCKED |

## Stage 4 — suppliers (not entered)

| Requirement | Current State | Evidence | Missing Work | Testing Status | Status |
| --- | --- | --- | --- | --- | --- |
| Supplier CRUD and isolated dashboard | Public supplier list/add/edit with SQL CRUD; no supplier account dashboard | Supplier pages/controller/repository | Supplier identity/auth, availability and scoped access | UI renders; database CRUD blocked | PARTIAL |
| Low stock to supply requirement/request | Low stock links directly to Receive Stock; no request entity | Low stock page, schema | Requested quantities/statuses and supplier assignment | No integrated request workflow | NOT STARTED |
| Receive supply increases stock | Purchase repository wraps header/items/quantity increment in transaction | `purchaseRepository.createWithItems` | SQL Server compatibility, replay protection, live rollback/concurrency tests | Stubbed unit test only | PARTIAL |
| Supply history/timestamps/status | Purchase headers/items and read APIs exist; no history screen or receipt status lifecycle | Purchase schema/API; only `/purchases` create page | Supplier history/statuses and immutable receipt semantics | Live persistence unverified | PARTIAL |
| X + Y exactly once, refresh persistence | One increment loop per transaction; repeated requests still create additional purchases | Repository; Receive Stock lacks in-flight guard | Real DB values, duplicate receipt/retry and restart tests | Cannot prove with existing mocks | BLOCKED |

## Stage 5 — prescriptions and customers (not entered)

| Requirement | Current State | Evidence | Missing Work | Testing Status | Status |
| --- | --- | --- | --- | --- | --- |
| Customer demographics CRUD | Public create/update/list/detail exists | Customer modules | Persisted verification, authentication, profile identity mapping | Browser local-only create/refresh reproduced | PARTIAL |
| Prescription-required products | No requirement flag or order check | Medicines/schema/POS | Product flag, customer message and enforced order handling | Not implemented | NOT STARTED |
| JPG/JPEG/PNG/PDF upload and secure view/download | No file input, upload endpoint, storage metadata or file authorization | Prescription pages/API/schema | Secure upload, customer/order linkage, authorized retrieval | No upload workflow to test | NOT STARTED |
| Lifecycle and staff dashboard | Manual prescription/item creation and details; frontend defaults status to `active` | Prescription modules, normalization utility | Pending/Under Review/Approved/Rejected/Ready for Billing/Completed and dashboard counts | No persisted status field in checked-in schema | PARTIAL |
| Medicine selection and availability | Customer selection, quantity entry, database availability query exist | Create/details pages; prescription repository | Aggregate duplicate lines, current stock checks and actual staff review | Read-only query unit test; DB behavior unverified | PARTIAL |
| Approval/rejection and durable billing handover | `send-to-billing` returns a JSON projection; UI passes route state into POS | Prescription controller; POS effect clears navigation state | Persisted approved order/prescription relationship, queue and transition rules | No approval or durable handover exists | PARTIAL |
| Status notifications | Toasts/local activity only | `AppContext.jsx` | Persisted customer-specific notifications and read/status lifecycle | Not implemented | NOT STARTED |
| Upload → review → billing gate and file denial tests | Required upstream functionality absent | Above rows | Full customer/staff integration and unauthorized access tests | Not executable | BLOCKED |

## Stage 6 — sales and billing (not entered)

| Requirement | Current State | Evidence | Missing Work | Testing Status | Status |
| --- | --- | --- | --- | --- | --- |
| Sales access/dashboard and approved queue | Public POS; today-summary API; no dashboard or approved order queue | Sales routes/pages | Role isolation, pending/completed/monthly metrics and queue | Today-summary fails without DB | PARTIAL |
| Bill customer/order/product/quantity/price/totals | POS carries prescription customer, medicine IDs, quantities, discount and totals | `POSPage.jsx`, sales controller/repository | Order/prescription IDs, visible Product IDs, reliable fixed-precision totals | Utility and stubbed price tests pass | PARTIAL |
| Cash/Card/Online completion | Payment-method selection stored as text on sale | POS, sales schema | Payment state/transaction identity, reconciliation and failure semantics | Selecting a method is not verified payment processing | PARTIAL |
| Record sale + decrease stock atomically | Transaction and row locking implemented in MySQL repository | `saleRepository.createWithItems` | SQL Server transaction/locking equivalent, idempotency, concurrent oversell/retry tests | Stubbed success/expired/commit-path tests pass | PARTIAL |
| Persisted invoice/receipt | Receipt projected from saved sale; print button calls `window.print()` | Sales receipt endpoint/page | Product/order/transaction IDs, stable invoice details and ownership | Direct detail route shows not found during DB outage | PARTIAL |
| Order/prescription status and customer notification on payment | No order/prescription relationship in sale schema | Schema, sales repository | Atomic downstream statuses and notifications | Not implemented | NOT STARTED |
| History/date filters/monthly/top products | Sales list/date filters in API; no history/report pages | Sales repository/routes | Staff history/report UI, accurate aggregations and pending/paid totals | Summary SQL repeats sale revenue per joined item (static finding) | PARTIAL |
| X − Y exactly once with all records and refresh | Single transaction loop is insufficient for duplicate request protection | Repository and POS submit handler | Real DB verification, retries, rollback, invoice/status/notification consistency | Live proof blocked | BLOCKED |

## Stages 7–8 — final integration and hardening (not entered)

| Requirement | Current State | Evidence | Missing Work | Testing Status | Status |
| --- | --- | --- | --- | --- | --- |
| Complete customer workflow | Missing accounts, cart/orders, upload, review lifecycle, payment lifecycle | Stage 1–6 rows | All preceding gates before final scenario | No end-to-end PASS | BLOCKED |
| Inventory → supplier → stock workflow | Stock/purchase code exists without requests/auth/live DB | Stage 3–4 rows | Full multi-role scenario and database assertions | No end-to-end PASS | BLOCKED |
| Prescription staff → sales staff workflow | Only transient handover exists | Stage 5–6 rows | Durable shared order with role-separated lifecycle | No end-to-end PASS | BLOCKED |
| Console, loading/error/empty/responsive behavior | Some states/CSS exist; known warnings, blank unknown route, stale/mock fallback | Audit browser results and styles | Stabilize existing errors now; full responsive/accessibility verification after functionality | Basic rendering only; responsive matrix not certified | PARTIAL |
| Dead/duplicate code and test execution | Duplicate service modules and dormant Vitest tests; unused Header/Sidebar/mockDashboard | Source imports and package scripts | Controlled cleanup and meaningful component/integration tests | Only `frontend/test/*.test.js` executes | PARTIAL |
| Secure files, roles, constraints and product identity | Some proposed SQL constraints; no authorization/files | Schema/security findings | Actual SQL Server constraints, protected files and role tests | Not verified | BLOCKED |
| Stock, monetary, lifecycle, notifications and reports integrity | Partial stock transaction code; lifecycle/report gaps | Audit findings | Real DB rollback/concurrency/replay/calculation/lifecycle verification | Unit tests alone insufficient | BLOCKED |

## Gate record

- **Stage 0A audit and Stage 0B code migration:** PASS under the team's current policy.
- **Stage 0C live environment verification:** DEFERRED to each member; it remains a required local acceptance task.
- **Stage 1:** active. Stages 2–8 have not been entered.
- SQL Server DDL/relationships/triggers have been supplied and reviewed. Remote
  SQLEXPRESS and Windows Authentication are confirmed. Next evidence required:
  the other computer's hostname/IP and the full SSMS Server name, a usable
  development connection, matching live metadata, then the persisted CRUD and
  purchase/prescription/sale regression checks.

## Known future issues (recorded in Stage 0B, deliberately NOT implemented now)

| # | Issue | Evidence | Assigned stage |
| --- | --- | --- | --- |
| 1 | Authentication absent — no accounts, login, sessions or password hashing | backend dependencies and routes | Stage 1 |
| 2 | Route authorization absent — all 31 endpoints and all 18 routes are public; no `ProtectedRoute` | `backend/src/routes/`, `frontend/src/App.jsx` | Stage 1 |
| 3 | Prescription → POS handoff is transient (route state only; no durable approval/order link; sale cannot reference the original prescription) | `prescriptionController.sendToBilling`, `POSPage.jsx` | Stage 5 / 6 |
| 4 | Sale and purchase idempotency absent — a repeated submit creates a second transaction and a second stock change | `saleRepository`, `purchaseRepository`, POS/purchase submit buttons | Stage 4 / 6 |
| 5 | `today-summary` revenue joins `sale_items`, multiplying a sale's revenue by its line count | `saleRepository.getTodaySummary` (comment in source) | Stage 6 |
| 6 | No catch-all frontend route — an unknown URL renders a blank page | `frontend/src/App.jsx` route table | Stage 7 |
| 7 | Validator weaknesses: `parseInt('2abc') → 2`, `parseInt('1.9') → 1`, `Infinity` accepted as a price; no length/range ceilings | `backend/src/validators/*` | Stage 1 (API validation hardening) |
| 8 | Dead duplicate service files (`medicineService.js`, `salesService.js`, `customerService.js`, `supplierService.js`, `purchaseService.js`, `prescriptionService.js`) are imported nowhere | import graph; only `apiService.js` is used | Stage 7 |
| 9 | Unused components/tests: `Header.jsx`, `Sidebar.jsx`, `mockDashboard.js`, and `frontend/src/test/*` (Vitest) which no runner executes | import graph; `frontend/package.json` scripts | Stage 7 |
| 10 | Free-text medicine categories, no permanent product code distinct from batch; one batch/expiry per product | `medicines` schema | Stage 3 |
| 11 | Frontend npm audit findings (4 packages) and backend audit findings (2 packages) still open | `audits/stage-0/*-npm-audit.json` | Stage 7 |
