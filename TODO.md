# Implementation Tracker - Senevirathna Medical Pharmacy

Last updated: 2026-09-12

This checklist tracks work against the UI/UX specification, image-reference guide, and Sprint 1 development guide. The approved ER diagram remains the authority for database structure when it becomes available.

## Verification Baseline

- [x] Read all authored frontend, backend, database, configuration, and test files.
- [x] Read all three supplied project reference documents.
- [x] Frontend production build passed before implementation changes.
- [x] Frontend production build passes after the current implementation batch.
- [x] Frontend automated tests pass: 9/9.
- [x] Backend automated tests pass: 13/13.
- [x] All backend JavaScript source files pass `node --check`.
- [x] Browser smoke test passes for the changed medicine, prescription, POS, and receipt routes.
- [ ] MySQL schema is confirmed against the approved ER diagram.
- [ ] Full browser/API/MySQL Sprint 1 demonstration flow passes.

## Phase 1 - Integration Foundation

- [x] Make API availability detection and local fallback deterministic.
- [x] Normalize API and local medicine, sale, and prescription records consistently.
- [x] Stabilize toast actions and route-state handover behavior.
- [x] Guard prescription route-state processing against duplicate Strict Mode effects.
- [x] Replace the non-runnable frontend test setup with a self-contained Node test suite.
- [ ] Remove or consolidate duplicate service implementations.

## Phase 2 - Prescription, Billing, and Receipt Flow

- [x] Require a valid customer before creating a prescription.
- [x] Stop navigation to billing when prescription creation fails.
- [x] Carry the prescription customer ID and name into the completed sale.
- [x] Keep prescription availability current when items or quantities change.
- [x] Load saved prescription details from the API when a list record has no items.
- [x] Recheck saved prescription availability before billing without reducing stock.
- [x] Exclude expired and unavailable prescription lines from the POS handoff.
- [x] Load receipts from the saved backend sale instead of relying only on list state.
- [x] Use payment-method values accepted by both frontend and backend.

## Phase 3 - Stock and Transaction Integrity

- [x] Calculate sale prices from the database rather than client-submitted prices.
- [x] Prevent expired medicines from being sold.
- [x] Validate sale customer IDs.
- [x] Reject duplicate medicine lines.
- [x] Make low-stock threshold logic consistent across frontend and backend.
- [x] Allow optional fields to be cleared during updates.
- [x] Make list counts use the same filters as list queries.
- [x] Prevent post-commit read failures from rolling back or releasing a transaction twice.
- [x] Prevent a failed post-sale or post-purchase stock refresh from duplicating the mutation offline.

## Phase 4 - Sprint 1 UI Completion

- [ ] Restore the specified utility strip, operational page banners, and complete footer.
- [ ] Add local/original/licensed hero, module, and banner assets without hotlinking.
- [ ] Add reusable loading, error, modal, confirmation, and step-indicator components.
- [ ] Provide purchase confirmation with the saved purchase number and summary.
- [ ] Verify all 18 routes at the required responsive breakpoints.
- [ ] Add a frontend not-found route and accessible navigation behavior.

## Phase 5 - Database and End-to-End Validation

- [ ] Obtain and review the approved ER diagram.
- [ ] Reconcile `database/schema.sql` with the approved ER diagram.
- [ ] Refresh date-sensitive seed data for repeatable low-stock and expiry scenarios.
- [ ] Make schema and seed execution safely repeatable for development.
- [x] Add backend automated tests for validation and transaction behavior.
- [ ] Run the required 20 -> 120 -> 110 integrated stock demonstration.
- [ ] Verify persistence after refresh and verify failure rollback behavior against MySQL.

## Completed Work Log

- 2026-09-12 - Completed repository and reference-document review.
- 2026-09-12 - Established implementation phases and verification baseline.
- 2026-09-12 - Completed integration, prescription/billing/receipt, and transaction-integrity batch.
- 2026-09-12 - Verified 9 frontend tests, 13 backend tests, backend syntax, and the frontend production build.
- 2026-09-12 - Browser-smoked medicine add/edit, prescription create/details, prescription-to-POS handoff, POS, and receipt fallback.

## Current Blockers and Required Inputs

- Approved ER diagram: required before treating the proposed schema as final.
- Running MySQL instance with project credentials: required for the live 20 -> 120 -> 110 stock demonstration and persistence/rollback verification.
