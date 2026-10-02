# Stage 0 audit — 2026-10-02

**Outcome: BLOCKED.** The application processes can start and unit tests/build pass, but there is no verified database connection or persisted workflow. The user confirmed that the intended database is **Microsoft SQL Server (SSMS)**; this repository is wired exclusively for **MySQL**. Stage 1 has not started.

**Schema evidence received during the audit:** the user supplied SQL Server schema/seed scripts, preserved under `database/mssql/`. They confirm the name `pharmacy_management`, nine matching core tables and six timestamp-only update triggers. The user identified **SQLEXPRESS / Windows Authentication**, then confirmed **the database is on another computer**. The earlier local `.\SQLEXPRESS` read-only check failed with **error 26 (instance not found/accessible)**, consistent with that clarification; it does not test the actual remote server. The remote hostname/IP and full SSMS Server name remain pending. See [SQL_SERVER_SCHEMA_REVIEW.md](SQL_SERVER_SCHEMA_REVIEW.md). Original baseline observations below describe the code before these reference scripts were added; the application runtime has not been converted or verified.

## Baseline and scope

- Branch: `dev`; source commit: `9bdfd34b7a021b39ef60372a9817164a0b49d7b7` (`Merge remote repository with local project`). Working tree was clean before audit.
- 107 tracked baseline files; [inventory](audits/stage-0/repository-inventory.txt) records their paths. No applicable `AGENTS.md` was found in the workspace or checked parent locations.
- Reviewed application entry points, routes, controllers, repositories, validators, shared state, service clients, page behaviors, schema/seed, test configuration, dependencies, navigation and styling structure. Generated dependencies/build assets were not treated as authored application code.
- This is an audit, not a certification of every UI behavior. Real SQL CRUD, database schema inspection, concurrency, rollback and restart persistence remain unverified. Nothing was imported into or changed in the user's database.

## Architecture and environment

| Area | Observed implementation |
| --- | --- |
| Frontend | React 18.3.1, React DOM 18.3.1, React Router DOM 6.30.6, Axios 1.20.0, Vite 5.4.21, plugin-react 4.7.0, JavaScript/JSX and plain CSS |
| Entry and state | `frontend/src/main.jsx` → BrowserRouter → AppProvider → App; reducer/localStorage in `AppContext.jsx`; API fan-out on mount |
| Layout | AppLayout → TopNav, MobileDrawer, Outlet, Footer, Toast, ScrollToTop; homepage combines marketing content with public staff metrics/actions |
| Backend | Node v24.14.1, npm 11.11.0, Express 4.22.2, cors 2.8.6, dotenv 16.6.1, mysql2 3.24.4; CommonJS |
| Request path | Express routes → controllers → validators/repositories → mysql2 promise pool; async error wrapper; JSON response envelopes |
| Database in code | Proposed MySQL/InnoDB schema and seed; no migrations or SQL Server implementation |
| Actual project database | Microsoft SQL Server on another computer; pharmacy_management and nine tables in supplied scripts; SQLEXPRESS / Windows Authentication confirmed; remote hostname/IP pending; live metadata unverified |
| Authentication | None: no users/roles model, login endpoint, password hash verification, token/session, ownership middleware or ProtectedRoute |
| Configuration present | `backend/.env.example`, `frontend/.env.example`, Vite config; both package-lock files tracked; dependencies already installed |
| Configuration absent | No backend/frontend `.env`; no DB/VITE/PORT/CORS/NODE_ENV variables found in the inspected process environment |
| Backend defaults | PORT=5000, DB_HOST=localhost, DB_PORT=3306, DB_USER=root, empty default password, DB_NAME=pharmacy_management; NODE_ENV controls generic 500 messages |
| Frontend defaults | VITE_API_BASE_URL=http://localhost:5000/api; Vite port 3000; `open: true` |
| CORS | CORS_ORIGIN defaults to http://localhost:3000; credentials enabled. This is not authentication or access control. The variable is not documented in the backend example |

No MySQL/MariaDB or SQL Server service, CLI (`mysql`, `mariadb`, `sqlcmd`, `SqlLocalDB`) or common installation location was discovered by the targeted local checks. This is not proof that a remote database does not exist. No broad search of unrelated personal files or credentials was performed.

## Database and query inventory

The original DDL is [`database/schema.sql`](../database/schema.sql); original example records are in [`database/seed.sql`](../database/seed.sql). These describe the MySQL-oriented code's expectations. The subsequently supplied SQL Server definitions are in [`database/mssql/`](../database/mssql/) and share these entity/column relationships; they still require live metadata verification.

| Proposed table | Main columns / relationships |
| --- | --- |
| medicines | integer `id` PK; name, description, generic_name, manufacturer, category, batch_number, quantity, unit_price, expiry_date, min_stock_level, timestamps |
| suppliers | integer `id` PK; company_name, contact_person, email, phone, address, timestamps |
| purchases | integer `id` PK; supplier_id FK → suppliers; purchase_date, total_amount, notes, timestamps |
| purchase_items | integer `id` PK; purchase_id FK → purchases; medicine_id FK → medicines; quantity, unit_cost, total_cost |
| customers | integer `id` PK; first_name, last_name, email, phone, address, date_of_birth, timestamps |
| prescriptions | integer `id` PK; customer_id FK → customers; prescription_date, instructions, notes, timestamps |
| prescription_items | integer `id` PK; prescription_id FK → prescriptions; medicine_id FK → medicines; quantity, instructions, created_at |
| sales | integer `id` PK; nullable customer_id FK → customers; sale_date, total_amount, discount, final_amount, payment_method, notes, timestamps |
| sale_items | integer `id` PK; sale_id FK → sales; medicine_id FK → medicines; quantity, unit_price, line_total |

All item tables share `medicines.id`, which is a useful existing foundation to preserve. However, medicines combine product identity with a single batch/expiry. No unique product code/natural identity prevents repeated records for the same product. Product IDs are absent from several user-facing tables and the receipt response. Local fallback allocates separate `max(id)+1` IDs, which can collide with server records.

| Query location | Operations already implemented |
| --- | --- |
| `backend/src/config/database.js` | `mysql2/promise.createPool`; optional `testConnection()` helper, not called by server startup |
| `backend/src/repositories/medicineRepository.js` | SELECT/filter/count/create/update; stock/expiry CASE expressions; low stock and expiry queries |
| `backend/src/repositories/supplierRepository.js` | SELECT/search/count/create/update suppliers |
| `backend/src/repositories/customerRepository.js` | SELECT/search/count/create/update customers |
| `backend/src/repositories/purchaseRepository.js` | Purchase header/item reads, date/search/count/recent; transaction inserts header/items and increments medicine quantity |
| `backend/src/repositories/prescriptionRepository.js` | Prescription/header/item/customer reads; transactional creation; stock availability; search/date/count/recent |
| `backend/src/repositories/saleRepository.js` | Sale/header/item/customer reads; search/date/count/recent/today summary; transaction locks stock rows, inserts sale/items and decrements quantity |

SQL Server compatibility requires more than changing a port: the current code uses MySQL `?` parameters and driver result shapes, `AUTO_INCREMENT`, `ENGINE=InnoDB`, `REGEXP`, `LIMIT/OFFSET`, `CURDATE()`, `DATE_ADD`, MySQL `DATEDIFF`, `NOW()`, `ON UPDATE CURRENT_TIMESTAMP`, and `SELECT ... FOR UPDATE`. Identity retrieval and transaction/locking behavior must be mapped to SQL Server. No T-SQL DDL existed in the original checkout; the supplied scripts now provide it. No stored procedures are present in either set.

The proposed MySQL schema has foreign keys and nonnegative stock/amount checks, but lacks accounts, role relationships, orders, carts, supply requests, prescription lifecycle/files, notifications and payment/invoice lifecycle. A separate table is not automatically required for each concept; inspect the actual schema before designing additions.

Schema/seed execution is not safely repeatable: tables use IF NOT EXISTS, but subsequent CREATE INDEX statements are unconditional; seed INSERTs create additional records on each run. Fixed expiry dates have aged: for example, the seed's described near-expiry Ibuprofen date is 2026-05-15, already past on this audit date. Neither script was executed.

## Frontend routes and browser observations

All 18 declared routes were visited in the audit browser. These observations were made during the database outage with mock/localStorage fallback; rendering is not proof of integration.

| Route | Browser result |
| --- | --- |
| `/` | Hero/about/services, inventory alerts and mock-backed counts visible; no login required |
| `/medicines` | Table renders 14 seeded records; Amoxicillin search returns the matching row |
| `/medicines/add` | Add Medicine form renders |
| `/medicines/edit/1` | Edit Medicine form renders seeded record |
| `/medicines/low-stock` | Low-stock and out-of-stock tables render |
| `/medicines/expiry` | Expiry tabs/tables render |
| `/sales` | POS renders; no authenticated sales role |
| `/sales/receipt/1` | Settles on Receipt not found during database failure |
| `/suppliers` | Supplier list renders |
| `/suppliers/add` | Add Supplier form renders |
| `/suppliers/edit/1` | Edit Supplier form renders seeded record |
| `/purchases` | Receive Medicine Stock form renders; not a history page |
| `/customers` | Customer table renders seeded/local data |
| `/customers/add` | Empty submit shows first/last-name errors; named submit falsely succeeds offline |
| `/customers/edit/1` | Edit Customer form renders seeded record |
| `/customers/1` | Customer details and prescription links render |
| `/prescriptions/create` | Manual prescription/medicine-selection form renders |
| `/prescriptions/1` | Loading then Prescription not found during database failure |

An unknown route `/stage-0-missing-route` renders a blank snapshot and logs “No routes matched location”; there is no catch-all route.

The browser test created **Stage0Audit LocalOnly** with no contact/medical details. It appeared with “Customer added (offline)” and survived refresh through localStorage. No customer POST was required on that fallback path and no database connection existed. This disposable browser-local record is not a database fixture and must not be treated as persisted acceptance evidence. The application has no delete UI for it.

## API inventory and live probes

All routes are currently public. In addition to `/api/health`, the six routers define 30 method/path combinations:

| Prefix | GET endpoints | Mutations |
| --- | --- | --- |
| `/api/medicines` | `/`, `/:id`, `/low-stock`, `/expiry-status` | POST `/`; PUT `/:id` |
| `/api/suppliers` | `/`, `/:id` | POST `/`; PUT `/:id` |
| `/api/customers` | `/`, `/:id` | POST `/`; PUT `/:id` |
| `/api/purchases` | `/`, `/recent`, `/:id` | POST `/` |
| `/api/prescriptions` | `/`, `/recent`, `/:id`, `/:id/availability` | POST `/`; POST `/:id/send-to-billing` |
| `/api/sales` | `/`, `/recent`, `/today-summary`, `/:id`, `/:id/receipt` | POST `/` |

Saved [34 live API probe results](audits/stage-0/api-probes.json):

- `/api/health`: 200/success even while database connections fail.
- All **20** database-backed GET endpoints: 500 with Internal server error.
- Unknown endpoint: 404 with structured JSON.
- Empty POST bodies to all six create endpoints: 400 with required-field messages.
- Malformed JSON: 400.
- Invalid IDs on the three update endpoints and prescription handover: 400.
- `{ "name": 123, "expiry_date": "2027-01-01" }` to medicine creation: 500, `data.name.trim is not a function`.

Total: **1×200, 11×400, 1×404, 21×500**. Invalid mutation requests were deliberately chosen to fail before repository writes. Successful create/update/handover/payment responses have not been verified against a real database.

## Existing business logic worth preserving

- Parameterized query values and an allowlist of update columns.
- Low-stock threshold uses `quantity <= minimum`; out-of-stock is separate.
- Sale repository locks medicine rows, uses the database price, rejects expired/insufficient stock and wraps header/items/stock changes in one transaction.
- Purchase repository wraps header/items/stock increase in one transaction.
- Prescription creation wraps header/items in one transaction; availability query does not change stock.
- Handover queries current stock and excludes unavailable/expired lines before returning billing items.
- Post-commit record reads happen after transaction release, avoiding an invalid second rollback/release.
- Frontend normalization handles API/local naming differences; sales/purchases avoid recreating local mutations merely because a later stock refresh fails.

These properties are supported by source and selected stubbed tests. They have not yet been established against SQL Server or concurrent live requests.

## Prioritized findings

| ID | Priority / verification | Finding and consequence | Evidence / next work |
| --- | --- | --- | --- |
| B01 | Blocker / user + source | Actual database is SQL Server; backend runtime is MySQL. Supplied SQL Server DDL now reviewed, but persistence cannot be certified | Obtain server/auth config; map queries and test against development database |
| B02 | Blocker / live | Database connection refused; every database GET fails | Direct mysql2 SELECT 1 and API probe evidence; establish correct connection |
| B03 | Blocker / browser + source | Automatic mock records/localStorage mutations report success during failure; no synchronization or durable server identity | `AppContext.jsx` initial state/actions; local customer reproduction; stabilize before Stage 0 PASS |
| S01 | Critical requirement gap / source + browser | No authentication, role guards or ownership checks; all customer/prescription/staff operations are public | Backend routes and App.jsx; implement in Stage 1 after baseline gate |
| B04 | High / live | Health succeeds despite unavailable DB; startup never calls testConnection | app.js/server.js/database.js; add separate readiness semantics or database-aware health |
| B05 | High / live + direct validator calls | Numeric/string type gaps cause 500 or accept invalid values: quantity 1.9 becomes 1; `2abc` becomes 2; price `Infinity` accepted | Validators; enforce finite types, integer quantities/IDs, valid calendar dates, ranges and maximum lengths |
| B06 | High / source | No purchase/sale idempotency key or unique request guard; repeated submissions/retries can repeat stock changes | POS and purchase buttons lack pending disable; transaction repositories accept every new request |
| B07 | High / source | A post-commit read can fail after stock was changed, returning error; retry can create another transaction | Existing test confirms committed-read failure; add durable retry/receipt reconciliation |
| B08 | High / source | Today's revenue sums sale header totals after joining sale_items, multiplying revenue by line count | `saleRepository.getTodaySummary`; aggregate header totals independently; verify multi-line sale |
| B09 | High / source | Prescription handover is transient JSON/React route state, with no approval state/order link; sale cannot complete original prescription | Prescription controller and POS; preserve identity in database and implement staged lifecycle later |
| B10 | Medium / direct validator call | Duplicate prescription medicine lines accepted; availability checks per line, not aggregate demand | prescriptionValidator/repository; reject or consolidate duplicates |
| B11 | Medium / source | Optional nullable medicine category is not normalized; search calls `m.category.toLowerCase()` | Medicine create validator permits null; normalization and MedicineListPage; add null-safe normalization/search |
| B12 | Medium / source | Frontend edit validation rejects unchanged numeric zero price/quantity as falsy; API date values are not normalized to date-input format | EditMedicinePage, normalizeMedicine/normalizeCustomer; verify zero values and real SQL Server date serialization |
| B13 | Medium / browser + source | Direct prescription/receipt loads turn outage into not-found, while list pages show mocks; partial startup success can mix real and fake datasets | AppContext loadInitialData/getReceipt/getPrescriptionById and detail pages |
| B14 | Medium / browser + source | Inventory Near Expiry count includes expired records; Product IDs omitted from visible inventory and receipt fields | MedicineListPage count/filter; salesController.getReceipt; show actual identities and correct metrics |
| B15 | Medium / source | Free stock quantity updates can overwrite concurrent sale/purchase changes; one expiry/batch per product; currency uses floating-point JS arithmetic | MedicineRepository.update; schema and sale/purchase arithmetic; reconcile with real schema and verify concurrency/rounding |
| B16 | Medium / source | Seed dates stale; rerunning seed duplicates data and indexes are not rerunnable | database scripts; do not apply these blindly to existing database |
| B17 | Medium / observed audits | Frontend 4 affected packages (1 high, 3 moderate), backend 2 moderate; broad forced upgrade would cross major versions | Raw npm audit reports; select compatible remediation and run regression tests |
| B18 | Low–medium / browser | React fetchPriority warning, two React Router future warnings; unknown route blank; API error console entries | Dashboard img prop, main.jsx, App.jsx; fix without redesign |
| B19 | Maintenance / source | Six duplicate service clients, unused Header/Sidebar/mockDashboard; formatting helpers imported from mock data; inline validation/date logic duplicates helpers | Import graph/source search; preserve active implementation during later cleanup |
| B20 | Test gap / source | `frontend/src/test/*` imports Vitest/testing-library but runner only executes `frontend/test/*.test.js`; those dependencies/config are absent | frontend package/scripts/tests; passing 9 tests is not passing component/API context tests |
| B21 | Security/config / source | Development fallback root/empty password; no rate limiting, secure account/session configuration or protected files; frontend stores customer/prescription data in localStorage | Database config, app middleware, AppContext; do not use this baseline for real customer data |

Later-stage missing features are fully mapped in [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md). Recording a gap here does not mean that stage has been entered. Existing runtime failures must be stabilized before advancing; new role/customer/order workflows remain in their prescribed stages.

## Tests and dependency evidence

| Check | Result / limitation |
| --- | --- |
| Backend `npm ls --depth=0` | PASS, four direct dependencies installed; no install needed |
| Frontend `npm ls --depth=0` | PASS, ten direct/dev dependencies installed; no install needed |
| Backend `npm test` | PASS **13/13**; validator tests and database-stubbed repository tests |
| Frontend `npm test` | PASS **9/9**; normalization/stock/expiry/sale pure-function tests |
| Backend `node --check` | PASS **32** source/test JS files |
| Frontend `npm run build` | PASS; 1,960 modules; HTML 0.71 kB, CSS 59.98 kB, JS 383.47 kB; initial sandbox path-access failure did not reproduce outside sandbox |
| Frontend dev server | PASS on port 3000; browser rendering observed |
| Backend server | PASS on port 5000; startup not proof of DB connection |
| Direct database query | FAIL: ECONNREFUSED at ::1:3306 and 127.0.0.1:3306; wrong database implementation for user-confirmed SQL Server |
| API probes | 34 recorded; database success cases blocked |
| Browser routes | 18 visited; two details settle on not found; unknown route blank |
| Browser interaction | Inventory search works on seeded data; empty customer validation works; offline create + refresh reproduces false persistence |
| Browser console/backend logs | React prop/router warnings, API errors; backend AggregateError/ECONNREFUSED and malformed-input TypeError |
| Frontend npm audit | [Raw JSON](audits/stage-0/frontend-npm-audit.json): vite high; esbuild, react-router and react-router-dom moderate. Counts are affected packages, not distinct exploitable vulnerabilities |
| Backend npm audit | [Raw JSON](audits/stage-0/backend-npm-audit.json): express and qs moderate |
| Live CRUD/restart/stock arithmetic | BLOCKED; not substituted with localStorage or mocked SQL |
| Responsive matrix, browser print, upload security, cross-role, concurrency and retry acceptance | NOT VERIFIED / absent prerequisites |

Npm audit initially could not reach the registry in the restricted sandbox; a permitted network-enabled retry produced the saved reports. No `npm audit fix --force`, dependency install, source rewrite or schema modification was performed. The reports record the registry response observed during this audit, not a guarantee of exploitability in this application.

## Stage 0 continuation plan

1. SQL Server DDL, database name and remote SQLEXPRESS / Windows Authentication have been received. Obtain the other computer's hostname/IP and full SSMS Server name. The read-only `database/mssql/inspect-connection.sql` can identify metadata in a working SSMS session. Keep any credentials in local ignored configuration, not chat or committed evidence.
2. Inspect the actual schema and existing data relationships read-only. Determine whether triggers/procedures already modify stock before introducing application-side stock writes, to prevent double counting.
3. Reconcile the existing backend with SQL Server while preserving working modules and permanent IDs. Do not import the proposed MySQL scripts into SQL Server or invent replacement tables before mapping the real database.
4. Fix baseline outage/validation/readiness defects and retain existing business behavior. Verify all existing reads, creates and updates with named development fixtures and direct SQL assertions.
5. Exercise existing supplier → purchase → stock and customer → prescription → POS → receipt flows. Verify stock 20 → 120 → 110, rollback on invalid/expired/insufficient stock, duplicate requests, refresh and backend restart. A frontend success toast is insufficient evidence.
6. Rerun unit/build/API/browser checks, inspect console/logs, update tracker with actual results and make small logical commits. Stage 0 remains active until these prerequisites pass.

## Required stage report

STAGE: 0 — Current system audit and baseline

STATUS: BLOCKED

IMPLEMENTED:
- Evidence-backed audit, requirement tracker, route/query inventories, supplied SQL Server schema review and saved baseline/dependency evidence.

FIXED:
- Corrected documentation's unsupported completion claim and identified the authoritative database mismatch. No application fixes claimed.

DATABASE CHANGES:
- No live database changes. Preserved three supplied SQL Server scripts and added a read-only connection/metadata diagnostic script in `database/mssql/`; a reachable instance and live metadata are still required.

API CHANGES:
- None; 34 baseline probes recorded.

FRONTEND CHANGES:
- None; browser tests used existing screens and disposable local-only test data.

TESTS PERFORMED:
- Dependencies, 13 backend tests, 9 frontend tests, 32 syntax checks, production build, server startup, MySQL and Windows-authenticated SQL Server connection attempts, API probes, browser routes/search/form/refresh and npm audits.

REGRESSION TEST RESULTS:
- Existing unit suites/build pass. Database-backed CRUD and end-to-end regression blocked; no stage PASS.

KNOWN ISSUES:
- SQL Server/MySQL mismatch, database failures, fake offline success, absent authentication/lifecycle features, validation/reporting/retry bugs and dependency advisories; see findings above.

FILES CHANGED:
- README.md, TODO.md, docs/IMPLEMENTATION_STATUS.md, docs/STAGE_0_AUDIT.md, docs/SQL_SERVER_SCHEMA_REVIEW.md, four baseline evidence files under docs/audits/stage-0/, and four SQL Server files under database/mssql/.

COMMIT:
- Audited source: `9bdfd34b7a021b39ef60372a9817164a0b49d7b7`. Audit documentation: Git commit titled `chore: audit current dev implementation` (see Git history).

NEXT STAGE:
- Continue Stage 0 with the supplied SQL Server schema after server/auth connection details are supplied. Stage 1 is not started.

---

# Stage 0B addendum — 2026-10-02 (SQL Server migration + false-success removal)

**Database architecture decision (FINAL):** *Earlier Planned Database: MySQL*
(legacy reference code only, files retained until verification) · *Final
Implemented Database: Microsoft SQL Server* (SSMS, Windows Authentication). The
migration below implements this decision; Stage 1 stays gated until Stage 0
persistence and regression checks pass.

**Outcome: still BLOCKED** — but the two blockers that could be addressed from the
repository alone have been closed. What remains is exclusively the missing remote
connection details.

## Closed since the audit above

| Original finding | Status now |
| --- | --- |
| **B01** database is SQL Server, runtime is MySQL | **Closed.** `mysql2` removed. One runtime implementation: `mssql` + `msnodesqlv8` (Windows Authentication) behind `backend/src/config/database.js`. All six repositories translated (see `docs/SQLSERVER_MIGRATION.md`). |
| **B03** mock/localStorage fallback reports success during failure | **Closed.** Business collections start empty and are API-only; every mutation persists or fails with `success:false` + error toast; no local id generation. Browser-verified: `docs/audits/stage-0b/db-failure-probes.txt`. |
| **B02** every database GET returns an ambiguous 500 | **Changed.** Now an explicit `503 Database unavailable: …` carrying the reason. Still no connection (blocked). |
| **B04** health succeeds while the database is down; startup never tests the connection | **Closed.** `/api/health` reports `database.status/ready/server/name/login/base_tables`; `server.js` probes at boot and logs a clear failure. |
| **B07-adjacent** connection latch: one network error left the API permanently "unavailable" | **Closed.** The flag no longer gates requests; every call is attempted and the next success flips it back and re-syncs. |

## Regression evidence

- Backend `npm test`: **23/23 pass** (13 original tests, updated for SQL Server expectations, + 10 new migration tests that forbid MySQL syntax and assert `OUTPUT INSERTED.id`, `OFFSET/FETCH` ordering, `UPDLOCK/ROWLOCK`, SERIALIZABLE, `@pN` conversion and loud 503 failure).
- Frontend `npm test`: **9/9 pass**. Production build: pass.
- API probes: validation (400), 404 and health unchanged; DB paths now 503.
- Browser: all 18 routes previously inventoried still render; the outage banner replaces silent mock data.

## Still open (unchanged, requires the remote server)

B02 live connection, real-schema verification, CRUD persistence, purchase/sale
stock transactions, rollback, and concurrency behaviour. Findings B05, B06, B08,
B09, B10, B11, B12, B14, B15, B16, B17, B18, B19, B20 are recorded as known
future issues in `docs/IMPLEMENTATION_STATUS.md` with their stage assignment and
were deliberately not fixed here. S01 (no authentication/authorization) is Stage 1.

## Environment note discovered during Stage 0B

Only the legacy ODBC driver `SQL Server` is registered on this machine
(`reg query "HKLM\SOFTWARE\ODBC\ODBCINST.INI\ODBC Drivers"`); neither
`SQL Server Native Client 11.0` nor `ODBC Driver 17/18 for SQL Server` is
installed. `DB_DRIVER` therefore defaults to `{SQL Server}` and is overridable in
`backend/.env`. If date/`DATETIME2` round-tripping misbehaves once connected,
installing a modern ODBC driver is the first thing to try.
