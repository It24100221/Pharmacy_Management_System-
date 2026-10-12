# Final 5 Issues TODO

Updated: 2026-10-10

| Issue ID | Task | Status |
|---|---|---|
| ISSUE-017 | Remove top-right Receive Stock button | VERIFIED |
| ISSUE-018 | Correct duplicate medicine display | VERIFIED |
| ISSUE-019 | Add expiry-date validation | VERIFIED |
| ISSUE-020 | Fix customer deletion/deactivation | VERIFIED |
| ISSUE-021 | Remove customer summary cards | VERIFIED |

## Evidence Log

### ISSUE-017 — VERIFIED
- Root cause: `LowStockPage` rendered a header `Receive Stock` link in addition to row actions.
- Files inspected/changed: `frontend/src/pages/Medicines/LowStockPage.jsx`.
- Fix: removed only the header action and unused imports; retained row Receive Stock and Request Stock actions.
- Browser evidence: `/medicines/low-stock` reported `headerActions: false`, 6 Receive Stock row links and 4 Request Stock buttons.
- Regression: frontend contract test confirms two row-level Receive Stock labels remain and build passes.

### ISSUE-018 — VERIFIED
- Root cause: SQL Server contains three distinct Cetirizine medicines, not a repeated medicine ID or duplicated product join.
- Read-only SQL evidence: IDs 8, 9, and 30; product codes `P0000000008`, `P0000000009`, and `P0000000033`; duplicate product mappings query returned no rows; no Cetirizine batch rows were present.
- Fix: preserved all records and quantities; Low Stock now deduplicates accidental repeated objects by medicine ID and displays product code/medicine number beside the name.
- Browser/API evidence: API repository query returned three unique IDs; Low Stock browser displayed product identifiers for visible Cetirizine rows.
- No inventory records were changed.

### ISSUE-019 — VERIFIED
- Root cause: Add Medicine date input had no local-date minimum or client-side past-date check; backend checks already existed and were retained.
- Files changed: `frontend/src/pages/Medicines/AddMedicinePage.jsx`; automated coverage in `backend/test/finalFiveIssues.test.js` and `frontend/test/final-five-issues.test.js`.
- Fix: Asia/Colombo date-only helper, `min` attribute, change-time validation, submit-time validation, and clear error message. Backend create/batch/purchase paths reject past or invalid dates.
- Browser evidence: `/medicines/add` showed `min=2026-10-10`; past-date submission displayed the required error.
- Backend evidence: validator rejects past and impossible dates; existing purchase and API validation tests pass.

### ISSUE-020 — VERIFIED
- Root cause: customer removal was permanent-only and the confirmation was generic; historical foreign keys can prevent deletion.
- Files changed: `frontend/src/pages/Customers/CustomerListPage.jsx`, `frontend/src/context/AppContext.jsx`, `backend/src/controllers/customerController.js`, `backend/src/repositories/customerRepository.js`, `backend/src/repositories/authRepository.js`, `database/mssql/migrations/011_customer_deactivation.sql`.
- Fix: added non-destructive `is_active`/`deactivated_at` migration; active list/count filters; DELETE now deactivates and returns an accurate message; inactive customer authentication is rejected; UI removes the row and reports the API message. Confirmation includes a name, email, or stable customer ID fallback and explains historical preservation.
- SQL Server evidence: isolated demo customer deactivation returned `{ deactivated: true }`, persisted `is_active=0` and timestamp, and excluded the row from active results; synthetic row was cleaned up afterward.
- Browser evidence: `/customers` confirmation for a blank-name fixture identified `Customer #55` and cancellation did not submit a delete.

### ISSUE-021 — VERIFIED
- Root cause: `CustomerDashboard` rendered a four-card `customer-stat-grid` above the main navigation.
- Files changed: `frontend/src/pages/CustomerDashboard.jsx`.
- Fix: removed the four summary cards and unused cart summary imports; preserved welcome section, Pharmacy Items action, main navigation cards, and cart/checkout section.
- Browser evidence: `/customer-dashboard` reported zero summary grids, three main navigation cards, welcome text, and Pharmacy Items text.

## Regression and safety
- No medicines, batches, customers, prescriptions, sales, orders, or invoices were deleted or merged.
- Shared SQL Server received only the additive customer deactivation migration. Data-changing Issue-020 verification used an isolated demo database.
- Existing authentication, inventory, purchase, sales, prescription, cart, and order routes were not removed.
