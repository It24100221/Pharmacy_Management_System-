const fs = require('fs')
const path = require('path')
const dotenv = require('../../backend/node_modules/dotenv')

dotenv.config({ path: path.resolve(__dirname, '../../backend/.env') })

const jwt = require('../../backend/node_modules/jsonwebtoken')
const { pool, closePool } = require('../../backend/src/config/database')
const { getJwtSecret, JWT_AUDIENCE, JWT_ISSUER } = require('../../backend/src/config/jwt')

const API = process.env.VERIFY_API_BASE || 'http://127.0.0.1:5000/api'
const evidencePath = path.resolve(__dirname, '../evidence/extended-api-audit.json')

const tokenFor = userId => jwt.sign({ userId }, getJwtSecret(), {
  expiresIn: '10m', issuer: JWT_ISSUER, audience: JWT_AUDIENCE,
})

async function state() {
  const [users] = await pool.execute(`
    SELECT u.user_id, u.role FROM users u
    WHERE u.role IN ('CUSTOMER','ADMIN','PHARMACIST','INVENTORY','SALES','SUPPLIER')
    ORDER BY u.user_id
  `)
  const tokens = {}
  for (const row of users) if (!tokens[row.role]) tokens[row.role] = tokenFor(row.user_id)
  const [medicines] = await pool.execute('SELECT TOP 1 id FROM medicines ORDER BY id')
  const [products] = await pool.execute('SELECT TOP 1 product_id, product_code FROM products ORDER BY product_id')
  const [sales] = await pool.execute('SELECT TOP 1 id FROM sales ORDER BY id')
  const [prescriptions] = await pool.execute('SELECT TOP 1 id FROM prescriptions ORDER BY id')
  return { tokens, medicine: medicines[0]?.id, product: products[0], sale: sales[0]?.id, prescription: prescriptions[0]?.id }
}

async function snapshot() {
  const [rows] = await pool.execute(`
    SELECT
      (SELECT COUNT(*) FROM medicine_batches) AS medicine_batches,
      (SELECT COUNT(*) FROM stock_movements) AS stock_movements,
      (SELECT COUNT(*) FROM notifications) AS notifications,
      (SELECT COUNT(*) FROM customer_payments) AS customer_payments,
      (SELECT COUNT(*) FROM purchase_orders) AS purchase_orders,
      (SELECT COUNT(*) FROM goods_receipts) AS goods_receipts,
      (SELECT COUNT(*) FROM supplier_queries) AS supplier_queries,
      (SELECT COUNT(*) FROM supplier_invoices) AS supplier_invoices,
      (SELECT COUNT(*) FROM supplier_payments) AS supplier_payments,
      (SELECT COALESCE(SUM(CAST(quantity AS bigint)),0) FROM medicines) AS total_medicine_quantity
  `)
  return rows[0]
}

async function request(test, tokens) {
  const headers = { Accept: 'application/json' }
  if (test.role) headers.Authorization = `Bearer ${tokens[test.role]}`
  if (test.body !== undefined) headers['Content-Type'] = test.contentType || 'application/json'
  const response = await fetch(`${API}${test.path}`, {
    method: test.method || 'GET', headers,
    body: test.body === undefined ? undefined : (typeof test.body === 'string' ? test.body : JSON.stringify(test.body)),
  })
  let payload
  try { payload = await response.json() } catch { payload = null }
  return { status: response.status, payload }
}

function cases(ids) {
  const missing = 2147483647
  return [
    { name: 'medicine batches read', path: `/medicines/${ids.medicine}/batches`, role: 'INVENTORY', expected: [200] },
    { name: 'medicine movements read', path: `/medicines/${ids.medicine}/movements`, role: 'INVENTORY', expected: [200] },
    { name: 'medicine batch invalid write', path: '/medicines/0/batches', method: 'POST', role: 'INVENTORY', body: {}, expected: [400] },
    { name: 'medicine adjustment invalid write', path: '/medicines/0/adjust-stock', method: 'POST', role: 'INVENTORY', body: {}, expected: [400] },
    { name: 'notifications list', path: '/notifications', role: 'ADMIN', expected: [200] },
    { name: 'notification missing read update', path: `/notifications/${missing}/read`, method: 'PATCH', role: 'ADMIN', body: {}, expected: [404] },
    { name: 'invoice by historical sale', path: `/billing/sales/${ids.sale}/invoice`, role: 'SALES', expected: [200, 404] },
    { name: 'payment invalid invoice', path: '/billing/invoices/0/payments', method: 'POST', role: 'SALES', body: {}, expected: [400] },
    { name: 'purchase orders list', path: '/purchase-orders', role: 'INVENTORY', expected: [200] },
    { name: 'purchase order missing', path: `/purchase-orders/${missing}`, role: 'INVENTORY', expected: [404] },
    { name: 'purchase order invalid create', path: '/purchase-orders', method: 'POST', role: 'INVENTORY', body: {}, expected: [400] },
    { name: 'purchase order invalid transition', path: '/purchase-orders/0/status', method: 'PATCH', role: 'INVENTORY', body: {}, expected: [400] },
    { name: 'low stock reorder candidates', path: '/reorder-requests/low-stock', role: 'INVENTORY', expected: [200] },
    { name: 'reorder requests list', path: '/reorder-requests', role: 'INVENTORY', expected: [200] },
    { name: 'reorder invalid create', path: '/reorder-requests', method: 'POST', role: 'INVENTORY', body: {}, expected: [400] },
    { name: 'reorder invalid transition', path: '/reorder-requests/0/status', method: 'PATCH', role: 'INVENTORY', body: {}, expected: [400] },
    { name: 'supplier inquiries list', path: '/supplier-inquiries', role: 'SUPPLIER', expected: [200] },
    { name: 'supplier inquiry missing', path: `/supplier-inquiries/${missing}`, role: 'SUPPLIER', expected: [404] },
    { name: 'supplier inquiry invalid create', path: '/supplier-inquiries', method: 'POST', role: 'INVENTORY', body: {}, expected: [400] },
    { name: 'supplier inquiry invalid message', path: '/supplier-inquiries/0/messages', method: 'POST', role: 'INVENTORY', body: {}, expected: [400] },
    { name: 'supplier inquiry invalid transition', path: '/supplier-inquiries/0/status', method: 'PATCH', role: 'INVENTORY', body: {}, expected: [400] },
    { name: 'supplier invoices list', path: '/supplier-invoices', role: 'INVENTORY', expected: [200] },
    { name: 'supplier invoice missing', path: `/supplier-invoices/${missing}`, role: 'INVENTORY', expected: [404] },
    { name: 'supplier invoice invalid create', path: '/supplier-invoices', method: 'POST', role: 'INVENTORY', body: {}, expected: [400] },
    { name: 'supplier payment invalid create', path: '/supplier-invoices/0/payments', method: 'POST', role: 'INVENTORY', body: {}, expected: [400] },
    { name: 'goods receipts list', path: '/goods-receipts', role: 'INVENTORY', expected: [200] },
    { name: 'goods receipt missing', path: `/goods-receipts/${missing}`, role: 'INVENTORY', expected: [404] },
    { name: 'goods receipt invalid create', path: '/goods-receipts', method: 'POST', role: 'INVENTORY', body: {}, expected: [400] },
    { name: 'product image absent or present', path: `/products/${ids.product.product_code}/image`, expected: [200, 404] },
    { name: 'product image wrong media', path: `/products/id/${ids.product.product_id}/image`, method: 'POST', role: 'INVENTORY', body: '{}', expected: [415] },
    { name: 'prescription billing read', path: `/prescriptions/${ids.prescription}/billing`, role: 'SALES', expected: [200, 409] },
    { name: 'prescription status invalid id', path: '/prescriptions/0/status', method: 'PATCH', role: 'PHARMACIST', body: {}, expected: [400] },
  ]
}

async function main() {
  fs.mkdirSync(path.dirname(evidencePath), { recursive: true })
  const ids = await state()
  const before = await snapshot()
  const results = []
  for (const test of cases(ids)) {
    try {
      const actual = await request(test, ids.tokens)
      results.push({ name: test.name, method: test.method || 'GET', path: test.path, expected: test.expected, actual: actual.status, passed: test.expected.includes(actual.status), message: actual.payload?.message || null })
    } catch (error) {
      results.push({ name: test.name, method: test.method || 'GET', path: test.path, expected: test.expected, actual: 'REQUEST_ERROR', passed: false, message: error.message })
    }
  }
  const after = await snapshot()
  const unchanged = JSON.stringify(before) === JSON.stringify(after)
  const result = {
    generatedAt: new Date().toISOString(),
    summary: { total: results.length, passed: results.filter(item => item.passed).length, failed: results.filter(item => !item.passed).length, databaseWrites: unchanged ? 0 : 'DETECTED' },
    databaseBefore: before, databaseAfter: after, results,
  }
  fs.writeFileSync(evidencePath, JSON.stringify(result, null, 2))
  console.log(JSON.stringify(result, null, 2))
  if (!unchanged || result.summary.failed) process.exitCode = 1
}

main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1 }).finally(closePool)
