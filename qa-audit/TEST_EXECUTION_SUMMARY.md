# Test Execution Summary

Audit date: 2026-10-09 (Asia/Colombo)

## Headline counts

| Measure | Count | Result |
|---|---:|---|
| React route patterns discovered | 51 | 51 opened (100% route-touch coverage) |
| Route/viewport runs | 255 | Raw runner: 224 pass, 11 fail, 20 blocked |
| Strict unique-page adjudication | 51 | 21 pass, 30 fail due to unexpected 500s; 3 of the failed detail pages also lack fixtures |
| Visible desktop control instances | 291 | Inventoried |
| Controls actually operated | 21 | 21 pass; 270 not operated/blocked |
| Additional direct authorization checks | 5 | 5 pass |
| User roles | 6 | All six exercised |
| Registered API endpoints | 90 | 90 touched; 87 pass, 3 fail |
| Additional API validation cases | 14 | 14 pass |
| Backend automated tests | 63 | 63 pass |
| Frontend automated tests | 18 | 18 pass |
| Production builds | 1 | Pass |
| Database integrity query groups | 17 | Executed; duplicates and legacy-stock gaps found |
| Browser screenshots | 155 | `qa-audit/evidence/*.png` |

## Aggregate execution accounting

The following non-overlapping execution units total 487:

| Execution class | Total | Passed | Failed | Blocked |
|---|---:|---:|---:|---:|
| Browser route/viewport runner (raw) | 255 | 224 | 11 | 20 |
| Browser controls and role scenarios | 29 | 29 | 0 | 0 |
| Live API cases | 104 | 101 | 3 | 0 |
| Backend/frontend automated tests | 81 | 81 | 0 | 0 |
| Production build | 1 | 1 | 0 | 0 |
| Database integrity query groups | 17 | 17 executed | 0 execution failures | 0 |
| **Total** | **487** | **453** | **14** | **20** |

The raw browser runner classified pages with a background HTTP 500 as pass when their primary component still rendered. The final page matrix deliberately reclassified every affected unique route as `FAIL`; therefore strict page totals are more severe than raw runner totals.

## Automated command results

| Command | Result | Evidence |
|---|---|---|
| `backend: npm.cmd test` | 63/63 pass | `logs/backend-tests.log` |
| `frontend: npm.cmd test` | 18/18 pass | `logs/frontend-tests.log` |
| `frontend: npm.cmd run build` | Pass, 1,996 modules transformed | `logs/frontend-build.log` |
| `backend: npm.cmd run verify:api-readonly` | 69/72 pass, zero writes | `logs/readonly-api.log` |
| `node qa-audit/scripts/extendedApiAudit.cjs` | 32/32 pass, zero writes | `evidence/extended-api-audit.json` |
| `node qa-audit/scripts/databaseIntegrityAudit.cjs` | 17 query groups executed | `evidence/database-integrity-audit.json` |
| `node qa-audit/scripts/fullBrowserAudit.cjs` | 255 viewport runs | `evidence/browser-audit.json` |
| `node qa-audit/scripts/safeInteractionAudit.cjs` | 18/18 pass | `evidence/safe-interaction-audit.json` |

## Roles exercised

| Role | Login | Authorized behavior | Forbidden route | Notes |
|---|---|---|---|---|
| Admin | Real staff UI login PASS | Broad staff/API reads | N/A | 500 prescription request affects dashboard/pages |
| Pharmacist | Real staff UI login PASS | Prescription/customer reads | Purchase route redirect PASS | Prescription list broken |
| Inventory | Real staff UI login PASS | Inventory/supplier reads | Sales route redirect PASS | Write success blocked |
| Sales | Real staff UI login PASS | Sales/receipt reads | Supplier route redirect PASS | Billing queue crashes |
| Supplier | Real staff UI login PASS | Supplier/PO reads | Customer route redirect PASS | Detail fixtures absent |
| Customer | JWT-backed canonical session; invalid login UI PASS | Own dashboard/order and logout | Medicine staff route redirect PASS | Valid password unavailable |

## Coverage qualifications

- Endpoint touch coverage is 100%, but many protected mutation endpoints were tested only with invalid inputs or unauthorized roles. Their successful transaction paths are `BLOCKED`.
- Control-operation coverage is 21/291 (7.2%). Direct route loads do not count as button tests.
- Browser coverage includes all five requested sizes and direct refresh/navigation. Back/forward history and full keyboard sequences were not exhaustively automated.
- Unit tests use mocks for important transaction behavior. They do not replace live SQL Server concurrency tests.
- No real external payments, emails, SMS messages, or supplier communications were triggered.

## Database safety and cleanup

- Before/after snapshots for both live API suites matched.
- Extended audit snapshot remained: 0 batches, 0 stock movements, 0 notifications, 0 payments/orders/receipts/inquiries/invoices in the newer domains, total medicine quantity 598.
- No cleanup was necessary because the audit created no database records.
- No existing application source was modified. New or changed audit-only content is under `qa-audit/`.

## Overall confidence

**Medium.** Read paths, validation, roles, responsive rendering, and schema integrity have strong evidence. Confidence is limited by the absence of a disposable database, live batch fixtures, successful write workflows, concurrent transactions, external providers, and broad control interaction coverage.
