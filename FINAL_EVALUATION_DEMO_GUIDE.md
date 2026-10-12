# Final Evaluation Demo Guide

Use the prepared isolated database `pharmacy_management_demo_20261010b` with fictional records. Do not reset or mutate the shared operational database during the panel demonstration. See `FINAL_STARTUP_AND_RECOVERY_GUIDE.md` for startup.

## Accounts and URLs

- Staff login: `http://localhost:3000/staff-login`
- Customer registration: `http://localhost:3000/customer-register`
- Customer login: `http://localhost:3000/customer-login`
- Staff dashboards: `/staff/admin`, `/staff/inventory`, `/staff/sales`, `/staff/pharmacist`
- API health: `http://localhost:5000/api/health` for the normal shared startup; use `http://localhost:5002/api/health` with the isolated demo startup.

Use the seeded staff role accounts supplied locally. Passwords are intentionally not documented here.

## Demo order

### 1. Medicine and inventory

1. Sign in as `INVENTORY` or `ADMIN`.
2. Open `/medicines` and search by name or Product ID.
3. Open a medicine, then **Batches / stock movements**.
4. Show expiry and low-stock pages (`/medicines/expiry`, `/medicines/low-stock`).
5. Add a medicine with a future batch number, expiry date, and opening quantity. The server writes the opening batch and `OPENING` movement in one transaction.
6. Point out SQL verification queries: `medicines.quantity`, `medicine_batches.quantity_available`, and `stock_movements`.

### 2. Supplier and purchase receiving

1. Open `/suppliers`, select **Add supplier**, and save a fictional supplier.
2. Open `/purchases`, select that supplier and medicine, enter quantity, unit cost, batch number, and future expiry.
3. Save the purchase/receipt. Show the increased medicine quantity and the new batch.
4. Open `/purchase-orders` and `/goods-receipts` to show that creating an order alone does not increase stock.
5. Verify the paired `GOODS_RECEIPT` movement and purchase item in SQL Server.

### 3. Sales and billing

1. Sign in as `SALES` or `ADMIN` and open `/sales`.
2. Search the seeded medicine, add it to the cart, change quantity, and confirm the displayed total.
3. Choose **Cash** and click **Complete Sale**.
4. Open the receipt link. Show the `PAID` invoice/payment status and the reduced stock.
5. Refresh the receipt and sales history. Explain that server-side price/stock checks, idempotency, FEFO allocation, and movement rows prevent double deduction.

### 4. Customer and prescription

1. Register a fictional customer at `/customer-register`, then sign in.
2. Add a prescription-required item from `/pharmacy-items` and open `/customer/checkout`.
3. Create the order and upload a PDF/JPG/PNG prescription from the order page.
4. As `PHARMACIST`, open `/prescription-orders`, preview the file, and approve the order.
5. As `SALES`, open `/billing-orders`, select the approved order, and complete a **Cash** sale.
6. Open the receipt and refresh the customer order. Show `COMPLETED` order state and `DISPENSED` prescription state.
7. Explain ownership checks: customers can access only their own orders, prescriptions, and files.

## Timing and evidence

Target 15–20 minutes: introduction (1), medicine/inventory (4), supplier/purchase (3), POS (4), prescription/customer integration (6), architecture/testing conclusion (2). Use `FINAL_DEMO_TEST_RESULTS.md` for SQL-backed evidence and do not demonstrate deferred external payment or messaging providers.

## Recovery notes

- If no order is ready, use the walk-in POS link and continue the sales demo.
- If a payment provider is requested, explain that external card/online settlement is intentionally not claimed; use Cash for the completed academic flow.
- If the panel asks about the shared database, state that it contains legacy aggregate stock and is kept unchanged; the full mutation demo belongs on the disposable fixture.

