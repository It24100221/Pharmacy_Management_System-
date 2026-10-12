const crypto = require('crypto');
const assert = require('node:assert/strict');
const { pool, closePool } = require('../config/database');

const apiBase = process.env.VERIFY_API_BASE || 'http://127.0.0.1:5000/api';
const marker = `verify_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
const password = `Valid-${crypto.randomBytes(8).toString('hex')}!`;

async function request(path, body) {
  const response = await fetch(`${apiBase}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const payload = await response.json();
  return { response, payload };
}

async function run() {
  const valid = {
    name: '  Verification   Customer  ', email: `${marker}@example.test`,
    phone: '+94 77 123 4567', address: '  10   Verification Road  ',
    username: marker, password, confirmPassword: password,
  };
  const created = await request('/customers/register', valid);
  assert.equal(created.response.status, 201);

  const [persisted] = await pool.execute(`
    SELECT u.user_id, u.username, u.role, c.id AS customer_id, c.email, c.address
    FROM users u INNER JOIN customers c ON c.user_id = u.user_id
    WHERE u.username = ?
  `, [marker]);
  assert.equal(persisted.length, 1);
  assert.equal(persisted[0].role, 'CUSTOMER');
  assert.equal(persisted[0].email, valid.email.toLowerCase());
  assert.equal(persisted[0].address, '10 Verification Road');

  const login = await request('/auth/customer-login', { username: marker, password });
  assert.equal(login.response.status, 200);
  assert.equal(login.payload.data.role, 'CUSTOMER');
  assert.equal(login.payload.data.customerId, persisted[0].customer_id);

  const cases = [
    [{ ...valid, username: `${marker}_bad_email`, email: 'not-an-email' }, 400],
    [{ ...valid, username: `${marker}_dup_email` }, 409],
    [{ ...valid, email: `${marker}_dup_user@example.test` }, 409],
    [{ ...valid, username: `${marker}_blank_name`, email: `${marker}_blank_name@example.test`, name: '  ' }, 400],
    [{ ...valid, username: `${marker}_blank_address`, email: `${marker}_blank_address@example.test`, address: '  ' }, 400],
    [{ ...valid, username: `${marker}_bad_phone`, email: `${marker}_bad_phone@example.test`, phone: '12' }, 400],
    [{ ...valid, username: `${marker}_mismatch`, email: `${marker}_mismatch@example.test`, confirmPassword: 'different-password' }, 400],
  ];
  for (const [body, status] of cases) {
    const result = await request('/customers/register', body);
    assert.equal(result.response.status, status, `${body.username} should return ${status}`);
  }

  const attemptedUsernames = cases.map(([body]) => body.username).filter(username => username !== marker);
  const [partialUsers] = await pool.execute(
    `SELECT username FROM users WHERE username IN (${attemptedUsernames.map(() => '?').join(',')})`,
    attemptedUsernames
  );
  assert.equal(partialUsers.length, 0, 'Rejected registrations must not leave partial users');
  console.log('Registration verification passed: validation, uniqueness, atomic persistence, login, and CUSTOMER role.');
}

async function cleanup() {
  const [users] = await pool.execute('SELECT user_id FROM users WHERE username = ?', [marker]);
  for (const user of users) {
    await pool.execute('DELETE FROM customers WHERE user_id = ?', [user.user_id]);
    await pool.execute('DELETE FROM users WHERE user_id = ?', [user.user_id]);
  }
}

run()
  .finally(cleanup)
  .catch(error => {
    console.error(`Registration verification failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => closePool().catch(() => {}));
