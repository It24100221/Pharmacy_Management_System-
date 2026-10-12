# Final Presentation Content

## 1. Title

**Pharmacy Management System – Senevirathna Medical Pharmacy**  
Project ID: ISE_WE_0101_19

## 2. Problem and client

The pharmacy needs one system for medicines, suppliers, sales, customers, and prescriptions. Manual records make stock, expiry, billing, and prescription follow-up difficult to reconcile. The client is Senevirathna Medical Pharmacy.

## 3. Proposed solution and objectives

The system provides role-based workspaces, SQL-backed catalogue and inventory, supplier purchasing, POS billing, customer accounts, prescription upload/review, and linked receipts. Objectives are accurate stock, traceable transactions, safer prescription handling, and faster service.

## 4. Four integrated epics

1. Medicine and inventory management.
2. Supplier and purchase management.
3. Sales and billing management.
4. Prescription and customer management.

The integration path is supplier receipt → batch stock → POS sale → invoice/receipt, with customer prescription approval joining the billing path.

## 5. Technology and architecture

- React 18, React Router, Vite, Axios, and CSS for the frontend.
- Node.js, Express, JWT authentication, role middleware, and repository/controller layers for the API.
- Microsoft SQL Server with ordered additive migrations 001–009.
- Parameterized queries and SQL transactions protect inventory, billing, and lifecycle updates.

## 6. Database explanation

Core entities are users, customers, medicines/products, medicine batches, suppliers, purchases and receipts, prescriptions/items, orders, sales/items, invoices/payments, and stock movements. Primary keys identify rows; foreign keys preserve relationships. Batches support expiry-aware FEFO allocation. `stock_movements` is the append-only audit ledger.

## 7. Security and validation

Passwords are bcrypt hashes; JWTs are issuer/audience checked and role-scoped. Customer data, orders, prescriptions, and files use ownership checks. Uploads accept only verified PDF/JPG/PNG files within the configured size limit. Validators reject malformed IDs, quantities, dates, duplicate lines, and overpayments.

## 8. Testing evidence

The final checks recorded 77/77 backend tests, 22/22 frontend tests, a passing production build, 72/72 read-only API checks, 32/32 extended API checks, 45/45 browser smoke runs, and a successful isolated SQL Server write rehearsal.

## 9. Challenges and solutions

The main issues were SQL dialect compatibility, prescription list joins, React effect cleanup, public route middleware order, stock accounting, cumulative payment checks, and accessible labels. Fixes were kept additive and covered with regression tests.

## 10. Limitations and future work

Live external payments, email/SMS, malware scanning, refunds, advanced reporting, and full concurrency testing are not claimed. Future work can add those providers, reconcile legacy aggregate stock into verified batches, and expand audit logging.

## 11. Conclusion

The implemented MVP connects the four pharmacy workflows through a role-aware React application, Express API, and SQL Server transactions. It is suitable for a controlled live demonstration with synthetic seeded data.

