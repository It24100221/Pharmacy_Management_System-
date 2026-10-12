const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const sql = require('../backend/node_modules/mssql');
require('../backend/node_modules/dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });

const databaseName = 'pharmacy_management_qa_codex_20261009';
const baseConfig = {
  server: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 1433,
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || '',
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE !== 'false'
  }
};
const splitBatches = script => script.split(/^\s*GO\s*;?\s*$/gim).map(batch => batch.trim()).filter(Boolean);

async function dropDatabase() {
  const master = await new sql.ConnectionPool({ ...baseConfig, database: 'master' }).connect();
  try {
    await master.request().query(`
      IF DB_ID(N'${databaseName}') IS NOT NULL
      BEGIN
        ALTER DATABASE [${databaseName}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
        DROP DATABASE [${databaseName}];
      END
    `);
  } finally {
    await master.close();
  }
}

async function createAndMigrate() {
  await dropDatabase();
  const master = await new sql.ConnectionPool({ ...baseConfig, database: 'master' }).connect();
  try {
    await master.request().query(`CREATE DATABASE [${databaseName}]`);
  } finally {
    await master.close();
  }

  const connection = await new sql.ConnectionPool({ ...baseConfig, database: databaseName }).connect();
  try {
    const schema = await fs.readFile(path.resolve(__dirname, '../database/schema.sql'), 'utf8');
    const deferredTables = new Set(['categories', 'products', 'carts', 'cart_items', 'orders', 'order_items']);
    for (const batch of splitBatches(schema)) {
      if (/^IF DB_ID\(/i.test(batch) || /^USE\s+/i.test(batch)) continue;
      const tableName = batch.match(/^CREATE TABLE\s+([a-z_]+)/i)?.[1]?.toLowerCase();
      if (deferredTables.has(tableName)) continue;
      await connection.request().query(batch);
    }
    await connection.request().query(`
      CREATE TABLE dbo.schema_migrations (
        migration_id INT NOT NULL CONSTRAINT PK_schema_migrations PRIMARY KEY,
        migration_name NVARCHAR(255) NOT NULL CONSTRAINT UQ_schema_migrations_name UNIQUE,
        applied_at DATETIME2(0) NOT NULL CONSTRAINT DF_schema_migrations_applied_at DEFAULT SYSDATETIME()
      )
    `);
    const migrationDirectory = path.resolve(__dirname, '../database/mssql/migrations');
    const files = (await fs.readdir(migrationDirectory)).filter(file => /^\d{3}_[a-z0-9_]+\.sql$/.test(file)).sort();
    for (const file of files) {
      const script = (await fs.readFile(path.join(migrationDirectory, file), 'utf8'))
        .replaceAll("N'pharmacy_management'", `N'${databaseName}'`);
      for (const batch of splitBatches(script)) await connection.request().query(batch);
      await connection.request()
        .input('id', sql.Int, Number(file.slice(0, 3)))
        .input('name', sql.NVarChar(255), file.replace(/\.sql$/, ''))
        .query('INSERT INTO dbo.schema_migrations (migration_id, migration_name) VALUES (@id, @name)');
    }
    return files.length;
  } finally {
    await connection.close();
  }
}

async function verify() {
  process.env.DB_NAME = databaseName;
  const database = require('../backend/src/config/database');
  const medicineRepository = require('../backend/src/repositories/medicineRepository');
  const supplierRepository = require('../backend/src/repositories/supplierRepository');
  const billingRepository = require('../backend/src/repositories/billingRepository');
  const prescriptionRepository = require('../backend/src/repositories/prescriptionRepository');
  const { pool } = database;

  try {
    const medicineId = await medicineRepository.create({
      name: 'QA Atomic Medicine', generic_name: 'QA Compound', manufacturer: 'QA Labs',
      category: 'Tablet', batch_number: 'QA-OPEN-001', quantity: 5, unit_price: 10,
      expiry_date: '2099-12-31', min_stock_level: 1
    }, null);
    const [stockRows] = await pool.execute(`
      SELECT m.quantity, b.quantity_available, sm.quantity_delta, sm.balance_after, sm.movement_type
      FROM medicines m
      JOIN medicine_batches b ON b.medicine_id = m.id
      JOIN stock_movements sm ON sm.medicine_id = m.id AND sm.batch_id = b.batch_id
      WHERE m.id = ?
    `, [medicineId]);
    assert.deepEqual(
      { quantity: Number(stockRows[0].quantity), batch: Number(stockRows[0].quantity_available), delta: Number(stockRows[0].quantity_delta), balance: Number(stockRows[0].balance_after), type: stockRows[0].movement_type },
      { quantity: 5, batch: 5, delta: 5, balance: 5, type: 'OPENING' }
    );
    await assert.rejects(
      medicineRepository.create({ name: ' qa atomic medicine ', generic_name: 'qa compound', manufacturer: 'qa labs', batch_number: 'QA-2', quantity: 1, unit_price: 10, expiry_date: '2099-12-31' }, null),
      error => error.statusCode === 409
    );

    await supplierRepository.create({ company_name: 'QA Supplier', email: 'qa@example.test', phone: '0111111111' });
    await assert.rejects(
      supplierRepository.create({ company_name: ' qa supplier ', email: 'QA@example.test', phone: '0111111111' }),
      error => error.statusCode === 409
    );

    const [customerResult] = await pool.execute(`
      INSERT INTO customers (first_name, last_name, email) VALUES ('QA', 'Customer', 'qa-customer@example.test');
      SELECT CAST(SCOPE_IDENTITY() AS INT) AS id;
    `);
    const customerId = customerResult.id;
    const [userResult] = await pool.execute(`
      INSERT INTO users (username, password, role) VALUES ('qa-sales', 'not-a-real-login', 'SALES');
      SELECT CAST(SCOPE_IDENTITY() AS INT) AS id;
    `);
    const userId = userResult.id;
    const [saleResult] = await pool.execute(`
      INSERT INTO sales (customer_id, total_amount, discount, final_amount, payment_method)
      VALUES (?, 100, 0, 100, 'Cash');
      SELECT CAST(SCOPE_IDENTITY() AS INT) AS id;
    `, [customerId]);
    const saleId = saleResult.id;
    const [invoiceResult] = await pool.execute(`
      INSERT INTO customer_invoices (sale_id, customer_id, subtotal, total_amount)
      VALUES (?, ?, 100, 100);
      SELECT CAST(SCOPE_IDENTITY() AS INT) AS id;
    `, [saleId, customerId]);
    const invoiceId = invoiceResult.id;

    await billingRepository.recordPayment({ invoiceId, amount: 40, method: 'CASH', idempotencyKey: 'qa:payment:partial', actorUserId: userId });
    await billingRepository.recordPayment({ invoiceId, amount: 60, method: 'CASH', idempotencyKey: 'qa:payment:full', actorUserId: userId });
    await billingRepository.recordPayment({ invoiceId, amount: 60, method: 'CASH', idempotencyKey: 'qa:payment:full', actorUserId: userId });
    await assert.rejects(
      billingRepository.recordPayment({ invoiceId, amount: 0.01, method: 'CASH', idempotencyKey: 'qa:payment:over', actorUserId: userId }),
      error => error.statusCode === 409
    );
    const [paymentRows] = await pool.execute(`
      SELECT i.status, SUM(p.amount) AS paid, COUNT(*) AS payment_count
      FROM customer_invoices i JOIN customer_payments p ON p.customer_invoice_id = i.customer_invoice_id
      WHERE i.customer_invoice_id = ? GROUP BY i.status
    `, [invoiceId]);
    assert.equal(paymentRows[0].status, 'PAID');
    assert.equal(Number(paymentRows[0].paid), 100);
    assert.equal(Number(paymentRows[0].payment_count), 2);

    const [prescriptionResult] = await pool.execute(`
      INSERT INTO prescriptions (customer_id, prescription_date, instructions) VALUES (?, CAST(GETDATE() AS date), 'QA');
      SELECT CAST(SCOPE_IDENTITY() AS INT) AS id;
    `, [customerId]);
    const prescriptionId = prescriptionResult.id;
    const prescriptions = await prescriptionRepository.findAll({ pagination: false });
    assert.ok(prescriptions.some(item => Number(item.id) === prescriptionId));

    return {
      medicineId,
      stock: stockRows[0],
      invoiceId,
      payment: paymentRows[0],
      prescriptionId,
      duplicateMedicineRejected: true,
      duplicateSupplierRejected: true
    };
  } finally {
    await database.closePool();
  }
}

(async () => {
  let migrationCount = 0;
  try {
    migrationCount = await createAndMigrate();
    const checks = await verify();
    console.log(JSON.stringify({ success: true, databaseName, migrationCount, checks }, null, 2));
  } finally {
    await dropDatabase();
    console.log(`Dropped disposable database ${databaseName}`);
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
