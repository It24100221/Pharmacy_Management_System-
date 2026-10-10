# Final Viva Preparation

## General

**What is the project?** A role-based pharmacy management system for Senevirathna Medical Pharmacy.

**What problem does it solve?** It connects stock, purchasing, billing, customers, and prescriptions so staff do not rely on disconnected manual records.

**What are the four epics?** Medicine/inventory, supplier/purchase, sales/billing, and prescription/customer management.

**How are they integrated?** Purchases add verified stock, POS sales consume it, and approved customer prescriptions carry their customer and prescription references into billing.

## Frontend

**Why React and Vite?** React divides the interface into reusable components; Vite gives a fast development server and production build.

**Props and state?** Props are inputs from a parent component; state is data a component owns and updates, such as a cart or loading flag.

**What happens on submit?** The component validates the form, calls an Axios service, the API authenticates and validates again, then the repository commits a SQL transaction and the UI refreshes.

## Backend

**Why Node.js and Express?** They provide a small HTTP API with clear middleware, routes, controllers, and asynchronous database calls.

**What is middleware?** A function that runs during a request, for example JWT authentication, role authorization, JSON parsing, or error handling.

**How is data validated?** Frontend checks improve feedback; backend validators enforce types, ranges, dates, duplicate lines, and business rules before repository code runs.

## Database and inventory

**Why SQL Server?** It supports relational integrity, transactions, foreign keys, and the SQL Server environment used by the project.

**What is a transaction?** A group of operations that commits together or rolls back together. A sale therefore cannot reduce stock without its sale and movement records.

**What is FEFO?** First Expire, First Out: eligible non-expired batches are allocated in expiry-date order.

**How are duplicate sales prevented?** Idempotency keys and locked rows make retries return the existing result; stock is deducted once.

**Why batches?** Batch number and expiry date make recalls, expiry checks, and FEFO allocation possible. Legacy aggregate stock is kept explicit until it can be reconciled.

## Prescription module

**How is a prescription approved?** A pharmacist opens the SQL-backed review queue, previews a protected upload, and changes the lifecycle status. Approval creates a durable billing handoff.

**How is DISPENSED set?** A successful authorized Cash sale validates the exact prescription medicines and quantities, creates the sale/invoice/payment, and updates the prescription in the same transaction.

**What prevents double dispensing?** Locked status checks reject already dispensed prescriptions and idempotency prevents repeated sale effects.

**How is a normal Cash POS sale accounted for?** The sale transaction creates a customer invoice and a confirmed internal Cash payment, then the receipt reads the persisted sale and invoice records.

## Project management and testing

**How was quality checked?** Unit tests cover validators, repositories, FEFO and payment logic; API audits check status/authorization without mutating the shared database; browser smoke tests cover routes, labels, responsive layouts, and safe controls; an isolated SQL Server demo was exercised end to end.

**What are the limitations?** External payment/email/SMS, malware scanning, refunds, and disposable-database concurrency tests are not claimed as complete.

**What would you implement next?** A repeatable disposable demo seed/reset process, legacy-stock reconciliation, broader live integration tests, and provider-backed notifications and payments.

