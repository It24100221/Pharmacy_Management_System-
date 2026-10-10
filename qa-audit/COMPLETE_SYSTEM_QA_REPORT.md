# Complete System QA Report (Pre-fix Baseline)

> **Current status:** This report records the pre-fix audit. The fixes were subsequently implemented and verified. See the repository-root `FINAL_EVALUATION_READINESS.md` and the latest JSON evidence in `qa-audit/evidence/` for current results.

## Executive summary

The current Pharmacy Management System is **partially stable but not demonstration-ready without targeted fixes**. Static validation, automated unit tests, production compilation, database constraints, public catalogue, staff authentication, read APIs, and responsive layouts are generally strong. Five high-severity defects affect customer onboarding, prescription operations, billing, inventory auditability, and payment correctness.

The most visible runtime failures are a SQL error in the prescription list and a React crash in the billing queue. The most important latent integrity risks are medicine quantity updates that bypass the stock ledger and customer payments that do not calculate cumulative outstanding balance.

No P0 data-loss or active cross-user disclosure was confirmed. No application bug was fixed during this audit.

## Environment and tested revision

| Property | Value |
|---|---|
| Audit date/time zone | 2026-10-09, Asia/Colombo |
| Branch | `dev-2` |
| Commit | `142d5be3567e6ee34daabe0a1069ad7aeae93fcb` |
| Working tree | Pre-existing extensive modified/untracked implementation state |
| Node.js | v24.21.0 |
| npm | 11.19.0 |
| Frontend | React 18, Vite 5, port 3000 |
| Backend | Express 4, port 5000 |
| Database | SQL Server Express 17.0.1135.8, `pharmacy_management` |
| Browser | Microsoft Edge, headless DevTools automation |
| Database mode | Shared/live development database; read-only/invalid-write audit only |

## Methodology

1. Read implementation progress, package manifests, documentation, React router, Express mounts/routes, controllers, repositories, validators, middleware, and migrations.
2. Inventoried 51 frontend route patterns, 90 API endpoints, six roles, and 291 visible desktop control instances.
3. Ran backend/frontend tests and the production build.
4. Started the real frontend/backend and connected to live SQL Server.
5. Opened every route at five requested viewports, captured console/network failures and screenshots.
6. Exercised safe UI controls, all staff logins, logout, role redirects, search/filter/validation, real read fixtures, and mobile navigation.
7. Ran 104 non-destructive API cases with before/after database snapshots.
8. Ran 17 read-only database integrity query groups.
9. Performed source-assisted security, authorization, transaction, accessibility, and gap analysis.

## Coverage summary

| Area | Coverage | Outcome |
|---|---|---|
| Pages | 51/51 route patterns, 255 viewport runs | 21 strict pass, 30 strict fail due to repeated API 500; no horizontal overflow |
| Controls | 291 inventoried, 21 operated | All operated controls pass; most mutations blocked |
| APIs | 90/90 touched plus 14 validation cases | 101/104 live cases pass |
| Roles | 6/6 | Staff login and role redirects pass; valid customer password unavailable |
| Automated tests | 81/81 | Pass |
| Production build | 1/1 | Pass |
| Database | 17 query groups | Constraints sound; duplicate/data-fixture gaps found |

## User roles tested

`ADMIN`, `PHARMACIST`, `INVENTORY`, `SALES`, `SUPPLIER`, and `CUSTOMER` were all exercised. Five real staff logins redirected to correct dashboards. Customer behavior used a canonical short-lived JWT and real customer row; invalid customer login and logout were browser-tested. Backend ownership checks exist for customer orders, prescriptions, uploads, and files.

## Module results

| Module | Pages tested | Functions/API cases | Passed evidence | Failed/blocked evidence | Overall |
|---|---:|---:|---|---|---|
| Medicine & Inventory | 6 | Read/filter/batch/movement/validation; FEFO unit tests | Reads, filters, validation pass | Global prescription 500; quantity bypass; no live batches/writes | Unstable for audited stock |
| Supplier & Purchase | 10 | Supplier/purchase/PO/reorder/inquiry/invoice/receipt endpoints | Reads and invalid inputs pass | No success fixtures; duplicate suppliers; background 500 | Partially stable |
| Sales & Billing | 3 | Sales/receipt/invoice/payment/order billing | Sales reads and receipt pass | Billing page crash; cumulative payment risk; writes blocked | Unstable |
| Prescription & Customer | 14 customer/prescription routes | Ownership, upload validation, details, lifecycle APIs | Detail/ownership/read helpers pass | List 500; registration 401; lifecycle writes blocked | Unstable |
| Authentication & Platform | 18 public/dashboard aliases/fallbacks | Six role/auth scenarios, redirects, health | Staff auth/logout/RBAC pass | Public health/register middleware defect | Partially stable |

## Confirmed bugs

| Severity | Count |
|---|---:|
| P0 Critical | 0 |
| P1 High | 5 |
| P2 Medium | 2 |
| P3 Low | 1 |
| P4 Enhancement | 0 |

Top findings:

1. BUG-001: prescription list SQL returns 500.
2. BUG-002: billing queue crashes blank.
3. BUG-003: public customer registration and health endpoint return 401.
4. BUG-004: medicine quantity create/update bypasses stock ledger and batches.
5. BUG-005: cumulative customer invoice overpayment is possible.
6. BUG-006: duplicate medicine/supplier business identities exist.
7. BUG-007: five moderate dependency advisories.
8. BUG-008: 41 label/control association failures.

Full reproduction details are in `BUG_LIST.md`.

## Database verification

- Migrations 001–009 are applied.
- No disabled/untrusted tested checks or foreign keys.
- No tested orphan rows across 12 core relationships.
- No negative quantity, sale total, purchase total, order total, invoice/payment, or prescription/sale inconsistencies in current rows.
- No duplicate usernames or product codes.
- Exact duplicate medicine and supplier names exist.
- All 598 medicine units across 11 medicines are legacy/unallocated because `medicine_batches` has zero rows.
- `stock_movements` also has zero rows, so current stock has no ledger history.
- Both API before/after snapshots matched; no audit writes occurred.

## Security findings

Positive evidence:

- JWT signature, issuer/audience, expiry, deleted-user, missing-token, and wrong-role behavior is unit-tested.
- Live role redirects and representative 403 responses pass.
- SQL-injection search text remains parameter data.
- File storage unit tests cover MIME/signature mismatch, size, traversal, rollback, PDF/JPEG/PNG, and protected ownership logic.
- Server errors return a generic message rather than SQL details to the client.

Gaps/risks:

- BUG-003 broad middleware is an availability/route-contract defect.
- No rate limiting, security headers, token revocation, refresh rotation, or upload malware scanning.
- npm reports 3 moderate backend and 2 moderate frontend dependency findings.
- CORS relies on one configured/default origin; production policy was not deployment-tested.
- No destructive penetration, brute-force, or denial-of-service testing was performed.

## UI/UX and accessibility

- No horizontal overflow at the five target viewports.
- Mobile navigation opens correctly.
- Loading/empty/error states generally render, including missing orders and records.
- Billing queue is unusable because it crashes.
- Eight forms contain 41 visible labels without programmatic associations.
- Full keyboard sequencing, focus management, screen-reader output, native print behavior, and automated contrast checks remain untested.

## Integration failures

- Prescription list integration: SQL query/backend/frontends fail across 30 route patterns.
- Billing queue integration: frontend effect lifecycle fails before usable UI.
- Registration/readiness integration: Express mount order overrides public contracts.
- Inventory/ledger integration: medicine editor has a parallel stock-change path.
- Invoice/payment integration: payment status and balance are not cumulative.

## Missing and incomplete functionality

Major gaps are external payment confirmation, refunds, email/SMS processing, malware scanning, audit-log writes, product-image management UI, token revocation, rate limiting/security headers, OpenAPI, isolated DB provisioning, and full accessibility automation. Supplier/PO, notification, batch, payment, and prescription lifecycle schemas exist but lack safe live success fixtures.

See `MISSING_FEATURES_AND_GAPS.md` for the full classification.

## Testing blockers and limitations

- No disposable SQL Server database was available; successful CRUD, sale, receiving, payment, refund, and lifecycle writes were not run.
- No batch/movement fixtures, confirmed PO, supplier inquiry/invoice, customer invoice/payment, or notification fixtures existed.
- No valid customer password was available.
- Private prescription file content was not opened or exposed.
- External providers were not configured and no real communications/payments were attempted.
- Concurrency/rollback behavior is unit-tested but not proven with competing live SQL sessions.

## Readiness assessment

- Ready for continued bug-fixing development: **Yes**, after freezing feature expansion and addressing correctness defects first.
- Ready for an academic demonstration: **No**, not while registration, prescription list, and billing queue are broken.
- Ready for production: **No**.

Recommended repair order:

1. Fix BUG-004 and BUG-005, then add isolated transaction/concurrency tests.
2. Fix BUG-001 and BUG-003; add live integration tests for public contracts and prescription lists.
3. Fix BUG-002 and run the complete browser matrix again.
4. Provision a disposable SQL Server QA database and execute medicine/batch/purchase/sale/prescription/payment success and rollback workflows.
5. Reconcile legacy stock into approved opening batches/movements.
6. Address dependency, rate-limit, header, token, logging, and upload-security gaps.
7. Resolve duplicate-master-data policy and accessibility defects.

## Evidence and companion reports

- `BUG_LIST.md`
- `PAGE_AND_BUTTON_TEST_MATRIX.md`
- `API_AND_DATABASE_TEST_REPORT.md`
- `MISSING_FEATURES_AND_GAPS.md`
- `TEST_EXECUTION_SUMMARY.md`
- `evidence/browser-audit.json`
- `evidence/safe-interaction-audit.json`
- `evidence/extended-api-audit.json`
- `evidence/database-integrity-audit.json`
- `evidence/*.png`
- `logs/*.log`
