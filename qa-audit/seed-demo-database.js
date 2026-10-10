// Idempotently seeds only pharmacy_management_demo_* databases with synthetic data.
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const sql = require('../backend/node_modules/mssql');
const bcrypt = require('../backend/node_modules/bcryptjs');
require('../backend/node_modules/dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });

const databaseName = process.env.DEMO_DB_NAME || 'pharmacy_management_demo_20261010';
if (!/^pharmacy_management_demo_[a-z0-9_]+$/.test(databaseName)) throw new Error('Refusing to seed a non-demo database');
const config = {
  server: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT) || 1433,
  user: process.env.DB_USER || 'sa', password: process.env.DB_PASSWORD || '', database: databaseName,
  options: { encrypt: process.env.DB_ENCRYPT === 'true', trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE !== 'false' },
};

async function main() {
  const db = await new sql.ConnectionPool(config).connect();
  const request = () => db.request();
  try {
    const users = await request().query("SELECT user_id, username, role FROM users WHERE role IN ('ADMIN','PHARMACIST','INVENTORY','SALES','SUPPLIER')");
    const inventoryUser = users.recordset.find(row => row.role === 'INVENTORY') || users.recordset[0];
    if (!inventoryUser) throw new Error('Demo staff accounts are missing; run prepare-demo-database.js first');

    const medicineSpecs = [
      { name: 'Demo Paracetamol 500mg', generic: 'Paracetamol', manufacturer: 'Demo Labs', category: 'Medicine', price: 25, min: 20, batches: [['DEMO-PARA-NEAR', '2026-12-31', 30], ['DEMO-PARA-LONG', '2028-12-31', 70]] },
      { name: 'Demo Amoxicillin 500mg', generic: 'Amoxicillin', manufacturer: 'Demo Labs', category: 'Medicine', price: 80, min: 10, batches: [['DEMO-AMOX-01', '2027-06-30', 50]] },
      { name: 'Demo Cetirizine 10mg', generic: 'Cetirizine', manufacturer: 'Demo Labs', category: 'Medicine', price: 15, min: 15, batches: [['DEMO-CET-01', '2027-10-31', 35]] },
    ];
    const medicineIds = [];
    for (const spec of medicineSpecs) {
      let result = await request().input('name', sql.NVarChar, spec.name).query('SELECT TOP 1 id FROM medicines WHERE name = @name');
      let medicineId = result.recordset[0]?.id;
      if (!medicineId) {
        result = await request().input('name', sql.NVarChar, spec.name).input('generic', sql.NVarChar, spec.generic).input('manufacturer', sql.NVarChar, spec.manufacturer).input('category', sql.NVarChar, spec.category).input('price', sql.Decimal(10, 2), spec.price).input('min', sql.Int, spec.min)
          .query("INSERT INTO medicines (name, generic_name, manufacturer, category, batch_number, quantity, unit_price, expiry_date, min_stock_level) VALUES (@name,@generic,@manufacturer,@category,NULL,0,@price,'2099-12-31',@min); SELECT CAST(SCOPE_IDENTITY() AS INT) AS id");
        medicineId = result.recordset[0].id;
      }
      medicineIds.push(medicineId);
      for (const [batchNumber, expiry, quantity] of spec.batches) {
        const existing = await request().input('medicineId', sql.Int, medicineId).input('batchNumber', sql.NVarChar, batchNumber).query('SELECT TOP 1 batch_id FROM medicine_batches WHERE medicine_id = @medicineId AND batch_number = @batchNumber');
        if (existing.recordset[0]) continue;
        const batch = await request().input('medicineId', sql.Int, medicineId).input('batchNumber', sql.NVarChar, batchNumber).input('expiry', sql.Date, expiry).input('quantity', sql.Int, quantity).input('cost', sql.Decimal(12, 2), spec.price * 0.6).query('INSERT INTO medicine_batches (medicine_id,batch_number,expiry_date,quantity_available,unit_cost) OUTPUT INSERTED.batch_id VALUES (@medicineId,@batchNumber,@expiry,@quantity,@cost)');
        const batchId = batch.recordset[0].batch_id;
        const balance = await request().input('medicineId', sql.Int, medicineId).query('SELECT quantity FROM medicines WHERE id = @medicineId');
        const nextBalance = Number(balance.recordset[0].quantity) + quantity;
        await request().input('quantity', sql.Int, quantity).input('medicineId', sql.Int, medicineId).query('UPDATE medicines SET quantity = quantity + @quantity WHERE id = @medicineId');
        await request().input('medicineId', sql.Int, medicineId).input('batchId', sql.Int, batchId).input('quantity', sql.Int, quantity).input('balance', sql.Int, nextBalance).input('userId', sql.Int, inventoryUser.user_id).input('key', sql.NVarChar, `demo:opening:${medicineId}:${batchId}`).query("INSERT INTO stock_movements (medicine_id,batch_id,movement_type,quantity_delta,balance_after,reference_type,reference_id,idempotency_key,notes,created_by) VALUES (@medicineId,@batchId,'OPENING',@quantity,@balance,'DEMO',NULL,@key,'Synthetic evaluation demo opening stock',@userId)");
      }
    }

    let supplier = (await request().query("SELECT TOP 1 id FROM suppliers WHERE company_name = 'Demo Health Supplies'")).recordset[0];
    if (!supplier) supplier = (await request().input('company', sql.NVarChar, 'Demo Health Supplies').input('email', sql.NVarChar, 'demo-supplier@example.test').input('phone', sql.NVarChar, '0112345678').query("INSERT INTO suppliers (company_name,email,phone,address) VALUES (@company,@email,@phone,'Synthetic demo address'); SELECT CAST(SCOPE_IDENTITY() AS INT) AS id")).recordset[0];
    const supplierId = supplier.id;
    for (const medicineId of medicineIds) await request().input('supplierId', sql.Int, supplierId).input('medicineId', sql.Int, medicineId).input('cost', sql.Decimal(12, 2), 12).query("IF NOT EXISTS (SELECT 1 FROM supplier_medicines WHERE supplier_id=@supplierId AND medicine_id=@medicineId) INSERT INTO supplier_medicines (supplier_id,medicine_id,last_unit_cost,is_preferred) VALUES (@supplierId,@medicineId,@cost,1)");

    let customerUser = (await request().query("SELECT TOP 1 u.user_id,u.username,c.id AS customer_id FROM users u JOIN customers c ON c.user_id=u.user_id WHERE u.username='demo_customer'")).recordset[0];
    let customerPassword = null;
    if (!customerUser) {
      customerPassword = `Cus-${crypto.randomBytes(18).toString('base64url')}!7a`;
      const hash = await bcrypt.hash(customerPassword, 12);
      const userResult = await request().input('username', sql.NVarChar, 'demo_customer').input('hash', sql.NVarChar, hash).query("INSERT INTO users (username,password,role) VALUES (@username,@hash,'CUSTOMER'); SELECT CAST(SCOPE_IDENTITY() AS INT) AS user_id");
      const user = userResult.recordset[0];
      const customerResult = await request().input('userId', sql.Int, user.user_id).query("INSERT INTO customers (user_id,first_name,last_name,email,phone,address) VALUES (@userId,'Demo','Customer','demo.customer@example.test','0771234567','Synthetic demo address'); SELECT CAST(SCOPE_IDENTITY() AS INT) AS id");
      const customer = customerResult.recordset[0];
      customerUser = { user_id: user.user_id, username: 'demo_customer', customer_id: customer.id };
    }
    const existingPrescription = await request().input('customerId', sql.Int, customerUser.customer_id).query('SELECT TOP 1 id FROM prescriptions WHERE customer_id=@customerId AND notes=N\'Synthetic evaluation demo prescription\'');
    if (!existingPrescription.recordset[0]) {
      const prescriptionResult = await request().input('customerId', sql.Int, customerUser.customer_id).input('reviewer', sql.Int, inventoryUser.user_id).query("INSERT INTO prescriptions (customer_id,prescription_date,instructions,notes,status,reviewer_user_id,reviewed_at) VALUES (@customerId,CAST(GETDATE() AS date),'Take as directed','Synthetic evaluation demo prescription','PENDING',NULL,NULL); SELECT CAST(SCOPE_IDENTITY() AS INT) AS id");
      const prescription = prescriptionResult.recordset[0];
      await request().input('prescriptionId', sql.Int, prescription.id).input('medicineId', sql.Int, medicineIds[1]).query("INSERT INTO prescription_items (prescription_id,medicine_id,quantity,instructions) VALUES (@prescriptionId,@medicineId,2,'Take one twice daily')");
    }
    const local = path.resolve(__dirname, '../backend/.local'); await fs.mkdir(local, { recursive: true });
    if (customerPassword) await fs.writeFile(path.join(local, 'demo-customer-credentials.json'), JSON.stringify({ database: databaseName, username: 'demo_customer', password: customerPassword }, null, 2), { mode: 0o600 });
    const counts = await request().query("SELECT (SELECT COUNT(*) FROM medicines WHERE name LIKE 'Demo %') AS medicines, (SELECT COUNT(*) FROM medicine_batches WHERE batch_number LIKE 'DEMO-%') AS batches, (SELECT COUNT(*) FROM stock_movements WHERE idempotency_key LIKE 'demo:%') AS movements, (SELECT COUNT(*) FROM suppliers WHERE company_name='Demo Health Supplies') AS suppliers, (SELECT COUNT(*) FROM prescriptions WHERE notes=N'Synthetic evaluation demo prescription') AS prescriptions");
    console.log(JSON.stringify({ database: databaseName, customer: customerUser.username, counts: counts.recordset[0], customerCredentialsWritten: Boolean(customerPassword) }));
  } finally { await db.close(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
