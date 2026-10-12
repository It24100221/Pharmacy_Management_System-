# Inventory and supplier integration

## Implementation and verification status

The existing SQL Server inventory, supplier, notification, purchase-order and goods-receipt modules now share a persisted replenishment workflow. Automatic requests are configurable per medicine. Supplier ownership comes from the authenticated user's database account binding.

| Component | Status |
|---|---|
| Low-stock detection | VERIFIED through SQL Server API tests, including zero stock, threshold sales and adjustments, expired and inactive batches |
| Reorder request creation | VERIFIED, including concurrent duplicate requests |
| Assigned supplier lookup | VERIFIED, including missing mappings and unlinked accounts |
| Supplier notification | VERIFIED for SQL persistence, ownership, unread/read state and deduplication |
| Medicine details displayed | API data VERIFIED; React details implemented; complete browser verification pending |
| Supplier response | VERIFIED for ownership, quantity/date validation, availability and retry behavior |
| Purchase-order integration | VERIFIED for linked approval, confirmation and unchanged stock before receipt |
| Goods receipt | VERIFIED for partial deliveries, over-receiving, expired delivery rejection and concurrent retries |
| Inventory stock update | VERIFIED: 8 existing units + 92 received units = 100, with one stock movement |
| SQL Server persistence | VERIFIED, including HTTP server stop/start within the test process |
| End-to-end testing | 19 SQL Server API scenarios passed; complete browser workflow pending |

The complete browser audit was not executed before the request to push the current changes. This report does not claim that gate has passed.

## Existing functionality reused

- Existing medicine, batch, supplier and supplier-medicine records and permanent medicine/product codes.
- Existing reorder requests, personal notifications, purchase orders/items, goods receipts/items and stock movements.
- Existing Express authentication, role checks, SQL Server transaction wrapper and API error handling.
- Existing React navigation, dashboards, purchase-order and goods-receipt pages, toast messages and product image rendering.
- Existing order states: approval creates a linked `DRAFT` order; staff send it, the assigned supplier confirms it, and receipts determine `PARTIALLY_RECEIVED` / `RECEIVED`. No stock is added during approval or confirmation.

## Database migration and backup

Added [015_inventory_supplier_integration.sql](database/mssql/migrations/015_inventory_supplier_integration.sql):

- `supplier_users` links real supplier logins to supplier companies.
- `supplier_responses` stores response quantity, delivery date, quote, message, responder and approval.
- Medicine reorder targets and optional automatic request settings.
- Request numbers, priority, requested delivery date and stock snapshots.
- Purchase-order links to the originating request and response.
- A filtered unique index prevents active requests for the same medicine and supplier.
- `v_inventory_supply_stock` separates physical quantity from eligible stock.

The migration was applied to the isolated test database and the existing live database after a SQL Server `COPY_ONLY`, checksum-verified backup. The migration preserves existing business rows and does not guess supplier ownership.

Verified backup created on 2026-10-10:

`D:\Softwares\MSSQL17.SQLEXPRESS\MSSQL\Backup\pharmacy_management_before_supplier_integration_20261010131904251.bak`

[backupSupplierIntegration.js](backend/src/scripts/backupSupplierIntegration.js) creates a backup, verifies it and can restore a missing isolated test database with `--prepare-test-database`. It refuses a different source database and does not replace an existing test database. Local backup receipts and database snapshots are ignored by Git.

## Files and backend APIs

Core additions:

- [inventorySupply.js](backend/src/services/inventorySupply.js): shared transactions, request creation, supplier scope, notification delivery, responses, approvals and configuration.
- [inventorySupplyController.js](backend/src/controllers/inventorySupplyController.js): validated API contracts and supplier account administration.
- [verifySupplierIntegration.js](backend/src/scripts/verifySupplierIntegration.js): isolated SQL Server integration verification.

Existing medicine, sale, purchase, supplier, purchase-order, supplier-operations, authentication and notification repositories/controllers/routes were connected to the shared workflow. Stock-changing transactions check configured automatic requests before commit. Supplier-facing queries enforce company ownership in SQL.

| API | Purpose |
|---|---|
| `GET /api/reorder-requests/low-stock` | Eligible stock, targets, supplier assignment and request status |
| `POST /api/reorder-requests` | Staff create a persisted request |
| `GET /api/reorder-requests` | Staff history or authenticated supplier's assigned requests |
| `GET /api/reorder-requests/:id` | Ownership-checked request details |
| `POST /api/reorder-requests/:id/respond` | Assigned supplier availability / quotation |
| `POST /api/reorder-requests/:id/review` | Staff approve into a linked order or reject |
| `GET /api/medicines/:id/supply-settings` | Current supplier mappings and settings |
| `PUT /api/medicines/:id/supply-settings` | Staff configure supplier, target and automatic requests |
| `GET /api/suppliers/accounts` | Administrator lists supplier login bindings |
| `POST /api/suppliers/accounts` | Administrator creates a linked supplier login |
| `PUT /api/suppliers/accounts/:userId` | Administrator links an existing supplier login |
| Existing `/api/notifications` and `/:id/read` | Persisted personal notification list, count and read state |
| Existing `/api/purchase-orders` and `/:id/status` | Purchase orders and authorized transitions |
| Existing `POST /api/goods-receipts` | Transactional batch receipt and stock movement |

## Notifications and ownership

Notifications are stored in SQL Server for specific users linked to the assigned supplier company. Their content uses actual medicine identity, stock, threshold and requested quantity. Notification creation and workflow updates share the transaction. Deduplication keys and locked queries make retries safe.

Supplier identity is read from the current database binding, never accepted from client-supplied supplier IDs. Supplier request, order, directory and notification reads are scoped to that company. Inventory/purchasing staff receive supplier response notifications. Supplier confirmation and goods receipt notifications use the same personal delivery mechanism. The existing notification read update was corrected to use SQL Server's returned row count.

No email or SMS service is configured or claimed.

## Frontend changes

- [InventorySupplyPanel.jsx](frontend/src/components/InventorySupplyPanel.jsx): dashboard and purchasing low/out-of-stock list, supplier settings, Request Supply, history, response review and approval.
- [SupplierDashboard.jsx](frontend/src/pages/SupplierDashboard.jsx): Incoming Medicine Supply Requests, details, real availability/quotation form, assigned orders and confirmation.
- [SupplyRequestDetails.jsx](frontend/src/components/SupplyRequestDetails.jsx): actual medicine identity, optional product image and workflow details.
- [SupplierAccountManager.jsx](frontend/src/components/SupplierAccountManager.jsx): administrator account creation and company binding on the supplier management page.
- [StaffNotifications.jsx](frontend/src/components/StaffNotifications.jsx): shared notification menu, unread count, persisted read state and navigation to the linked workflow.
- Existing staff/header navigation, supplier list, inventory dashboard, purchasing, low-stock, normalization and goods-receipt pages were updated. Goods receipts retain an attempt key across network retries and refresh inventory after a successful receipt.

Prior requested changes are also retained: the Request Stock dialog fix, removal of the medicine-list Batches action, separate supplier/purchasing dashboard shortcuts, and product-image components/assets/review metadata.

## Executed checks

- **2026-10-10:** 19/19 isolated SQL Server integration scenarios passed on `pharmacy_management_test`, with no live-database writes from that script.
- **2026-10-12:** backend `npm.cmd test`: **94/94 passed**.
- **2026-10-12:** frontend `npm.cmd test`: **30/30 passed**. The low-stock source check was updated to recognize its shared action helper used by both lists.
- **2026-10-12:** frontend `npm.cmd run build`: **passed**. Vite reports the existing application bundle size warning above 500 kB.

The SQL scenarios exercise the 8-to-100 workflow, multiple suppliers, spoofed ownership, unread/read persistence, unavailable/rejected responses, partial availability and receipts, expired stock and deliveries, duplicate and concurrent processing, simulated transaction/database failures, and retry delivery. The server persistence scenario stops and restarts the HTTP listener in the same process; a full process restart and complete browser workflow remain unverified.

Local detailed SQL results are in `backend/.local/supplier-integration-verification.json`. Test evidence, runtime uploads, environment files, database backups and credentials are excluded from the push. Reusable QA scripts are included. No new supplier-integration browser screenshots were produced.

Re-run the isolated integration suite from `backend` in PowerShell after preparing/migrating the isolated database:

```powershell
$env:DB_NAME = 'pharmacy_management_test'
node src/scripts/verifySupplierIntegration.js
```

The script refuses other database names. Test fixtures remain exclusively in the isolated test database; it does not delete business data.

## Configuration and limitations

1. An administrator must link or create the supplier login on **Supplier management**. Inventory staff then select the actual supplier and reorder target under **Supply settings**. Enable automatic requests where wanted. No existing login or medicine is assigned to a guessed supplier.
2. Existing unassigned historical requests remain preserved. New requests require a valid supplier-medicine assignment; unlinked supplier logins receive an explicit configuration error.
3. Eligible stock excludes expired and inactive batches and handles valid unallocated legacy stock. The current schema has no reservation model to subtract.
4. Automatic detection runs during stock-changing transactions and configuration updates. There is no background clock-triggered expiry scan; current read queries still calculate eligible stock when loaded.
5. Dashboard notifications refresh by polling every 30 seconds and after relevant actions. No websocket delivery is claimed.
6. Full browser verification, new browser screenshots and process-restart verification are pending. API verification is not presented as a completed browser audit.
