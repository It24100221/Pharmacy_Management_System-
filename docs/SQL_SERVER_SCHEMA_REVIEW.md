# SQL Server schema review — Stage 0

Reviewed on 2026-10-02. The user supplied three files from Downloads; exact copies are preserved in `database/mssql/`. They establish the intended **Microsoft SQL Server** schema for **`pharmacy_management`**. They do not prove the scripts have been applied to a running server.

## Supplied files and provenance

| File | Purpose | SHA-256 of supplied file |
| --- | --- | --- |
| [schema.sql](../database/mssql/schema.sql) | Standalone SQL Server schema, indexes and timestamp triggers | `FD2E9D40DFEA5AE861C23083767E23F9EA60F9F5C3F03246E0B8324C56582829` |
| [seed.sql](../database/mssql/seed.sql) | Optional starter records for empty master tables | `0BD9067A67D50BA5D402E65D4775B9342B0FC8DE4896415AD835AC0B8CAD8D21` |
| [pharmacy_management_mssql.sql](../database/mssql/pharmacy_management_mssql.sql) | Combined, guarded schema/index creation, CREATE OR ALTER timestamp triggers, starter data and quick SELECT checks | `5EBCD644EA9633DFFBAB7D699EA5E4D48C4F116A0E6EA003D7233A344D89FCF6` |

Original source paths: `C:/Users/ASUS/Downloads/` followed by the filenames above. No SQL was executed, no tables were changed, and no data was imported. The pre-existing `database/schema.sql` and `database/seed.sql` are different **MySQL** files and were retained as historical source; they must not be confused with the supplied SQL Server versions.

## Confirmed schema

Both schema versions contain these nine entities with compatible column names for the current application's core model:

| Table | Primary key | Foreign keys |
| --- | --- | --- |
| `dbo.medicines` | `id INT IDENTITY(1,1)` | None |
| `dbo.suppliers` | `id INT IDENTITY(1,1)` | None |
| `dbo.customers` | `id INT IDENTITY(1,1)` | None |
| `dbo.purchases` | `id INT IDENTITY(1,1)` | supplier_id → suppliers.id |
| `dbo.purchase_items` | `id INT IDENTITY(1,1)` | purchase_id → purchases.id; medicine_id → medicines.id |
| `dbo.prescriptions` | `id INT IDENTITY(1,1)` | customer_id → customers.id |
| `dbo.prescription_items` | `id INT IDENTITY(1,1)` | prescription_id → prescriptions.id; medicine_id → medicines.id |
| `dbo.sales` | `id INT IDENTITY(1,1)` | nullable customer_id → customers.id |
| `dbo.sale_items` | `id INT IDENTITY(1,1)` | sale_id → sales.id; medicine_id → medicines.id |

Item-parent foreign keys cascade on parent deletion; medicine and supplier/customer references generally prevent deletion; sales.customer_id is set null when a customer is deleted. Money columns are DECIMAL, quantities are INT with checks, and date/timestamp columns use DATE/DATETIME2. Medicine IDs are shared through all three item tables. No separate product identity should be invented during the connection repair.

There are **six AFTER UPDATE triggers**, one on each master/header table with updated_at: medicines, suppliers, customers, purchases, prescriptions and sales. Each refreshes updated_at and guards recursion with TRIGGER_NESTLEVEL. **No supplied trigger inserts stock movements or increments/decrements stock.** There are no stored procedures or views in these files. The existing backend must still perform stock changes in its sale/purchase transactions, translated to SQL Server.

## Differences between the two SQL Server schema variants

- The standalone schema uses unconditional CREATE TABLE/INDEX/TRIGGER. Rerunning it against existing objects will fail.
- The combined script checks table/index existence and uses CREATE OR ALTER TRIGGER. It is more suitable as a bootstrap reference, but it is **not a migration tool**: existing table columns/constraints are not reconciled or updated.
- The combined script explicitly qualifies `dbo` and adds simple nullable email CHECK constraints on suppliers/customers. The standalone schema omits those email checks and mostly leaves schema qualification implicit. Live metadata must determine which variant was applied.
- Both seed variants insert the same three suppliers, seven medicines and three customers when each corresponding table is entirely empty. Existing populated master tables are left alone; partial fixture sets are not repaired.
- Expiry dates are relative to the day of first seeding. They are not refreshed by subsequent seed runs on nonempty tables. Seed medicines include low-stock, near-expiry and expired examples, but no zero-stock fixture. No purchase, prescription or sale history is seeded.
- Do not run both schema variants sequentially or rerun setup against the user's existing database without first inspecting its schema and intended environment.

## Backend compatibility work identified

| Current backend assumption | SQL Server integration requirement |
| --- | --- |
| mysql2/promise driver and MySQL pool configuration | SQL Server driver configured for the actual SSMS instance and authentication mode |
| Positional `?` values and `[rows]` / insertId results | Named, typed parameters and SQL Server recordset/identity handling |
| LIMIT/OFFSET and MySQL GROUP BY behavior | T-SQL pagination and explicit aggregate projections compatible with SQL Server |
| CURDATE, DATE_ADD, MySQL DATEDIFF, NOW and DATE(...) | Equivalent T-SQL date operations with a deliberate timezone/date policy |
| SELECT ... FOR UPDATE | SQL Server transaction isolation and update-lock semantics preserving oversell protection |
| MySQL begin/commit/rollback and connection release | SQL Server transaction ownership, rollback and connection lifecycle |
| Unnormalized returned DATE fields | Consistent date-only API values for HTML date inputs and expiry calculations |
| Blind successful health response | Real database readiness check and clear connection failures |

This is a defined Stage 0 stabilization task, not a new feature or authorization to skip the baseline gate. Existing CRUD routes and business flows should be preserved while connecting them to SQL Server.

## Connection check and remaining requirements

The user identified **SQLEXPRESS / Windows Authentication**, then clarified that **SQL Server is on another computer**. An earlier read-only check using the normal Windows execution context (outside the sandbox) to local `.\SQLEXPRESS`, database `pharmacy_management`, with encryption and certificate validation enabled, failed with **SQL Network Interfaces error 26: Error Locating Server/Instance Specified**. No local `MSSQL$SQLEXPRESS` service or SQL instance registry entry was discovered. That local result is consistent with the remote-host clarification; it is not a failed test of the actual remote server. The other computer's hostname/IP and full SSMS Server name are still pending. No credentials or security settings were changed.

- The other computer's hostname/IP and exact SSMS **Server name** (host and named instance, or host and TCP port).
- A reachable server that accepts the confirmed **Windows Authentication** from this computer.
- Confirmation the scripts are already applied to the development database, followed by read-only verification of the live tables, constraints, triggers and row counts.

The supplied scripts contain no server address, instance name, credentials or connection string. [inspect-connection.sql](../database/mssql/inspect-connection.sql) is a new, read-only diagnostic script that can be run in the user's working SSMS session to identify the machine, instance, authentication mode and live table/trigger metadata. It does not query customer records or secrets. Stage 0 remains **BLOCKED** until the application can connect and its existing operations can be tested against that database.

## Later-stage gaps (identified only)

The supplied schemas do not include users/roles, customer accounts, persistent carts/orders, supply requests, prescription uploads/status lifecycle, notifications, payment state or invoice identity. Those remain the sequenced Stage 1–6 work described in [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md). No such entities have been added during Stage 0.
