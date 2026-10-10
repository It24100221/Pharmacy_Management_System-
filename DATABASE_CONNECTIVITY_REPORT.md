# Database Connectivity Report

Verification timestamp: 2026-10-10 00:34 +05:30  
Database name: `pharmacy_management`  
Credentials: intentionally omitted

## Connectivity result

**CONNECTED** to Microsoft SQL Server Express 17.0.1135.8 (64-bit). The application uses `mssql` 11.0.2 and a connection pool. The live health endpoint executed `SELECT 1 AS ready` and returned HTTP 200 with `database: connected`.

No MySQL driver is installed and no MySQL connection code was found.

## Live schema state

| Item | Live result |
|---|---:|
| User tables | 19 |
| Enabled foreign keys | 24 |
| Enabled CHECK constraints | 35 |
| Enabled table triggers | 11 |
| Applied migrations | 9 |

Applied migrations (001-009; all reported already applied by the latest idempotent migration run):

1. `001_baseline_existing_database`
2. `002_prescription_file_storage`
3. `003_product_catalog_foundation`
4. `004_customer_registration_integrity`
5. `005_customer_order_workflow`
6. `006_operational_domains`
7. `007_prescription_lifecycle`
8. `008_transaction_idempotency`
9. `009_prescription_sale_link`

Live tables: `users`, `staff`, `customers`, `medicines`, `categories`, `products`, `suppliers`, `purchases`, `purchase_items`, `sales`, `sale_items`, `prescriptions`, `prescription_items`, `prescription_uploads`, `carts`, `cart_items`, `orders`, `order_items`, and `schema_migrations`.

## Commands executed

```powershell
npm.cmd run inventory:database
npm.cmd run migrate
npm.cmd run verify:api-readonly
Invoke-WebRequest http://127.0.0.1:5000/api/health
```

`npm.cmd run migrate` reported all five migrations already applied; no schema mutation was performed.

## Transaction and consistency evidence

- Unit tests verified locked database price selection, one stock decrement, expired-medicine rollback, purchase stock increment, post-commit handling, and explicit transaction commit/rollback behavior.
- The final live API verifier captured counts for carts, orders, medicines, sales, purchases, customers, suppliers, prescriptions, and uploads plus total medicine quantity before and after 72 requests. The snapshots matched exactly (`database_writes: 0`).
- Live SQL reads confirmed primary/foreign-key, index, CHECK-constraint, and trigger metadata.

## Important cleanup hold

During the initial validation probe, two inputs expected to fail were accepted by the old permissive numeric validators and committed:

| Record | Test timestamp | Effect |
|---|---|---|
| Sale `24` | 2026-10-09 15:55:26 +05:30 | Medicine 1 quantity −2 |
| Purchase `17` | 2026-10-09 15:55:26 +05:30 | Medicine 1 quantity +1 |

Net medicine 1 stock effect: **−1**. These exact records were identified read-only. They have not been deleted or reversed because the task explicitly requires permission before record deletion. Cleanup is pending user approval.

## What remains NOT VERIFIED

- CRUD and workflow tests were not run in a newly created isolated database.
- Successful live create/update/delete tests were not run after the cleanup hold.
- Actual concurrent SQL sessions were not used to race stock/payment operations.
- Notification, payment, supplier invoice, and inventory-history tables do not exist.

