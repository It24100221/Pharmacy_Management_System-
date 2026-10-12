# Pharmacy Management System — Prioritized Bug List (Pre-fix Baseline)

> **Current status:** This is the 2026-10-09 pre-fix defect register. The source now contains the remediation sprint. Current verification is recorded in `FINAL_EVALUATION_READINESS.md`; do not treat the historical statuses below as the current runtime verdict.

Audit date: 2026-10-09 (Asia/Colombo)  
Branch/commit: `dev-2` / `142d5be3567e6ee34daabe0a1069ad7aeae93fcb`  
Rule: no application bug was fixed during this audit.

## Summary

| Bug ID | Severity | Module | Page/Function | Problem | Reproduction | Evidence | Status |
|---|---|---|---|---|---|---|---|
| BUG-001 | P1 High | Prescription/platform | `GET /api/prescriptions` | SQL selects `s.id` without joining `sales`; returns 500 and pollutes 30 routes | Authenticate as pharmacist/admin; request the list | `logs/backend-runtime.err.log`, browser JSON | Confirmed |
| BUG-002 | P1 High | Sales/billing | `/billing-orders` | React effect returns a Promise; StrictMode cleanup throws `destroy is not a function`; page is blank | Open billing queue as admin/sales | `evidence/browser-audit.json`, screenshots | Confirmed |
| BUG-003 | P1 High | Authentication/platform | registration and health | Broad `/api` authentication middleware intercepts intended public endpoints; registration and health return 401 | POST registration or GET health without token | `logs/readonly-api.log` | Confirmed |
| BUG-004 | P1 High | Inventory integrity | medicine create/edit | Quantity can be inserted or overwritten directly without batch allocation or stock-movement row | Inspect/submit medicine create or update with quantity | source inspection; DB audit | Confirmed code defect; mutation not run |
| BUG-005 | P1 High | Customer billing | invoice payments | Multiple confirmed cash payments with different idempotency keys can cumulatively exceed invoice total | Record partial cash payment, then another payment up to full total | source inspection | Confirmed code defect; mutation not run |
| BUG-006 | P2 Medium | Master data | medicines/suppliers | Exact duplicate business names exist and no business-level duplicate rule prevents more | Query grouped medicine and supplier names | `evidence/database-integrity-audit.json` | Confirmed data-quality gap |
| BUG-007 | P2 Medium | Dependency security | backend/frontend dependencies | npm reports five moderate dependency findings | Run `npm audit --omit=dev` in both packages | npm audit output recorded in QA report | Confirmed |
| BUG-008 | P3 Low | Accessibility | eight data-entry pages | 41 visible labels are not programmatically associated with controls | Inspect label/control association in browser | `evidence/browser-audit.json` | Confirmed |

## Detailed findings

### BUG-001 — Prescription list query always fails

- Severity: P1 High
- Roles: `ADMIN`, `PHARMACIST`, and any page whose shared context requests prescriptions
- Affected API: `GET /api/prescriptions`
- Reproducibility: consistent; 149 occurrences during the five-viewport route sweep

Steps:

1. Start the backend against the current SQL Server database.
2. Authenticate as pharmacist or administrator.
3. Request `GET /api/prescriptions` or open `/prescription-orders`.
4. Observe HTTP 500 and SQL Server error 4104.

Expected: a paginated prescription list.  
Actual: `500 Internal Server Error`; backend log says `The multi-part identifier "s.id" could not be bound.`

Confirmed cause: `PrescriptionRepository.findAll()` selects `s.id AS sale_id` but its `FROM` clause joins only `customers`, not `sales`. `findById()` contains the missing `LEFT JOIN sales` and therefore does not have the same defect.

Recommended correction: add the intended sale join, add an integration test using SQL Server, and assert list behavior with zero and multiple prescriptions.

### BUG-002 — Billing queue crashes to a blank page

- Severity: P1 High
- Roles: `ADMIN`, `SALES`
- Page: `/billing-orders`
- Reproducibility: 5/5 viewport runs

Steps:

1. Authenticate as administrator or sales staff.
2. Navigate directly to `/billing-orders`.
3. Observe a blank document and console exception.

Expected: “Pending billing orders” queue or a clear empty state.  
Actual: blank page; React throws `TypeError: destroy is not a function` from effect cleanup.

Confirmed cause: `useEffect(load, [])` uses a function that returns the Promise produced by `.then().catch()`. React interprets the Promise as an effect cleanup function.

Recommended correction: wrap the call in an effect callback that returns either nothing or a real cleanup function, then cover mount/unmount under StrictMode.

### BUG-003 — Public registration and health are accidentally authenticated

- Severity: P1 High because customer onboarding is unavailable
- Affected endpoints: `POST /api/customers/register`, `GET /api/health`
- Reproducibility: consistent

Steps:

1. Send either request without an Authorization header.
2. Observe HTTP 401 `Authentication required`.

Expected: registration validates the request and health returns 200/503 based on readiness.  
Actual: both return 401 before their own route/controller executes.

Confirmed cause: `app.use('/api', authenticateToken, supplierOperationsRoutes)` appears before customer and health routes. Express executes that authentication middleware for every later `/api/*` request, not only supplier-operation paths.

Recommended correction: mount supplier operations under explicit subpaths or move public endpoints before the broad middleware; add anonymous integration tests for both routes.

### BUG-004 — Medicine quantity edits bypass the stock ledger

- Severity: P1 High
- Roles: `ADMIN`, `INVENTORY`
- APIs/UI: `POST /api/medicines`, `PUT /api/medicines/:id`, add/edit medicine pages
- Runtime mutation: not executed because the database is shared

Expected: every stock change has a batch/legacy allocation and an append-only `stock_movements` record.  
Actual: the validator and repository accept `quantity`; the repository runs a direct `UPDATE medicines SET quantity = ?`. Creation also accepts positive opening quantity without an `OPENING` movement.

Impact: stock can change with no auditable reason, actor, idempotency key, or reconciliation with batches. The current database already has 598 units and zero movement rows.

Recommended correction: make medicine metadata edits quantity-neutral; route all opening stock and adjustments through transactional ledger operations.

### BUG-005 — Cumulative customer invoice overpayment is possible

- Severity: P1 High
- Roles: `ADMIN`, `SALES`
- API: `POST /api/billing/invoices/:invoiceId/payments`
- Runtime mutation: not executed because no disposable invoice fixture was available

Expected: a locked invoice rejects any payment greater than its outstanding balance.  
Actual: the repository checks each payment only against `invoice.total_amount`, does not sum existing confirmed payments, and updates status based only on the current payment amount.

Example: on a 100-unit invoice, confirmed payments of 60 then 100 with different idempotency keys are both individually allowed, producing 160 confirmed.

Recommended correction: lock invoice and payment rows, calculate confirmed total/outstanding inside the transaction, reject overpayment, and update status from cumulative confirmed value.

### BUG-006 — Duplicate medicine and supplier identities

- Severity: P2 Medium
- Evidence: exact medicine name `Cetirizine` occurs 3 times; one supplier company name occurs 4 times

Expected: an agreed business identity rule detects or deliberately differentiates duplicates.  
Actual: generated product IDs keep rows technically unique, but name-level duplicates can split inventory, purchasing, and reporting.

Recommended correction: agree on medicine identity (for example generic/strength/form/manufacturer) and supplier identity, then add normalized duplicate checks and a reviewed reconciliation process. Do not delete records automatically.

### BUG-007 — Moderate dependency advisories

- Severity: P2 Medium
- Backend: 3 moderate findings in `mssql -> tedious -> sprintf-js`, including unbounded precision DoS; npm proposes an unsafe major downgrade rather than a clean patch.
- Frontend: 2 moderate findings through `react-router-dom/react-router`, including an open-redirect advisory and SSR hydration issue. The app is client-rendered, reducing relevance of the SSR issue but not removing the vulnerable dependency.

Recommended correction: evaluate supported `mssql/tedious` releases and upgrade React Router through a tested migration. Do not apply forced major changes without regression testing.

### BUG-008 — Form labels are not associated with inputs

- Severity: P3 Low
- Affected pages: medicine add/edit, supplier add, purchase create, POS, customer add/edit, prescription create
- Evidence: 41 page-label instances across eight desktop pages

Expected: clicking a label focuses its input and assistive technology announces the field name.  
Actual: visible `<label>` elements lack `htmlFor` and do not wrap the input.

Recommended correction: give each control a stable `id`, connect each label with `htmlFor`, and add automated accessibility checks.

## Non-bug observations kept separate

- One receipt navigation produced `net::ERR_INSUFFICIENT_RESOURCES` after hundreds of browser requests; four other viewport runs passed. It is recorded as intermittent/environmental, not a confirmed defect.
- Purchase-order, supplier-inquiry, and supplier-invoice detail success states were blocked by zero live fixtures.
- External card/mobile confirmation, email/SMS delivery, malware scanning, refunds, and concurrency were not claimed as working.
