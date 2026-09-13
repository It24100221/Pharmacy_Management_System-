const { pool } = require('../config/database');
const ApiError = require('../middleware/errorHandler');

class PrescriptionRepository {
  // Get all prescriptions
  async findAll(filters = {}) {
    let query = `
      SELECT
        p.id,
        p.customer_id,
        p.prescription_date,
        p.instructions,
        p.notes,
        p.created_at,
        p.updated_at,
        c.id AS customer_id,
        CONCAT(c.first_name, ' ', c.last_name) AS customer_name,
        c.phone AS customer_phone,
        c.email AS customer_email
      FROM prescriptions p
      LEFT JOIN customers c ON p.customer_id = c.id
      WHERE 1=1
    `;

    const params = [];

    // Search by customer
    if (filters.search) {
      query += ` AND (
        c.first_name LIKE ? OR
        c.last_name LIKE ? OR
        c.phone LIKE ?
      )`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    // Date range filter
    if (filters.start_date) {
      query += ` AND p.prescription_date >= ?`;
      params.push(filters.start_date);
    }

    if (filters.end_date) {
      query += ` AND p.prescription_date <= ?`;
      params.push(filters.end_date);
    }

    query += ` ORDER BY p.prescription_date DESC, p.id DESC`;

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

  // Get prescription by ID with items
  async findById(id) {
    // Get prescription header
    const headerQuery = `
      SELECT
        p.id,
        p.customer_id,
        p.prescription_date,
        p.instructions,
        p.notes,
        p.created_at,
        p.updated_at,
        c.id AS customer_id,
        c.first_name,
        c.last_name,
        c.phone AS customer_phone,
        c.email AS customer_email,
        c.address AS customer_address
      FROM prescriptions p
      LEFT JOIN customers c ON p.customer_id = c.id
      WHERE p.id = ?
    `;

    const [headerRows] = await pool.execute(headerQuery, [id]);
    const prescription = headerRows[0] || null;

    if (!prescription) {
      return null;
    }

    // Get prescription items with medicine details
    const itemsQuery = `
      SELECT
        pi.id,
        pi.prescription_id,
        pi.medicine_id,
        m.name AS medicine_name,
        m.generic_name,
        m.batch_number,
        m.quantity AS current_stock,
        m.unit_price,
        pi.quantity AS prescribed_quantity,
        pi.instructions AS item_instructions,
        pi.created_at
      FROM prescription_items pi
      LEFT JOIN medicines m ON pi.medicine_id = m.id
      WHERE pi.prescription_id = ?
      ORDER BY pi.id
    `;

    const [itemsRows] = await pool.execute(itemsQuery, [id]);
    prescription.items = itemsRows;

    return prescription;
  }

  // Create prescription with items
  async createWithItems(prescriptionData, items) {
    const connection = await pool.getConnection();
    let prescriptionId;

    try {
      await connection.beginTransaction();

      // 1. Create prescription header
      const prescriptionQuery = `
        INSERT INTO prescriptions (customer_id, prescription_date, instructions, notes)
        VALUES (?, ?, ?, ?)
      `;

      const [prescriptionResult] = await connection.execute(prescriptionQuery, [
        prescriptionData.customer_id,
        prescriptionData.prescription_date,
        prescriptionData.instructions || null,
        prescriptionData.notes || null
      ]);

      prescriptionId = prescriptionResult.insertId;

      // 2. Create prescription items
      const itemQuery = `
        INSERT INTO prescription_items (prescription_id, medicine_id, quantity, instructions)
        VALUES (?, ?, ?, ?)
      `;

      for (const item of items) {
        await connection.execute(itemQuery, [
          prescriptionId,
          item.medicine_id,
          item.quantity,
          item.instructions || null
        ]);
      }

      // Commit transaction
      await connection.commit();
    } catch (error) {
      // Rollback on error
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    // Load the committed record after the transaction connection is closed.
    return this.findById(prescriptionId);
  }

  // Check availability of prescribed medicines
  async checkAvailability(prescriptionId) {
    const query = `
      SELECT
        pi.id,
        pi.prescription_id,
        pi.medicine_id,
        m.name AS medicine_name,
        m.generic_name,
        m.batch_number,
        m.unit_price,
        m.expiry_date,
        m.quantity AS current_stock,
        pi.quantity AS requested_quantity,
        CASE
          WHEN m.id IS NULL OR m.quantity <= 0 THEN 'out_of_stock'
          WHEN m.expiry_date < CURDATE() THEN 'expired'
          WHEN m.quantity >= pi.quantity THEN 'available'
          ELSE 'insufficient'
        END AS availability_status,
        (m.quantity - pi.quantity) AS remaining_after_dispense
      FROM prescription_items pi
      LEFT JOIN medicines m ON pi.medicine_id = m.id
      WHERE pi.prescription_id = ?
      ORDER BY pi.id
    `;

    const [rows] = await pool.execute(query, [prescriptionId]);
    return rows;
  }

  // Get total count
  async getCount(filters = {}) {
    let query = `
      SELECT COUNT(DISTINCT p.id) as total
      FROM prescriptions p
      LEFT JOIN customers c ON p.customer_id = c.id
      WHERE 1=1
    `;

    const params = [];

    if (filters.search) {
      query += ` AND (
        c.first_name LIKE ? OR
        c.last_name LIKE ? OR
        c.phone LIKE ?
      )`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (filters.start_date) {
      query += ` AND p.prescription_date >= ?`;
      params.push(filters.start_date);
    }

    if (filters.end_date) {
      query += ` AND p.prescription_date <= ?`;
      params.push(filters.end_date);
    }

    const [rows] = await pool.execute(query, params);
    return rows[0].total;
  }

  // Get recent prescriptions
  async findRecent(limit = 5) {
    const query = `
      SELECT
        p.id,
        p.customer_id,
        p.prescription_date,
        CONCAT(c.first_name, ' ', c.last_name) AS customer_name
      FROM prescriptions p
      LEFT JOIN customers c ON p.customer_id = c.id
      ORDER BY p.prescription_date DESC
      LIMIT ?
    `;

    const [rows] = await pool.execute(query, [limit]);
    return rows;
  }
}

module.exports = new PrescriptionRepository();
