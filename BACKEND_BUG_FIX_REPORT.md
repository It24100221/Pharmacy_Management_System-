# Backend Bug Fix Report

Date: 2026-10-09 (Asia/Colombo)

## Confirmed fixes applied

Eleven defect groups were fixed. Existing architecture and SQL Server repositories were preserved.

| # | Root cause | Correction | Regression evidence |
|---:|---|---|---|
| 1 | `parseInt`/`parseFloat` accepted partial and fractional values | Strict integer/decimal parsing for medicines, sales, purchases, prescriptions, carts, and identifiers | Unit and live invalid-input tests |
| 2 | Validators called `.trim()` on non-string user input | Type guards and controlled HTTP 400 errors across registration, medicine, customer, supplier, and prescription inputs | Wrong-type unit tests; live numeric medicine-name test |
| 3 | Pagination was unbounded and allowed negative SQL offsets | Shared bounded pagination parser (page ≥1, limit ≤100) | Unit tests and live list-route tests |
| 4 | Date filters reached SQL Server without validation | Strict real ISO dates and chronological range validation | Unit tests; malformed/reversed live cases |
| 5 | Recent-list limits were unbounded | Shared recent-limit parser capped at 100 | Live prescription recent-limit test |
| 6 | Duplicate purchase/prescription medicine lines were accepted | Duplicate medicine-ID rejection | Unit tests |
| 7 | SQL integer and decimal boundaries were not enforced | SQL `int` upper bound, money maximum, and two-decimal precision validation | Unit tests and live overflow cases |
| 8 | Past medicine expiry dates could be created/updated | Asia/Colombo-aware past-date rejection | Unit and live tests |
| 9 | Malformed JSON and unexpected SQL errors exposed unstable/internal messages | Stable malformed-JSON response, SQL conflict mapping, generic 5xx messages | Live malformed-JSON payload assertion |
| 10 | Health endpoint only checked the Express process | Health now executes a safe SQL readiness query and reports database connectivity | Live HTTP 200 health response |
| 11 | Critical/moderate transitive Express advisories | Updated Express, `proxy-addr`, and `qs` within compatible ranges | npm dependency tree and final audit |

## Files added

- `backend/src/utils/requestValidation.js`
- `backend/src/scripts/verifyReadOnlyApi.js`
- `backend/test/inputValidation.test.js`
- `backend/test/requestValidation.test.js`

## Key files changed

- `backend/src/app.js`
- Controllers for auth, cart, customers, medicines, orders, prescriptions, products, purchases, sales, and suppliers
- Validators for registration, customers, medicines, prescriptions, purchases, sales, and suppliers
- `backend/package.json` and `backend/package-lock.json`
- `backend/test/validators.test.js`

## Re-verification

```text
npm.cmd test
49 passed, 0 failed, 0 skipped

npm.cmd run verify:api-readonly
72 passed, 0 failed, database_writes: 0
```

## Not changed intentionally

- No migration was applied because migrations 001–005 were already current.
- No production/shared records were deleted.
- No functionality was removed.
- The `mssql` package was not downgraded to satisfy an npm audit heuristic.
- Large missing domains (notifications, payment ledger/gateway, supplier PO lifecycle) were not fabricated as shallow endpoints; they remain documented implementation work.

