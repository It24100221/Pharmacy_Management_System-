# MSSQL Insert Audit

Phase A1 audit against the live `pharmacy_management` SQL Server schema.

The database adapter no longer injects an `OUTPUT INSERTED.id` clause. Runtime repositories that need a generated key now specify the schema-defined key explicitly and alias it to the adapter-neutral `insertId` result property. Inserts that do not consume a generated key do not include an `OUTPUT` clause.

| Table | Primary key | Repository/function | Insert SQL | Returned ID needed? | Correct `OUTPUT INSERTED` column | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `medicines` | `id` | `MedicineRepository.create` | `INSERT INTO medicines (...) OUTPUT INSERTED.id AS insertId VALUES (...)` | Yes | `id` | Fixed and live API verified |
| `suppliers` | `id` | `SupplierRepository.create` | `INSERT INTO suppliers (...) OUTPUT INSERTED.id AS insertId VALUES (...)` | Yes | `id` | Fixed and live API verified |
| `customers` | `id` | `CustomerRepository.create` | `INSERT INTO customers (...) OUTPUT INSERTED.id AS insertId VALUES (...)` | Yes | `id` | Fixed and live API verified |
| `customers` | `id` | `AuthRepository.createCustomer` | `INSERT INTO customers (...) OUTPUT INSERTED.id AS insertId VALUES (...)` | Yes | `id` | Fixed and registration verified |
| `purchases` | `id` | `PurchaseRepository.createWithItems` | `INSERT INTO purchases (...) OUTPUT INSERTED.id AS insertId VALUES (...)` | Yes | `id` | Fixed; transaction tests pass |
| `purchase_items` | `id` | `PurchaseRepository.createWithItems` | `INSERT INTO purchase_items (...) VALUES (...)` | No | None | Correct; no generated key consumed |
| `prescriptions` | `id` | `PrescriptionRepository.createWithItems` | `INSERT INTO prescriptions (...) OUTPUT INSERTED.id AS insertId VALUES (...)` | Yes | `id` | Fixed; repository path audited |
| `prescription_items` | `id` | `PrescriptionRepository.createWithItems` | `INSERT INTO prescription_items (...) VALUES (...)` | No | None | Correct; no generated key consumed |
| `sales` | `id` | `SaleRepository.createWithItems` | `INSERT INTO sales (...) OUTPUT INSERTED.id AS insertId VALUES (...)` | Yes | `id` | Fixed; transaction tests pass |
| `sale_items` | `id` | `SaleRepository.createWithItems` | `INSERT INTO sale_items (...) VALUES (...)` | No | None | Correct; no generated key consumed |
| `users` | `user_id` | `AuthRepository.createCustomer` | `INSERT INTO users (...) OUTPUT INSERTED.user_id AS insertId VALUES (...)` | Yes | `user_id` | Fixed and registration verified |
| `staff` | `staff_id` | Bootstrap SQL only (`seed.sql`, `staff_default_users.sql`) | `INSERT INTO staff (...) SELECT ...` | No | None | Audited; no active API insert or generated key consumer |
| `prescription_uploads` | `prescription_id` | `PrescriptionRepository.createUpload` | `INSERT INTO prescription_uploads (...) OUTPUT INSERTED.prescription_id AS insertId VALUES (...)` | Yes | `prescription_id` | Fixed and live API verified |

## Bootstrap SQL

The seed and staff bootstrap scripts insert `suppliers`, `users`, `staff`, `medicines`, and `customers` without consuming generated IDs from the database adapter. Their set-based inserts therefore correctly omit `OUTPUT` clauses. These scripts do not run through the Node.js query adapter.

## Live schema evidence

The live primary keys were read from `sys.tables`, `sys.indexes`, `sys.index_columns`, and `sys.columns`:

- `id`: `medicines`, `suppliers`, `customers`, `purchases`, `purchase_items`, `prescriptions`, `prescription_items`, `sales`, `sale_items`
- `user_id`: `users`
- `staff_id`: `staff`
- `prescription_id`: `prescription_uploads`

Phase A1 live verification confirmed that the API-returned keys matched directly queried SQL Server rows for medicine, supplier, customer, registered user/profile, and prescription-upload metadata inserts.
