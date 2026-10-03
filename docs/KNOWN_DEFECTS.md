# Known Defects — Full-System QA

Audit date: 2026-10-03  
Audited branch: `dev`  
Audited source commit: `95790ddde96501edb9ed6484ab0437b9a6e82bbb`  
Overall result: **FAIL**

This register contains defects observed during the end-to-end audit. No product-code fixes were made. Required features that do not exist are listed separately under **Not implemented** rather than being disguised as defects or passes.

## Defect summary

| Severity | Count |
|---|---:|
| CRITICAL | 1 |
| HIGH | 2 |
| MEDIUM | 4 |
| LOW | 3 |

## QA-SEC-001 — Working staff credentials are committed in repository documentation

- Severity: **CRITICAL**
- Status: **FAIL**
- Area: Secrets / authentication
- Evidence: A credential documented in the tracked README was checked without printing it and successfully authenticated against the live database for every original staff role tested: ADMIN, PHARMACIST, INVENTORY, SALES, and SUPPLIER.
- Impact: Anyone with repository access can obtain live application access, including administrative access. Hashing the database password does not mitigate disclosure of a working plaintext credential elsewhere.
- Required remediation: Remove all working credentials from tracked history/documentation, rotate every affected account immediately, use non-working placeholders, and verify old credentials no longer authenticate.

## QA-RX-002 — Prescription-to-billing handoff is transient and not persisted

- Severity: **HIGH**
- Status: **FAIL**
- Area: Prescription / sales integration
- Evidence: `POST /api/prescriptions/:id/send-to-billing` computes and returns available lines but creates no durable handoff/order/billing record. The frontend passes the result through React navigation state.
- Impact: The handoff is lost on refresh, backend restart, direct navigation, or a different staff login. The final pharmacist-to-sales workflow cannot be relied on.
- Required remediation: Persist an explicit handoff/order state and ownership/audit trail in SQL Server, expose it to authorized sales staff, and test refresh/restart/cross-user continuity.

## QA-TXN-003 — Sale and purchase submission have no duplicate-request protection

- Severity: **HIGH**
- Status: **FAIL**
- Area: POS / purchase receive
- Evidence: The POS “Complete Sale” and purchase “Confirm & Receive Stock” actions remain enabled during their requests, and the API has no idempotency key or duplicate-request guard.
- Impact: A double click or retry can create two valid transactions and adjust stock twice. Each individual transaction is atomic, but duplicate intent is not prevented.
- Required remediation: Add frontend in-flight disabling plus server-side idempotency/duplicate protection for stock-changing requests.

## QA-REG-004 — Customer registration validation and uniqueness are incomplete

- Severity: **MEDIUM**
- Status: **FAIL**
- Area: Registration
- Evidence:
  - malformed email was accepted with HTTP 201 instead of 400;
  - duplicate username returned HTTP 500 instead of 409;
  - duplicate email was accepted with HTTP 201 instead of 409;
  - missing phone and address were accepted with HTTP 201, although both are required by the final requirement.
- Impact: Invalid or ambiguous customer records can be created, and a normal uniqueness conflict is exposed as a server error.
- Required remediation: Enforce normalized email/username uniqueness and all required fields in the API and database, returning deterministic 400/409 responses.

## QA-VAL-005 — Medicine numeric/type validation is permissive and can raise HTTP 500

- Severity: **MEDIUM**
- Status: **FAIL**
- Area: Inventory input validation
- Evidence:
  - quantity `"2abc"` was accepted with HTTP 201;
  - fractional quantity `2.5` was accepted with HTTP 201;
  - price `"Infinity"` produced HTTP 500 rather than 400;
  - object-valued medicine name produced HTTP 500 rather than 400.
- Impact: Invalid inventory data may be stored, while malformed input can trigger avoidable server errors.
- Required remediation: Apply strict finite-number parsing, integer rules, primitive type checks, bounds, and consistent 400 responses before repository access.

## QA-RPT-006 — Today revenue is multiplied for multi-item sales

- Severity: **MEDIUM**
- Status: **FAIL**
- Area: Sales reports
- Evidence: A controlled multi-line sale produced an independently queried SQL total of LKR 150, while `GET /api/sales/today-summary` returned LKR 180. The summary joins `sales` to `sale_items` and sums the header `final_amount` once per line.
- Impact: Revenue is overstated whenever a sale contains multiple items, making the dashboard/report financially unreliable.
- Required remediation: Aggregate sale headers independently (or group per sale before summing), then independently verify transaction count, revenue, and item quantity.

## QA-ERR-007 — Non-production API responses expose database error details

- Severity: **MEDIUM**
- Status: **FAIL**
- Area: Sensitive error handling
- Evidence: During a controlled pool shutdown, read and write APIs correctly returned HTTP 500 and no fake success, but the JSON response exposed the underlying database message (`Connection is closed`) when `NODE_ENV` is not production.
- Impact: Internal infrastructure state is revealed to clients in the normal development configuration and could be exposed by a misconfigured deployment.
- Required remediation: Return a stable public error code/message in every environment used by untrusted clients; retain detailed diagnostics only in protected server logs.

## QA-UI-008 — Public catalogue overflows horizontally at 390 px

- Severity: **LOW**
- Status: **FAIL**
- Area: Responsive frontend
- Evidence: A headless Edge capture at 390×844 with the live API showed two four-column-grid cards extending past the right viewport edge. Desktop (1440×1000) and tablet (768×1024) home layouts rendered correctly.
- Impact: Mobile users cannot view the catalogue as a single readable column without horizontal scrolling/clipping.
- Required remediation: Add an appropriate mobile breakpoint for the catalogue grid and toolbar, then retest common 320–430 px widths.

## QA-UI-009 — Unknown frontend routes render no 404 page

- Severity: **LOW**
- Status: **FAIL**
- Area: Routing
- Evidence: `frontend/src/App.jsx` has no wildcard route.
- Impact: Mistyped and stale links resolve to a blank application view without recovery guidance.
- Required remediation: Add a public not-found route that preserves safe navigation.

## QA-UX-010 — UI advertises workflows that are not implemented

- Severity: **LOW**
- Status: **FAIL**
- Area: Content / navigation
- Evidence: The public Services section advertises online ordering, the customer dashboard presents order/invoice/payment history and checkout affordances, and sales dashboard history/invoice actions lead back to POS, while no order backend/tables or dedicated history workflow exists.
- Impact: Users are directed toward unavailable capabilities and cannot distinguish planned functionality from operational functionality.
- Required remediation: Label planned functions accurately or expose them only when their complete backend workflow exists.

## Not implemented

The following final requirements are absent and are therefore **NOT IMPLEMENTED**, not failed test executions:

- persistent customer cart and cart database model;
- customer order/order-items backend, ownership, statuses, and history;
- backend-enforced prescription-required ordering rule;
- customer checkout and payment lifecycle (the checkout component is not routed; `/customer/checkout` redirects);
- persistent notification/event system;
- structured-prescription approval, rejection, and completion transitions;
- pharmacist upload queue with file review and workflow actions;
- durable prescription-to-billing handoff and sales queue;
- supplier supply request, receive/supply, and supply-history workflow;
- dedicated inventory supply-requirement workflow;
- medicine delete endpoint;
- dedicated sales history UI with today/week/month filters;
- monthly sales, paid/pending, and top-products reports;
- product image upload/management (catalogue uses a placeholder when no image exists);
- frontend wildcard/not-found page.

## Blocked browser-only checks

These were not marked as passed from static code or unit tests:

- authenticated refresh/logout/browser-Back behavior in a real interactive browser;
- real-browser sensitive-cache isolation while switching roles;
- print-dialog output and printer rendering;
- retry recovery in the same browser after a backend or database outage;
- authenticated staff/customer pages at all responsive breakpoints.

They remain **BLOCKED** by the available non-interactive browser harness. API behavior and automated session tests are recorded separately in the test matrix.
