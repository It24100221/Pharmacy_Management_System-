const { pool } = require('../config/database');

const publicColumns = 'id, username, email, role, account_status, customer_id, supplier_id, created_at';

async function findByIdentifier(identifier) {
  const [rows] = await pool.execute(
    `SELECT ${publicColumns}, password_hash FROM dbo.users WHERE username = ? OR email = ?`,
    [identifier, identifier]
  );
  return rows[0] || null;
}

async function findById(id) {
  const [rows] = await pool.execute(`SELECT ${publicColumns} FROM dbo.users WHERE id = ?`, [id]);
  return rows[0] || null;
}

async function createCustomerAccount(data, passwordHash) {
  const connection = await pool.getConnection();
  let userId;
  try {
    await connection.beginTransaction();
    const [customers] = await connection.execute(
      `INSERT INTO dbo.customers (first_name, last_name, email, phone, address)
       OUTPUT INSERTED.id VALUES (?, ?, ?, ?, ?)`,
      [data.first_name, data.last_name, data.email, data.phone, data.address]
    );
    const [users] = await connection.execute(
      `INSERT INTO dbo.users (username, email, password_hash, role, customer_id)
       OUTPUT INSERTED.id VALUES (?, ?, ?, N'CUSTOMER', ?)`,
      [data.username, data.email, passwordHash, customers[0].id]
    );
    userId = users[0].id;
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  return findById(userId);
}

async function createStaffAccount(data, passwordHash) {
  const [rows] = await pool.execute(
    `INSERT INTO dbo.users (username, email, password_hash, role, supplier_id)
     OUTPUT INSERTED.id VALUES (?, ?, ?, ?, ?)`,
    [data.username, data.email, passwordHash, data.role, data.supplier_id || null]
  );
  return findById(rows[0].id);
}

module.exports = { findByIdentifier, findById, createCustomerAccount, createStaffAccount };
