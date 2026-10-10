# Final Known Limitations

These are limitations or deferred scope, not hidden failures:

- The shared `pharmacy_management` database still contains legacy aggregate quantities with zero historical batch/movement rows. It was not modified for the demonstration.
- The complete write rehearsal was performed on the isolated `pharmacy_management_demo_20261010b` database only.
- Browser smoke and safe interaction coverage is verified, but the full inventory of 291 visible controls was not exhaustively clicked.
- Expired-batch rejection and rollback are covered by automated tests; the isolated seed uses future-dated batches for a repeatable live demo.
- Card/online payment labels remain pending without an external provider. Cash is the completed demo payment path.
- Email, SMS, malware scanning, refunds, advanced reporting, and production deployment are deferred.
- `npm audit` could not be verified because the npm advisory endpoint was unavailable in this environment.
- Isolated demo credentials are local ignored files under `backend/.local/`; do not commit them.

