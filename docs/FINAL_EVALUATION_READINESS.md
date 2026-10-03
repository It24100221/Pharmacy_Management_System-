# Final Evaluation Emergency Sprint

Date: 2026-10-03  
Branch: `dev`  
Starting checkpoint: `6f5c2141f8ae40c0edd07f9608851f341ae69def`

## Overall status

**PARTIALLY READY** for the full emergency backlog. The requested customer-to-prescription-to-sale demonstration and the existing purchase/inventory/sale demonstration are ready. The optional supplier supply-request workflow remains deferred; existing supplier CRUD and purchase receiving remain operational.

| TODO | Status | Evidence | Commit |
|---|---|---|---|
| 0 — Checkpoint | PASS | Started on clean tracked tree at `6f5c214`; `.env` ignored; pre-existing untracked QA artifacts preserved. | N/A |
| 1 — Credential security | PASS | Removed tracked working plaintext credentials; rotated and bcrypt-verified ADMIN, PHARMACIST, INVENTORY, SALES, and SUPPLIER accounts; old passwords rejected; local handoff stored only under ignored `backend/.local/`. | `867c99a` |
| 2 — Registration | PASS | Migration 004 deployed; unique customer email index; server validation for full name, email, phone, address, username, password, and confirmation; atomic users/customers write; `verify:registration` passed including duplicates and partial-row checks. | `ec1921e` |
| 3 — Persistent cart | PASS | Migration 005 deployed `carts` and `cart_items`; JWT-derived customer ownership; database-authoritative price/stock; add/update/remove/clear; customer isolation and repeated reads passed in `verify:customer-order-flow`. | `ca078dc` |
| 4 — Persistent orders | PASS | Checkout transaction creates order and item snapshots, closes the active cart, and never creates a sale. Ownership 403 and SQL persistence passed. | `ca078dc` |
| 5 — Prescription requirement | PASS | Canonical product `prescription_required` drives server state. Non-Rx checkout reached `READY_FOR_BILLING`; Rx checkout reached `PRESCRIPTION_REQUIRED`; order-linked upload moved it to `PENDING_REVIEW`. | `ca078dc` |
| 6 — Pharmacist review | PASS | Database-backed pending queue, secure image fetch, customer/order/items/Product IDs/live availability, role protection, approval and rejection persistence all passed. | `ca078dc` |
| 7 — Durable billing handoff | PASS | Approval persists `READY_FOR_BILLING`; sales queue queries SQL Server and does not depend on React route state. | `ca078dc` |
| 8 — Order to sale | PASS | Existing locked-price sale transaction reused; order-linked sale, sale items, one stock decrement, order/prescription completion, and receipt passed. | `ca078dc` |
| 9 — Customer order history | PASS | `/my-orders` and owned order detail use authenticated database reads; completed/rejected/ready states are visible; another customer received 403. | `ca078dc` |
| 10 — Sales report | PASS | Revenue aggregation separated from sale-item aggregation; unit test passed; `verify:sales-summary` matched API totals with independent SQL totals. | `ca078dc` |
| 11 — Supply requests | DEFERRED | Dedicated low-stock → supplier request → supplied/received states were intentionally not added. Existing Supplier → Purchase Receive → Inventory Increase flow remains PASS and `verify:inventory-lifecycle` proves 100 → 120 → 110. | N/A |
| 12 — Mobile catalogue | PASS | Narrow-screen rules prevent horizontal overflow and collapse catalogue, toolbar, checkout, and workflow grids at mobile widths. | `ca078dc` |
| 13 — Frontend 404 | PASS | Catch-all route renders “Page not found” and “Back to Home.” | `ca078dc` |

## Demonstration paths

### Customer prescription order

1. Register at `/customer-register` and sign in.
2. Browse `/pharmacy-items`; Rx products are labelled.
3. Add to the database-backed cart and open `/customer/checkout`.
4. Create the order. Rx orders require an upload; non-Rx orders enter billing directly.
5. Upload JPG/PNG prescription for the order.
6. Pharmacist opens `/prescription-orders`, checks live stock and the secure image, then approves or rejects.
7. Sales opens `/billing-orders`, selects the payment label, and completes the approved order.
8. Open the generated receipt; customer `/my-orders` shows `COMPLETED`.

### Staff inventory

1. Inventory creates/receives a purchase from `/purchases`.
2. Purchase transaction increases stock.
3. Sales completes a sale from `/sales` or `/billing-orders`.
4. Sale transaction decreases stock exactly once.

## Verification commands

From `backend`:

```powershell
npm.cmd run migrate
npm.cmd test
npm.cmd run verify:registration
npm.cmd run verify:customer-order-flow
npm.cmd run verify:sales-summary
npm.cmd run verify:inventory-lifecycle
```

The live verification commands require a running backend and use `VERIFY_API_BASE` when it is not at port 5000. They create uniquely named temporary records, assert SQL/API state, and clean up their own data.

From `frontend`:

```powershell
npm.cmd test
npm.cmd run build
```

## Deferred scope

- Dedicated supplier supply-request states and screens.
- Sophisticated notification center; durable order statuses serve as the immediate notification mechanism.
- Real payment gateway; Cash/Card/Online are recorded payment-method labels only.
