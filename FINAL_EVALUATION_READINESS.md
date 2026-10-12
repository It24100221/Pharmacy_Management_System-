# Final Evaluation Readiness

Updated: 2026-10-10 (Asia/Colombo)

## Verdict

**READY WITH LIMITATIONS.** The application starts, connects to SQL Server, passes the automated suites, and the critical read/navigation smoke paths work. A separate synthetic SQL Server demonstration database was created, seeded, and exercised through purchase, batch, POS, payment, prescription, upload, and notification workflows. The shared operational database remains unchanged.

## Verified evidence

| Check | Result |
|---|---|
| Backend tests | 84/84 pass (`backend`, `npm.cmd test`) |
| Frontend tests | 26/26 pass (`frontend`, `npm.cmd test`) |
| Frontend production build | Pass (`npm.cmd run build`) |
| SQL Server health | HTTP 200; database connected |
| Migrations | 001–010 already applied; rerun is idempotent |
| Read-only API verification | 72/72 pass; 0 writes |
| Extended API audit | 32/32 pass; before/after database counts unchanged |
| Browser smoke sweep | 45/45 pass across desktop, laptop, tablet, mobile, narrow mobile |
| Safe browser interactions | 18/18 pass |
| Isolated write rehearsal | Pass; see `FINAL_DEMO_TEST_RESULTS.md` |

## Module status

| Module | Frontend | Backend/API | SQL Server | Browser | Demo status |
|---|---|---|---|---|---|
| Medicine & Inventory | Ready | Ready, FEFO and movement logic live-tested in isolated DB | Shared DB unchanged; isolated batches/movements verified | Ready | Ready |
| Supplier & Purchase | Ready | Direct purchase, PO, and goods receipt live-tested in isolated DB | Stock stayed unchanged at PO creation and increased on receipt | Ready | Ready |
| Sales & Billing | Ready | Walk-in Cash invoice/payment, receipt, FEFO, and idempotency live-tested | Confirmed payment and movements verified in SQL | Ready; billing queue no longer crashes | Ready |
| Prescription & Customer | Ready | Login, structured review, handoff, Cash dispensing, upload, file preview, notification live-tested | `DISPENSED`, sale link, and upload persisted | Ready; prescription list returns 200 | Ready |

## Remaining limitations

- The shared development database contains legacy aggregate stock but no batch or stock-movement rows. No historical batches were fabricated.
- Concurrent SQL Server contention tests remain to be run; rollback and integrity cases are covered by automated repository tests and disposable verification.
- Card/online payment labels remain pending without an external provider. Cash is the supported completed payment path.
- Email, SMS, malware scanning, refunds, and production deployment are outside the evaluation MVP.
- `npm audit` was not verifiable in this environment because the npm advisory endpoint was unavailable; dependency upgrades were not forced.
- Existing duplicate legacy medicine/supplier names require business review; new normalized duplicates are rejected.
- Low-stock supplier request creation is implemented with duplicate-open-request protection; a live mutation rehearsal remains pending in `FINAL_11_ISSUES_TODO.md`.

## Startup

1. Configure `backend/.env` using the variable names in `backend/.env.example`.
2. From `backend`: `npm.cmd run migrate`, then `npm.cmd start`.
3. From `frontend`: `npm.cmd run dev`.
4. Open `http://localhost:3000`; API health is `http://localhost:5000/api/health`.

For the verified write rehearsal, use the isolated API at `http://localhost:5002` with the commands in `FINAL_STARTUP_AND_RECOVERY_GUIDE.md`.

Do not store passwords in this document. Use the local staff credential handoff under ignored `backend/.local/`.

