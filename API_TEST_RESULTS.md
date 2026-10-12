# API Test Results

Final execution timestamp: 2026-10-10 00:34 +05:30

## Final results

| Suite | Cases | Passed | Failed | Skipped | Database writes |
|---|---:|---:|---:|---:|---:|
| Node regression tests | 77 | 77 | 0 | 0 | Mocked/temp-file only |
| Live SQL-backed API verifier | 72 | 72 | 0 | 0 | 0 (snapshot asserted) |
| Total automated checks | 149 | 149 | 0 | 0 | 0 in final shared-database run |

The live suite called all **58 registered routes** and added 14 validation/security cases. This does not mean all successful mutation paths passed: 27 routes were deliberately stopped at authorization, validation, not-found, or unsupported-media handling.

## Commands and actual outcomes

```powershell
node --version
# v24.21.0

npm.cmd --version
# 11.19.0

npm.cmd test
# tests 77, pass 77, fail 0, skipped 0

npm.cmd run verify:api-readonly
# endpoint_count 58
# additional_validation_cases 14
# total_cases 72, passed 72, failed 0, database_writes 0

npm.cmd ls --depth=0
# dependency tree valid

npm.cmd run migrate
# migrations 001-009 already applied

npm.cmd start
# API running on port 5000
```

Health response:

```json
{"success":true,"message":"Pharmacy Management API is running","database":"connected","timestamp":"2026-10-09T10:35:21.264Z"}
```

## Initial failures reproduced before fixes

The first live verifier run executed 67 cases: 59 passed and 8 failed.

| Failure | Initial result | Final result |
|---|---|---|
| Negative medicine page | HTTP 500 from negative SQL OFFSET | HTTP 400 |
| Excessive customer limit | HTTP 200 | HTTP 400 |
| Malformed sales date | HTTP 500 from SQL conversion | HTTP 400 |
| Reversed purchase date range | HTTP 200 | HTTP 400 |
| Excessive prescription recent limit | HTTP 200 | HTTP 400 |
| Numeric medicine name | HTTP 500 TypeError | HTTP 400 |
| Sale quantity `2abc` | HTTP 201, coerced to 2 | HTTP 400 |
| Purchase quantity `1.5` | HTTP 201, truncated to 1 | HTTP 400 |

Additional final checks covered malformed JSON, harmless SQL-injection search input, past expiry, SQL integer overflow, and SQL money overflow.

## Security checks

- Missing, malformed, invalid-signature, expired, and deleted-user JWTs: passed.
- Role allow-lists and 403 responses: passed.
- Password hashing uses bcryptjs cost 12: code and unit path inspected.
- SQL input is parameterized; harmless injection-shaped search remained data and returned no products.
- Prescription upload signature, MIME, size, traversal, write-failure, and database-failure cleanup tests: passed.
- Internal database/server error text is masked from HTTP 5xx responses.
- Malformed JSON returns stable HTTP 400.
- CORS is configured to a single configured/default origin.
- Rate limiting: missing.

## Dependency audit

Initial audit: 1 critical and 5 moderate findings. Safe remediation upgraded Express 4.22.2 → 4.22.3, `proxy-addr` 2.0.7 → 2.0.8, and `qs` 6.15.3 → 6.16.0. Final audit: 0 critical, 0 high, 3 moderate, all from `mssql → tedious → sprintf-js`. The upstream `sprintf-js` advisory has no patched release; `npm audit --force` proposes an unsafe `mssql` downgrade and was not applied.

## Untested successful paths

Successful login, registration, cart mutation/clear, checkout, order review/completion, medicine create/update, sale create, supplier create/update/delete, purchase create, customer create/update/delete, prescription create/upload/billing handoff, and prescription file download remain NOT VERIFIED in this run.

