const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const bcrypt = require('bcryptjs');
const { pool, closePool } = require('../config/database');

const roles = ['ADMIN', 'PHARMACIST', 'INVENTORY', 'SALES', 'SUPPLIER'];

async function run() {
  const [accounts] = await pool.execute(`
    SELECT u.user_id, u.username, u.role
    FROM users u
    WHERE u.role IN ('ADMIN', 'PHARMACIST', 'INVENTORY', 'SALES', 'SUPPLIER')
    ORDER BY u.role, u.user_id
  `);
  const selected = roles.map(role => accounts.find(account => account.role === role)).filter(Boolean);
  if (!selected.length) throw new Error('No staff accounts were found to rotate');

  const credentials = [];
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    for (const account of selected) {
      const password = `${account.role.slice(0, 3)}-${crypto.randomBytes(18).toString('base64url')}!7a`;
      const passwordHash = await bcrypt.hash(password, 12);
      await connection.execute('UPDATE users SET password = ? WHERE user_id = ?', [passwordHash, account.user_id]);
      credentials.push({ username: account.username, role: account.role, password });
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  for (const credential of credentials) {
    const [rows] = await pool.execute('SELECT password FROM users WHERE username = ? AND role = ?', [credential.username, credential.role]);
    if (!rows[0] || !(await bcrypt.compare(credential.password, rows[0].password))) {
      throw new Error(`Rotated credential verification failed for ${credential.role}`);
    }
  }

  const localDirectory = path.resolve(__dirname, '../../.local');
  const credentialFile = path.join(localDirectory, 'staff-credentials.json');
  await fs.mkdir(localDirectory, { recursive: true });
  await fs.writeFile(credentialFile, `${JSON.stringify({ rotatedAt: new Date().toISOString(), accounts: credentials }, null, 2)}\n`, { mode: 0o600 });
  console.log(`Rotated and verified ${credentials.length} staff accounts.`);
  console.log('Credential handoff saved to the ignored backend/.local/staff-credentials.json file.');
}

run()
  .catch(error => {
    console.error(`Staff password rotation failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => closePool().catch(() => {}));
