# End-to-End Test Report (Historical Baseline Plus Final Rehearsal)

> The original sections below describe the shared-database read-only baseline. The final isolated write rehearsal is recorded in `FINAL_DEMO_TEST_RESULTS.md` and supersedes the old “not executed” statements for the synthetic demo database.

Date: 2026-10-09 (Asia/Colombo)

## Overall result

**READY WITH LIMITATIONS.** The shared database remains protected. The isolated demo database now proves successful medicine, purchase, receipt, FEFO sale, confirmed Cash payment, prescription dispensing, upload, and notification workflows. Concurrent contention remains unverified.

## Epic summary

| Epic | Endpoint Count | Tests Run | Passed | Failed | Integration Status |
|---|---:|---:|---:|---:|---|
| Authentication & users | 12 auth/customer routes | 12 live route calls + unit cases | All executed checks | 0 final | PARTIAL — valid login/register/logout lifecycle not fully run |
| Medicines | 6 | 6 live route calls + validation/repository tests | All executed checks | 0 final | PARTIAL — create/update success not live-tested; delete missing |
| Inventory | 4 dedicated | Repository transaction tests + browser route checks | All executed checks | 0 final | PARTIAL — live database has no historical batch/movement fixtures |
| Customers | 8 | 8 live route calls + validation tests | All executed checks | 0 final | PARTIAL — successful mutations not live-tested |
| Prescriptions | 10 | 10 live route calls + upload/repository tests | All executed checks | 0 final | PARTIAL — successful upload/review chain not run |
| Suppliers & purchases | 9 | 9 live route calls + repository tests | All executed checks | 0 final | PARTIAL — supplier CRUD/purchase receipt exist; PO lifecycle missing |
| Sales | 6 | 6 live route calls + repository tests | All executed checks | 0 final | PARTIAL — successful live sale not run |
| Billing & payments | 4 dedicated | Payment repository and API boundary checks | Executed reads pass | 0 final | PARTIAL — external provider is deferred |
| Notifications | 3 dedicated | Read/list and UI menu checks | Executed reads pass | 0 final | PARTIAL — outbox delivery is deferred |
| Images & media | 2 product/prescription routes | Upload/storage unit tests | Unit cases pass | 0 final | PARTIAL — product images are optional |

Endpoint counts overlap authentication/customer management by design; the registered application total is 58.

## Required workflow status

### Workflow A — Customer and prescription

Registration → login → cart → checkout → upload → pharmacist review → sale → receipt is represented in code and older project scripts, but it was **NOT EXECUTED end-to-end in this run**. The database currently has zero orders and zero prescription uploads, so read queues returned successfully but could not prove state transitions.

### Workflow B — Inventory and suppliers

Purchase repository transaction tests prove stock increment behavior. The dedicated low-stock → notification → purchase order → supplier confirmation → goods receipt → supplier invoice → payable workflow is **MISSING**.

### Workflow C — Medicine and sales

Medicine reads, live stock state, sale reads, receipts, locked database price, expired-stock prevention, rollback behavior, and stock-decrement unit tests passed. Live medicine creation → live sale → payment confirmation → stock check was **NOT EXECUTED**.

## Reliability findings

- Sale and purchase repositories use SQL transactions and row locks for medicine stock.
- Order checkout/review and customer registration use transactions.
- Database-level non-negative constraints are present.
- Duplicate order-to-sale linkage is protected by a unique filtered index.
- General direct sale/purchase idempotency keys are missing.
- Actual concurrent live requests were not run.
- Payment concurrency cannot be tested because no payment entity exists.

## Strict acceptance score

The requested acceptance list contains 12 binary criteria. Four are fully verified in this run:

1. Server starts and stays responsive — PASS.
2. SQL Server connectivity tested — PASS.
3. All required tables exist — FAIL (payment, notification, supplier workflow, inventory history absent).
4. Every required endpoint implemented — FAIL.
5. Every endpoint fully tested — PARTIAL (all 58 routes called; successful mutation paths incomplete).
6. All required validation rules pass — PARTIAL (broad suite passed; exhaustive mutation/file workflow matrix incomplete).
7. Customer-prescription-sales-billing integration — NOT VERIFIED.
8. Inventory-supplier integration — NOT VERIFIED for required full workflow.
9. Payment and notification workflows — FAIL/MISSING.
10. Unauthorized actions blocked — PASS.
11. Regression suite passes — PASS.
12. No critical/high unresolved bugs — FAIL because major required domains are absent.

**Strict completion: 4/12 = 33%.** Partial criteria receive no credit in this conservative score.

## Test-data note

The initial bug-reproduction run created sale 24 and purchase 17 due the numeric-coercion defects. Cleanup is awaiting explicit permission; see `DATABASE_CONNECTIVITY_REPORT.md`.

