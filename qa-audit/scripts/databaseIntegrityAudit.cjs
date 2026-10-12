const fs = require('fs')
const path = require('path')
const dotenv = require('../../backend/node_modules/dotenv')
dotenv.config({ path: path.resolve(__dirname, '../../backend/.env') })
const { pool, closePool } = require('../../backend/src/config/database')

const checks = {
  migrations: `SELECT migration_id, migration_name, applied_at FROM schema_migrations ORDER BY migration_id`,
  disabledOrUntrustedForeignKeys: `SELECT OBJECT_NAME(parent_object_id) AS table_name, name, is_disabled, is_not_trusted FROM sys.foreign_keys WHERE is_disabled = 1 OR is_not_trusted = 1`,
  disabledOrUntrustedChecks: `SELECT OBJECT_NAME(parent_object_id) AS table_name, name, is_disabled, is_not_trusted FROM sys.check_constraints WHERE is_disabled = 1 OR is_not_trusted = 1`,
  duplicateUsernames: `SELECT username, COUNT(*) AS duplicate_count FROM users GROUP BY username HAVING COUNT(*) > 1`,
  duplicateProductCodes: `SELECT product_code, COUNT(*) AS duplicate_count FROM products GROUP BY product_code HAVING COUNT(*) > 1`,
  duplicateMedicineNames: `SELECT name, COUNT(*) AS duplicate_count FROM medicines GROUP BY name HAVING COUNT(*) > 1`,
  duplicateSupplierNames: `SELECT company_name, COUNT(*) AS duplicate_count FROM suppliers GROUP BY company_name HAVING COUNT(*) > 1`,
  duplicateCustomerIdentityGroups: `SELECT COUNT(*) AS duplicate_groups FROM (SELECT first_name,last_name,phone,COUNT(*) AS copies FROM customers GROUP BY first_name,last_name,phone HAVING COUNT(*) > 1) duplicates`,
  invalidQuantities: `
    SELECT 'medicines' AS entity, COUNT(*) AS invalid_count FROM medicines WHERE quantity < 0 OR min_stock_level < 0 OR unit_price < 0
    UNION ALL SELECT 'medicine_batches', COUNT(*) FROM medicine_batches WHERE quantity_available < 0
    UNION ALL SELECT 'sale_items', COUNT(*) FROM sale_items WHERE quantity <= 0 OR unit_price < 0 OR line_total < 0
    UNION ALL SELECT 'purchase_items', COUNT(*) FROM purchase_items WHERE quantity <= 0 OR unit_cost < 0 OR total_cost < 0
    UNION ALL SELECT 'order_items', COUNT(*) FROM order_items WHERE quantity <= 0 OR unit_price < 0 OR line_total < 0`,
  orphanCounts: `
    SELECT 'customers.user_id' AS relation_name, COUNT(*) AS orphan_count FROM customers c LEFT JOIN users u ON u.user_id=c.user_id WHERE c.user_id IS NOT NULL AND u.user_id IS NULL
    UNION ALL SELECT 'staff.user_id', COUNT(*) FROM staff s LEFT JOIN users u ON u.user_id=s.user_id WHERE u.user_id IS NULL
    UNION ALL SELECT 'prescriptions.customer_id', COUNT(*) FROM prescriptions p LEFT JOIN customers c ON c.id=p.customer_id WHERE c.id IS NULL
    UNION ALL SELECT 'prescription_items.prescription_id', COUNT(*) FROM prescription_items pi LEFT JOIN prescriptions p ON p.id=pi.prescription_id WHERE p.id IS NULL
    UNION ALL SELECT 'prescription_items.medicine_id', COUNT(*) FROM prescription_items pi LEFT JOIN medicines m ON m.id=pi.medicine_id WHERE m.id IS NULL
    UNION ALL SELECT 'sales.customer_id', COUNT(*) FROM sales s LEFT JOIN customers c ON c.id=s.customer_id WHERE s.customer_id IS NOT NULL AND c.id IS NULL
    UNION ALL SELECT 'sale_items.sale_id', COUNT(*) FROM sale_items si LEFT JOIN sales s ON s.id=si.sale_id WHERE s.id IS NULL
    UNION ALL SELECT 'sale_items.medicine_id', COUNT(*) FROM sale_items si LEFT JOIN medicines m ON m.id=si.medicine_id WHERE m.id IS NULL
    UNION ALL SELECT 'purchases.supplier_id', COUNT(*) FROM purchases p LEFT JOIN suppliers s ON s.id=p.supplier_id WHERE s.id IS NULL
    UNION ALL SELECT 'purchase_items.purchase_id', COUNT(*) FROM purchase_items pi LEFT JOIN purchases p ON p.id=pi.purchase_id WHERE p.id IS NULL
    UNION ALL SELECT 'cart_items.cart_id', COUNT(*) FROM cart_items ci LEFT JOIN carts c ON c.cart_id=ci.cart_id WHERE c.cart_id IS NULL
    UNION ALL SELECT 'order_items.order_id', COUNT(*) FROM order_items oi LEFT JOIN orders o ON o.order_id=oi.order_id WHERE o.order_id IS NULL`,
  saleTotalMismatches: `SELECT s.id, s.total_amount, s.discount, s.final_amount, COALESCE(SUM(si.line_total),0) AS item_total FROM sales s LEFT JOIN sale_items si ON si.sale_id=s.id GROUP BY s.id,s.total_amount,s.discount,s.final_amount HAVING ABS(s.total_amount-COALESCE(SUM(si.line_total),0))>0.01 OR ABS(s.final_amount-(s.total_amount-s.discount))>0.01`,
  purchaseTotalMismatches: `SELECT p.id, p.total_amount, COALESCE(SUM(pi.total_cost),0) AS item_total FROM purchases p LEFT JOIN purchase_items pi ON pi.purchase_id=p.id GROUP BY p.id,p.total_amount HAVING ABS(p.total_amount-COALESCE(SUM(pi.total_cost),0))>0.01`,
  orderTotalMismatches: `SELECT o.order_id,o.subtotal,COALESCE(SUM(oi.line_total),0) AS item_total FROM orders o LEFT JOIN order_items oi ON oi.order_id=o.order_id GROUP BY o.order_id,o.subtotal HAVING ABS(o.subtotal-COALESCE(SUM(oi.line_total),0))>0.01`,
  batchReconciliation: `SELECT m.id,m.name,m.quantity,COUNT(b.batch_id) AS batch_count,COALESCE(SUM(b.quantity_available),0) AS batch_quantity,m.quantity-COALESCE(SUM(b.quantity_available),0) AS legacy_unallocated FROM medicines m LEFT JOIN medicine_batches b ON b.medicine_id=m.id GROUP BY m.id,m.name,m.quantity ORDER BY m.id`,
  invoicePaymentMismatches: `SELECT i.customer_invoice_id,i.total_amount,i.status,COALESCE(SUM(CASE WHEN p.status='CONFIRMED' THEN p.amount ELSE 0 END),0) AS confirmed_payments FROM customer_invoices i LEFT JOIN customer_payments p ON p.customer_invoice_id=i.customer_invoice_id GROUP BY i.customer_invoice_id,i.total_amount,i.status HAVING COALESCE(SUM(CASE WHEN p.status='CONFIRMED' THEN p.amount ELSE 0 END),0)>i.total_amount OR (i.status='PAID' AND COALESCE(SUM(CASE WHEN p.status='CONFIRMED' THEN p.amount ELSE 0 END),0)<i.total_amount) OR (i.status='UNPAID' AND COALESCE(SUM(CASE WHEN p.status='CONFIRMED' THEN p.amount ELSE 0 END),0)>=i.total_amount)`,
  prescriptionSaleIssues: `SELECT p.id,p.status,p.dispensed_at,COUNT(s.id) AS sale_count FROM prescriptions p LEFT JOIN sales s ON s.prescription_id=p.id GROUP BY p.id,p.status,p.dispensed_at HAVING COUNT(s.id)>1 OR (p.status='DISPENSED' AND (COUNT(s.id)<>1 OR p.dispensed_at IS NULL)) OR (p.status<>'DISPENSED' AND p.dispensed_at IS NOT NULL)`,
  statusCounts: `SELECT 'prescriptions' AS entity,status,COUNT(*) AS row_count FROM prescriptions GROUP BY status UNION ALL SELECT 'orders',status,COUNT(*) FROM orders GROUP BY status UNION ALL SELECT 'purchase_orders',status,COUNT(*) FROM purchase_orders GROUP BY status UNION ALL SELECT 'customer_invoices',status,COUNT(*) FROM customer_invoices GROUP BY status`,
}

async function main() {
  const results = {}
  for (const [name, query] of Object.entries(checks)) {
    const [rows] = await pool.execute(query)
    results[name] = rows
  }
  const output = { generatedAt: new Date().toISOString(), checks: Object.keys(checks).length, results }
  const target = path.resolve(__dirname, '../evidence/database-integrity-audit.json')
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, JSON.stringify(output, null, 2))
  console.log(JSON.stringify(output, null, 2))
}

main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1 }).finally(closePool)
