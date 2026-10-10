# Final Demo Test Results

Date: 2026-10-10 (Asia/Colombo)

Machine-readable evidence: `qa-audit/evidence/final-demo-workflow.json`.

Continuation evidence for the 11-issue workflow is recorded in `qa-audit/evidence/final-11-continuation.json`.

## Isolated database

Database: `pharmacy_management_demo_20261010b`  
Created by `qa-audit/prepare-demo-database.js`; seeded by `qa-audit/seed-demo-database.js`. The scripts only accept names beginning with `pharmacy_management_demo_` and never overwrite an existing database.

Initial seed created 3 medicines, 4 batches, 4 opening stock movements, 1 supplier, 1 customer, and 1 structured prescription.

## Live API workflow

| Flow | Result | Evidence |
|---|---|---|
| Staff/customer login | PASS | Staff roles and `demo_customer` authenticated against the isolated database |
| Medicine creation | PASS | New medicine persisted with opening batch and ledger entry |
| Supplier creation | PASS | Synthetic supplier persisted |
| Direct purchase receiving | PASS | Purchase increased stock and created a movement |
| Purchase order before receiving | PASS | Stock stayed at 8 units |
| Goods receipt | PASS | Receipt increased stock from 8 to 13 |
| Walk-in Cash POS sale | PASS | Receipt `REC-000001`, invoice `PAID`, confirmed payment persisted |
| Sale and invoice status consistency | PASS | A fresh Cash sale returned invoice `PAID` and `sales.payment_status = PAID` in SQL |
| Sale idempotency retry | PASS | Retry returned the same sale ID |
| FEFO allocation | PASS | Near-expiry batch reached 0 before the later-expiry batch fell to 60 |
| Structured prescription handoff | PASS | `PENDING → UNDER_REVIEW → APPROVED → READY_FOR_BILLING` |
| Prescription Cash sale | PASS | Sale linked to prescription; final status `DISPENSED` |
| Prescription upload | PASS | Synthetic PDF upload returned `PENDING`; private file retrieved as `application/pdf` |
| Pharmacist notification | PASS | Upload generated one in-app pharmacist notification |

Final isolated database counts after rehearsal: 4 medicines, 7 batches, 12 stock movements, 2 suppliers, 1 purchase, 4 sales, 4 invoices, 3 confirmed payments, 1 structured prescription, 1 uploaded document, and 1 notification.

## Automated and browser checks

- Backend: **84/84 pass**.
- Frontend: **26/26 pass**.
- Production build: **pass**.
- Read-only API suite: **72/72 pass, zero writes to shared database**.
- Extended API audit: **32/32 pass, zero writes to shared database**.
- Browser route sweep: **45/45 pass**, five viewport sizes.
- Safe browser interactions: **18/18 pass**.
- Disposable repository verification: **pass**, including opening stock, duplicate identity rejection, cumulative payments, and prescription listing.

