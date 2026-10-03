const assert = require('node:assert/strict');
const fs = require('fs/promises');
const path = require('path');
const { pool, closePool } = require('../config/database');

const apiBase = process.env.VERIFY_API_BASE || 'http://127.0.0.1:5000/api';

(async () => {
  const accounts = JSON.parse(await fs.readFile(path.resolve(__dirname, '../../.local/staff-credentials.json'), 'utf8')).accounts;
  const sales = accounts.find(account => account.role === 'SALES');
  const login = await fetch(`${apiBase}/auth/staff-login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sales) });
  assert.equal(login.status, 200);
  const token = (await login.json()).data.token;
  const response = await fetch(`${apiBase}/sales/today-summary`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(response.status, 200);
  const summary = (await response.json()).data;
  const [rows] = await pool.execute(`
    SELECT COUNT(*) AS total_sales, COALESCE(SUM(final_amount), 0) AS total_revenue
    FROM sales WHERE CAST(sale_date AS date) = CAST(GETDATE() AS date)
  `);
  assert.equal(Number(summary.total_sales), Number(rows[0].total_sales));
  assert.equal(Number(summary.total_revenue), Number(rows[0].total_revenue));
  console.log('Sales summary verification passed: API transaction count and revenue match independent SQL totals.');
})().catch(error => { console.error(`Sales summary verification failed: ${error.message}`); process.exitCode = 1; }).finally(() => closePool().catch(() => {}));
