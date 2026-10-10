// Creates a fresh, isolated academic demo database. Never drops or resets any database.
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const sql = require('../backend/node_modules/mssql');
const bcrypt = require('../backend/node_modules/bcryptjs');
require('../backend/node_modules/dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });

const name = process.env.DEMO_DB_NAME || 'pharmacy_management_demo_20261010';
if (!/^pharmacy_management_demo_[a-z0-9_]+$/.test(name)) throw new Error('Refusing to create a non-demo database');
const config = {
  server: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT) || 1433,
  user: process.env.DB_USER || 'sa', password: process.env.DB_PASSWORD || '',
  options: { encrypt: process.env.DB_ENCRYPT === 'true', trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE !== 'false' },
};
const batches = source => source.split(/^\s*GO\s*;?\s*$/gim).map(value => value.trim()).filter(Boolean);

async function main() {
  const master = await new sql.ConnectionPool({ ...config, database: 'master' }).connect();
  try {
    const result = await master.request().input('name', sql.NVarChar, name).query('SELECT DB_ID(@name) AS id');
    if (result.recordset[0].id !== null) throw new Error(`${name} already exists; refusing to overwrite it`);
    await master.request().query(`CREATE DATABASE [${name}]`);
  } finally { await master.close(); }

  const db = await new sql.ConnectionPool({ ...config, database: name }).connect();
  try {
    const schema = await fs.readFile(path.resolve(__dirname, '../database/schema.sql'), 'utf8');
    const deferred = new Set(['categories', 'products', 'carts', 'cart_items', 'orders', 'order_items']);
    for (const batch of batches(schema)) {
      if (/^IF DB_ID\(/i.test(batch) || /^USE\s+/i.test(batch)) continue;
      const table = batch.match(/^CREATE TABLE\s+([a-z_]+)/i)?.[1]?.toLowerCase();
      if (!deferred.has(table)) await db.request().query(batch);
    }
    await db.request().query(`CREATE TABLE dbo.schema_migrations (
      migration_id INT NOT NULL CONSTRAINT PK_schema_migrations PRIMARY KEY,
      migration_name NVARCHAR(255) NOT NULL CONSTRAINT UQ_schema_migrations_name UNIQUE,
      applied_at DATETIME2(0) NOT NULL CONSTRAINT DF_schema_migrations_applied_at DEFAULT SYSDATETIME())`);
    const dir = path.resolve(__dirname, '../database/mssql/migrations');
    const files = (await fs.readdir(dir)).filter(file => /^\d{3}_[a-z0-9_]+\.sql$/.test(file)).sort();
    for (const file of files) {
      const script = (await fs.readFile(path.join(dir, file), 'utf8')).replaceAll("N'pharmacy_management'", `N'${name}'`);
      for (const batch of batches(script)) await db.request().query(batch);
      await db.request().input('id', sql.Int, Number(file.slice(0, 3))).input('migration', sql.NVarChar, file.slice(0, -4))
        .query('INSERT INTO dbo.schema_migrations (migration_id, migration_name) VALUES (@id, @migration)');
    }

    const roles = ['ADMIN', 'PHARMACIST', 'INVENTORY', 'SALES', 'SUPPLIER'];
    const accounts = [];
    for (const role of roles) {
      const username = `demo_${role.toLowerCase()}`;
      const password = `${role.slice(0, 3)}-${crypto.randomBytes(18).toString('base64url')}!7a`;
      const hash = await bcrypt.hash(password, 12);
      const user = await db.request().input('username', sql.NVarChar, username).input('hash', sql.NVarChar, hash)
        .input('role', sql.NVarChar, role).query('INSERT INTO users (username, password, role) OUTPUT INSERTED.user_id VALUES (@username, @hash, @role)');
      await db.request().input('id', sql.Int, user.recordset[0].user_id).input('role', sql.NVarChar, role)
        .input('staffName', sql.NVarChar, `Demo ${role.toLowerCase()} staff`)
        .query('INSERT INTO staff (user_id, staff_name, staff_role) VALUES (@id, @staffName, @role)');
      accounts.push({ username, role, password });
    }
    const local = path.resolve(__dirname, '../backend/.local');
    await fs.mkdir(local, { recursive: true });
    await fs.writeFile(path.join(local, 'demo-staff-credentials.json'), JSON.stringify({ database: name, accounts }, null, 2), { mode: 0o600 });
    console.log(JSON.stringify({ database: name, migrations: files.length, staffAccounts: accounts.map(({ username, role }) => ({ username, role })) }));
  } finally { await db.close(); }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
