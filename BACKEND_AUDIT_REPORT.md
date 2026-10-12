# Backend Audit Report

Audit timestamp: 2026-10-09 16:07 +05:30 (Asia/Colombo)  
Branch/commit inspected: `dev-2` / `142d5be` plus the uncommitted worktree  
Backend: Node.js 24.21.0, Express 4.22.3, npm 11.19.0  
Database target: Microsoft SQL Server via `mssql` 11.0.2

## Result

The backend contains 58 registered HTTP routes. All 58 were called by the read-only live verifier. Thirty-one routes completed a successful read/readiness request; the remaining 27 were exercised only through a safe authorization, validation, not-found, or unsupported-media path because successful mutation testing would create or delete records in the shared local database.

No MySQL package or runtime connection exists. A small compatibility layer converts legacy placeholder/date/limit syntax to SQL Server syntax before parameterized execution. This is technical debt, but the active driver and server are SQL Server.

## Architecture

| Layer | Implementation |
|---|---|
| Entry point | `backend/src/server.js` |
| Express app | `backend/src/app.js` |
| Routes | `backend/src/routes/*.js` |
| Controllers | `backend/src/controllers/*.js` |
| Domain persistence | `backend/src/repositories/*.js` |
| File storage service | `backend/src/services/prescriptionFileStorage.js` |
| Authentication | JWT, bcryptjs cost 12, database identity rehydration |
| Database | Microsoft SQL Server Express, pooled `mssql` connection |
| Tests | Node built-in test runner plus live fetch/SQL verifier |

## Route audit

`Working` means a live successful route/readiness request was completed in this run. `Not Tested` means the route was reached and its safe rejection behavior passed, but its successful mutation/download path was not run. `Missing` means the requested capability has no registered route.

| Module | API Endpoint | Controller | Service / Repository | Database Table(s) | Status |
|---|---|---|---|---|---|
| Health | `GET /api/health` | inline app handler | database pool | SQL Server connection | Working |
| Authentication | `POST /api/auth/customer-login` | `customerLogin` | `authRepository` | users, customers | Not Tested |
| Authentication | `POST /api/auth/customer/login` | `customerLogin` | `authRepository` | users, customers | Not Tested |
| Authentication | `POST /api/auth/staff-login` | `staffLogin` | `authRepository` | users, staff | Not Tested |
| Authentication | `GET /api/auth/me` | `getCurrentSession` | auth middleware/repository | users, customers, staff | Working |
| Products | `GET /api/products` | `getProducts` | `productRepository` | v_product_catalog, products, categories | Working |
| Products | `GET /api/products/:productCode` | `getProductByCode` | `productRepository` | v_product_catalog | Working |
| Cart | `GET /api/cart` | `getCart` | `cartRepository` | carts, cart_items, products | Working |
| Cart | `POST /api/cart/items` | `addItem` | `cartRepository` | carts, cart_items, products | Not Tested |
| Cart | `PATCH /api/cart/items/:productId` | `updateItem` | `cartRepository` | cart_items, products | Not Tested |
| Cart | `DELETE /api/cart/items/:productId` | `removeItem` | `cartRepository` | cart_items | Not Tested |
| Cart | `DELETE /api/cart` | `clear` | `cartRepository` | cart_items | Not Tested |
| Orders | `POST /api/orders/checkout` | `checkout` | `orderRepository` | carts, cart_items, orders, order_items | Not Tested |
| Orders | `GET /api/orders/mine` | `getMine` | `orderRepository` | orders, customers | Working |
| Orders | `GET /api/orders/pending-review` | `getPendingReview` | `orderRepository` | orders, prescription_uploads | Working |
| Orders | `GET /api/orders/ready-for-billing` | `getReadyForBilling` | `orderRepository` | orders | Working |
| Orders | `GET /api/orders/:id` | `getById` | `orderRepository` | orders, order_items | Not Tested |
| Orders | `POST /api/orders/:id/review` | `review` | `orderRepository` | orders, prescription_uploads | Not Tested |
| Orders | `POST /api/orders/:id/complete-sale` | `completeSale` | `saleRepository` | orders, sales, sale_items, medicines | Not Tested |
| Medicines | `GET /api/medicines` | `getAllMedicines` | `medicineRepository` | medicines, products | Working |
| Medicines | `GET /api/medicines/low-stock` | `getLowStockMedicines` | `medicineRepository` | medicines, products | Working |
| Medicines | `GET /api/medicines/expiry-status` | `getExpiryStatusMedicines` | `medicineRepository` | medicines, products | Working |
| Medicines | `GET /api/medicines/:id` | `getMedicineById` | `medicineRepository` | medicines, products | Working |
| Medicines | `POST /api/medicines` | `createMedicine` | `medicineRepository` | medicines, products | Not Tested |
| Medicines | `PUT /api/medicines/:id` | `updateMedicine` | `medicineRepository` | medicines, products | Not Tested |
| Medicines | Required delete/deactivate route | none | none | medicines, products | Missing |
| Sales | `GET /api/sales` | `getAllSales` | `saleRepository` | sales, sale_items, customers | Working |
| Sales | `GET /api/sales/recent` | `getRecentSales` | `saleRepository` | sales, customers | Working |
| Sales | `GET /api/sales/today-summary` | `getTodaySummary` | `saleRepository` | sales, sale_items | Working |
| Sales | `GET /api/sales/:id` | `getSaleById` | `saleRepository` | sales, sale_items | Working |
| Sales | `GET /api/sales/:id/receipt` | `getReceipt` | `saleRepository` | sales, sale_items | Working |
| Sales | `POST /api/sales` | `createSale` | `saleRepository` | sales, sale_items, medicines | Not Tested |
| Suppliers | `GET /api/suppliers` | `getAllSuppliers` | `supplierRepository` | suppliers | Working |
| Suppliers | `GET /api/suppliers/:id` | `getSupplierById` | `supplierRepository` | suppliers | Working |
| Suppliers | `POST /api/suppliers` | `createSupplier` | `supplierRepository` | suppliers | Not Tested |
| Suppliers | `PUT /api/suppliers/:id` | `updateSupplier` | `supplierRepository` | suppliers | Not Tested |
| Suppliers | `DELETE /api/suppliers/:id` | `deleteSupplier` | `supplierRepository` | suppliers | Not Tested |
| Purchases | `GET /api/purchases` | `getAllPurchases` | `purchaseRepository` | purchases, purchase_items, suppliers | Working |
| Purchases | `GET /api/purchases/recent` | `getRecentPurchases` | `purchaseRepository` | purchases, suppliers | Working |
| Purchases | `GET /api/purchases/:id` | `getPurchaseById` | `purchaseRepository` | purchases, purchase_items | Working |
| Purchases | `POST /api/purchases` | `createPurchase` | `purchaseRepository` | purchases, purchase_items, medicines | Not Tested |
| Customers | `POST /api/customers/register` | `registerCustomer` | `authRepository` | users, customers | Not Tested |
| Customers | `GET /api/customers/me` | `getCurrentCustomer` | `customerRepository` | customers | Working |
| Customers | `PUT /api/customers/me` | `updateCurrentCustomer` | `customerRepository` | customers | Not Tested |
| Customers | `GET /api/customers` | `getAllCustomers` | `customerRepository` | customers | Working |
| Customers | `GET /api/customers/:id` | `getCustomerById` | `customerRepository` | customers | Working |
| Customers | `POST /api/customers` | `createCustomer` | `customerRepository` | customers | Not Tested |
| Customers | `PUT /api/customers/:id` | `updateCustomer` | `customerRepository` | customers | Not Tested |
| Customers | `DELETE /api/customers/:id` | `deleteCustomer` | `customerRepository` | customers | Not Tested |
| Prescriptions | `GET /api/prescriptions` | `getAllPrescriptions` | `prescriptionRepository` | prescriptions, prescription_items | Working |
| Prescriptions | `POST /api/prescriptions/upload` | `uploadPrescription` | file storage + repository | prescription_uploads, orders | Not Tested |
| Prescriptions | `GET /api/prescriptions/mine` | `getOwnUploads` | `prescriptionRepository` | prescription_uploads | Working |
| Prescriptions | `GET /api/prescriptions/customer/:id` | `getCustomerUploads` | `prescriptionRepository` | prescription_uploads | Working |
| Prescriptions | `GET /api/prescriptions/recent` | `getRecentPrescriptions` | `prescriptionRepository` | prescriptions | Working |
| Prescriptions | `GET /api/prescriptions/:id/availability` | `checkAvailability` | `prescriptionRepository` | prescription_items, medicines | Working |
| Prescriptions | `GET /api/prescriptions/:id` | `getPrescriptionById` | `prescriptionRepository` | prescriptions, prescription_items | Working |
| Prescriptions | `POST /api/prescriptions` | `createPrescription` | `prescriptionRepository` | prescriptions, prescription_items | Not Tested |
| Prescriptions | `POST /api/prescriptions/:id/send-to-billing` | `sendToBilling` | `prescriptionRepository` | prescriptions, medicines | Not Tested |
| Prescriptions | `GET /api/prescription-uploads/:id/file` | `getFile` | file storage + repository | prescription_uploads | Not Tested |
| Authentication | Required logout/token revocation route | none | none | none | Missing |
| Inventory | Required inventory-history/adjustment route | none | none | none | Missing |
| Supplier workflow | Required PO/approval/response/delivery/invoice routes | none | none | none | Missing |
| Billing/payments | Required bill/payment/refund/status routes | none | none | none | Missing |
| Notifications | Required list/create/read/retry routes | none | none | none | Missing |
| Product media | Required medicine/baby-product image upload/read routes | none | none | products metadata only | Missing |

## Confirmed implementation gaps

- No server-side logout or JWT revocation/deny-list.
- No medicine deletion/deactivation endpoint.
- No inventory ledger/history or idempotency key for stock transactions.
- No supplier query, purchase-order lifecycle, delivery status, supplier invoice, or payable workflow.
- No separate customer bill, payment entity, payment status, gateway confirmation, refund, or cancellation workflow.
- No notification table, API, delivery adapter, retry mechanism, or read/unread state.
- Product image metadata exists in SQL Server, but the public API always returns `image_url: null`; there is no product-media upload/download implementation.
- Tax is not modeled. Sales only record a payment-method label.
- Category remains optional in medicine validation; it is not required.
- Rate limiting is not implemented.

## Status summary

| Classification | Count |
|---|---:|
| Registered routes called | 58 |
| Successful live read/readiness paths | 31 |
| Registered mutation/download paths only safely rejected | 27 |
| Required capability groups with no route | 7 |
