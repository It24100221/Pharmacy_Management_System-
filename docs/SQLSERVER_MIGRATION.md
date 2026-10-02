# SQL Server migration — Stage 0B

Status legend: `PLANNED` (identified, not yet changed) · `MIGRATED` (translated and covered by tests) · `BLOCKED` (cannot be verified without a live connection) · `REFERENCE` (kept deliberately, not runtime).

Scope: **Stage 0B only** — migrate persistence from MySQL to Microsoft SQL Server, remove false-success frontend writes, preserve existing business rules. No authentication, roles, workflows or reporting changes.

---

## 1. Runtime decision

| Item | Value |
| --- | --- |
| Target database | Microsoft SQL Server (SQLEXPRESS, remote host) |
| Required authentication | **Windows Authentication (Trusted Connection)** |
| Driver | `msnodesqlv8` (only maintained Node driver that performs Windows Integrated Authentication with the *current process token*) |
| API layer | `mssql` (ConnectionPool / Request / Transaction) using the `mssql/msnodesqlv8` dialect |
| Why not `tedious` alone | tedious supports only SQL logins or NTLM with an explicit `domain\user` + password. It cannot use the logged-on Windows account, so it does not satisfy "Windows Authentication" as configured in SSMS. |
| Why not `mysql2` | Removed from runtime; SQL Server is the single production database. |
| Connection config | Environment variables only (`backend/.env.example`, placeholders). No hard-coded server/instance/database/credentials. |

`msnodesqlv8` builds the ODBC connection string as `Trusted_Connection=yes` when `options.trustedConnection` is `true`, which delegates to Windows Integrated Authentication.

> **Driver prerequisite:** the ODBC *driver* named in `DB_DRIVER` must exist on the machine running Node.
> Observed on this machine via `reg query HKLM\SOFTWARE\ODBC\ODBCINST.INI\ODBC Drivers`: only the legacy `SQL Server` driver is present — **no `SQL Server Native Client 11.0`, no `ODBC Driver 17/18 for SQL Server`**. `DB_DRIVER` therefore defaults to `{SQL Server}` and is overridable by environment variable.

---

## 2. Migration matrix

### 2.1 `backend/src/config/database.js` (central database module)

| File | Function | MySQL behavior | SQL Server replacement | Status |
| --- | --- | --- | --- | --- |
| config/database.js | module init | `mysql2/promise.createPool({host,port,user,password,database})` | `mssql/msnodesqlv8` `ConnectionPool` built from `DB_SERVER`, `DB_PORT`, `DB_INSTANCE`, `DB_DATABASE`, `DB_DRIVER`, `DB_TRUSTED_CONNECTION`, `DB_ENCRYPT` | MIGRATED |
| config/database.js | auth | user/password from env (SQL login) | `options.trustedConnection` → ODBC `Trusted_Connection=yes` (Windows Authentication). User/password only read when `DB_TRUSTED_CONNECTION=false`, never defaulted in. | MIGRATED |
| config/database.js | lazy pool | pool created at require time | lazy `getPool()`; a failed connect clears the cached promise so a **later attempt reconnects** (recovery after outage) | MIGRATED |
| config/database.js | `pool.execute(sql, params)` | mysql2 positional `?` binding, returns `[rows, fields]` | converts each `?` to a named marker `@p0…@pN` (skipping quoted literals), binds with `request.input('pN', value)`, returns `[rows]` | MIGRATED |
| config/database.js | `pool.getConnection()` | mysql2 pooled connection | `new Transaction(pool)` + `begin()`; wrapper exposes `execute/commit/rollback/release` | MIGRATED |
| config/database.js | `beginTransaction()` | `BEGIN` implicit on pool | `SET TRANSACTION ISOLATION LEVEL SERIALIZABLE; BEGIN TRAN` via `tx.begin(ISOLATION_LEVEL.SERIALIZABLE)` for stock-changing transactions | MIGRATED |
| config/database.js | `commit()` / `rollback()` | mysql2 | `COMMIT TRAN` / `ROLLBACK TRAN` through `mssql` Transaction | MIGRATED |
| config/database.js | `release()` | returns connection to pool | idempotent; rolls back an still-open transaction before releasing the borrowed connection | MIGRATED |
| config/database.js | `testConnection()` | `pool.getConnection()` (not called at startup) | `SELECT 1 AS connection_test` + `SELECT DB_NAME() AS database_name`; invoked at server startup and by `/api/health` | MIGRATED |
| config/database.js | `close()` | not present | `pool.close()` for clean shutdown | MIGRATED |
| config/database.js | error handling | mysql2 error codes (`ER_*`, `errno`) | normalized errors: connection-class failures → `statusCode 503` + message `Database unavailable: …`; query failures → `statusCode 500` + message `Database error: …`; original driver error preserved on `err.original` | MIGRATED |
| config/database.js | result shape | `[rows, fields]`, `rows[0]`, `result.insertId`, `result.affectedRows` | `[rows]` (array of row objects); insert ids read from `OUTPUT INSERTED.<pk>` rows; `affectedRows` not used anywhere in the codebase | MIGRATED |
| config/database.js | date handling | driver returns `DATE`/`DATETIME` as JS `Date` in server tz | unchanged behaviour expected from `msnodesqlv8`; **not yet verified against a live server** (date serialisation differences are tracked in §5) | BLOCKED |

### 2.2 Parameter binding and placeholders

| File | Function | MySQL behavior | SQL Server replacement | Status |
| --- | --- | --- | --- | --- |
| all repositories | every `pool.execute(query, params)` | positional `?` placeholders | `?` → `@pN` marker conversion in the central module; values bound with `request.input()`; **no value is ever concatenated into SQL** | MIGRATED |
| repositories | `update()` dynamic `SET ${field} = ?` | field names interpolated from an explicit allow-list | unchanged — allow-list still the only source of identifiers; values remain bound parameters | MIGRATED |
| repositories | `LIKE ?` with `` `%term%` `` | mysql2 binding | bound `NVarChar` parameter, implicit conversion; SQL injection surface unchanged (parameterized) | MIGRATED |

### 2.3 SQL function / syntax translation

| File | Function | MySQL behavior | SQL Server replacement | Status |
| --- | --- | --- | --- | --- |
| medicineRepository | `findAll`, `findById`, `findByExpiryStatus`, `getCount` | `CURDATE()` | `CAST(GETDATE() AS DATE)` | MIGRATED |
| medicineRepository | same | `DATE_ADD(CURDATE(), INTERVAL 30 DAY)` | `DATEADD(DAY, 30, CAST(GETDATE() AS DATE))` | MIGRATED |
| medicineRepository | `findByExpiryStatus` | `DATEDIFF(expiry, CURDATE())` (expiry − today) | `DATEDIFF(DAY, CAST(GETDATE() AS DATE), expiry_date)` (same direction: end − start) | MIGRATED |
| saleRepository | `createWithItems` | `INSERT … VALUES (?, NOW(), …)` | `INSERT … VALUES (?, SYSDATETIME(), …)`; `sale_date` column is `DATETIME2(0)` | MIGRATED |
| saleRepository | `getTodaySummary` | `WHERE DATE(s.sale_date) = CURDATE()` | `WHERE s.sale_date >= CAST(GETDATE() AS DATE) AND s.sale_date < DATEADD(DAY, 1, CAST(GETDATE() AS DATE))` (sargable, server-side "today", same semantics) | MIGRATED |
| all repositories | `findAll` pagination | `LIMIT ? OFFSET ?` appended after `ORDER BY` | `ORDER BY … OFFSET @p ROWS FETCH NEXT @p ROWS ONLY` | MIGRATED |
| all repositories | `findRecent` | `ORDER BY … LIMIT ?` | `ORDER BY … OFFSET 0 ROWS FETCH NEXT @p ROWS ONLY` | MIGRATED |
| medicine/supplier/customer `findAll` | ordering | `ORDER BY name/company_name/last_name, first_name` only | **deterministic tie-breaker `, id` added** because `OFFSET/FETCH` requires a stable order | MIGRATED |
| purchaseRepository | `findAll` | `GROUP BY p.id` with bare `p.*`/`s.*` columns (MySQL only-full-group-by-off) | **rejected by SQL Server** → replaced with a derived table `SELECT purchase_id, COUNT(*) … GROUP BY purchase_id` joined as `pi`; no `GROUP BY` on the outer query | MIGRATED |
| saleRepository, prescriptionRepository | `findAll`, `findRecent` | `CONCAT(first, ' ', last)` | `CONCAT(...)` exists in SQL Server 2012+; note MySQL `CONCAT` returns `NULL` for any `NULL` argument while SQL Server treats `NULL` as `''` — `first_name`/`last_name` are `NOT NULL`, so behaviour is identical | MIGRATED |

### 2.4 Row locking (concurrency)

| File | Function | MySQL behavior | SQL Server replacement | Status |
| --- | --- | --- | --- | --- |
| saleRepository | `createWithItems` medicine read | `SELECT … FROM medicines WHERE id = ? FOR UPDATE` | `SELECT … FROM medicines WITH (UPDLOCK, ROWLOCK) WHERE id = ?` inside a **SERIALIZABLE** transaction — U locks are held to commit, so a concurrent sale cannot read the same pre-decrement quantity (prevents overselling) | MIGRATED |
| purchaseRepository | `createWithItems` stock increment | plain `UPDATE … quantity = quantity + ?` | unchanged statement; runs in a **SERIALIZABLE** transaction, so it cannot interleave with a sale's locked read | MIGRATED |
| saleRepository | `createWithItems` stock decrement | `UPDATE … quantity = quantity - ?` | unchanged statement (server-side arithmetic, never a JS round-trip value) | MIGRATED |

Business purpose preserved: **X − Y exactly once, atomically, with no lost update and no oversell.** Live concurrency proof requires a real database (§5).

### 2.5 Insert identity

| File | Function | MySQL behavior | SQL Server replacement | Status |
| --- | --- | --- | --- | --- |
| medicineRepository | `create` | `result.insertId` | `INSERT INTO medicines (…) OUTPUT INSERTED.id VALUES (…)` → `rows[0].id` | MIGRATED |
| supplierRepository | `create` | `result.insertId` | `OUTPUT INSERTED.id` | MIGRATED |
| customerRepository | `create` | `result.insertId` | `OUTPUT INSERTED.id` | MIGRATED |
| saleRepository | `createWithItems` | `saleResult.insertId` | `OUTPUT INSERTED.id` | MIGRATED |
| purchaseRepository | `createWithItems` | `purchaseResult.insertId` | `OUTPUT INSERTED.id` | MIGRATED |
| prescriptionRepository | `createWithItems` | `prescriptionResult.insertId` | `OUTPUT INSERTED.id` | MIGRATED |

`OUTPUT INSERTED.<pk>` is safe here: the six tables with `updated_at` triggers have **AFTER UPDATE** triggers only, and none of the tables has an `INSTEAD OF INSERT` trigger, so the `OUTPUT` clause is not blocked.

### 2.6 Transactions and atomicity

| File | Function | MySQL behavior | SQL Server replacement | Status |
| --- | --- | --- | --- | --- |
| saleRepository | `createWithItems` | `beginTransaction/commit/rollback/release` | same call sequence on the SQL Server transaction wrapper; header + items + stock decrement still one atomic unit; post-commit `findById` still runs **after** `release()` so a read failure cannot double-rollback | MIGRATED (live proof BLOCKED) |
| purchaseRepository | `createWithItems` | same | same — header + items + stock increment atomic | MIGRATED (live proof BLOCKED) |
| prescriptionRepository | `createWithItems` | same | same — header + items atomic (no stock change by design) | MIGRATED (live proof BLOCKED) |

### 2.7 Backend / application files

| File | Function | MySQL behavior | SQL Server replacement | Status |
| --- | --- | --- | --- | --- |
| app.js | `/api/health` | liveness only, no DB check | reports `database.status`, `database.name`, `ready` after `testConnection()` | MIGRATED |
| server.js | startup | never touched the DB | calls `testConnection()` at boot and logs a **clear failure line** without substituting mocks | MIGRATED |
| package.json | deps | `mysql2` | `mssql` + `msnodesqlv8`; `mysql2` removed from the active runtime | MIGRATED |
| backend/.env.example | config | MySQL host/user/password | SQL Server placeholders: `DB_SERVER`, `DB_INSTANCE`, `DB_PORT`, `DB_DATABASE`, `DB_DRIVER`, `DB_TRUSTED_CONNECTION`, `DB_ENCRYPT` | MIGRATED |
| database/schema.sql, database/seed.sql | DDL/DML | MySQL DDL | kept **for reference only**; not the runtime schema | REFERENCE |
| database/mssql/*.sql | DDL/DML | — | active schema definition; verified in §4 | MIGRATED |

### 2.8 Frontend (false-success removal)

| File | Function | Previous behavior | New behavior | Status |
| --- | --- | --- | --- | --- |
| AppContext.jsx | `addMedicine`, `updateMedicine`, `addSupplier`, `updateSupplier`, `addCustomer`, `updateCustomer`, `addPrescription`, `createSale`, `receiveStock` | on API failure: local record + `max(id)+1` id + `success:true` + "(offline)" toast | **API-only writes**: any failure returns `success:false` + error toast; no local record, no generated id | MIGRATED |
| AppContext.jsx | `apiAvailableRef` | set `false` after one network error and never retried; all later writes skipped the API | every write/read **always attempts the API**; the flag only tracks display state and flips back to connected on the next success (then re-syncs server data) | MIGRATED |
| AppContext.jsx | initial state | business collections seeded from `data/mock*.js` and `localStorage` | business collections start empty and come from the API only; `activities` (a local UI feed, never business data) stays local | MIGRATED |
| AppContext.jsx | `getReceipt`, `getPrescriptionById`, `preparePrescriptionForBilling` | mixed fallback | reads may fall back to **already-loaded cached records** when the API is unreachable (display only, never a write); failures that reach the API are reported as failures | MIGRATED |
| AppContext.jsx | `INCREASE_STOCK` / `DECREASE_STOCK` | local stock patch | kept **only** as post-commit cache reconciliation after a *successful* server mutation whose follow-up stock refresh failed | MIGRATED |

---

## 3. Business rules preserved (no redesign)

- Sale prices are read from the locked database row; client-supplied `unit_price` is ignored (validator keeps it informational only).
- Sale rejects: unknown medicine, expired medicine, insufficient stock, non-positive quantity, duplicate medicine lines, invalid payment method.
- Sale atomically creates header + items + stock decrement; discount cannot exceed total.
- Purchase atomically creates header + items + stock increment.
- Prescription availability keeps returning `available` / `insufficient` / `out_of_stock` / `expired` with the same thresholds.
- `send-to-billing` still does not reduce stock and still filters to available, non-expired lines.

---

## 4. Schema verification (`database/mssql/`)

| Item | Finding |
| --- | --- |
| Tables | 9 — `medicines`, `suppliers`, `customers`, `purchases`, `purchase_items`, `prescriptions`, `prescription_items`, `sales`, `sale_items` |
| Primary keys | all 9 present (`INT IDENTITY(1,1)`) |
| Foreign keys | 7 — purchases→suppliers, purchase_items→purchases (CASCADE) /→medicines, prescriptions→customers, prescription_items→prescriptions (CASCADE) /→medicines, sales→customers (SET NULL), sale_items→sales (CASCADE) /→medicines |
| Identity | `IDENTITY(1,1)` on all PKs — matches the `OUTPUT INSERTED.id` strategy |
| CHECK constraints | stock ≥ 0, price ≥ 0, quantity > 0, amounts ≥ 0, discount ≥ 0 on the columns the code writes |
| Indexes | 13 guarded by `IF NOT EXISTS (… sys.indexes)` — script is rerunnable |
| Triggers | 6 `AFTER UPDATE` `updated_at` triggers (medicines, suppliers, customers, purchases, prescriptions, sales) with `TRIGGER_NESTLEVEL() > 1` guard; no `INSTEAD OF` triggers, so `OUTPUT INSERTED` on INSERT is safe |
| Seed data | guarded by `IF NOT EXISTS (SELECT 1 FROM …)`; expiry dates are `DATEADD(DAY, n, GETDATE())` — relative, so low-stock/expiry scenarios stay repeatable |
| Gaps vs current code | none blocking. `medicines.category` is nullable (code already tolerates it); no `products`/`orders`/`carts`/`users` tables — **not required by any implemented Stage-0 feature** and intentionally not added |

Combined script `pharmacy_management_mssql.sql` and the split `schema.sql` + `seed.sql` are equivalent in structure; `inspect-connection.sql` is read-only diagnostics.

**Not executed against any remote database.** No existing database was modified, created or dropped by this work.

---

## 5. Still blocked (needs the live server)

These cannot be answered without connecting the Node backend to the real database:

1. Server/instance reachability, Windows Authentication success, database existence → `SELECT 1 AS connection_test`.
2. DATE / DATETIME2 serialisation from `msnodesqlv8` into JavaScript (affects displayed dates only; all comparisons are done in SQL).
3. CREATE / READ / UPDATE / RESTART persistence evidence for a Medicine record.
4. Purchase `X + Y`, sale `X − Y`, and rollback-on-insufficient-stock proofs.
5. Concurrent oversell test (`UPDLOCK` + SERIALIZABLE) under two parallel sale requests.

Required input: see §7 of the Stage 0 report — the remote host name/IP, the instance name, and confirmation that the Windows account running Node exists on the SQL Server machine.

---

## 6. Commands

```bash
# backend
cp backend/.env.example backend/.env   # then fill DB_SERVER / DB_INSTANCE / DB_DATABASE
npm test                               # 13/13
npm start                              # logs "Database connected successfully" or a clear failure

# frontend
npm test                               # 9/9
npm run build                          # production build
```

---

## 7. Verification performed (2026-10-02)

| Gate item | Result |
| --- | --- |
| Backend tests | **23/23 PASS** — 13 original tests updated to SQL Server expectations + 10 new migration tests (`backend/test/sqlserver.test.js`) |
| Frontend tests | **9/9 PASS** |
| Frontend production build | **PASS** (1956 modules) |
| MySQL removed from runtime | PASS — `mysql2` uninstalled; a test scans every repository and `config/database.js` and fails if `FOR UPDATE`, `CURDATE(`, `DATE_ADD(`, `LIMIT ?`, `AUTO_INCREMENT`, `insertId`, `mysql2`, `pool.query(` or `ENGINE=InnoDB` reappears |
| Placeholder safety | PASS — `?` → `@pN` conversion unit-tested (literals/comments untouched); arity mismatch throws **before** any connection is opened |
| Unconfigured database | PASS — `pool.execute` rejects with **503 `Database unavailable: DB_SERVER is not set…`**, never with a success |
| API behaviour with no database | PASS — GETs 503, valid POST 503, invalid POST still 400, unknown route 404, `/api/health` truthful (`ready:false`, `database.status:'unreachable'`) |
| False-success removal | PASS — browser: error toast, no navigation, `localStorage` unchanged (only `pharmacy_activities*` keys), empty list. Evidence: [`docs/audits/stage-0b/db-failure-probes.txt`](../audits/stage-0b/db-failure-probes.txt) |
| Outage recovery | PASS (partial) — after killing and restarting the backend the frontend issued a fresh `POST /api/medicines`, confirmed in the restarted process log. Full "connected + data resync" proof needs a live database. |
| **Live connection / CRUD / transactions / rollback / concurrency** | **BLOCKED** — see §5 |

