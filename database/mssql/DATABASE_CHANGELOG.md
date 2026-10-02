# SQL Server database changelog

## 002 — Public catalog product master (Stage 2)

File: `migrations/002_extend_products_for_public_catalog.sql`. Run after the core schema, seed data and migration 001. The existing `dbo.medicines` row remains the single product master so current sales, purchase and prescription foreign keys keep their numeric `medicines.id` links. New `product_code` is a separate permanent business ID (required, unique, uppercase alphanumeric with hyphens; protected by an UPDATE trigger). New `product_type` is constrained to Medicine, Baby Items, Lab Items or Medical Accessories, while existing `category` remains an optional subcategory. `image_url` stores an image reference, `requires_prescription` marks controlled items, and `is_active` controls public visibility. `expiry_date` becomes nullable for non-medicines, with a CHECK keeping it required for Medicine. A catalog index covers active/type/name browsing.

The seven distributed seed rows receive fixed codes P001–P007 using their exact original name and batch. These opaque codes do not encode a category. The script stops if any other row lacks a code or codes collide; agree on shared codes for additional local rows, update those rows explicitly, then rerun. It never derives a code from a machine-local identity value. Existing medicines default to `requires_prescription = 1` conservatively; a pharmacist should review and correct each flag. New items are created through the inventory form with an assigned code. No image binaries are stored in SQL Server. The migration is guarded for reruns, but take a backup first and verify it on each team member's own instance.

## 001 — User authentication foundation (Stage 1)

File: `migrations/001_add_users_authentication.sql`. Run after the nine-table core schema. It adds `dbo.users` with an integer identity, unique username and email, bcrypt password hash, one of the five approved roles, active/disabled status, and timestamps. Nullable, unique `customer_id` and `supplier_id` foreign keys link an account to the existing domain records without copying customer or supplier details into `users`. Customer registration inserts a customer and account in one transaction. The CHECK constraint requires a customer link for a CUSTOMER account and prohibits customer links on staff accounts. No ADMIN role is created.

The script guards table and index creation so it can be rerun. It does not seed passwords. Existing customer rows are unchanged; creating a login for an existing customer requires a deliberate identity reconciliation and is not automated by public registration.

## Team environment verification

Live SQL Server verification is deferred to each member's own instance. The checked-in Node tests run without a database. On a local instance, verify registration, unique conflicts, login, `/api/auth/me`, role denials, restart persistence, purchase/sale stock changes, and rollback. Record results before claiming live acceptance.
