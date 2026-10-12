# API and Database Test Report

Audit date: 2026-10-09  
API base: `http://127.0.0.1:5000/api`  
Database: SQL Server Express `pharmacy_management`, version 17.0.1135.8

## Execution summary

- Registered endpoints discovered: 90/90 tested at least once.
- Endpoint cases: 90; 87 passed, 3 failed.
- Additional validation/security cases: 14/14 passed.
- Total API cases: 104; 101 passed, 3 failed.
- Database writes detected by before/after snapshots: 0.
- Success-path writes were intentionally blocked because the configured database is shared.

`PASS` means the endpoint returned its expected success or controlled validation/not-found response. It does not mean a mutation success path was executed.

## Endpoint inventory and result

| Method | Path | Controller | Required access | Actual audit result |
|---|---|---|---|---|
| POST | `/auth/customer-login` | auth.customerLogin | Public | PASS, invalid credentials 401 |
| POST | `/auth/customer/login` | auth.customerLogin | Public | PASS, alias 401 for invalid credentials |
| POST | `/auth/staff-login` | auth.staffLogin | Public | PASS, invalid API case and five valid browser roles |
| GET | `/auth/me` | auth.getCurrentSession | Authenticated | PASS 200 |
| GET | `/billing/sales/:saleId/invoice` | billing.getInvoiceBySale | Admin, Sales | PASS, historical sale has controlled 404 |
| POST | `/billing/invoices/:invoiceId/payments` | billing.recordPayment | Admin, Sales | PASS invalid-input 400; success BLOCKED |
| GET | `/cart` | cart.getCart | Customer | PASS 200 |
| POST | `/cart/items` | cart.addItem | Customer | PASS invalid-input 400; success BLOCKED |
| PATCH | `/cart/items/:productId` | cart.updateItem | Customer | PASS invalid-input 400; success BLOCKED |
| DELETE | `/cart/items/:productId` | cart.removeItem | Customer | PASS invalid-input 400; success BLOCKED |
| DELETE | `/cart` | cart.clear | Customer | PASS unauthorized-role 403; success BLOCKED |
| POST | `/customers/register` | auth.registerCustomer | Public intended | **FAIL 401**, BUG-003 |
| GET | `/customers/me` | customer.getCurrentCustomer | Customer | PASS 200 |
| PUT | `/customers/me` | customer.updateCurrentCustomer | Customer | PASS invalid-input 400; success BLOCKED |
| GET | `/customers` | customer.getAllCustomers | Admin, Pharmacist, Sales | PASS 200 |
| GET | `/customers/:id` | customer.getCustomerById | Admin, Pharmacist, Sales | PASS 200 |
| POST | `/customers` | customer.createCustomer | Admin, Pharmacist | PASS invalid-input 400; success BLOCKED |
| PUT | `/customers/:id` | customer.updateCustomer | Admin, Pharmacist | PASS invalid-input 400; success BLOCKED |
| DELETE | `/customers/:id` | customer.deleteCustomer | Admin, Pharmacist | PASS invalid-input 400; success BLOCKED |
| GET | `/medicines` | medicine.getAllMedicines | Admin, Pharmacist, Inventory, Sales | PASS 200 |
| GET | `/medicines/low-stock` | medicine.getLowStockMedicines | Same read roles | PASS 200 |
| GET | `/medicines/expiry-status` | medicine.getExpiryStatusMedicines | Same read roles | PASS 200 |
| GET | `/medicines/:id/batches` | medicine.getBatches | Same read roles | PASS 200 |
| GET | `/medicines/:id/movements` | medicine.getStockMovements | Same read roles | PASS 200 |
| GET | `/medicines/:id` | medicine.getMedicineById | Same read roles | PASS 200 |
| POST | `/medicines` | medicine.createMedicine | Admin, Inventory | PASS invalid-input 400; success BLOCKED |
| POST | `/medicines/:id/batches` | medicine.createBatch | Admin, Inventory | PASS invalid ID 400; success BLOCKED |
| POST | `/medicines/:id/adjust-stock` | medicine.adjustStock | Admin, Inventory | PASS invalid ID 400; success BLOCKED |
| PUT | `/medicines/:id` | medicine.updateMedicine | Admin, Inventory | PASS invalid-input 400; success BLOCKED; BUG-004 |
| GET | `/notifications` | notification.list | Authenticated/scoped | PASS 200 |
| PATCH | `/notifications/:id/read` | notification.markRead | Authenticated/scoped | PASS missing record 404; success BLOCKED |
| POST | `/orders/checkout` | order.checkout | Customer | PASS wrong-role 403; success BLOCKED |
| GET | `/orders/mine` | order.getMine | Customer | PASS 200 |
| GET | `/orders/pending-review` | order.getPendingReview | Admin, Pharmacist | PASS 200 |
| GET | `/orders/ready-for-billing` | order.getReadyForBilling | Admin, Sales | PASS 200 |
| GET | `/orders/:id` | order.getById | Customer/authorized staff | PASS 200 for owned browser fixture; missing API 404 |
| POST | `/orders/:id/review` | order.review | Admin, Pharmacist | PASS invalid decision 400; success BLOCKED |
| POST | `/orders/:id/complete-sale` | order.completeSale | Admin, Sales | PASS invalid ID 400; success BLOCKED |
| GET | `/prescriptions` | prescription.getAllPrescriptions | Customer, Admin, Pharmacist | **FAIL 500**, BUG-001 |
| POST | `/prescriptions/upload` | upload.uploadPrescription | Customer | PASS wrong media 415; real upload BLOCKED |
| GET | `/prescriptions/mine` | upload.getOwnUploads | Customer | PASS 200 |
| GET | `/prescriptions/customer/:id` | upload.getCustomerUploads | Owner/Admin/Pharmacist | PASS 200 |
| GET | `/prescriptions/recent` | prescription.getRecentPrescriptions | Admin, Pharmacist | PASS 200 |
| GET | `/prescriptions/:id/availability` | prescription.checkAvailability | Customer/Admin/Pharmacist | PASS 200 |
| GET | `/prescriptions/:id` | prescription.getPrescriptionById | Customer/Admin/Pharmacist | PASS 200 |
| POST | `/prescriptions` | prescription.createPrescription | Admin, Pharmacist | PASS invalid-input 400; success BLOCKED |
| POST | `/prescriptions/:id/send-to-billing` | prescription.sendToBilling | Admin, Pharmacist | PASS invalid ID 400; success BLOCKED |
| GET | `/prescriptions/:id/billing` | prescription.getBilling | Admin, Pharmacist, Sales | PASS controlled 409 for non-billable fixture |
| PATCH | `/prescriptions/:id/status` | prescription.updateStatus | Admin, Pharmacist | PASS invalid ID 400; success BLOCKED |
| GET | `/prescription-uploads/:id/file` | upload.getFile | Owner/Admin/Pharmacist | PASS invalid ID 400; valid private download NOT TESTED |
| GET | `/products` | product.getProducts | Public | PASS 200 |
| POST | `/products/id/:productId/image` | product.uploadProductImage | Admin, Inventory | PASS wrong media 415; success BLOCKED |
| GET | `/products/:productCode/image` | product.getProductImage | Public | PASS controlled 404 (no image fixture) |
| GET | `/products/:productCode` | product.getProductByCode | Public | PASS 200 |
| GET | `/purchase-orders` | purchaseOrder.list | Admin, Inventory, Supplier | PASS 200 |
| GET | `/purchase-orders/:id` | purchaseOrder.get | Same read roles | PASS missing record 404; real fixture unavailable |
| POST | `/purchase-orders` | purchaseOrder.create | Admin, Inventory | PASS invalid-input 400; success BLOCKED |
| PATCH | `/purchase-orders/:id/status` | purchaseOrder.updateStatus | Admin, Inventory | PASS invalid ID 400; success BLOCKED |
| GET | `/purchases` | purchase.getAllPurchases | Admin, Inventory, Supplier | PASS 200 |
| GET | `/purchases/recent` | purchase.getRecentPurchases | Same read roles | PASS 200 |
| GET | `/purchases/:id` | purchase.getPurchaseById | Same read roles | PASS 200 |
| POST | `/purchases` | purchase.createPurchase | Admin, Inventory | PASS invalid-input 400; success BLOCKED |
| GET | `/sales` | sales.getAllSales | Admin, Sales | PASS 200 |
| GET | `/sales/recent` | sales.getRecentSales | Admin, Sales | PASS 200 |
| GET | `/sales/today-summary` | sales.getTodaySummary | Admin, Sales | PASS 200 |
| GET | `/sales/:id` | sales.getSaleById | Admin, Sales | PASS 200 |
| GET | `/sales/:id/receipt` | sales.getReceipt | Admin, Sales | PASS 200 |
| POST | `/sales` | sales.createSale | Admin, Sales | PASS invalid-input 400; success BLOCKED |
| GET | `/reorder-requests/low-stock` | supplierOps.lowStock | Admin, Inventory | PASS 200 |
| GET | `/reorder-requests` | supplierOps.listReorders | Admin, Inventory | PASS 200 |
| POST | `/reorder-requests` | supplierOps.createReorder | Admin, Inventory | PASS invalid-input 400; success BLOCKED |
| PATCH | `/reorder-requests/:id/status` | supplierOps.updateReorderStatus | Admin, Inventory | PASS invalid ID 400; success BLOCKED |
| GET | `/supplier-inquiries` | supplierOps.listInquiries | Admin, Inventory, Supplier | PASS 200 |
| GET | `/supplier-inquiries/:id` | supplierOps.getInquiry | Same read roles | PASS missing record 404 |
| POST | `/supplier-inquiries` | supplierOps.createInquiry | Admin, Inventory | PASS invalid-input 400; success BLOCKED |
| POST | `/supplier-inquiries/:id/messages` | supplierOps.addInquiryMessage | Admin, Inventory | PASS invalid-input 400; success BLOCKED |
| PATCH | `/supplier-inquiries/:id/status` | supplierOps.updateInquiryStatus | Admin, Inventory | PASS invalid ID 400; success BLOCKED |
| GET | `/supplier-invoices` | supplierOps.listInvoices | Admin, Inventory | PASS 200 |
| GET | `/supplier-invoices/:id` | supplierOps.getInvoice | Admin, Inventory | PASS missing record 404 |
| POST | `/supplier-invoices` | supplierOps.createInvoice | Admin, Inventory | PASS invalid-input 400; success BLOCKED |
| POST | `/supplier-invoices/:id/payments` | supplierOps.recordPayment | Admin, Inventory | PASS invalid-input 400; success BLOCKED |
| GET | `/goods-receipts` | supplierOps.listReceipts | Admin, Inventory | PASS 200 |
| GET | `/goods-receipts/:id` | supplierOps.getReceipt | Admin, Inventory | PASS missing record 404 |
| POST | `/goods-receipts` | supplierOps.createReceipt | Admin, Inventory | PASS invalid-input 400; success BLOCKED |
| GET | `/suppliers` | supplier.getAllSuppliers | Admin, Inventory, Supplier | PASS 200 |
| GET | `/suppliers/:id` | supplier.getSupplierById | Same read roles | PASS 200 |
| POST | `/suppliers` | supplier.createSupplier | Admin, Inventory | PASS invalid-input 400; success BLOCKED |
| PUT | `/suppliers/:id` | supplier.updateSupplier | Admin, Inventory | PASS invalid-input 400; success BLOCKED |
| DELETE | `/suppliers/:id` | supplier.deleteSupplier | Admin, Inventory | PASS invalid ID 400; success BLOCKED |
| GET | `/health` | app readiness | Public intended | **FAIL 401**, BUG-003 |

## Validation and authorization checks

All 14 additional cases passed: negative/excessive pagination, malformed/reversed dates, wrong input types, partial numeric input, fractional quantities, past expiry, SQL integer/money overflow, malformed JSON, and benign SQL-injection text. Missing, malformed, expired, wrong-signature, and deleted-user JWT behavior is also covered by the 63-test backend suite.

Frontend role redirects passed for Customer, Sales, Inventory, Supplier, and Pharmacist. Backend role middleware rejected tested unauthorized requests with 403. Customer order and prescription/file controllers contain ownership checks; valid cross-customer file retrieval was not attempted because it would expose a private fixture.

## Database integrity results

| Check | Result |
|---|---|
| Migrations | 001–009 present in order |
| Disabled/untrusted foreign keys | 0 |
| Disabled/untrusted check constraints | 0 |
| Orphans across 12 core relationships | 0 |
| Negative/zero-invalid quantities | 0 |
| Sale total mismatches | 0 |
| Purchase total mismatches | 0 |
| Order total mismatches | 0 |
| Invoice/payment inconsistencies | 0 (tables empty) |
| Prescription/sale lifecycle inconsistencies | 0 |
| Duplicate usernames/product codes | 0 |
| Duplicate medicine names | 1 group, 3 rows |
| Duplicate supplier company names | 1 group, 4 rows |
| Batch reconciliation | 11 medicines, 598 units, 0 batch rows; all stock legacy/unallocated |
| Stock movement ledger | 0 rows |

The empty operational tables (`medicine_batches`, `stock_movements`, purchase orders, receipts, supplier invoices/payments, customer invoices/payments, notifications) mean schema integrity is visible but successful lifecycle persistence is unverified.

## Evidence

- `evidence/extended-api-audit.json`
- `evidence/database-integrity-audit.json`
- `logs/readonly-api.log`
- `logs/backend-runtime.err.log`
- `scripts/extendedApiAudit.cjs`
- `scripts/databaseIntegrityAudit.cjs`
