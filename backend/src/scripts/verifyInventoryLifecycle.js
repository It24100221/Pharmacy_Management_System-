const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const { pool, closePool } = require('../config/database');

const apiBase = process.env.VERIFY_API_BASE || 'http://127.0.0.1:5000/api';
const marker = `stock_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
let medicineId;
let purchaseId;
let saleId;

async function api(pathname, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${apiBase}${pathname}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, payload: await response.json() };
}

async function run() {
  const accounts = JSON.parse(await fs.readFile(path.resolve(__dirname, '../../.local/staff-credentials.json'), 'utf8')).accounts;
  const login = async role => {
    const credential = accounts.find(account => account.role === role);
    const result = await api('/auth/staff-login', { method: 'POST', body: credential });
    assert.equal(result.status, 200); return result.payload.data.token;
  };
  const [inventoryToken, salesToken] = await Promise.all([login('INVENTORY'), login('SALES')]);
  let result = await api('/suppliers?limit=1', { token: inventoryToken }); const supplierId = result.payload.data.suppliers[0].id;
  result = await api('/medicines', { method: 'POST', token: inventoryToken, body: { name: marker, generic_name: marker, batch_number: marker, category: 'Verification', quantity: 100, unit_price: 25, expiry_date: '2028-12-31', min_stock_level: 10 } });
  assert.equal(result.status, 201); medicineId = result.payload.data.id;
  result = await api('/purchases', { method: 'POST', token: inventoryToken, body: { supplier_id: supplierId, purchase_date: new Date().toISOString().slice(0, 10), items: [{ medicine_id: medicineId, quantity: 20, unit_cost: 15 }] } });
  assert.equal(result.status, 201); purchaseId = result.payload.data.id;
  let [rows] = await pool.execute('SELECT quantity FROM medicines WHERE id = ?', [medicineId]); assert.equal(rows[0].quantity, 120);
  result = await api('/sales', { method: 'POST', token: salesToken, body: { items: [{ medicine_id: medicineId, quantity: 10 }], payment_method: 'Cash' } });
  assert.equal(result.status, 201); saleId = result.payload.data.id;
  [rows] = await pool.execute('SELECT quantity FROM medicines WHERE id = ?', [medicineId]); assert.equal(rows[0].quantity, 110);
  console.log('Inventory lifecycle verification passed: SQL stock 100 -> purchase +20 = 120 -> sale -10 = 110.');
}

async function cleanup() {
  if (!medicineId) return;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    if (saleId) {
      await connection.execute('DELETE FROM sale_items WHERE sale_id = ?', [saleId]);
      await connection.execute('DELETE FROM sales WHERE id = ?', [saleId]);
    }
    if (purchaseId) {
      await connection.execute('DELETE FROM purchase_items WHERE purchase_id = ?', [purchaseId]);
      await connection.execute('DELETE FROM purchases WHERE id = ?', [purchaseId]);
    }
    await connection.execute('DELETE FROM products WHERE medicine_id = ?', [medicineId]);
    await connection.execute('DELETE FROM medicines WHERE id = ?', [medicineId]);
    await connection.commit();
  } catch (error) { try { await connection.rollback(); } catch {} throw error } finally { connection.release(); }
}

run().finally(cleanup).catch(error => { console.error(`Inventory lifecycle verification failed: ${error.stack || error.message}`); process.exitCode = 1; }).finally(() => closePool().catch(() => {}));
