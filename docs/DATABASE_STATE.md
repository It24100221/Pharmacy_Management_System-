# SQL Server Database State and Drift Map

Phase: Business Foundation B1

Inventory date: 2026-10-03

Inventory command: `cd backend; npm run inventory:database`

No credentials or passwords are included in this document.

## Server and migration state

| Property | Live value |
|---|---|
| Database | `pharmacy_management` |
| SQL Server product version | `17.0.1135.8` |
| Product level | RTM |
| Edition | Express Edition (64-bit) |
| Migration table | `dbo.schema_migrations` |
| Applied migration 1 | `001_baseline_existing_database` |
| Applied migration 2 | `002_prescription_file_storage` |
| Applied migration 3 | `003_product_catalog_foundation` |

Migration 001 is an honest baseline marker: it verifies the known A1/A2 core tables already exist and records that inventoried state. It does not claim the historical monolithic script was executed. Migration 002 adds managed prescription-file storage metadata. Migration 003 adds the B1 product/category foundation. Re-running the migration runner skipped all three applied records successfully.

## B1 catalogue evidence

The four relational category records are `MEDICINE / Medicine`, `BABY_ITEMS / Baby Items`, `LAB_ITEMS / Lab Items`, and `MEDICAL_ACCESSORIES / Medical Accessories`. Category code and display name are independently unique.

| Medicine ID | Medicine name | Product ID | Permanent code | Catalogue category |
|---:|---|---:|---|---|
| 1 | Amoxicillin 500mg Capsules (100pcs) | 1 | `P0000000001` | Medicine |
| 2 | Paracetamol 500mg Tablets (100pcs) | 2 | `P0000000002` | Medicine |
| 3 | Omeprazole 20mg Capsules (30pcs) | 3 | `P0000000003` | Medicine |

Direct SQL and live API checks matched these three records for code, name, category, price, stock, and availability. The frontend catalogue normalizer/rendering model has the same three-value equality fixture. The live verifier also proved the first code through medicine inventory, historical purchase, prescription, and sale receipt representations.

## Tables, columns, and row counts

These are post-B1 counts after every reversible verifier row was removed. Medicines and all historical item counts are unchanged from the pre-B1 baseline.

| Table | Columns | Rows |
|---|---|---:|
| `categories` | `category_id int identity`, `category_code nvarchar(50)`, `category_name nvarchar(120)`, `is_active bit`, `created_at datetime2` | 4 |
| `customers` | `id int identity`, `first_name nvarchar(100)`, `last_name nvarchar(100)`, `email nvarchar(255) null`, `phone nvarchar(50) null`, `address nvarchar(max) null`, `date_of_birth date null`, `created_at datetime2`, `updated_at datetime2`, `user_id int null` | 4 |
| `medicines` | `id int identity`, `name nvarchar(255)`, `description nvarchar(max) null`, `generic_name nvarchar(255) null`, `manufacturer nvarchar(255) null`, `category nvarchar(100) null`, `batch_number nvarchar(100) null`, `quantity int`, `unit_price decimal(10,2)`, `expiry_date date`, `min_stock_level int`, `created_at datetime2`, `updated_at datetime2` | 10 |
| `prescription_items` | `id int identity`, `prescription_id int`, `medicine_id int`, `quantity int`, `instructions nvarchar(max) null`, `created_at datetime2` | 9 |
| `prescription_uploads` | `prescription_id int identity`, `customer_id int`, `image nvarchar(500) null`, `doctor_name nvarchar(200) null`, `notes nvarchar(max) null`, `status nvarchar(20)`, `uploaded_date datetime2`, `original_filename nvarchar(255) null`, `stored_filename nvarchar(255) null`, `storage_path nvarchar(500) null`, `mime_type nvarchar(100) null`, `file_size bigint null` | 0 |
| `prescriptions` | `id int identity`, `customer_id int`, `prescription_date date`, `instructions nvarchar(max) null`, `notes nvarchar(max) null`, `created_at datetime2`, `updated_at datetime2` | 9 |
| `products` | `product_id int identity`, computed persisted `product_code nvarchar(11)`, `category_id int`, `medicine_id int null`, standalone name/description/price/quantity/min-stock fields, prescription/active flags, image metadata/path fields, timestamps | 10 |
| `purchase_items` | `id int identity`, `purchase_id int`, `medicine_id int`, `quantity int`, `unit_cost decimal(10,2)`, `total_cost decimal(12,2)` | 6 |
| `purchases` | `id int identity`, `supplier_id int`, `purchase_date date`, `total_amount decimal(12,2)`, `notes nvarchar(max) null`, `created_at datetime2`, `updated_at datetime2` | 6 |
| `sale_items` | `id int identity`, `sale_id int`, `medicine_id int`, `quantity int`, `unit_price decimal(10,2)`, `line_total decimal(12,2)` | 5 |
| `sales` | `id int identity`, `sale_date datetime2`, `customer_id int null`, `total_amount decimal(12,2)`, `discount decimal(10,2)`, `final_amount decimal(12,2)`, `payment_method nvarchar(50)`, `notes nvarchar(max) null`, `created_at datetime2`, `updated_at datetime2` | 5 |
| `schema_migrations` | `migration_id int`, `migration_name nvarchar(255)`, `applied_at datetime2` | 3 |
| `staff` | `staff_id int identity`, `user_id int`, `staff_name nvarchar(200)`, `staff_role nvarchar(20)`, `email nvarchar(255) null`, `phone nvarchar(50) null` | 5 |
| `suppliers` | `id int identity`, `company_name nvarchar(255)`, `contact_person nvarchar(255) null`, `email nvarchar(255) null`, `phone nvarchar(50) null`, `address nvarchar(max) null`, `created_at datetime2`, `updated_at datetime2` | 5 |
| `users` | `user_id int identity`, `username nvarchar(100)`, `password nvarchar(255)`, `role nvarchar(20)`, `created_date datetime2` | 5 |

## Primary and unique keys

All application identity tables have their expected single-column primary key. SQL Server generated several physical names when the original tables were created.

| Table | Key |
|---|---|
| `categories` | PK `PK_categories` (`category_id`); unique `UQ_categories_code`; unique `UQ_categories_name` |
| `customers` | PK `PK__customer__3213E83F8ADD08FD` (`id`); filtered unique index `UQ_customers_user` (`user_id`) |
| `medicines` | PK `PK__medicine__3213E83F291EC921` (`id`) |
| `prescription_items` | PK `PK__prescrip__3213E83F828B39AB` (`id`) |
| `prescription_uploads` | PK `PK__prescrip__3EE444F8321C66E5` (`prescription_id`); filtered unique index `UQ_prescription_uploads_stored_filename` (`stored_filename`) |
| `prescriptions` | PK `PK__prescrip__3213E83F389BF610` (`id`) |
| `products` | PK `PK_products` (`product_id`); unique index `UQ_products_product_code`; filtered unique index `UQ_products_medicine` |
| `purchase_items` | PK `PK__purchase__3213E83F50016541` (`id`) |
| `purchases` | PK `PK__purchase__3213E83F8292F56C` (`id`) |
| `sale_items` | PK `PK__sale_ite__3213E83F73C853DD` (`id`) |
| `sales` | PK `PK__sales__3213E83F4F64CF6F` (`id`) |
| `schema_migrations` | PK `PK_schema_migrations` (`migration_id`); unique `UQ_schema_migrations_name` (`migration_name`) |
| `staff` | PK `PK__staff__1963DD9CFF42DCA8` (`staff_id`); unique `UQ__staff__B9BE370EFD06D000` (`user_id`) |
| `suppliers` | PK `PK__supplier__3213E83F223B8941` (`id`) |
| `users` | PK `PK__users__B9BE370F61C27F84` (`user_id`); unique `UQ__users__F3DBC572535B5001` (`username`) |

## Foreign keys

| Constraint | Relation | Delete action |
|---|---|---|
| `FK_products_category` | `products.category_id -> categories.category_id` | NO ACTION |
| `FK_products_medicine` | `products.medicine_id -> medicines.id` | NO ACTION |
| `FK_customer_workflow_upload_customer` | `prescription_uploads.customer_id -> customers.id` | NO ACTION |
| `FK_customers_user` | `customers.user_id -> users.user_id` | SET NULL |
| `FK_prescription_items_medicine` | `prescription_items.medicine_id -> medicines.id` | NO ACTION |
| `FK_prescription_items_prescription` | `prescription_items.prescription_id -> prescriptions.id` | CASCADE |
| `FK_prescriptions_customer` | `prescriptions.customer_id -> customers.id` | NO ACTION |
| `FK_purchase_items_medicine` | `purchase_items.medicine_id -> medicines.id` | NO ACTION |
| `FK_purchase_items_purchase` | `purchase_items.purchase_id -> purchases.id` | CASCADE |
| `FK_purchases_supplier` | `purchases.supplier_id -> suppliers.id` | NO ACTION |
| `FK_sale_items_medicine` | `sale_items.medicine_id -> medicines.id` | NO ACTION |
| `FK_sale_items_sale` | `sale_items.sale_id -> sales.id` | CASCADE |
| `FK_sales_customer` | `sales.customer_id -> customers.id` | SET NULL |
| `FK_staff_user_migration` | `staff.user_id -> users.user_id` | CASCADE |

## Non-primary indexes

| Table | Indexes |
|---|---|
| `products` | `IX_products_category_active(category_id, is_active)`, unique `UQ_products_product_code(product_code)`, filtered unique `UQ_products_medicine(medicine_id)` |
| `customers` | `IX_customers_name(last_name, first_name)`, `IX_customers_phone(phone)`, filtered unique `UQ_customers_user(user_id)` |
| `medicines` | `IX_medicines_category(category)`, `IX_medicines_expiry(expiry_date)`, `IX_medicines_name(name)`, `IX_medicines_quantity(quantity)` |
| `prescription_uploads` | `IX_prescription_uploads_customer(customer_id)`, filtered unique `UQ_prescription_uploads_stored_filename(stored_filename)` |
| `prescriptions` | `IX_prescriptions_customer(customer_id)`, `IX_prescriptions_date(prescription_date)` |
| `purchases` | `IX_purchases_date(purchase_date)`, `IX_purchases_supplier(supplier_id)` |
| `sales` | `IX_sales_customer(customer_id)`, `IX_sales_date(sale_date)` |
| `staff` | unique `UQ__staff__B9BE370EFD06D000(user_id)` |
| `suppliers` | `IX_suppliers_company(company_name)` |
| `users` | unique `UQ__users__F3DBC572535B5001(username)` |

## CHECK constraints

| Table | Constraints |
|---|---|
| `categories` | `CK_categories_code_upper` |
| `medicines` | `CK_medicines_min_stock >= 0`, `CK_medicines_quantity >= 0`, `CK_medicines_unit_price >= 0` |
| `prescription_items` | `CK_prescription_items_quantity > 0` |
| `prescription_uploads` | `CK_customer_workflow_upload_status` (`PENDING/APPROVED/REJECTED/COMPLETED`); `CK_prescription_uploads_file_size` (`1..10485760` or null); `CK_prescription_uploads_mime_type` (JPEG/PNG or null); `CK_prescription_uploads_file_metadata` (all metadata null for legacy or all present); `CK_prescription_uploads_storage_path` (managed relative prefix; no `..`, backslash, or colon) |
| `products` | exclusive medicine/standalone backing; non-negative standalone price/quantity/min-stock; image metadata all-null/all-present; JPEG/PNG; `1..5242880` bytes; managed `products/` relative paths only |
| `purchase_items` | quantity `> 0`; unit and total cost `>= 0` |
| `purchases` | total `>= 0` |
| `sale_items` | quantity `> 0`; unit price and line total `>= 0` |
| `sales` | total, discount, and final amount `>= 0` |
| `users` | `CK_users_role_migration` permits `CUSTOMER`, `ADMIN`, `PHARMACIST`, `INVENTORY`, `SALES`, `SUPPLIER` |

All listed checks are enabled and trusted. There is no live `CK_staff_role`; this drift is recorded below rather than silently changed in A3.

## Update triggers

All are enabled:

- `trg_customers_updated_at`
- `trg_medicines_updated_at`
- `trg_medicines_product_mapping`
- `trg_prescriptions_updated_at`
- `trg_products_updated_at`
- `trg_purchases_updated_at`
- `trg_sales_updated_at`
- `trg_suppliers_updated_at`

## Default constraints

Named defaults match the core schema and A3 storage state. B1 adds category active/time defaults and product prescription/active/time defaults. Live auto-named defaults remain on `users.created_date`, `prescription_uploads.status`, and `prescription_uploads.uploaded_date`.

## Schema/script versus live classification

The comparison included `database/schema.sql`, `database/seed.sql`, `database/staff_default_users.sql`, `database/customer_workflow.sql`, `database/foundation_stabilization_a1.sql`, and all `database/mssql/migrations/*.sql` files.

| Object(s) | Classification | Notes |
|---|---|---|
| Core tables `medicines`, `suppliers`, `customers`, `purchases`, `purchase_items`, `prescriptions`, `prescription_items`, `sales`, `sale_items` and their listed PKs/FKs/indexes/checks/defaults | `DEPLOYED_AND_MATCHES` | Logical definitions match the checked-in SQL Server core schema. Physical names generated by SQL Server are documented above. |
| `users`, `staff`, customer-user link, role records | `DEPLOYED_AND_MATCHES` against `staff_default_users.sql` | The deployed migration variants use names ending in `_migration`. |
| Six core `trg_*_updated_at` triggers | `DEPLOYED_AND_MATCHES` | Match `foundation_stabilization_a1.sql`; B1 separately adds the product timestamp and medicine-mapping triggers. |
| `schema_migrations`, its PK/unique/default constraints, and history rows 001/002/003 | `DEPLOYED_AND_MATCHES` | Created and controlled by the checked-in runner. |
| A3 upload metadata columns, constraints, and indexes | `DEPLOYED_AND_MATCHES` | Match migration 002. |
| `prescription_uploads` compared with historical `schema.sql` | `DEPLOYED_BUT_DIFFERS` | Live includes A3 metadata; legacy `image` is nullable; status also permits `COMPLETED` from `customer_workflow.sql`. This is intentional and non-destructive. |
| `staff` compared with monolithic `schema.sql` | `DEPLOYED_BUT_DIFFERS` | The live table has no `CK_staff_role`; the safer historical staff migration never added it. A3 does not change unrelated staff schema. |
| Constraint names `CK_users_role`, `FK_staff_user`, `FK_prescription_upload_customer`, `CK_prescription_upload_status` from monolithic `schema.sql` | `OBSOLETE` variants | Equivalent live relationships/checks use the migration/customer-workflow names documented above. They must not be added as duplicates. |
| Legacy `prescription_uploads.image` storage design and JSON/base64 write path in `schema.sql`/`customer_workflow.sql` | `OBSOLETE` | Column retained nullable for compatibility; new application code never writes it. |
| B1 `categories`, `products`, `v_product_catalog`, indexes, checks, FKs, and triggers | `DEPLOYED_AND_MATCHES` | Migration 003 is applied. Ten existing medicines map one-to-one without changing medicine IDs. |
| Historical `categories`/`products` definitions in `database/schema.sql` | `OBSOLETE` | Their duplicate name/price/quantity design was not deployed; migration 003 is authoritative. |
| `carts`, `cart_items`, `orders`, `order_items` and related objects | `SCRIPTED_BUT_NOT_DEPLOYED` / `PENDING FUTURE MIGRATIONS` | Explicitly excluded from B1 and absent from the live database. |
| Additional user application tables, indexes, checks, FKs, views, or triggers | `LIVE_ONLY`: none | The complete live B1 additions are represented by migration 003 and documented above. |

## Compatibility and safety decisions

- `database/schema.sql` is a historical/bootstrap reference and is not safe to replay over this database.
- Existing upload rows would retain their legacy `image` value and null metadata. The live database had zero such rows at migration time.
- Migration 002 never drops a column/table or overwrites a row. Its DDL is guarded by `COL_LENGTH`, `sys.check_constraints`, and `sys.indexes` checks.
- Each migration executes inside its own SQL transaction and is recorded only after commit. A failed first compilation of migration 002 rolled back fully and was not recorded; after correcting the batch boundary it applied once.
- Future changes must be added as new ordered migrations. Already recorded migration files must not be renamed or repurposed.
- `products.product_code` is a persisted computed value derived from immutable `product_id` (`P` plus ten digits), protected by a unique index and not accepted from clients.
- Medicine-backed catalogue name, price, stock, threshold, and expiry are projected live from `medicines` through `v_product_catalog`; no competing B1 values were copied.
- B1 verification preserved 10 medicines, 6 purchase items, 5 sale items, and 9 prescription items, and confirmed zero cart/order tables.
