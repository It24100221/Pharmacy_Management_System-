const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const { pool, closePool } = require('../config/database');
const fileStorage = require('../services/prescriptionFileStorage');

const apiBase = process.env.VERIFY_API_BASE || 'http://127.0.0.1:5000/api';
const marker = `flow_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
const password = `Flow-${crypto.randomBytes(8).toString('hex')}!`;
const jpeg = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAEP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAEP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//9k=', 'base64');
const orderIds = [];

async function api(pathname, { method = 'GET', token, body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${apiBase}${pathname}`, { method, headers, body: form || (body ? JSON.stringify(body) : undefined) });
  const payload = response.headers.get('content-type')?.includes('json') ? await response.json() : null;
  return { status: response.status, payload };
}

async function register(username) {
  const result = await api('/customers/register', { method: 'POST', body: {
    name: `Flow Customer ${username.slice(-4)}`, email: `${username}@example.test`, phone: '+94771234567',
    address: '10 Verification Road', username, password, confirmPassword: password,
  } });
  assert.equal(result.status, 201);
  const login = await api('/auth/customer-login', { method: 'POST', body: { username, password } });
  assert.equal(login.status, 200);
  return login.payload.data;
}

async function upload(token, orderId) {
  const form = new FormData();
  form.append('file', new Blob([jpeg], { type: 'image/jpeg' }), 'prescription.jpg');
  form.append('orderId', String(orderId));
  const result = await api('/prescriptions/upload', { method: 'POST', token, form });
  assert.equal(result.status, 201);
  assert.equal(result.payload.data.status, 'PENDING_REVIEW');
}

async function run() {
  const credentials = JSON.parse(await fs.readFile(path.resolve(__dirname, '../../.local/staff-credentials.json'), 'utf8')).accounts;
  const loginRole = async role => {
    const credential = credentials.find(item => item.role === role);
    assert.ok(credential, `${role} credential is required`);
    const result = await api('/auth/staff-login', { method: 'POST', body: credential });
    assert.equal(result.status, 200);
    return result.payload.data.token;
  };
  const [customerA, customerB, pharmacistToken, salesToken] = await Promise.all([
    register(`${marker}_a`), register(`${marker}_b`), loginRole('PHARMACIST'), loginRole('SALES'),
  ]);
  const productsResult = await api('/products?limit=100');
  const products = productsResult.payload.data.products;
  const rx = products.find(product => product.prescription_required && product.stock_quantity >= 3 && ['AVAILABLE', 'LOW_STOCK'].includes(product.availability));
  const normal = products.find(product => !product.prescription_required && product.stock_quantity >= 1 && ['AVAILABLE', 'LOW_STOCK'].includes(product.availability));
  assert.ok(rx && normal, 'Both prescription and non-prescription products are required');

  let result = await api('/cart/items', { method: 'POST', token: customerA.token, body: { product_id: rx.product_id, quantity: 2 } });
  assert.equal(result.status, 201); assert.equal(result.payload.data.items[0].unit_price, rx.price);
  result = await api('/cart', { token: customerA.token }); assert.equal(result.payload.data.total_items, 2);
  result = await api('/cart', { token: customerB.token }); assert.equal(result.payload.data.total_items, 0, 'Customer carts must be isolated');
  result = await api('/orders/checkout', { method: 'POST', token: customerA.token });
  assert.equal(result.status, 201); assert.equal(result.payload.data.status, 'PRESCRIPTION_REQUIRED');
  const approvedOrder = result.payload.data; orderIds.push(approvedOrder.order_id);
  const [salesBefore] = await pool.execute('SELECT COUNT(*) AS total FROM sales WHERE order_id = ?', [approvedOrder.order_id]);
  assert.equal(salesBefore[0].total, 0, 'Checkout must not create a sale');
  result = await api(`/orders/${approvedOrder.order_id}`, { token: customerB.token }); assert.equal(result.status, 403);
  result = await api(`/orders/${approvedOrder.order_id}/review`, { method: 'POST', token: customerA.token, body: { decision: 'APPROVE' } }); assert.equal(result.status, 403);
  await upload(customerA.token, approvedOrder.order_id);
  result = await api('/orders/pending-review', { token: pharmacistToken }); assert.ok(result.payload.data.orders.some(order => order.order_id === approvedOrder.order_id));
  result = await api(`/orders/${approvedOrder.order_id}`, { token: pharmacistToken }); assert.equal(result.payload.data.items[0].current_stock, rx.stock_quantity);
  result = await api(`/orders/${approvedOrder.order_id}/review`, { method: 'POST', token: pharmacistToken, body: { decision: 'APPROVE' } });
  assert.equal(result.payload.data.status, 'READY_FOR_BILLING'); assert.equal(result.payload.data.prescription_status, 'APPROVED');
  result = await api('/orders/ready-for-billing', { token: salesToken }); assert.ok(result.payload.data.orders.some(order => order.order_id === approvedOrder.order_id));
  result = await api(`/orders/${approvedOrder.order_id}/complete-sale`, { method: 'POST', token: salesToken, body: { payment_method: 'Cash' } });
  assert.equal(result.status, 201); const sale = result.payload.data;
  result = await api(`/sales/${sale.id}/receipt`, { token: salesToken }); assert.equal(result.status, 200); assert.equal(result.payload.data.items[0].product_code, rx.product_code);
  const [completed] = await pool.execute(`
    SELECT o.status, s.id AS sale_id, m.quantity
    FROM orders o INNER JOIN sales s ON s.order_id = o.order_id
    INNER JOIN order_items oi ON oi.order_id = o.order_id INNER JOIN medicines m ON m.id = oi.medicine_id
    WHERE o.order_id = ?
  `, [approvedOrder.order_id]);
  assert.equal(completed[0].status, 'COMPLETED'); assert.equal(completed[0].quantity, rx.stock_quantity - 2);
  result = await api('/orders/mine', { token: customerA.token }); assert.equal(result.payload.data.orders.find(order => order.order_id === approvedOrder.order_id).status, 'COMPLETED');

  await api('/cart/items', { method: 'POST', token: customerA.token, body: { product_id: normal.product_id, quantity: 1 } });
  result = await api('/orders/checkout', { method: 'POST', token: customerA.token }); assert.equal(result.payload.data.status, 'READY_FOR_BILLING'); orderIds.push(result.payload.data.order_id);

  await api('/cart/items', { method: 'POST', token: customerA.token, body: { product_id: rx.product_id, quantity: 1 } });
  result = await api('/orders/checkout', { method: 'POST', token: customerA.token }); const rejectedOrder = result.payload.data; orderIds.push(rejectedOrder.order_id); await upload(customerA.token, rejectedOrder.order_id);
  result = await api(`/orders/${rejectedOrder.order_id}/review`, { method: 'POST', token: pharmacistToken, body: { decision: 'REJECT', reason: 'Prescription image does not meet review requirements' } });
  assert.equal(result.payload.data.status, 'REJECTED'); assert.equal(result.payload.data.prescription_status, 'REJECTED');
  console.log('Customer order flow verification passed: cart isolation/persistence, Rx rule, upload, approve/reject, durable billing, sale, stock, receipt, and history.');
}

async function cleanup() {
  const [uploads] = orderIds.length ? await pool.execute(`SELECT storage_path FROM prescription_uploads WHERE order_id IN (${orderIds.map(() => '?').join(',')})`, orderIds) : [[]];
  const [users] = await pool.execute('SELECT user_id FROM users WHERE username LIKE ?', [`${marker}%`]);
  const userIds = users.map(user => user.user_id);
  if (userIds.length) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [customers] = await connection.execute(`SELECT id FROM customers WHERE user_id IN (${userIds.map(() => '?').join(',')})`, userIds);
      const customerIds = customers.map(customer => customer.id);
      if (customerIds.length) {
        const [sold] = await connection.execute(`SELECT si.medicine_id, SUM(si.quantity) AS quantity FROM sale_items si INNER JOIN sales s ON s.id = si.sale_id WHERE s.order_id IN (SELECT order_id FROM orders WHERE customer_id IN (${customerIds.map(() => '?').join(',')})) GROUP BY si.medicine_id`, customerIds);
        for (const item of sold) await connection.execute('UPDATE medicines SET quantity = quantity + ? WHERE id = ?', [item.quantity, item.medicine_id]);
        await connection.execute(`DELETE FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE order_id IN (SELECT order_id FROM orders WHERE customer_id IN (${customerIds.map(() => '?').join(',')})))`, customerIds);
        await connection.execute(`DELETE FROM sales WHERE order_id IN (SELECT order_id FROM orders WHERE customer_id IN (${customerIds.map(() => '?').join(',')}))`, customerIds);
        await connection.execute(`DELETE FROM prescription_uploads WHERE order_id IN (SELECT order_id FROM orders WHERE customer_id IN (${customerIds.map(() => '?').join(',')}))`, customerIds);
        await connection.execute(`DELETE FROM order_items WHERE order_id IN (SELECT order_id FROM orders WHERE customer_id IN (${customerIds.map(() => '?').join(',')}))`, customerIds);
        await connection.execute(`DELETE FROM orders WHERE customer_id IN (${customerIds.map(() => '?').join(',')})`, customerIds);
        await connection.execute(`DELETE FROM carts WHERE customer_id IN (${customerIds.map(() => '?').join(',')})`, customerIds);
        await connection.execute(`DELETE FROM customers WHERE id IN (${customerIds.map(() => '?').join(',')})`, customerIds);
      }
      await connection.execute(`DELETE FROM users WHERE user_id IN (${userIds.map(() => '?').join(',')})`, userIds);
      await connection.commit();
    } catch (error) { try { await connection.rollback(); } catch {} throw error } finally { connection.release(); }
  }
  for (const upload of uploads) if (upload.storage_path) await fileStorage.deleteFile(upload.storage_path).catch(() => {});
}

run().finally(cleanup).catch(error => { console.error(`Customer order flow verification failed: ${error.stack || error.message}`); process.exitCode = 1; }).finally(() => closePool().catch(() => {}));
