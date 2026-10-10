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
    const connection = await pool.getConnection();
    const query = `
      INSERT INTO suppliers (
        company_name, contact_person, email, phone, address
      ) OUTPUT INSERTED.id AS insertId
      VALUES (?, ?, ?, ?, ?)
    `;

    const values = [
      supplierData.company_name,
      supplierData.contact_person || null,
      supplierData.email || null,
      supplierData.phone || null,
      supplierData.address || null
    ];

    try {
      await connection.beginTransaction();
      const [duplicates] = await connection.execute(`
        SELECT TOP (1) id FROM suppliers WITH (UPDLOCK, HOLDLOCK)
        WHERE LOWER(LTRIM(RTRIM(company_name))) = LOWER(LTRIM(RTRIM(?)))
          AND LOWER(LTRIM(RTRIM(COALESCE(email, '')))) = LOWER(LTRIM(RTRIM(COALESCE(?, ''))))
          AND LTRIM(RTRIM(COALESCE(phone, ''))) = LTRIM(RTRIM(COALESCE(?, '')))
      `, [supplierData.company_name, supplierData.email || null, supplierData.phone || null]);
      if (duplicates[0]) throw new ApiError('A supplier with the same company, email, and phone already exists', 409);
      const [result] = await connection.execute(query, values);
      await connection.commit();
      return result.insertId;
    } catch (error) {
      try { await connection.rollback(); } catch { /* preserve original error */ }
      throw error;
    } finally {
      connection.release();
    }
  }

  // Update supplier
  async update(id, supplierData) {
    const allowedFields = ['company_name', 'contact_person', 'email', 'phone', 'address'];
    const fields = allowedFields.filter(field => Object.hasOwn(supplierData, field));
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [existingRows] = await connection.execute(
        'SELECT id, company_name, email, phone FROM suppliers WITH (UPDLOCK, HOLDLOCK) WHERE id = ?',
        [id]
      );
      const existing = existingRows[0];
      if (!existing) throw new ApiError('Supplier not found', 404);
      const identity = {
        company_name: Object.hasOwn(supplierData, 'company_name') ? supplierData.company_name : existing.company_name,
        email: Object.hasOwn(supplierData, 'email') ? supplierData.email : existing.email,
        phone: Object.hasOwn(supplierData, 'phone') ? supplierData.phone : existing.phone
      };
      const normalize = value => String(value || '').trim().toLowerCase();
      const identityChanged = normalize(identity.company_name) !== normalize(existing.company_name)
        || normalize(identity.email) !== normalize(existing.email)
        || normalize(identity.phone) !== normalize(existing.phone);
      if (identityChanged) {
        const [duplicates] = await connection.execute(`
          SELECT TOP (1) id FROM suppliers WITH (UPDLOCK, HOLDLOCK)
          WHERE id <> ?
            AND LOWER(LTRIM(RTRIM(company_name))) = LOWER(LTRIM(RTRIM(?)))
            AND LOWER(LTRIM(RTRIM(COALESCE(email, '')))) = LOWER(LTRIM(RTRIM(COALESCE(?, ''))))
            AND LTRIM(RTRIM(COALESCE(phone, ''))) = LTRIM(RTRIM(COALESCE(?, '')))
        `, [id, identity.company_name, identity.email || null, identity.phone || null]);
        if (duplicates[0]) throw new ApiError('A supplier with the same company, email, and phone already exists', 409);
      }
      if (fields.length > 0) {
        const assignments = fields.map(field => `${field} = ?`).join(', ');
        const values = fields.map(field => supplierData[field]);
        values.push(id);
        await connection.execute(`UPDATE suppliers SET ${assignments} WHERE id = ?`, values);
      }
      await connection.commit();
    } catch (error) {
      try { await connection.rollback(); } catch { /* preserve original error */ }
      throw error;
    } finally {
      connection.release();
    }
    return this.findById(id);
  }

  async remove(id) {
    const existing = await this.findById(id);
    if (!existing) {
      throw new ApiError('Supplier not found', 404);
    }

    try {
      await pool.execute('DELETE FROM suppliers WHERE id = ?', [id]);
      if (await this.findById(id)) {
        throw new ApiError('Supplier was not deleted', 409);
      }
    } catch (error) {
      if (error.number === 547) {
        throw new ApiError('Supplier cannot be deleted because related purchases exist', 409);
      }
      throw error;
    }
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
