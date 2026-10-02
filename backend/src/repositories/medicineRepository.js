const { pool } = require('../config/database');
const ApiError = require('../middleware/errorHandler');

// Microsoft SQL Server implementation (Stage 0B).
// Placeholders stay positional `?` — the central database module converts them
// to named `@pN` markers and binds every value with request.input().

const TODAY = `CAST(GETDATE() AS DATE)`;
const NEAR_EXPIRY_CUTOFF = `DATEADD(DAY, 30, ${TODAY})`;

const STOCK_STATUS_CASE = `
        CASE
          WHEN m.quantity = 0 THEN 'out_of_stock'
          WHEN m.quantity <= m.min_stock_level THEN 'low_stock'
          ELSE 'in_stock'
        END AS stock_status`;

const EXPIRY_STATUS_CASE = `
        CASE
          WHEN m.expiry_date < ${TODAY} THEN 'expired'
          WHEN m.expiry_date <= ${NEAR_EXPIRY_CUTOFF} THEN 'near_expiry'
          ELSE 'valid'
        END AS expiry_status`;

class MedicineRepository {
  // Get all medicines with optional filters
  async findAll(filters = {}) {
    let query = `
      SELECT
        m.id,
        m.product_code,
        m.product_type,
        m.image_url,
        m.requires_prescription,
        m.is_active,
        m.name,
        m.description,
        m.generic_name,
        m.manufacturer,
        m.category,
        m.batch_number,
        m.quantity,
        m.unit_price,
        m.expiry_date,
        m.min_stock_level,
        m.created_at,
        m.updated_at,
        ${STOCK_STATUS_CASE},
        ${EXPIRY_STATUS_CASE}
      FROM medicines m
      WHERE 1=1
    `;

    const params = [];

    // Search filter
    if (filters.search) {
      query += ` AND (m.name LIKE ? OR m.generic_name LIKE ? OR m.batch_number LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    // Category filter
    if (filters.category) {
      query += ` AND m.category = ?`;
      params.push(filters.category);
    }

    // Stock status filter
    if (filters.stock_status) {
      if (filters.stock_status === 'low_stock') {
        query += ` AND m.quantity > 0 AND m.quantity <= m.min_stock_level`;
      } else if (filters.stock_status === 'out_of_stock') {
        query += ` AND m.quantity = 0`;
      } else if (filters.stock_status === 'in_stock') {
        query += ` AND m.quantity > m.min_stock_level`;
      }
    }

    // Expiry status filter
    if (filters.expiry_status) {
      if (filters.expiry_status === 'expired') {
        query += ` AND m.expiry_date < ${TODAY}`;
      } else if (filters.expiry_status === 'near_expiry') {
        query += ` AND m.expiry_date >= ${TODAY} AND m.expiry_date <= ${NEAR_EXPIRY_CUTOFF}`;
      }
    }

    // Deterministic order is required: SQL Server rejects OFFSET/FETCH without
    // a stable ORDER BY, and duplicate medicine names are possible.
    query += ` ORDER BY m.name ASC, m.id ASC`;

    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 50;
    const offset = (page - 1) * limit;

    if (filters.pagination !== false) {
      query += ` OFFSET ? ROWS FETCH NEXT ? ROWS ONLY`;
      params.push(offset, limit);
    }

    const [rows] = await pool.execute(query, params);
    return rows;
  }

  // Get medicine by ID
  async findById(id) {
    const query = `
      SELECT
        m.id,
        m.product_code,
        m.product_type,
        m.image_url,
        m.requires_prescription,
        m.is_active,
        m.name,
        m.description,
        m.generic_name,
        m.manufacturer,
        m.category,
        m.batch_number,
        m.quantity,
        m.unit_price,
        m.expiry_date,
        m.min_stock_level,
        m.created_at,
        m.updated_at,
        ${STOCK_STATUS_CASE},
        ${EXPIRY_STATUS_CASE}
      FROM medicines m
      WHERE m.id = ?
    `;

    const [rows] = await pool.execute(query, [id]);
    return rows[0] || null;
  }

  // Create new medicine
  async create(medicineData) {
    const query = `
      INSERT INTO medicines (
        product_code, product_type, image_url, requires_prescription, is_active,
        name, description, generic_name, manufacturer, category,
        batch_number, quantity, unit_price, expiry_date, min_stock_level
      )
      OUTPUT INSERTED.id
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      medicineData.product_code,
      medicineData.product_type,
      medicineData.image_url,
      medicineData.requires_prescription,
      medicineData.is_active,
      medicineData.name,
      medicineData.description || null,
      medicineData.generic_name || null,
      medicineData.manufacturer || null,
      medicineData.category || null,
      medicineData.batch_number || null,
      medicineData.quantity ?? 0,
      medicineData.unit_price ?? 0,
      medicineData.expiry_date,
      medicineData.min_stock_level ?? 10
    ];

    const [rows] = await pool.execute(query, values);
    return rows[0].id;
  }

  // Update medicine
  async update(id, medicineData) {
    // First check if medicine exists
    const existing = await this.findById(id);
    if (!existing) {
      throw new ApiError('Medicine not found', 404);
    }

    const allowedFields = [
      'name', 'description', 'generic_name', 'manufacturer', 'category',
      'batch_number', 'quantity', 'unit_price', 'expiry_date', 'min_stock_level',
      'product_type', 'image_url', 'requires_prescription', 'is_active'
    ];
    const fields = allowedFields.filter(field => Object.hasOwn(medicineData, field));

    if (fields.length > 0) {
      const assignments = fields.map(field => `${field} = ?`).join(', ');
      const values = fields.map(field => medicineData[field]);
      values.push(id);
      await pool.execute(`UPDATE medicines SET ${assignments} WHERE id = ?`, values);
    }

    return this.findById(id);
  }

  // Get low stock medicines
  async findLowStock() {
    const query = `
      SELECT
        m.id,
        m.name,
        m.quantity,
        m.min_stock_level,
        (m.min_stock_level - m.quantity) AS shortage
      FROM medicines m
      WHERE m.quantity > 0 AND m.quantity <= m.min_stock_level
      ORDER BY m.quantity ASC, m.id ASC
    `;

    const [rows] = await pool.execute(query);
    return rows;
  }

  // Get medicines by expiry status
  async findByExpiryStatus(status = 'all') {
    let query = `
      SELECT
        m.id,
        m.name,
        m.expiry_date,
        m.quantity,
        CASE
          WHEN m.expiry_date < ${TODAY} THEN 'expired'
          WHEN m.expiry_date <= ${NEAR_EXPIRY_CUTOFF} THEN 'near_expiry'
          ELSE 'valid'
        END AS expiry_status,
        DATEDIFF(DAY, ${TODAY}, m.expiry_date) AS days_until_expiry
      FROM medicines m
      WHERE 1=1
    `;

    if (status === 'expired') {
      query += ` AND m.expiry_date < ${TODAY}`;
    } else if (status === 'near_expiry') {
      query += ` AND m.expiry_date >= ${TODAY} AND m.expiry_date <= ${NEAR_EXPIRY_CUTOFF}`;
    }

    query += ` ORDER BY m.expiry_date ASC, m.id ASC`;

    const [rows] = await pool.execute(query);
    return rows;
  }

  // Get total count
  async getCount(filters = {}) {
    let query = `SELECT COUNT(*) AS total FROM medicines m WHERE 1=1`;
    const params = [];

    if (filters.search) {
      query += ` AND (m.name LIKE ? OR m.generic_name LIKE ? OR m.batch_number LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (filters.category) {
      query += ` AND m.category = ?`;
      params.push(filters.category);
    }

    if (filters.stock_status === 'low_stock') {
      query += ` AND m.quantity > 0 AND m.quantity <= m.min_stock_level`;
    } else if (filters.stock_status === 'out_of_stock') {
      query += ` AND m.quantity = 0`;
    } else if (filters.stock_status === 'in_stock') {
      query += ` AND m.quantity > m.min_stock_level`;
    }

    if (filters.expiry_status === 'expired') {
      query += ` AND m.expiry_date < ${TODAY}`;
    } else if (filters.expiry_status === 'near_expiry') {
      query += ` AND m.expiry_date >= ${TODAY} AND m.expiry_date <= ${NEAR_EXPIRY_CUTOFF}`;
    }

    const [rows] = await pool.execute(query, params);
    return rows[0].total;
  }
}

module.exports = new MedicineRepository();
