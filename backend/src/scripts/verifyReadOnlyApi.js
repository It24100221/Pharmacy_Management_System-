const jwt = require('jsonwebtoken');
const { pool, closePool } = require('../config/database');
const { JWT_AUDIENCE, JWT_ISSUER, getJwtSecret } = require('../config/jwt');

const baseUrl = process.env.VERIFY_API_BASE || 'http://127.0.0.1:5000';

function tokenFor(userId) {
  return jwt.sign({ userId }, getJwtSecret(), {
    expiresIn: '5m',
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });
}

async function getFixtureState() {
  const [users] = await pool.execute(`
    SELECT u.user_id, u.role, c.id AS customer_id,
      CASE WHEN EXISTS (
        SELECT 1 FROM carts ca WHERE ca.customer_id = c.id AND ca.status = 'ACTIVE'
      ) THEN 1 ELSE 0 END AS has_active_cart
    FROM users u
    LEFT JOIN customers c ON c.user_id = u.user_id
    WHERE u.role IN ('CUSTOMER', 'ADMIN', 'PHARMACIST', 'INVENTORY', 'SALES', 'SUPPLIER')
    ORDER BY CASE WHEN u.role = 'CUSTOMER' AND EXISTS (
      SELECT 1 FROM carts ca WHERE ca.customer_id = c.id AND ca.status = 'ACTIVE'
    ) THEN 0 ELSE 1 END, u.user_id
  `);
  const byRole = {};
  for (const user of users) {
    if (!byRole[user.role] && (user.role !== 'CUSTOMER' || user.customer_id)) byRole[user.role] = user;
  }
  const requiredRoles = ['CUSTOMER', 'ADMIN', 'PHARMACIST', 'INVENTORY', 'SALES', 'SUPPLIER'];
  const missingRoles = requiredRoles.filter(role => !byRole[role]);
  if (missingRoles.length) throw new Error(`Missing test identities for roles: ${missingRoles.join(', ')}`);

  const [[medicine], [product], [sale], [purchase], [supplier], [customer], [prescription], [upload], [order]] = await Promise.all([
    pool.execute('SELECT TOP 1 id FROM medicines ORDER BY id').then(([rows]) => rows),
    pool.execute('SELECT TOP 1 product_code FROM products ORDER BY product_id').then(([rows]) => rows),
    pool.execute('SELECT TOP 1 id FROM sales ORDER BY id').then(([rows]) => rows),
    pool.execute('SELECT TOP 1 id FROM purchases ORDER BY id').then(([rows]) => rows),
    pool.execute('SELECT TOP 1 id FROM suppliers ORDER BY id').then(([rows]) => rows),
    pool.execute('SELECT TOP 1 id FROM customers ORDER BY id').then(([rows]) => rows),
    pool.execute('SELECT TOP 1 id FROM prescriptions ORDER BY id').then(([rows]) => rows),
    pool.execute('SELECT TOP 1 prescription_id FROM prescription_uploads ORDER BY prescription_id').then(([rows]) => rows),
    pool.execute('SELECT TOP 1 order_id FROM orders ORDER BY order_id').then(([rows]) => rows),
  ]);

  return {
    tokens: Object.fromEntries(Object.entries(byRole).map(([role, user]) => [role, tokenFor(user.user_id)])),
    ids: {
      medicine: medicine?.id,
      productCode: product?.product_code,
      sale: sale?.id,
      purchase: purchase?.id,
      supplier: supplier?.id,
      customer: customer?.id,
      prescription: prescription?.id,
      upload: upload?.prescription_id,
      order: order?.order_id,
    },
  };
}

async function databaseSnapshot() {
  const [rows] = await pool.execute(`
    SELECT
      (SELECT COUNT(*) FROM carts) AS carts,
      (SELECT COUNT(*) FROM cart_items) AS cart_items,
      (SELECT COUNT(*) FROM orders) AS orders,
      (SELECT COUNT(*) FROM order_items) AS order_items,
      (SELECT COUNT(*) FROM medicines) AS medicines,
      (SELECT COALESCE(SUM(CAST(quantity AS bigint)), 0) FROM medicines) AS medicine_quantity,
      (SELECT COUNT(*) FROM sales) AS sales,
      (SELECT COUNT(*) FROM sale_items) AS sale_items,
      (SELECT COUNT(*) FROM purchases) AS purchases,
      (SELECT COUNT(*) FROM purchase_items) AS purchase_items,
      (SELECT COUNT(*) FROM customers) AS customers,
      (SELECT COUNT(*) FROM suppliers) AS suppliers,
      (SELECT COUNT(*) FROM prescriptions) AS prescriptions,
      (SELECT COUNT(*) FROM prescription_uploads) AS prescription_uploads
  `);
  return rows[0];
}

async function call(test, tokens) {
  const headers = { Accept: 'application/json', ...(test.headers || {}) };
  if (test.role) headers.Authorization = `Bearer ${tokens[test.role]}`;
  if (test.body !== undefined && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${baseUrl}${test.path}`, {
    method: test.method || 'GET',
    headers,
    body: test.body === undefined ? undefined : (typeof test.body === 'string' ? test.body : JSON.stringify(test.body)),
  });
  const contentType = response.headers.get('content-type') || '';
  let payload = null;
  if (contentType.includes('application/json')) payload = await response.json();
  else await response.arrayBuffer();
  return { status: response.status, payload };
}

function endpointCases(ids) {
  const present = (value, label) => {
    if (value === undefined) throw new Error(`No live ${label} fixture is available`);
    return value;
  };
  return [
    { name: 'health', path: '/api/health', expect: 200 },
    { name: 'auth customer-login', path: '/api/auth/customer-login', method: 'POST', body: { username: '__invalid__', password: '__invalid__' }, expect: 401 },
    { name: 'auth customer/login alias', path: '/api/auth/customer/login', method: 'POST', body: { username: '__invalid__', password: '__invalid__' }, expect: 401 },
    { name: 'auth staff-login', path: '/api/auth/staff-login', method: 'POST', body: { username: '__invalid__', password: '__invalid__' }, expect: 401 },
    { name: 'auth me', path: '/api/auth/me', role: 'CUSTOMER', expect: 200 },
    { name: 'products list', path: '/api/products', expect: 200 },
    { name: 'product by code', path: `/api/products/${present(ids.productCode, 'product')}`, expect: 200 },

    { name: 'cart get', path: '/api/cart', role: 'CUSTOMER', expect: 200 },
    { name: 'cart add invalid', path: '/api/cart/items', method: 'POST', role: 'CUSTOMER', body: { product_id: 0, quantity: 1 }, expect: 400 },
    { name: 'cart update invalid', path: '/api/cart/items/0', method: 'PATCH', role: 'CUSTOMER', body: { quantity: 1 }, expect: 400 },
    { name: 'cart remove invalid', path: '/api/cart/items/0', method: 'DELETE', role: 'CUSTOMER', expect: 400 },
    { name: 'cart clear forbidden', path: '/api/cart', method: 'DELETE', role: 'ADMIN', expect: 403 },

    { name: 'order checkout forbidden', path: '/api/orders/checkout', method: 'POST', role: 'ADMIN', expect: 403 },
    { name: 'orders mine', path: '/api/orders/mine', role: 'CUSTOMER', expect: 200 },
    { name: 'orders pending review', path: '/api/orders/pending-review', role: 'PHARMACIST', expect: 200 },
    { name: 'orders ready for billing', path: '/api/orders/ready-for-billing', role: 'SALES', expect: 200 },
    { name: 'order by id missing', path: '/api/orders/2147483647', role: 'ADMIN', expect: 404 },
    { name: 'order review invalid', path: `/api/orders/${ids.order || 1}/review`, method: 'POST', role: 'PHARMACIST', body: { decision: 'INVALID' }, expect: 400 },
    { name: 'order complete invalid id', path: '/api/orders/0/complete-sale', method: 'POST', role: 'SALES', body: {}, expect: 400 },

    { name: 'medicines list', path: '/api/medicines', role: 'INVENTORY', expect: 200 },
    { name: 'medicines low stock', path: '/api/medicines/low-stock', role: 'INVENTORY', expect: 200 },
    { name: 'medicines expiry status', path: '/api/medicines/expiry-status', role: 'PHARMACIST', expect: 200 },
    { name: 'medicine by id', path: `/api/medicines/${present(ids.medicine, 'medicine')}`, role: 'INVENTORY', expect: 200 },
    { name: 'medicine create invalid', path: '/api/medicines', method: 'POST', role: 'INVENTORY', body: {}, expect: 400 },
    { name: 'medicine update invalid', path: '/api/medicines/0', method: 'PUT', role: 'INVENTORY', body: {}, expect: 400 },

    { name: 'sales list', path: '/api/sales', role: 'SALES', expect: 200 },
    { name: 'sales recent', path: '/api/sales/recent', role: 'SALES', expect: 200 },
    { name: 'sales today summary', path: '/api/sales/today-summary', role: 'SALES', expect: 200 },
    { name: 'sale by id', path: `/api/sales/${present(ids.sale, 'sale')}`, role: 'SALES', expect: 200 },
    { name: 'sale receipt', path: `/api/sales/${ids.sale}/receipt`, role: 'SALES', expect: 200 },
    { name: 'sale create invalid', path: '/api/sales', method: 'POST', role: 'SALES', body: {}, expect: 400 },

    { name: 'suppliers list', path: '/api/suppliers', role: 'INVENTORY', expect: 200 },
    { name: 'supplier by id', path: `/api/suppliers/${present(ids.supplier, 'supplier')}`, role: 'SUPPLIER', expect: 200 },
    { name: 'supplier create invalid', path: '/api/suppliers', method: 'POST', role: 'INVENTORY', body: {}, expect: 400 },
    { name: 'supplier update invalid', path: '/api/suppliers/0', method: 'PUT', role: 'INVENTORY', body: {}, expect: 400 },
    { name: 'supplier delete invalid', path: '/api/suppliers/0', method: 'DELETE', role: 'INVENTORY', expect: 400 },

    { name: 'purchases list', path: '/api/purchases', role: 'INVENTORY', expect: 200 },
    { name: 'purchases recent', path: '/api/purchases/recent', role: 'SUPPLIER', expect: 200 },
    { name: 'purchase by id', path: `/api/purchases/${present(ids.purchase, 'purchase')}`, role: 'SUPPLIER', expect: 200 },
    { name: 'purchase create invalid', path: '/api/purchases', method: 'POST', role: 'INVENTORY', body: {}, expect: 400 },

    { name: 'customer register invalid', path: '/api/customers/register', method: 'POST', body: {}, expect: 400 },
    { name: 'customer me', path: '/api/customers/me', role: 'CUSTOMER', expect: 200 },
    { name: 'customer me update invalid', path: '/api/customers/me', method: 'PUT', role: 'CUSTOMER', body: {}, expect: 400 },
    { name: 'customers list', path: '/api/customers', role: 'PHARMACIST', expect: 200 },
    { name: 'customer by id', path: `/api/customers/${present(ids.customer, 'customer')}`, role: 'SALES', expect: 200 },
    { name: 'customer create invalid', path: '/api/customers', method: 'POST', role: 'PHARMACIST', body: {}, expect: 400 },
    { name: 'customer update invalid', path: '/api/customers/0', method: 'PUT', role: 'PHARMACIST', body: {}, expect: 400 },
    { name: 'customer delete invalid', path: '/api/customers/0', method: 'DELETE', role: 'PHARMACIST', expect: 400 },

    { name: 'prescriptions list', path: '/api/prescriptions', role: 'PHARMACIST', expect: 200 },
    { name: 'prescription upload wrong media', path: '/api/prescriptions/upload', method: 'POST', role: 'CUSTOMER', body: {}, expect: 415 },
    { name: 'prescriptions mine', path: '/api/prescriptions/mine', role: 'CUSTOMER', expect: 200 },
    { name: 'prescriptions by customer', path: `/api/prescriptions/customer/${ids.customer}`, role: 'PHARMACIST', expect: 200 },
    { name: 'prescriptions recent', path: '/api/prescriptions/recent', role: 'PHARMACIST', expect: 200 },
    { name: 'prescription availability', path: `/api/prescriptions/${present(ids.prescription, 'prescription')}/availability`, role: 'PHARMACIST', expect: 200 },
    { name: 'prescription by id', path: `/api/prescriptions/${ids.prescription}`, role: 'PHARMACIST', expect: 200 },
    { name: 'prescription create invalid', path: '/api/prescriptions', method: 'POST', role: 'PHARMACIST', body: {}, expect: 400 },
    { name: 'prescription billing invalid', path: '/api/prescriptions/0/send-to-billing', method: 'POST', role: 'PHARMACIST', body: {}, expect: 400 },
    { name: 'prescription file invalid', path: '/api/prescription-uploads/0/file', role: 'PHARMACIST', expect: 400 },
  ];
}

function validationCases() {
  return [
    { name: 'public catalogue rejects negative page', path: '/api/products?page=-1', expect: 400 },
    { name: 'medicines reject negative page', path: '/api/medicines?page=-1', role: 'INVENTORY', expect: 400 },
    { name: 'customers reject excessive limit', path: '/api/customers?limit=1000000', role: 'ADMIN', expect: 400 },
    { name: 'sales reject malformed date', path: '/api/sales?start_date=not-a-date', role: 'SALES', expect: 400 },
    { name: 'purchases reject reversed range', path: '/api/purchases?start_date=2099-01-02&end_date=2099-01-01', role: 'INVENTORY', expect: 400 },
    { name: 'prescriptions reject excessive recent limit', path: '/api/prescriptions/recent?limit=1000000', role: 'PHARMACIST', expect: 400 },
    { name: 'medicine create rejects wrong name type', path: '/api/medicines', method: 'POST', role: 'INVENTORY', body: { name: 123, expiry_date: '2099-01-01' }, expect: 400 },
    { name: 'sale rejects partial numeric quantity', path: '/api/sales', method: 'POST', role: 'SALES', body: { items: [{ medicine_id: 1, quantity: '2abc' }] }, expect: 400 },
    { name: 'purchase rejects fractional quantity', path: '/api/purchases', method: 'POST', role: 'INVENTORY', body: { supplier_id: 1, purchase_date: '2099-01-01', items: [{ medicine_id: 1, quantity: 1.5, unit_cost: 1 }] }, expect: 400 },
    { name: 'medicine rejects past expiry', path: '/api/medicines', method: 'POST', role: 'INVENTORY', body: { name: 'Invalid expired test', expiry_date: '2000-01-01' }, expect: 400 },
    { name: 'sale rejects SQL integer overflow', path: '/api/sales', method: 'POST', role: 'SALES', body: { items: [{ medicine_id: 1, quantity: 2147483648 }] }, expect: 400 },
    { name: 'purchase rejects SQL money overflow', path: '/api/purchases', method: 'POST', role: 'INVENTORY', body: { supplier_id: 1, purchase_date: '2099-01-01', items: [{ medicine_id: 1, quantity: 1, unit_cost: 100000000 }] }, expect: 400 },
    { name: 'malformed JSON has stable client error', path: '/api/auth/customer-login', method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad json', expect: 400, check: payload => payload?.message === 'Malformed JSON request' },
    { name: 'SQL injection search remains data, not SQL', path: '/api/products?search=%27%20OR%201%3D1--', expect: 200, check: payload => Array.isArray(payload?.data?.products) && payload.data.products.length === 0 },
  ];
}

async function main() {
  let state;
  const results = [];
  try {
    const before = await databaseSnapshot();
    state = await getFixtureState();
    const endpointTests = endpointCases(state.ids);
    const tests = [...endpointTests, ...validationCases()];
    for (const test of tests) {
      try {
        const actual = await call(test, state.tokens);
        const statusPassed = actual.status === test.expect;
        const payloadPassed = !test.check || test.check(actual.payload);
        const passed = statusPassed && payloadPassed;
        results.push({
          name: test.name,
          expected: test.expect,
          actual: actual.status,
          passed,
          ...(statusPassed && !payloadPassed ? { error: 'Response payload assertion failed' } : {}),
        });
      } catch (error) {
        results.push({ name: test.name, expected: test.expect, actual: 'REQUEST_ERROR', passed: false, error: error.message });
      }
    }

    const after = await databaseSnapshot();
    const databaseUnchanged = JSON.stringify(before) === JSON.stringify(after);
    if (!databaseUnchanged) {
      results.push({ name: 'database remains unchanged', expected: before, actual: after, passed: false });
    }
    const passed = results.filter(result => result.passed).length;
    const summary = {
      endpoint_count: endpointTests.length,
      additional_validation_cases: tests.length - endpointTests.length,
      total_cases: results.length,
      passed,
      failed: results.length - passed,
      database_writes: databaseUnchanged ? 0 : 'DETECTED',
    };
    console.log(JSON.stringify({ summary, failures: results.filter(result => !result.passed) }, null, 2));
    if (summary.failed) process.exitCode = 1;
  } finally {
    await closePool();
  }
}

main().catch(error => {
  console.error(`Read-only API verification failed: ${error.message}`);
  process.exitCode = 1;
});
