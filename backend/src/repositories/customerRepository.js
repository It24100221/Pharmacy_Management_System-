const { pool } = require('../config/database');
const ApiError = require('../middleware/errorHandler');

class CustomerRepository {
  // Get all customers
  async findAll(filters = {}) {
    let query = `
      SELECT
        c.id,
        c.first_name,
        c.last_name,
        c.email,
        c.phone,
        c.address,
        c.date_of_birth,
        c.created_at,
        c.updated_at
      FROM customers c
      WHERE 1=1
    `;

    const params = [];

    // Search filter
    if (filters.search) {
      query += ` AND (
        c.first_name LIKE ? OR
        c.last_name LIKE ? OR
        c.email LIKE ? OR
        c.phone LIKE ?
      )`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    query += ` ORDER BY c.last_name ASC, c.first_name ASC`;

    // Pagination
    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 50;
    const offset = (page - 1) * limit;

    if (filters.pagination !== false) {
      query += ` LIMIT ? OFFSET ?`;
      params.push(limit, offset);
    }

    const [rows] = await pool.execute(query, params);
    return rows;
  }

  // Get customer by ID
  async findById(id) {
    const query = `
      SELECT
        c.id,
        c.first_name,
        c.last_name,
        c.email,
        c.phone,
        c.address,
        c.date_of_birth,
        c.created_at,
        c.updated_at
      FROM customers c
      WHERE c.id = ?
    `;

    const [rows] = await pool.execute(query, [id]);
    return rows[0] || null;
  }

  // Create new customer
  async create(customerData) {
    const query = `
      INSERT INTO customers (
        first_name, last_name, email, phone, address, date_of_birth
      ) VALUES (?, ?, ?, ?, ?, ?)
    `;

    const values = [
      customerData.first_name,
      customerData.last_name,
      customerData.email || null,
      customerData.phone || null,
      customerData.address || null,
      customerData.date_of_birth || null
    ];

    const [result] = await pool.execute(query, values);
    return result.insertId;
  }

  // Update customer
  async update(id, customerData) {
    // Check if customer exists
    const existing = await this.findById(id);
    if (!existing) {
      throw new ApiError('Customer not found', 404);
    }

    const allowedFields = ['first_name', 'last_name', 'email', 'phone', 'address', 'date_of_birth'];
    const fields = allowedFields.filter(field => Object.hasOwn(customerData, field));

    if (fields.length > 0) {
      const assignments = fields.map(field => `${field} = ?`).join(', ');
      const values = fields.map(field => customerData[field]);
      values.push(id);
      await pool.execute(`UPDATE customers SET ${assignments} WHERE id = ?`, values);
    }

    return this.findById(id);
  }

  // Get total count
  async getCount(filters = {}) {
    let query = `SELECT COUNT(*) as total FROM customers c WHERE 1=1`;
    const params = [];

    if (filters.search) {
      query += ` AND (
        c.first_name LIKE ? OR
        c.last_name LIKE ? OR
        c.email LIKE ? OR
        c.phone LIKE ?
      )`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    const [rows] = await pool.execute(query, params);
    return rows[0].total;
  }
}

module.exports = new CustomerRepository();
