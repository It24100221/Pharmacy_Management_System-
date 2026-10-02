# Team SQL Server update guide

1. Back up your local `pharmacy_management` development database in SSMS.
2. If it is a new database, run `pharmacy_management_mssql.sql` in SSMS. For an existing database with the nine core tables, leave them intact.
3. Run `migrations/001_add_users_authentication.sql` in SSMS. It is rerunnable and adds no demo account automatically.
4. Create a private `backend/.env` from `backend/.env.example`. Set your own `DB_SERVER`, `DB_INSTANCE` (if needed), `DB_DATABASE`, `DB_DRIVER`, and a randomly generated `AUTH_JWT_SECRET` of at least 32 characters. Keep `.env` out of Git. Windows Authentication uses the Windows identity of the Node process and requires a database login with appropriate permissions.
5. From `backend/`, run `npm install` and `npm start`. The health endpoint reports database readiness. Register a customer through `/register`; it creates both `customers` and `users` rows in one transaction.
6. Create staff accounts locally with `node scripts/createStaffAccount.js ROLE username email`, where ROLE is `PRESCRIPTION_STAFF`, `SUPPLIER`, `INVENTORY_STAFF`, or `SALES_STAFF`. The tool prompts privately for a password and stores a bcrypt hash. Give each demo staff member a distinct account. No plaintext credentials are committed. A supplier account can be linked to an existing supplier row by an authorized local SQL update to `users.supplier_id` after provisioning.
7. Verify the schema with the read-only queries below, then test login and each role's allowed and forbidden API routes. Check data after backend restart. Complete the Stage 0C checks on your own SQL Server instance.

```sql
USE pharmacy_management;
SELECT name FROM sys.tables WHERE name IN (N'users', N'customers', N'suppliers');
SELECT name FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.users');
SELECT u.id, u.username, u.email, u.role, u.account_status, u.customer_id, u.supplier_id
FROM dbo.users AS u ORDER BY u.id;
SELECT c.id, c.first_name, c.last_name, u.username
FROM dbo.customers AS c LEFT JOIN dbo.users AS u ON u.customer_id = c.id
ORDER BY c.id;
-- Do not select or export password_hash in routine checks.
```

Session model: the backend signs an 8-hour HS256 bearer token containing only a user ID; each protected request reloads the role and account status from SQL Server. The React app keeps the token in `sessionStorage`, sends it in the Authorization header, restores it through `/api/auth/me`, and removes it on logout. Logout ends this browser session; issued tokens remain valid until expiry if copied elsewhere, so keep the token private. TLS is required outside localhost. Rotate `AUTH_JWT_SECRET` to invalidate all outstanding tokens. The frontend does not decide role authority; backend route middleware does.

Role access: Inventory Staff can edit medicines and supplier records; Supplier can view suppliers and receive stock; Prescription Staff can manage customer/prescription records; Sales Staff can use sales APIs and read medicine/customer information needed by POS; Customer cannot access staff APIs. All business APIs require authentication. Prescription Staff prepares a persisted prescription and gives its ID to Sales Staff; Sales Staff loads currently available items through a sales-only endpoint. This preserves the existing handoff without granting Sales Staff prescription-management access. The public home/items pages do not query inventory directly yet; the customer catalog belongs to Stage 2.

Known pre-existing gaps remain tracked in `docs/IMPLEMENTATION_STATUS.md`: purchase/sale request idempotency, today-summary revenue multiplication, incomplete prescription-to-sale lifecycle, and broader validation hardening.
