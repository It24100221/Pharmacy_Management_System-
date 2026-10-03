const assert = require('node:assert/strict')
const jwt = require('jsonwebtoken')
const app = require('../app')
const { pool, closePool } = require('../config/database')
const { JWT_AUDIENCE, JWT_ISSUER, getJwtSecret } = require('../config/jwt')

const expectedCategories = ['MEDICINE', 'BABY_ITEMS', 'LAB_ITEMS', 'MEDICAL_ACCESSORIES']

let server
let baseUrl
let purchaseId
let saleId
let temporaryMedicineId
let originalStock
let selectedMedicineId
let baseline

const query = async (sql, params = []) => (await pool.execute(sql, params))[0]

function tokenFor(user) {
  return jwt.sign(
    { userId: user.user_id, username: user.username, role: user.role },
    getJwtSecret(),
    { issuer: JWT_ISSUER, audience: JWT_AUDIENCE, expiresIn: '10m' }
  )
}

async function api(path, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const payload = await response.json()
  return { status: response.status, payload }
}

async function expectSqlFailure(action, label) {
  let failed = false
  try {
    await action()
  } catch {
    failed = true
  }
  assert.equal(failed, true, `${label} must be rejected by SQL Server`)
}

function expectedAvailability(row) {
  const expiry = row.expiry_date ? new Date(row.expiry_date) : null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (!row.is_active) return 'INACTIVE'
  if (expiry && expiry < today) return 'EXPIRED'
  if (Number(row.stock_quantity) <= 0) return 'OUT_OF_STOCK'
  if (Number(row.stock_quantity) <= Number(row.min_stock_level)) return 'LOW_STOCK'
  return 'AVAILABLE'
}

async function run() {
  baseline = (await query(`
    SELECT
      (SELECT COUNT(*) FROM medicines) AS medicines,
      (SELECT COUNT(*) FROM products) AS products,
      (SELECT COUNT(*) FROM purchases) AS purchases,
      (SELECT COUNT(*) FROM purchase_items) AS purchase_items,
      (SELECT COUNT(*) FROM sales) AS sales,
      (SELECT COUNT(*) FROM sale_items) AS sale_items
  `))[0]

  const listener = app.listen(0, '127.0.0.1')
  server = listener
  await new Promise((resolve, reject) => {
    listener.once('listening', resolve)
    listener.once('error', reject)
  })
  baseUrl = `http://127.0.0.1:${listener.address().port}`

  const staff = await query(`
    SELECT user_id, username, role FROM users
    WHERE role IN ('ADMIN', 'INVENTORY', 'SALES', 'PHARMACIST')
  `)
  const byRole = Object.fromEntries(staff.map(user => [user.role, user]))
  for (const role of ['INVENTORY', 'SALES', 'PHARMACIST']) {
    assert.ok(byRole[role] || byRole.ADMIN, `A ${role} or ADMIN user is required`)
  }
  const inventoryToken = tokenFor(byRole.INVENTORY || byRole.ADMIN)
  const salesToken = tokenFor(byRole.SALES || byRole.ADMIN)
  const pharmacistToken = tokenFor(byRole.PHARMACIST || byRole.ADMIN)

  const catalogue = await api('/api/products?pagination=false')
  assert.equal(catalogue.status, 200)
  assert.equal(catalogue.payload.data.products.length, Number(baseline.products))
  assert.deepEqual(
    catalogue.payload.data.categories.map(category => category.category_code),
    expectedCategories
  )

  const sqlProducts = await query(`
    SELECT TOP 3 product_id, medicine_id, product_code, product_name, category_code, category_name,
      unit_price, stock_quantity, min_stock_level, availability, expiry_date, is_active
    FROM v_product_catalog ORDER BY product_id
  `)
  for (const row of sqlProducts) {
    const product = catalogue.payload.data.products.find(item => item.product_code === row.product_code)
    assert.ok(product, `API must contain ${row.product_code}`)
    assert.equal(product.name, row.product_name)
    assert.equal(product.category_code, row.category_code)
    assert.equal(product.category, row.category_name)
    assert.equal(product.price, Number(row.unit_price))
    assert.equal(product.stock_quantity, Number(row.stock_quantity))
    assert.equal(product.availability, row.availability)
    assert.equal(row.availability, expectedAvailability(row))
  }

  const first = sqlProducts[0]
  const detail = await api(`/api/products/${first.product_code}`)
  assert.equal(detail.status, 200)
  assert.equal(detail.payload.data.product_code, first.product_code)
  for (const term of [first.product_code, encodeURIComponent(first.product_name)]) {
    const found = await api(`/api/products?pagination=false&search=${term}`)
    assert.equal(found.status, 200)
    assert.ok(found.payload.data.products.some(item => item.product_code === first.product_code))
  }
  for (const category of expectedCategories) {
    const filtered = await api(`/api/products?pagination=false&category=${category}`)
    assert.equal(filtered.status, 200)
    assert.ok(filtered.payload.data.products.every(item => item.category_code === category))
  }
  for (const availability of ['AVAILABLE', 'LOW_STOCK', 'OUT_OF_STOCK', 'EXPIRED']) {
    const filtered = await api(`/api/products?pagination=false&availability=${availability}`)
    assert.equal(filtered.status, 200)
    assert.ok(filtered.payload.data.products.every(item => item.availability === availability))
  }

  assert.equal((await api('/api/products', { method: 'POST', body: {} })).status, 404)
  assert.equal((await api('/api/products', { method: 'POST', token: inventoryToken, body: {} })).status, 404)

  const indexes = await query(`
    SELECT name, is_unique FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.products')
      AND name IN ('UQ_products_product_code', 'UQ_products_medicine')
  `)
  assert.equal(indexes.length, 2)
  assert.ok(indexes.every(index => index.is_unique))
  assert.equal((await query(`SELECT COUNT(*) AS total FROM products WHERE product_code IS NULL`))[0].total, 0)
  assert.equal((await query(`SELECT COUNT(*) AS total FROM products GROUP BY product_code HAVING COUNT(*) > 1`)).length, 0)
  assert.equal((await query(`SELECT COUNT(*) AS total FROM products WHERE product_code <> 'P' + RIGHT(REPLICATE('0', 10) + CONVERT(varchar(10), product_id), 10)`))[0].total, 0)
  await expectSqlFailure(
    () => query(`INSERT categories (category_code, category_name) VALUES ('MEDICINE', 'Duplicate')`),
    'duplicate category code'
  )
  await expectSqlFailure(
    () => query(`INSERT products (category_id, medicine_id) SELECT category_id, ? FROM categories WHERE category_code = 'MEDICINE'`, [first.medicine_id]),
    'duplicate medicine mapping'
  )
  await expectSqlFailure(
    () => query(`UPDATE products SET product_code = 'P9999999999' WHERE product_id = ?`, [first.product_id]),
    'product-code mutation'
  )

  const medicineRows = await query(`
    SELECT TOP 1 pc.*, m.id AS source_medicine_id, m.name AS source_name, m.unit_price AS source_price,
      m.quantity AS source_stock
    FROM v_product_catalog pc
    INNER JOIN medicines m ON m.id = pc.medicine_id
    WHERE pc.availability IN ('AVAILABLE', 'LOW_STOCK')
    ORDER BY pc.product_id
  `)
  const medicineProduct = medicineRows[0]
  assert.ok(medicineProduct)
  selectedMedicineId = medicineProduct.source_medicine_id
  originalStock = Number(medicineProduct.source_stock)

  const inventory = await api(`/api/medicines/${medicineProduct.source_medicine_id}`, { token: inventoryToken })
  assert.equal(inventory.status, 200)
  assert.equal(inventory.payload.data.product_code, medicineProduct.product_code)

  const history = (await query(`
    SELECT
      (SELECT TOP 1 purchase_id FROM purchase_items WHERE medicine_id = ? ORDER BY id) AS purchase_id,
      (SELECT TOP 1 prescription_id FROM prescription_items WHERE medicine_id = ? ORDER BY id) AS prescription_id,
      (SELECT TOP 1 sale_id FROM sale_items WHERE medicine_id = ? ORDER BY id) AS sale_id
  `, [medicineProduct.source_medicine_id, medicineProduct.source_medicine_id, medicineProduct.source_medicine_id]))[0]
  assert.ok(history.purchase_id && history.prescription_id && history.sale_id, 'Selected product needs purchase/prescription/sale history')

  const purchaseHistory = await api(`/api/purchases/${history.purchase_id}`, { token: inventoryToken })
  const prescriptionHistory = await api(`/api/prescriptions/${history.prescription_id}`, { token: pharmacistToken })
  const prescriptionAvailability = await api(`/api/prescriptions/${history.prescription_id}/availability`, { token: pharmacistToken })
  const saleReceipt = await api(`/api/sales/${history.sale_id}/receipt`, { token: salesToken })
  assert.ok(purchaseHistory.payload.data.items.some(item => item.product_code === medicineProduct.product_code))
  assert.ok(prescriptionHistory.payload.data.items.some(item => item.product_code === medicineProduct.product_code))
  assert.ok(prescriptionAvailability.payload.data.items.some(item => item.product_code === medicineProduct.product_code))
  assert.ok(saleReceipt.payload.data.items.some(item => item.product_code === medicineProduct.product_code))

  const supplier = (await query(`SELECT TOP 1 id FROM suppliers ORDER BY id`))[0]
  assert.ok(supplier)
  const purchase = await api('/api/purchases', {
    method: 'POST',
    token: inventoryToken,
    body: {
      supplier_id: supplier.id,
      purchase_date: new Date().toISOString().slice(0, 10),
      notes: 'B1 reversible verification',
      items: [{ medicine_id: medicineProduct.source_medicine_id, quantity: 2, unit_cost: 1, total_cost: 2 }],
    },
  })
  assert.equal(purchase.status, 201)
  purchaseId = purchase.payload.data.id
  assert.equal(purchase.payload.data.items[0].product_code, medicineProduct.product_code)
  const afterPurchase = await api(`/api/products/${medicineProduct.product_code}`)
  assert.equal(afterPurchase.payload.data.stock_quantity, originalStock + 2)

  const sale = await api('/api/sales', {
    method: 'POST',
    token: salesToken,
    body: {
      items: [{ medicine_id: medicineProduct.source_medicine_id, quantity: 2, unit_price: 0 }],
      payment_method: 'Cash',
      notes: 'B1 reversible verification',
    },
  })
  assert.equal(sale.status, 201)
  saleId = sale.payload.data.id
  assert.equal(sale.payload.data.items[0].product_code, medicineProduct.product_code)
  assert.equal(Number(sale.payload.data.items[0].unit_price), Number(medicineProduct.source_price))
  const afterSale = await api(`/api/products/${medicineProduct.product_code}`)
  assert.equal(afterSale.payload.data.stock_quantity, originalStock)

  const created = await api('/api/medicines', {
    method: 'POST',
    token: inventoryToken,
    body: {
      name: 'B1 Temporary Catalogue Verification',
      description: 'Removed by verifier',
      category: 'Test',
      batch_number: 'B1-TEMP',
      quantity: 3,
      unit_price: 12.5,
      expiry_date: '2099-12-31',
      min_stock_level: 1,
    },
  })
  assert.equal(created.status, 201)
  temporaryMedicineId = created.payload.data.id
  const permanentCode = created.payload.data.product_code
  assert.match(permanentCode, /^P\d{10}$/)
  const updated = await api(`/api/medicines/${temporaryMedicineId}`, {
    method: 'PUT',
    token: inventoryToken,
    body: { name: 'B1 Temporary Updated', quantity: 4, unit_price: 13.75 },
  })
  assert.equal(updated.status, 200)
  assert.equal(updated.payload.data.product_code, permanentCode)
  const updatedProduct = await api(`/api/products/${permanentCode}`)
  assert.equal(updatedProduct.payload.data.product_code, permanentCode)
  assert.equal(updatedProduct.payload.data.name, 'B1 Temporary Updated')
  assert.equal(updatedProduct.payload.data.price, 13.75)
  assert.equal(updatedProduct.payload.data.stock_quantity, 4)

  await new Promise((resolve, reject) => server.close(error => (error ? reject(error) : resolve())))
  server = null
  const restarted = app.listen(0, '127.0.0.1')
  server = restarted
  await new Promise((resolve, reject) => {
    restarted.once('listening', resolve)
    restarted.once('error', reject)
  })
  baseUrl = `http://127.0.0.1:${restarted.address().port}`
  assert.equal((await api(`/api/products/${permanentCode}`)).payload.data.product_code, permanentCode)

  assert.equal((await query(`
    SELECT COUNT(*) AS total FROM sys.tables
    WHERE name IN ('carts', 'cart_items', 'orders', 'order_items')
  `))[0].total, 0)

  console.log('SQL/API equality examples:')
  for (const row of sqlProducts) {
    console.log(`  ${row.product_code} | ${row.product_name} | ${row.category_name} | ${Number(row.unit_price).toFixed(2)} | stock ${row.stock_quantity} | ${row.availability}`)
  }
  console.log('PASS: categories, product-code uniqueness/immutability, filters, cross-module identity')
  console.log('PASS: medicine CRUD mapping, purchase stock increase, sale stock decrease, database price authority')
  console.log('PASS: product writes unavailable and cart/order tables absent')

}

async function cleanup(baseline) {
  if (saleId) {
    await query('DELETE FROM sale_items WHERE sale_id = ?', [saleId])
    await query('DELETE FROM sales WHERE id = ?', [saleId])
  }
  if (purchaseId) {
    await query('DELETE FROM purchase_items WHERE purchase_id = ?', [purchaseId])
    await query('DELETE FROM purchases WHERE id = ?', [purchaseId])
  }
  if (originalStock !== undefined) {
    await query('UPDATE medicines SET quantity = ? WHERE id = ?', [originalStock, selectedMedicineId])
  }
  if (temporaryMedicineId) {
    await query('DELETE FROM products WHERE medicine_id = ?', [temporaryMedicineId])
    await query('DELETE FROM medicines WHERE id = ?', [temporaryMedicineId])
  }
  const leakedTemporaryMedicines = await query(`
    SELECT id FROM medicines
    WHERE batch_number = 'B1-TEMP' AND name IN ('B1 Temporary Catalogue Verification', 'B1 Temporary Updated')
  `)
  for (const medicine of leakedTemporaryMedicines) {
    await query('DELETE FROM products WHERE medicine_id = ?', [medicine.id])
    await query('DELETE FROM medicines WHERE id = ?', [medicine.id])
  }
  if (baseline) {
    const after = (await query(`
      SELECT
        (SELECT COUNT(*) FROM medicines) AS medicines,
        (SELECT COUNT(*) FROM products) AS products,
        (SELECT COUNT(*) FROM purchases) AS purchases,
        (SELECT COUNT(*) FROM purchase_items) AS purchase_items,
        (SELECT COUNT(*) FROM sales) AS sales,
        (SELECT COUNT(*) FROM sale_items) AS sale_items
    `))[0]
    assert.deepEqual(after, baseline, 'Verifier must restore all application row counts')
  }
}

run()
  .catch(error => {
    process.exitCode = 1
    console.error(error)
  })
  .finally(async () => {
    try {
      if (server) await new Promise(resolve => server.close(resolve))
      await cleanup(baseline)
    } catch (error) {
      process.exitCode = 1
      console.error('Cleanup failed:', error)
    } finally {
      await closePool()
    }
  })
