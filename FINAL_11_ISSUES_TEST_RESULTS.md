# Final 11 issues test results

Updated: 2026-10-10 (Asia/Colombo)

| Issue ID | Test case | Expected | Actual | Result | Evidence | Notes |
|---|---|---|---|---|---|---|
| ISSUE-001 | Upload → pharmacist queue → notification/private preview → approval | Pending upload is reviewable and durable | Isolated continuation queued and approved upload; notification/private preview also passed | PASS | `qa-audit/evidence/final-11-continuation.json`; `qa-audit/evidence/final-demo-workflow.json` | — |
| ISSUE-002 | Pharmacist dashboard inspection at five viewports | Requests/customer care remain; Availability absent | Passed | PASS | Fixed-path browser sweep 45/45 | — |
| ISSUE-003 | Select medicine, load/select batch, receive stock | Correct batch and movement persist | Demo receipt increased stock; FEFO and movements verified | PASS | `FINAL_DEMO_TEST_RESULTS.md` | — |
| ISSUE-004 | Create low-stock request and view supplier workspace | Request persists without increasing stock | Synthetic request appeared to Supplier role, was cancelled, quantity stayed 0 | PASS | `qa-audit/evidence/final-11-continuation.json` | — |
| ISSUE-005 | Role-specific Suppliers navigation | Hidden for pharmacist/sales; retained for authorized roles | Passed by role config and authorization tests | PASS | Frontend authorization tests; browser sweep | — |
| ISSUE-006 | Sales History card and records | Opens history and shows completed sales | Route/page implemented; demo sales and receipts persisted | PASS | `FINAL_DEMO_TEST_RESULTS.md` | — |
| ISSUE-007 | Customer upload visibility in billing workflow | Review-gated upload appears in workflow | Approved upload created structured prescription, appeared ready for billing, and was dispensed | PASS | `qa-audit/evidence/final-11-continuation.json` | — |
| ISSUE-008 | Invoice card, history, payment totals, receipt | Invoice rows and balances match server | Demo invoices paid; billing tests pass | PASS | `FINAL_DEMO_TEST_RESULTS.md`; backend 84/84 | — |
| ISSUE-009 | Sales dashboard Quick Actions removal | Section absent | Passed | PASS | RoleDashboard inspection; browser sweep | — |
| ISSUE-010 | New Sale button | Opens existing POS | `/sales` route and empty-POS interaction pass | PASS | Safe interactions 18/18 | — |
| ISSUE-011 | Structured prescription → billing → Cash POS → dispense | Exact items persist; one sale; final DISPENSED | Isolated demo completed with linked sale and `DISPENSED` status | PASS | `qa-audit/evidence/final-demo-workflow.json` | Card/online provider confirmation remains external |
| ISSUE-012 | Prescription-linked POS customer mapping | Scalar authoritative customer ID; mismatches rejected; no orphan sale | Omitted client customer resolved to customer `1`; mismatched customer returned `409`; rejected attempt left prescription ready and wrote no sale | PASS | `qa-audit/evidence/issue-012-013-continuation.json` | Duplicate SQL aliases removed; locked transaction remains source of truth |
| ISSUE-013 | Duplicate invalid-customer notifications / submissions | One error owner and one sale per attempt | Synchronous POS lock and per-attempt idempotency key added; same-key retry returned sale `7` | PASS | `qa-audit/evidence/issue-012-013-continuation.json`; `frontend/test/billing-effect.test.js` | `AppContext.createSale` remains the single write-error toast owner |
| ISSUE-014 | Customer My Prescriptions access | CUSTOMER can load own history, see empty state, refresh, and cannot read another customer | Browser/API own request 200; empty state and refresh passed; existing demo customer retrieved 2 records; cross-customer request returned 403 | PASS | `qa-audit/evidence/issue-014-015-customer-access.json` | Role strings normalized at the identity boundary |
| ISSUE-015 | Customer My Orders access | CUSTOMER can load own history, see empty state, refresh, and cannot read another customer | Browser/API own request 200; empty state and refresh passed; unauthenticated request 401; cross-customer order returned 403 | PASS | `qa-audit/evidence/issue-014-015-customer-access.json` | Staff route permissions unchanged |
| ISSUE-016 | Pharmacist Send to Billing handoff | Authorized pharmacist reaches `READY_FOR_BILLING`; queue persists exact customer/items; no handoff stock deduction; unauthorized roles remain blocked | Real browser captured create `201` then handoff `200` and navigated without a permission error; isolated SQL Server/API refresh and Sales queue/detail checks persisted exact customer/items and unchanged stock; role/token edge tests passed | PASS | `qa-audit/evidence/issue-016-send-to-billing.json` | Previous 403 was not reproducible after role-boundary normalization |

## Regression gates

- Backend: 84/84 tests pass.
- Frontend: 26/26 tests pass.
- Frontend production build: pass.
- Read-only API: 72/72 pass, zero writes.
- Extended API: 32/32 pass, zero writes.
- Browser route sweep: 45/45 pass across five viewports.
- Safe browser interactions: 18/18 pass.
- Disposable SQL Server verification: pass; temporary database dropped afterward.
- Isolated continuation: standalone upload review, upload-linked billing, low-stock request visibility/cancellation, and final prescription dispensing passed on `pharmacy_management_demo_20261010b`.
- ISSUE-012/013 continuation: scalar customer mapping, mismatch rollback, same-key idempotent retry, and final `DISPENSED` transition passed on `pharmacy_management_demo_20261010b`.
- ISSUE-014/015 continuation: customer browser routes, refresh persistence, own SQL-backed access, unauthenticated rejection, and cross-customer rejection passed.
