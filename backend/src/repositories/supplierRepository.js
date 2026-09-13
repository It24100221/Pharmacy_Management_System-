const { pool } = require('../config/database');
const ApiError = require('../middleware/errorHandler');

class SupplierRepository {
  // Get all suppliers
  async findAll(filters = {}) {
    let query = `
      SELECT
        s.id,
        s.company_name,
        s.contact_person,
        s.email,
        s.phone,
        s.address,
        s.created_at,
        s.updated_at
      FROM suppliers s
      WHERE 1=1
    `;

    const params = [];

    // Search filter
    if (filters.search) {
      query += ` AND (s.company_name LIKE ? OR s.contact_person LIKE ? OR s.email LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    query += ` ORDER BY s.company_name ASC`;

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

  // Get supplier by ID
  async findById(id) {
    const query = `
      SELECT
        s.id,
        s.company_name,
        s.contact_person,
        s.email,
        s.phone,
        s.address,
        s.created_at,
        s.updated_at
      FROM suppliers s
      WHERE s.id = ?
    `;

    const [rows] = await pool.execute(query, [id]);
    return rows[0] || null;
  }

  // Create new supplier
  async create(supplierData) {
    const query = `
      INSERT INTO suppliers (
        company_name, contact_person, email, phone, address
      ) VALUES (?, ?, ?, ?, ?)
    `;

    const values = [
      supplierData.company_name,
      supplierData.contact_person || null,
      supplierData.email || null,
      supplierData.phone || null,
      supplierData.address || null
    ];

    const [result] = await pool.execute(query, values);
    return result.insertId;
  }

  // Update supplier
  async update(id, supplierData) {
    // Check if supplier exists
    const existing = await this.findById(id);
    if (!existing) {
      throw new ApiError('Supplier not found', 404);
    }

    const allowedFields = ['company_name', 'contact_person', 'email', 'phone', 'address'];
    const fields = allowedFields.filter(field => Object.hasOwn(supplierData, field));

    if (fields.length > 0) {
      const assignments = fields.map(field => `${field} = ?`).join(', ');
      const values = fields.map(field => supplierData[field]);
      values.push(id);
      await pool.execute(`UPDATE suppliers SET ${assignments} WHERE id = ?`, values);
    }

    return this.findById(id);
  }

  // Get total count
  async getCount(filters = {}) {
    let query = `SELECT COUNT(*) as total FROM suppliers s WHERE 1=1`;
    const params = [];

    if (filters.search) {
      query += ` AND (s.company_name LIKE ? OR s.contact_person LIKE ? OR s.email LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    const [rows] = await pool.execute(query, params);
    return rows[0].total;
  }
}

module.exports = new SupplierRepository();
