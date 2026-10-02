# Implementation status — Senevirathna Medical Pharmacy

Last audited: **2026-10-02 (Asia/Colombo)**. Scope: **Stage 0 only**.

## CURRENT ACTIVE STAGE

**Stage 0 — current system audit and baseline: BLOCKED.** Frontend and backend processes start, but the database-backed application is not verified and cannot receive PASS. No later stage has been started in this audit.

## NEXT STAGE

Continue Stage 0: reconcile the backend with the project's actual Microsoft SQL Server database, establish the connection, stabilize the existing workflows, and verify persisted CRUD and stock transactions. Stage 1 remains gated until Stage 0 passes.

## BLOCKERS

1. **Database technology mismatch.** The user confirmed Microsoft SQL Server **on another computer**, supplied three scripts now preserved in `database/mssql/`, and identified **SQLEXPRESS / Windows Authentication**. The scripts define `pharmacy_management` and nine core tables. The runtime still uses `mysql2` and MySQL-specific queries. An earlier Windows-authenticated check to local `.\SQLEXPRESS` failed with **error 26**, consistent with the remote-host clarification. The remote hostname/IP and full SSMS Server name remain pending; the actual remote connection and live metadata have not been tested. See [SQL_SERVER_SCHEMA_REVIEW.md](SQL_SERVER_SCHEMA_REVIEW.md).
2. **No live persistence baseline.** No backend `.env` or database environment variables were found. The current defaults fail with `ECONNREFUSED` on both localhost addresses at port 3306. All 20 database-backed GET probes returned HTTP 500. This does not establish that the user's SQL Server database is unavailable; it establishes that this checkout is not connected to it.
3. **False success during outages.** The frontend seeds mock records and creates/updates localStorage records when APIs are unavailable. A browser customer creation and refresh reproduced this behavior. This is not database persistence and cannot satisfy any stage gate.
4. **Existing baseline defects.** Invalid input types produce HTTP 500; numeric validation silently truncates quantities; detail pages report missing records during outages; health does not check database readiness. See the prioritized findings in [STAGE_0_AUDIT.md](STAGE_0_AUDIT.md).

## LAST VERIFIED COMMIT

Audited source baseline: **`9bdfd34b7a021b39ef60372a9817164a0b49d7b7`**, branch **`dev`**. It passed the existing unit suites and frontend production build; it **did not** pass the Stage 0 database/integration gate. No fully verified end-to-end commit exists in this audit. The audit documentation commit is recorded in Git history, not represented as a verified implementation.

## Status definitions

- **NOT STARTED:** no implementation located for the requirement.
- **PARTIAL:** some code/UI exists, but required behavior or integration is missing.
- **IMPLEMENTED:** implementation exists; required verification is still pending.
- **TESTED:** the narrowly stated requirement was exercised successfully, with evidence.
- **BLOCKED:** required verification or implementation depends on an unresolved prerequisite.

An individual TESTED row is not a stage PASS. The supplied SQL Server scripts and the original MySQL schema share the nine core entities listed below; the live SQL Server database has not been inspected. Stages 1–8 below are an inventory of pre-existing code and missing work, not authorization to skip Stage 0.

## Stage 0 — baseline

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

## Stage 1 — foundation and security (not entered)

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

- **Stage 0:** BLOCKED; audit produced; existing implementation is not a reliable database-backed baseline.
- **Stages 1–8:** not entered. No stage progression or feature implementation was performed.
- SQL Server DDL/relationships/triggers have now been supplied and reviewed. Remote SQLEXPRESS and Windows Authentication are confirmed. Next evidence required: the other computer's hostname/IP and full SSMS Server name, a usable development connection and matching live metadata, then persisted CRUD and purchase/prescription/sale regression checks.
