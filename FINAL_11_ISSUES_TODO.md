# Final 11 issues tracker

Updated: 2026-10-10 (Asia/Colombo)

The existing worktree was preserved. Verification uses the shared database only for read-only checks and the isolated `pharmacy_management_demo_20261010b` database for synthetic writes.

| ID | Issue | Priority | Status |
|---|---|---|---|
| ISSUE-001 | Customer prescription uploads must appear in pharmacist requests | Critical workflow | VERIFIED |
| ISSUE-002 | Remove Availability from Pharmacist Dashboard | UI | VERIFIED |
| ISSUE-003 | Automatically display medicine batch details in Purchases | Functional/UI | VERIFIED |
| ISSUE-004 | Request low-stock medicines from suppliers | New integration | VERIFIED |
| ISSUE-005 | Remove Suppliers navigation for the specified role | UI/RBAC | VERIFIED |
| ISSUE-006 | Fix Sales History navigation and page | Functional | VERIFIED |
| ISSUE-007 | Show customer prescription submissions in billing workflow | Critical integration | VERIFIED |
| ISSUE-008 | Fix Invoices navigation and page | Functional | VERIFIED |
| ISSUE-009 | Remove Sales Dashboard Quick Actions | UI | VERIFIED |
| ISSUE-010 | Add New Sale button to Sales Dashboard | UI | VERIFIED |
| ISSUE-011 | Make Send to Billing transfer structured prescriptions correctly | Critical integration | VERIFIED |

## Evidence log

### ISSUE-001

- Inspected upload page/service, upload middleware/controller, `prescription_uploads`, review queue, pharmacist dashboard, notifications, and private-file route.
- Implemented upload metadata and private storage, pending queue endpoint, pharmacist-only review endpoint, reviewer fields, customer notification, dashboard count, preview/download, and duplicate order protection.
- Isolated demo PDF upload persisted as `PENDING`, private preview returned `application/pdf`, and one pharmacist notification was persisted; browser/API route checks for the review queue passed.
- Isolated demo continuation verified standalone upload queue visibility, pharmacist approval, structured prescription creation from `upload_id`, `READY_FOR_BILLING`, Cash sale, and final `DISPENSED` status.

### ISSUE-002

- Pharmacist configuration contains only Requests and Customer Care cards and only Review Prescriptions/Open Customers actions.
- Browser route sweep passed at desktop, laptop, tablet, mobile, and narrow-mobile sizes.

### ISSUE-003

- Medicine selection loads actual non-expired batches; one batch is prefetched, multiple batches are selectable, and New supplier batch requires paired batch/expiry fields.
- Isolated demo receiving increased stock and recorded batch movement; FEFO consumed the near-expiry lot first.

### ISSUE-004

- Low-stock page exposes Request Stock with supplier, quantity, and notes; the API persists `reorder_requests`, deduplicates open requests, notifies inventory, and supplier workspace lists history.
- Backend duplicate-request unit coverage and read-only endpoint coverage pass.
- Isolated demo continuation created a synthetic zero-stock medicine, persisted a supplier-linked request, observed it from the Supplier role, cancelled it, and confirmed medicine quantity remained 0.

### ISSUE-005

- Top navigation and mobile drawer scope Suppliers to Admin, Inventory, and Supplier roles; pharmacist and sales low-stock workspaces do not receive that navigation.
- Backend supplier authorization remains unchanged; role authorization tests pass.

### ISSUE-006

- Sales dashboard card routes to `/sales-history`; page reads completed sales and links receipts.
- Sales data and receipt linkage were exercised in the isolated demo; browser route sweep passed.

### ISSUE-007

- Billing queue combines approved customer orders, structured prescriptions ready for billing, and awaiting-review upload visibility.
- Customer uploads remain review-gated and are not billed from the image alone; the isolated continuation moved an approved upload through structured billing and dispensing.

### ISSUE-008

- Sales dashboard invoice card routes to `/invoice-history`; invoice page reads server invoices, cumulative confirmed payments, outstanding balances, status, and receipt links.
- Isolated demo created and paid invoices; billing repository tests and extended API checks pass.

### ISSUE-009

- Sales configuration has no Quick Actions section; underlying routes remain available.
- Browser route and safe interaction sweeps pass.

### ISSUE-010

- Sales dashboard displays a prominent `+ New Sale` link to `/sales`; TopNav retains the authorized New Sale action.
- POS empty-cart and route interaction checks pass.

### ISSUE-011

- Structured prescriptions persist exact customer/item/quantity data, transition through `READY_FOR_BILLING`, reload by persistent prescription ID in POS, link the sale, and transition to `DISPENSED` after a confirmed Cash sale.
- Isolated demo verified handoff, FEFO sale, invoice/payment creation, sale link, and final `DISPENSED` status; duplicate dispensing is rejected by locked status checks.

## Continuation fixes

- Billing queue fallback message now matches the queue’s persistent empty/error state and the frontend regression test.
- Inventory search safely handles null optional medicine fields instead of crashing.
- Low-stock difference renders `0` rather than `-0` at the threshold.
- Supplier dashboard request-history card now points to the supplier dashboard route available to that role.
- Prescription and sale detail queries no longer select `customer_id` twice; SQL Server now returns a scalar customer ID for POS handoff and receipts.

## Urgent continuation issues: ISSUE-012 and ISSUE-013

| ID | Issue | Priority | Status |
|---|---|---|---|
| ISSUE-012 | Invalid Customer ID during prescription-linked POS billing | Critical | VERIFIED |
| ISSUE-013 | Duplicate invalid-customer error notifications | Critical | VERIFIED |

### ISSUE-012

- Root cause: prescription and sale detail queries selected both the canonical foreign-key field and a second `customer_id` alias from the customer join. SQL Server returned duplicate column values as an array (`[1, 1]`), so the POS submitted an invalid customer ID and the sales validator rejected it.
- Fix: removed the duplicate aliases, kept the canonical prescription/sale customer ID, and made the locked sale transaction resolve the authoritative customer from the linked `READY_FOR_BILLING` prescription when the client omits it. A supplied but different customer is rejected with `409 Prescription customer mismatch`.
- Isolated API evidence completed prescription `4` with sale `7` and scalar customer ID `1`; prescription `5` rejected a mismatched customer before any sale row was written. See `qa-audit/evidence/issue-012-013-continuation.json`.

### ISSUE-013

- Root cause: the POS relied only on asynchronous React state (`submitting`) to block repeated clicks; two clicks in the same event turn could enter the handler before the state update rendered.
- Fix: added a synchronous `useRef` submission lock, disabled the button while the request is active, and generated one idempotency key per sale attempt. Error toast ownership remains in `AppContext.createSale`, so POS does not emit a second copy.
- Regression coverage verifies the synchronous guard and reset path. The isolated API retry with the same idempotency key returned sale `7` again and created no duplicate sale.

## Urgent customer-access regression: ISSUE-014 and ISSUE-015

| ID | Issue | Priority | Status |
|---|---|---|---|
| ISSUE-014 | My Prescriptions shows Insufficient permissions | High | VERIFIED |
| ISSUE-015 | My Orders shows Insufficient permissions | High | VERIFIED |

### ISSUE-014

- The route and endpoint were present and correctly customer-scoped. The failure condition was the authorization boundary comparing raw role text byte-for-byte; legacy or stale identities with casing/whitespace differences were treated as a different role and received `403 Insufficient permissions`.
- Role values are now canonicalized with trim and uppercase during SQL user lookup, JWT identity hydration, backend role checks, login responses, and frontend session restore. The customer endpoint still derives ownership from `req.user.customerId`; browser-supplied customer IDs cannot broaden access.
- Browser evidence: `/my-prescriptions` loaded with a 200 request, rendered the empty state, and retained access after refresh. Current-code API evidence retrieved two existing customer prescriptions from SQL Server; another customer's uploads returned 403.

### ISSUE-015

- My Orders uses the same strict role gate, so the same non-canonical customer role condition denied `/api/orders/mine` before the customer-scoped repository query ran.
- The normalized role boundary now permits CUSTOMER consistently while `findMine(req.user.customerId)` remains the only list query and `getById` rejects a different owner with 403.
- Browser evidence: `/my-orders` loaded with a 200 request, rendered the empty state, and retained access after refresh. Unauthenticated requests returned 401 and a different customer's order returned 403.

### Customer-access regression evidence

- Automated ownership tests cover own prescriptions, own orders, cross-customer prescription rejection, and cross-customer order rejection.
- Mixed-case/whitespace role normalization is covered in backend and frontend authentication tests.
- No specific recent diff removed the customer route guards; the regression was reproduced as strict role-string handling and corrected at the identity boundary without weakening route authorization.
- Full evidence is in `qa-audit/evidence/issue-014-015-customer-access.json`.

## Urgent Send-to-Billing regression: ISSUE-016

| ID | Issue | Priority | Status |
|---|---|---|---|
| ISSUE-016 | Send to Billing reports Insufficient permissions for pharmacist | Critical | VERIFIED |

### ISSUE-016

- Failed endpoint under investigation: `POST /api/prescriptions/:id/send-to-billing`; the route is intentionally restricted to `ADMIN` and `PHARMACIST`.
- Root cause: authorization compared role text without canonicalizing legacy/stale casing or whitespace at the identity boundary. A valid pharmacist identity could therefore reach the role gate as a non-matching string and receive `403 Insufficient permissions`. The route registration and `CreatePrescriptionPage` handoff sequence were already correct; no route-wide permission expansion was made.
- Correction: normalize role values with trim and uppercase in SQL user lookup, JWT authentication, login/session responses, frontend session restore, and role checks. Customer ownership checks and all route allow-lists remain enforced.
- Source changes used by this fix: `backend/src/utils/roles.js`, `backend/src/repositories/authRepository.js`, `backend/src/middleware/auth.js`, `backend/src/controllers/authController.js`, `frontend/src/config/authorization.js`, `frontend/src/context/AuthContext.jsx`, and `frontend/src/services/authService.js`. Existing numeric customer ownership hardening remains intact in prescription, upload, and order controllers.
- Notification/submission protection: `CreatePrescriptionPage` has a synchronous `submitting` guard and disabled button; `preparePrescriptionForBilling` does not emit a toast, leaving one page-level billing error owner. Existing POS idempotency protection was not changed.
- Sanitized request evidence: current fixed code sent `POST /api/prescriptions/6/send-to-billing` as an authenticated pharmacist and returned `200`; the prior `403` could not be reproduced after normalization. No token or password was recorded.
- Isolated SQL Server workflow (`pharmacy_management_demo_20261010b`): pharmacist login `200`; prescription `6` created with customer `1`; handoff returned `READY_FOR_BILLING` with medicine `1 x 3` and medicine `2 x 1`; Sales billing queue and billing detail returned `200`; refresh retained the status; stock stayed `60 -> 60` and `45 -> 45` at handoff. Evidence: `qa-audit/evidence/issue-016-send-to-billing.json`.
- Real browser workflow against the same isolated API selected customer `1`, added two available medicines, showed `Available: 2 / 2 items`, captured `POST /api/prescriptions -> 201` and `POST /api/prescriptions/7/send-to-billing -> 200`, then navigated to the pharmacist dashboard without a permission error. The persisted browser-created prescription `7` is also present in the Sales queue with `READY_FOR_BILLING`.
- Regression coverage: authorized pharmacist controller handoff payload, normalized pharmacist role gate, unauthorized role rejection, missing/malformed/expired token rejection, frontend submit lock, single billing error notification ownership, customer access, and existing prescription lifecycle tests.
