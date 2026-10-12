# Full-System Test Matrix

Audit date: 2026-10-03  
Audited branch/commit: `dev` / `95790ddde96501edb9ed6484ab0437b9a6e82bbb`

Allowed statuses are used exactly: **PASS**, **FAIL**, **BLOCKED**, **NOT IMPLEMENTED**, **NOT APPLICABLE**. Severity is the release impact if the expectation fails; it is retained on passing rows to show the risk covered by the test.

## Environment, repository, database, and regression

| ID | MODULE | TEST | EXPECTED | ACTUAL | STATUS | SEVERITY | EVIDENCE |
|---|---|---|---|---|---|---|---|
| ENV-001 | Environment | Backend dependencies | Installed/resolvable | Dependency tree and clean-install dry run succeeded | PASS | HIGH | backend `npm ls`; `npm ci --dry-run` |
| ENV-002 | Environment | Frontend dependencies | Installed/resolvable | Dependency tree and clean-install dry run succeeded | PASS | HIGH | frontend `npm ls`; `npm ci --dry-run` |
| ENV-003 | Environment | Backend startup | Starts without DB/startup error | Started; health 200 | PASS | CRITICAL | live server `/api/health` |
| ENV-004 | Environment | Frontend startup | Vite serves app | HTTP 200 | PASS | HIGH | live Vite server |
| ENV-005 | Environment | Production build | Build succeeds | 1,981 modules; JS 409.51 kB | PASS | HIGH | `npm run build` |
| ENV-006 | Environment | Backend automated tests | All pass | 29 pass, 0 fail, 0 skip | PASS | HIGH | `npm test` |
| ENV-007 | Environment | Frontend automated tests | All pass | 15 pass, 0 fail, 0 skip | PASS | HIGH | `npm test` |
| GIT-001 | Repository | Initial state | Clean; branch/HEAD captured | Clean; `dev`; audited commit recorded | PASS | MEDIUM | Git status and rev-parse |
| GIT-002 | Repository | `.env` handling | Backend `.env` ignored, no secret env tracked | Ignored; no tracked `.env` | PASS | CRITICAL | `git check-ignore`; tracked-file scan |
| GIT-003 | Repository | Committed working credentials | No working plaintext password | README-documented value authenticated all five original staff roles | FAIL | CRITICAL | QA-SEC-001; bcrypt/live-login comparison without printing value |
| DB-001 | SQL Server | Backend database connection | Real MSSQL responds | `SELECT 1` succeeded through backend pool | PASS | CRITICAL | live Node/mssql query |
| DB-002 | SQL Server | Server identity | Required SQLEXPRESS instance | `DESKTOP-79MG1Q7\SQLEXPRESS` | PASS | CRITICAL | `@@SERVERNAME` |
| DB-003 | SQL Server | Database identity | `pharmacy_management` | Exact match | PASS | CRITICAL | `DB_NAME()` |
| DB-004 | Schema | Live inventory | Tables/columns/keys/indexes/checks/triggers recorded | 15/122/14/39/29/8 | PASS | HIGH | SQL catalog inventory; `DATABASE_STATE.md` |
| DB-005 | Schema | Migration history | Current migrations recorded once | `001`, `002`, `003` exactly | PASS | HIGH | `dbo.schema_migrations` |
| DB-006 | Schema | Migration rerun | Applied migrations skipped; no data loss | All three skipped; counts unchanged | PASS | CRITICAL | `npm run migrate` before/after |
| DB-007 | Persistence | Customer/medicine/supplier CRUD | SQL-backed persistence | Supported CRUD passed; medicine delete absent | PASS | CRITICAL | API → SQL → API checks |
| DB-008 | Persistence | Backend restart | Records survive restart | Temporary records remained readable | PASS | CRITICAL | live restart and API read |
| DB-009 | Persistence | Browser refresh | Records remain visible | Authenticated real-browser refresh unavailable | BLOCKED | HIGH | non-interactive browser limitation; SQL/restart passed separately |
| CLN-001 | Cleanup | Temporary database data | Restore original records/counts | All 13 audited table counts exactly restored | PASS | CRITICAL | before/after count snapshot |
| CLN-002 | Cleanup | Uploads/scripts/screenshots | Remove all QA artifacts | Removed | PASS | HIGH | filesystem and SQL check |

## Authentication, sessions, and authorization

| ID | MODULE | TEST | EXPECTED | ACTUAL | STATUS | SEVERITY | EVIDENCE |
|---|---|---|---|---|---|---|---|
| AUTH-001 | Authentication | Valid login: six roles | CUSTOMER/ADMIN/PHARMACIST/SUPPLIER/INVENTORY/SALES authenticate | All temporary role logins 200 | PASS | CRITICAL | live role loop |
| AUTH-002 | Authentication | Invalid password | 401 each role | 401 each role | PASS | CRITICAL | live role loop |
| AUTH-003 | Authentication | Missing password | 400 | 400 each role | PASS | HIGH | live role loop |
| AUTH-004 | Authentication | Wrong username/email | 401 | 401 each role | PASS | CRITICAL | live role loop |
| AUTH-005 | Authentication | Valid JWT | Accepted for current user | Accepted | PASS | CRITICAL | `/api/auth/me` and protected APIs |
| AUTH-006 | Authentication | Missing/malformed/bad-signature/expired JWT | 401 | 401 in all four cases | PASS | CRITICAL | live token probes |
| AUTH-007 | Authentication | Unknown-user token | 401 | 401 | PASS | CRITICAL | signed token for absent user |
| AUTH-008 | Authentication | Password storage | bcrypt only; no plaintext DB password | Hash verified; plaintext absent | PASS | CRITICAL | direct SQL plus bcrypt compare |
| SES-001 | Session | Fresh logged-out load | No protected data cascade | Session test resolves unauthenticated and clears scoped data | PASS | HIGH | frontend automated tests and AuthContext review |
| SES-002 | Session | Login redirect | Correct dashboard without reload | Route mapping/code covered; interactive browser not executed | BLOCKED | HIGH | interactive authenticated browser unavailable |
| SES-003 | Session | Refresh restore | Session restored | Automated restore passes; real browser not executed | BLOCKED | HIGH | frontend tests; browser requirement retained |
| SES-004 | Session | Logout and Browser Back | Protected page unavailable and cache cleared | Cache-clear test passes; actual browser Back not executed | BLOCKED | CRITICAL | frontend tests plus harness limitation |
| SES-005 | Session | Cross-role cache isolation | No sensitive carry-over | Scope reset exists/tested; real sequential role switch unavailable | BLOCKED | CRITICAL | frontend tests plus harness limitation |
| RBAC-001 | Authorization | Protected API role matrix | 200 for allowed; 403 for authenticated disallowed | Expected across medicines/suppliers/purchases/sales/prescriptions/customers | PASS | CRITICAL | live six-role representative matrix |
| RBAC-002 | Authorization | CUSTOMER ownership | Own only; other/list/edit/delete 403 | Expected results | PASS | CRITICAL | live customer probes |
| RBAC-003 | Authorization | Frontend protected routes | Role guard agrees with API | Route role groups align with backend | PASS | HIGH | `App.jsx`, `ProtectedRoute`, route files |

## Public site, customer, catalogue, inventory, and supplier

| ID | MODULE | TEST | EXPECTED | ACTUAL | STATUS | SEVERITY | EVIDENCE |
|---|---|---|---|---|---|---|---|
| PUB-001 | Public site | Home/About/Services | Render and links work | Home and anchor sections render | PASS | MEDIUM | headless Edge/live Vite |
| PUB-002 | Public site | Items/Login/Register navigation | Public routes work | All declared public links/routes render | PASS | MEDIUM | route inspection and headless load |
| PUB-003 | Public site | Navbar exposure | No staff operations | None exposed | PASS | HIGH | rendered navigation review |
| PUB-004 | Public site | Desktop 1440×1000 | Usable layout | Correct render | PASS | LOW | headless Edge capture reviewed then deleted |
| PUB-005 | Public site | Tablet 768×1024 | Usable layout | Correct responsive header/hero | PASS | LOW | headless Edge capture reviewed then deleted |
| PUB-006 | Public site | Mobile catalogue 390×844 | No horizontal overflow | Grid extends beyond viewport | FAIL | LOW | QA-UI-008; headless capture |
| PUB-007 | Public site | Invalid route | Friendly 404 | No wildcard route | NOT IMPLEMENTED | LOW | `frontend/src/App.jsx` |
| REG-001 | Registration | Valid complete registration/login | 201, SQL rows/hash, login succeeds | Passed; cleaned | PASS | CRITICAL | live API + SQL + bcrypt + login |
| REG-002 | Registration | Missing core fields/password mismatch | Rejected | Core missing input and UI mismatch checks rejected | PASS | HIGH | live/API and frontend behavior |
| REG-003 | Registration | Invalid email | 400 | 201 | FAIL | MEDIUM | QA-REG-004 |
| REG-004 | Registration | Duplicate username | 409 | 500 | FAIL | MEDIUM | QA-REG-004 |
| REG-005 | Registration | Duplicate email | 409 | 201 | FAIL | MEDIUM | QA-REG-004 |
| REG-006 | Registration | Phone/address required | 400 if missing | 201 | FAIL | MEDIUM | QA-REG-004 |
| CUST-001 | Profile | Own view/update/persistence | SQL-backed success | API and SQL values matched | PASS | CRITICAL | live API + SQL |
| CUST-002 | Profile | Other customer access | 403 | list/read/edit/delete returned 403 | PASS | CRITICAL | live ownership probes |
| CAT-001 | Catalogue | List/search/category | Correct filtered products | Passed | PASS | HIGH | product verifier and live UI/API |
| CAT-002 | Catalogue | Required categories | Four required categories | All four present | PASS | MEDIUM | live SQL/API |
| CAT-003 | Catalogue | Product identity/price/availability | SQL/API/UI equality for three | Exact match for three products | PASS | CRITICAL | product verifier |
| CAT-004 | Catalogue | Product images | Valid image or safe fallback | Placeholder used where no managed image exists | PASS | LOW | live catalogue |
| INV-001 | Inventory | Create/read/update/search | Authorized, persisted | Passed | PASS | CRITICAL | live API + SQL |
| INV-002 | Inventory | Low/out-of-stock/expiry | Correct status | Passed | PASS | HIGH | live endpoint checks |
| INV-003 | Inventory | Strict numeric/type validation | Reject malformed/float integer/Infinity/object | Four probes accepted or returned 500 | FAIL | MEDIUM | QA-VAL-005 |
| INV-004 | Inventory | Delete medicine | Supported CRUD delete | No DELETE route | NOT IMPLEMENTED | MEDIUM | route enumeration |
| SUP-001 | Supplier | Login/list/search/create/update/delete | Authorized and persisted | Passed, including 409 for referenced delete | PASS | HIGH | live API + SQL |
| SUP-002 | Supplier | Role permissions | Supplier reads; cannot manage | Read 200, writes 403 | PASS | CRITICAL | live RBAC |
| SUP-003 | Supplier | Supply requirement/request/history | Durable end-to-end flow | No model/endpoints/workflow | NOT IMPLEMENTED | HIGH | schema, route, UI review |

## Purchase, prescription, cart/order, and sales

| ID | MODULE | TEST | EXPECTED | ACTUAL | STATUS | SEVERITY | EVIDENCE |
|---|---|---|---|---|---|---|---|
| PUR-001 | Purchase | Receive +20 | One header/item; stock X+20 once | Exact result | PASS | CRITICAL | live API + SQL |
| PUR-002 | Purchase | Invalid product/qty/supplier | Reject; no partial mutation | Passed for invalid, zero, negative, bad supplier | PASS | CRITICAL | live API + SQL counts |
| PUR-003 | Purchase | Multi-line rollback | No header/item/stock partial state | Passed | PASS | CRITICAL | transaction probe |
| PUR-004 | Purchase | Duplicate submit | One user intent creates one transaction | No in-flight disable/idempotency | FAIL | HIGH | QA-TXN-003 |
| UP-001 | Upload | JPEG/PNG | 201, bytes and metadata round-trip | Passed | PASS | CRITICAL | live verifier |
| UP-002 | Upload | PDF | 415 | 415 | PASS | HIGH | live verifier |
| UP-003 | Upload | Oversized >10 MiB | Rejected | 413 | PASS | HIGH | live verifier |
| UP-004 | Upload | Unsupported/fake/mismatch/empty/missing | Rejected and cleaned | Passed across live/unit coverage | PASS | CRITICAL | verifier + backend tests |
| UP-005 | Upload | Storage design | Relative generated name, no base64/path leak | Passed | PASS | CRITICAL | SQL/file/API checks |
| UP-006 | Upload auth | Owner/other/pharmacist/admin | 200/403/200/200 | Exact | PASS | CRITICAL | live verifier |
| UP-007 | Upload auth | Inventory/sales/supplier/anonymous | 403/403/403/401 | Exact | PASS | CRITICAL | route matrix/live probes |
| UP-008 | Upload auth | Missing/traversal | 404/rejected | Passed | PASS | CRITICAL | verifier/tests |
| RX-001 | Structured prescription | Create/items | Persist exact quantities | Passed | PASS | HIGH | live API + SQL |
| RX-002 | Structured prescription | Availability states | Real stock yields all four states | available/insufficient/out_of_stock/expired verified | PASS | CRITICAL | controlled medicines |
| RX-003 | Workflow | Approval/rejection/completion | Persistent transitions | No transition endpoints/model | NOT IMPLEMENTED | HIGH | route/schema review |
| RX-004 | Staff dashboard | Upload queue/view/action | Queue, download, review controls | File download API exists; no queue/review workflow | NOT IMPLEMENTED | HIGH | route/UI review |
| RX-005 | Billing handoff | Survive refresh/restart/other staff | Durable SQL record and queue | Computed response/navigation state only | FAIL | HIGH | QA-RX-002 |
| CART-001 | Cart | Add/update/remove/subtotal/persist | Persistent cart | Disabled “Cart available in B2”; no table/API | NOT IMPLEMENTED | HIGH | UI/schema/API review |
| ORD-001 | Order | Order/items/owner/status/history | Durable order distinct from sale | No tables/API; checkout route redirects | NOT IMPLEMENTED | CRITICAL | schema and `App.jsx` |
| ORD-002 | Order | Prescription-required rule | Backend/database enforced | No order model/rule | NOT IMPLEMENTED | CRITICAL | schema/API review |
| PAY-001 | Payment | Customer payment lifecycle | Durable payment state | Only POS payment-method field exists | NOT IMPLEMENTED | HIGH | schema/API review |
| SALE-001 | POS | Search/select/quantity/discount/payment/total | Operational POS | Passed | PASS | CRITICAL | live POS API workflow |
| SALE-002 | POS | Authoritative server price | Ignore client price | Manipulated price ignored | PASS | CRITICAL | live tamper probe |
| SALE-003 | Sale | Stock -10 once | Header/items and X-10 | Exact | PASS | CRITICAL | API + SQL |
| SALE-004 | Sale rollback | Invalid/zero/negative/expired/short stock | No partial sale/item/stock | Passed | PASS | CRITICAL | live failure probes |
| SALE-005 | Sale | Duplicate lines | Reject without partial state | Rejected | PASS | CRITICAL | live failure probe |
| SALE-006 | Concurrency | Two sales against stock 1 | One succeeds, one conflicts, stock 0 | 201/409; final 0 | PASS | CRITICAL | parallel live requests + SQL |
| SALE-007 | POS | Duplicate submit intent | One transaction | Button/API lack duplicate guard | FAIL | HIGH | QA-TXN-003 |
| REC-001 | Receipt | Persisted direct route and fields | Complete server-backed receipt | Passed | PASS | HIGH | direct route after creation |
| REC-002 | Receipt | Print view | Printable browser output | Print dialog cannot be exercised headlessly | BLOCKED | MEDIUM | browser harness limitation |
| HIST-001 | Sales history | List/custom dates | SQL-backed results | API list/custom dates available | PASS | MEDIUM | live API/SQL |
| HIST-002 | Sales history | Today/week/month UI | Dedicated filters/views | Not present | NOT IMPLEMENTED | MEDIUM | UI route review |
| RPT-001 | Sales report | Today count/revenue/items | Equal independent SQL | Revenue 180 vs SQL 150 | FAIL | MEDIUM | QA-RPT-006 |
| RPT-002 | Sales report | Monthly/paid-pending/top products | Complete reports | No endpoints/workflow | NOT IMPLEMENTED | MEDIUM | API/UI review |
| NOTIF-001 | Notifications | Event persistence/isolation | Durable per-customer notifications | Display placeholder only; no table/API | NOT IMPLEMENTED | HIGH | schema/API/UI review |

## Integration, abuse, security, failure recovery, and journeys

| ID | MODULE | TEST | EXPECTED | ACTUAL | STATUS | SEVERITY | EVIDENCE |
|---|---|---|---|---|---|---|---|
| INT-001 | Product ID | Same permanent code across modules | Catalogue/inventory/purchase/RX/sale/receipt agree | Same code throughout | PASS | CRITICAL | controlled product verifier |
| INT-002 | Inventory integration | 100 → +20 → -10 | Final 110 everywhere | SQL/catalogue/inventory/RX all 110 | PASS | CRITICAL | live demonstration |
| ABUSE-001 | Input | Empty/null/long/wrong types/bounds | 4xx; no mutation | Representative endpoints reject many; medicine strict cases fail | FAIL | MEDIUM | QA-VAL-005 and live probes |
| ABUSE-002 | SQL injection | Parameterized, no data alteration | Search returned zero; counts unchanged | PASS | CRITICAL | live injection probe |
| SEC-001 | Security | Response data | No hash/secrets/password/path/stack | Normal responses clean | PASS | CRITICAL | payload inspection |
| SEC-002 | Security | Error detail | Generic client error | DB message exposed outside production | FAIL | MEDIUM | QA-ERR-007 |
| SEC-003 | Security | CORS | Only approved origin authorized | Evil origin did not receive matching ACAO | PASS | HIGH | live Origin probes |
| FAIL-001 | DB outage | Read/write failure truthfulness | 500; no fake success/partial write | Exact | PASS | CRITICAL | controlled pool close + SQL counts |
| FAIL-002 | DB outage | Browser recovery without restart | Retry succeeds after recovery | API recovered; same-browser retry unavailable | BLOCKED | HIGH | non-interactive harness limitation |
| FAIL-003 | Backend outage | Frontend/API truthfulness | Unavailable, then recovery | health unreachable; restart health/products 200 | PASS | HIGH | stop/start probes |
| FE-001 | Frontend quality | Loading/error/empty/success states | Present for active workflows | Present on catalogue/auth/upload/history/key CRUD | PASS | MEDIUM | component review/headless load |
| FE-002 | Frontend quality | Disable duplicate stock submits | Buttons disabled while pending | POS/purchase remain enabled | FAIL | HIGH | QA-TXN-003 |
| FE-003 | Frontend quality | Broken links/content | Only operational functions advertised | Ordering/history affordances lead to absent workflows | FAIL | LOW | QA-UX-010 |
| FE-004 | Frontend quality | Broken image/key/console issues | None | No public console output; keys/assets/build pass | PASS | LOW | headless output/static/build |
| JRN-C-001 | Customer journey | Home→register→login→browse | Complete | Passed | PASS | HIGH | combined live workflow |
| JRN-C-002 | Customer journey | Browse→cart→order | Complete | Cart is first missing step | NOT IMPLEMENTED | CRITICAL | cart/order rows |
| JRN-C-003 | Customer journey | Upload→review→billing→payment→invoice→complete | Complete | Upload/history pass; remaining state workflow absent | NOT IMPLEMENTED | CRITICAL | RX/order/payment rows |
| JRN-I-001 | Inventory journey | Login→dashboard→stock→low→supply requirement | Complete | Through low/expiry/purchase passes; supply requirement absent | NOT IMPLEMENTED | HIGH | live/API/UI |
| JRN-SUP-001 | Supplier journey | Login→request→supply→stock increase | Complete | Login/reads pass; request/supply absent | NOT IMPLEMENTED | HIGH | live/API/UI |
| JRN-PH-001 | Pharmacist journey | Queue→file→availability→decision→billing | Complete | Structured availability passes; queue/decision absent; handoff fails | NOT IMPLEMENTED | HIGH | RX rows |
| JRN-SA-001 | Sales journey | Approved order→bill→payment→invoice→transaction | Complete | Direct POS/receipt passes; approved order absent | NOT IMPLEMENTED | HIGH | sales/order rows |

## Complete API endpoint inventory

“Actual” reports the observed live response or the verified response family. Every protected route was also subjected to missing-token 401 and representative disallowed-role 403 checks; those common results are not repeated in every cell.

| ID | MODULE | TEST | EXPECTED | ACTUAL | STATUS | SEVERITY | EVIDENCE |
|---|---|---|---|---|---|---|---|
| API-001 | Health | `GET /api/health` — public | 200 | 200 | PASS | HIGH | live request |
| API-002 | Auth | `POST /api/auth/customer-login` — public | 200 valid; 400/401 invalid | Exact | PASS | CRITICAL | live auth matrix |
| API-003 | Auth | `POST /api/auth/customer/login` — public alias | Same as customer login | Same handler/behavior | PASS | CRITICAL | route + auth tests |
| API-004 | Auth | `POST /api/auth/staff-login` — public | 200 valid; 400/401 invalid | Exact across five roles | PASS | CRITICAL | live auth matrix |
| API-005 | Auth | `GET /api/auth/me` — authenticated | 200/401 | Exact | PASS | CRITICAL | token matrix |
| API-006 | Products | `GET /api/products` — public | 200 list/search/category | 200 correct filters | PASS | HIGH | product verifier |
| API-007 | Products | `GET /api/products/:productCode` — public | 200/404 | Exact | PASS | HIGH | product verifier |
| API-008 | Medicines | `GET /api/medicines` — ADMIN/PHARMACIST/INVENTORY/SALES | 200; others 403 | Exact | PASS | CRITICAL | role matrix |
| API-009 | Medicines | `GET /api/medicines/low-stock` — same roles | 200 | 200 correct set | PASS | HIGH | live query |
| API-010 | Medicines | `GET /api/medicines/expiry-status` — same roles | 200 | 200 correct states | PASS | HIGH | live query |
| API-011 | Medicines | `GET /api/medicines/:id` — same roles | 200/404 | Exact | PASS | HIGH | CRUD flow |
| API-012 | Medicines | `POST /api/medicines` — ADMIN/INVENTORY | 201/4xx | Happy path 201; malformed cases fail contract | FAIL | MEDIUM | QA-VAL-005 |
| API-013 | Medicines | `PUT /api/medicines/:id` — ADMIN/INVENTORY | 200/4xx/404 | 200 persisted; representative invalid rejected | PASS | HIGH | CRUD flow |
| API-014 | Suppliers | `GET /api/suppliers` — ADMIN/INVENTORY/SUPPLIER | 200 | 200 | PASS | HIGH | role matrix/search |
| API-015 | Suppliers | `GET /api/suppliers/:id` — same roles | 200/404 | Exact | PASS | HIGH | CRUD flow |
| API-016 | Suppliers | `POST /api/suppliers` — ADMIN/INVENTORY | 201/4xx | 201 persisted | PASS | HIGH | CRUD flow |
| API-017 | Suppliers | `PUT /api/suppliers/:id` — ADMIN/INVENTORY | 200/4xx/404 | 200 persisted | PASS | HIGH | CRUD flow |
| API-018 | Suppliers | `DELETE /api/suppliers/:id` — ADMIN/INVENTORY | 200; 409 referenced | Exact | PASS | HIGH | delete probes |
| API-019 | Purchases | `GET /api/purchases` — ADMIN/INVENTORY/SUPPLIER | 200 | 200 | PASS | HIGH | role matrix |
| API-020 | Purchases | `GET /api/purchases/recent` — same roles | 200 | 200 | PASS | MEDIUM | route/service verification |
| API-021 | Purchases | `GET /api/purchases/:id` — same roles | 200/404 | Exact | PASS | HIGH | purchase flow |
| API-022 | Purchases | `POST /api/purchases` — ADMIN/INVENTORY | 201/4xx/404/409, atomic | Exact; stock once | PASS | CRITICAL | transaction probes |
| API-023 | Sales | `GET /api/sales` — ADMIN/SALES | 200, filters | 200 with search/custom dates | PASS | HIGH | live route |
| API-024 | Sales | `GET /api/sales/recent` — ADMIN/SALES | 200 | 200 | PASS | MEDIUM | route/service verification |
| API-025 | Sales | `GET /api/sales/today-summary` — ADMIN/SALES | 200 and SQL-equal totals | 200 but revenue wrong | FAIL | MEDIUM | QA-RPT-006 |
| API-026 | Sales | `GET /api/sales/:id` — ADMIN/SALES | 200/404 | Exact | PASS | HIGH | sale flow |
| API-027 | Sales | `GET /api/sales/:id/receipt` — ADMIN/SALES | 200/404 persisted receipt | Exact | PASS | HIGH | direct route |
| API-028 | Sales | `POST /api/sales` — ADMIN/SALES | 201/4xx/404/409, atomic | Exact; server price; concurrency pass | PASS | CRITICAL | transaction/tamper/concurrency probes |
| API-029 | Customers | `POST /api/customers/register` — public | 201; strict 400/409 validation | Happy path 201; four validation failures | FAIL | MEDIUM | QA-REG-004 |
| API-030 | Customers | `GET /api/customers/me` — CUSTOMER | 200 | 200 own record | PASS | CRITICAL | ownership test |
| API-031 | Customers | `PUT /api/customers/me` — CUSTOMER | 200 persisted | 200/SQL match | PASS | CRITICAL | ownership test |
| API-032 | Customers | `GET /api/customers` — ADMIN/PHARMACIST/SALES | 200; CUSTOMER 403 | Exact | PASS | CRITICAL | role matrix |
| API-033 | Customers | `GET /api/customers/:id` — ADMIN/PHARMACIST/SALES | 200/404; CUSTOMER 403 | Exact | PASS | CRITICAL | role matrix |
| API-034 | Customers | `POST /api/customers` — ADMIN/PHARMACIST | 201 | 201 persisted | PASS | HIGH | staff CRUD |
| API-035 | Customers | `PUT /api/customers/:id` — ADMIN/PHARMACIST | 200/404 | 200 persisted | PASS | HIGH | staff CRUD |
| API-036 | Customers | `DELETE /api/customers/:id` — ADMIN/PHARMACIST | 200/404/conflict as applicable | Unreferenced temporary customer deleted | PASS | HIGH | staff CRUD |
| API-037 | Prescriptions | `GET /api/prescriptions` — CUSTOMER/ADMIN/PHARMACIST | 200, ownership-filtered | 200 with role scope | PASS | CRITICAL | role matrix |
| API-038 | Prescriptions | `POST /api/prescriptions/upload` — CUSTOMER | 201/4xx/413/415 | Exact | PASS | CRITICAL | upload verifier |
| API-039 | Prescriptions | `GET /api/prescriptions/mine` — CUSTOMER | 200 own uploads | 200 own only | PASS | CRITICAL | upload verifier |
| API-040 | Prescriptions | `GET /api/prescriptions/customer/:id` — CUSTOMER owner/ADMIN/PHARMACIST | 200; other CUSTOMER 403 | Exact | PASS | CRITICAL | ownership probes |
| API-041 | Prescriptions | `GET /api/prescriptions/recent` — ADMIN/PHARMACIST | 200 | 200 | PASS | HIGH | role/route verification |
| API-042 | Prescriptions | `GET /api/prescriptions/:id/availability` — CUSTOMER owner/ADMIN/PHARMACIST | 200/403/404 | Exact; four stock states | PASS | CRITICAL | controlled availability |
| API-043 | Prescriptions | `GET /api/prescriptions/:id` — CUSTOMER owner/ADMIN/PHARMACIST | 200/403/404 | Exact | PASS | CRITICAL | ownership flow |
| API-044 | Prescriptions | `POST /api/prescriptions` — ADMIN/PHARMACIST | 201/4xx | 201 persisted | PASS | HIGH | structured flow |
| API-045 | Prescriptions | `POST /api/prescriptions/:id/send-to-billing` — ADMIN/PHARMACIST | Durable handoff | 200 computed payload; no persistence | FAIL | HIGH | QA-RX-002 |
| API-046 | Upload file | `GET /api/prescription-uploads/:id/file` — CUSTOMER owner/ADMIN/PHARMACIST | 200/403/404 | Exact; all other roles 403 | PASS | CRITICAL | upload verifier |

## Final regression

| ID | MODULE | TEST | EXPECTED | ACTUAL | STATUS | SEVERITY | EVIDENCE |
|---|---|---|---|---|---|---|---|
| REGRESS-001 | Backend | Re-run full tests | No regression | 29 pass, 0 fail, 0 skip | PASS | HIGH | final `npm test` |
| REGRESS-002 | Frontend | Re-run full tests | No regression | 15 pass, 0 fail, 0 skip | PASS | HIGH | final `npm test` |
| REGRESS-003 | Build | Re-run production build | No regression | Build succeeded | PASS | HIGH | final `npm run build` |
| REGRESS-004 | MSSQL/app | Connection, health, auth, medicine API | Operational after audit | Live checks succeeded | PASS | CRITICAL | final server verification |
