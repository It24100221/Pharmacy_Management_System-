# Final 5 Issues Test Results

Updated: 2026-10-10

| Issue ID | Test Case | Expected Result | Actual Result | Status | Evidence |
|---|---|---|---|---|---|
| ISSUE-017 | Header and row action browser check | Header Receive Stock absent; row actions remain | Header action absent; 6 Receive Stock links and 4 Request Stock buttons present | PASS | Browser CDP check on `/medicines/low-stock` |
| ISSUE-017 | Frontend contract test | Only row Receive Stock labels remain | Passed | PASS | `frontend/test/final-five-issues.test.js` |
| ISSUE-018 | SQL identity and product mapping | Distinct IDs/codes identified; no duplicate product mapping | Cetirizine IDs 8, 9, 30; unique product mappings; no batch duplication | PASS | Read-only SQL and repository query |
| ISSUE-018 | Low Stock rendering | Distinct products remain distinguishable; repeated same ID is not rendered twice | Product codes shown; ID-based deduplication added | PASS | Browser CDP check and frontend test |
| ISSUE-019 | Past/impossible medicine expiry | Reject without write | Validator rejected 2000-01-01 and 2026-02-30; direct authenticated API request returned HTTP 400 | PASS | Backend 86-test suite and final test |
| ISSUE-019 | Add Medicine browser validation | Local-date minimum and error block save | `min=2026-10-10`; past date showed error | PASS | Browser CDP check on `/medicines/add` |
| ISSUE-019 | Purchase/batch validation regression | Current/future accepted, past rejected | Existing purchase and batch tests passed | PASS | `backend/test/validators.test.js` and controller checks |
| ISSUE-020 | Isolated deactivation persistence | Historical row remains, active list excludes it | `is_active=0`, timestamp persisted, active query empty | PASS | Isolated demo SQL Server verification |
| ISSUE-020 | Confirmation and cancellation | Customer-specific prompt; cancel sends no delete | Prompt identified `Customer #55`; cancel path used | PASS | Browser CDP check on `/customers` |
| ISSUE-020 | Controller response | Accurate deactivation message | Returned `Customer deactivated successfully` | PASS | `backend/test/finalFiveIssues.test.js` |
| ISSUE-021 | Customer dashboard browser check | Four summaries absent, navigation preserved | 0 summary grids; 3 main cards; welcome and Pharmacy Items present | PASS | Browser CDP check on `/customer-dashboard` |
| ISSUE-021 | Frontend contract test | Summary labels absent; links retained | Passed | PASS | `frontend/test/final-five-issues.test.js` |

## Full regression

- Backend: **86/86 passing**.
- Frontend: **30/30 passing**.
- Frontend production build: **passed** (`vite build`; existing chunk-size warning only).
- Existing browser safe interaction audit: **18/18 passing**.
- API health: `/api/health` returned 200 with `database: connected`.
- Migration: `011_customer_deactivation.sql` applied successfully.

