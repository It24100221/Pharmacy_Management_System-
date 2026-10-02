# SQL Server database changelog

## 001 — User authentication foundation (Stage 1)

File: `migrations/001_add_users_authentication.sql`. Run after the nine-table core schema. It adds `dbo.users` with an integer identity, unique username and email, bcrypt password hash, one of the five approved roles, active/disabled status, and timestamps. Nullable, unique `customer_id` and `supplier_id` foreign keys link an account to the existing domain records without copying customer or supplier details into `users`. Customer registration inserts a customer and account in one transaction. The CHECK constraint requires a customer link for a CUSTOMER account and prohibits customer links on staff accounts. No ADMIN role is created.

The script guards table and index creation so it can be rerun. It does not seed passwords. Existing customer rows are unchanged; creating a login for an existing customer requires a deliberate identity reconciliation and is not automated by public registration.

## Team environment verification

Live SQL Server verification is deferred to each member's own instance. The checked-in Node tests run without a database. On a local instance, verify registration, unique conflicts, login, `/api/auth/me`, role denials, restart persistence, purchase/sale stock changes, and rollback. Record results before claiming live acceptance.
