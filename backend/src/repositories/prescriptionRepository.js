const { pool } = require('../config/database');
const ApiError = require('../middleware/errorHandler');
const safeRollback = async connection => { try { await connection.rollback(); } catch {} };

class PrescriptionRepository {
  async createUpload({ customerId, originalFilename, storedFilename, storagePath, mimeType, fileSize, doctorName, notes, orderId }) {
    const connection = orderId ? await pool.getConnection() : pool;
    try {
      if (orderId) {
        await connection.beginTransaction();
        const [orders] = await connection.execute(
          "SELECT order_id FROM orders WITH (UPDLOCK, ROWLOCK) WHERE order_id = ? AND customer_id = ? AND status = 'PRESCRIPTION_REQUIRED'",
          [orderId, customerId]
        );
        if (!orders[0]) throw new ApiError('Order does not require a prescription or is not owned by this customer', 409);
      }
      const [result] = await connection.execute(`
        INSERT INTO prescription_uploads (
          customer_id, order_id, original_filename, stored_filename, storage_path,
          mime_type, file_size, doctor_name, notes, status
        )
        OUTPUT INSERTED.prescription_id AS insertId
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [customerId, orderId || null, originalFilename, storedFilename, storagePath, mimeType, fileSize, doctorName || null, notes || null, 'PENDING']);
      if (orderId) {
        await connection.execute("UPDATE orders SET status = 'PENDING_REVIEW' WHERE order_id = ?", [orderId]);
        await connection.commit();
      }
      return result.insertId;
    } catch (error) {
      if (orderId) { try { await connection.rollback(); } catch {} }
      if ((error.number === 2601 || error.number === 2627) && orderId) throw new ApiError('This order already has a prescription', 409);
      throw error;
    } finally {
      if (orderId) connection.release();
    }
  }

  async findUploadById(id) {
    const [rows] = await pool.execute(`
      SELECT prescription_id, customer_id, order_id, original_filename, stored_filename,
        storage_path, mime_type, file_size, doctor_name, notes, status, uploaded_date
      FROM prescription_uploads
      WHERE prescription_id = ?
    `, [id]);
    return rows[0] || null;
  }

  async findUploadsByCustomer(customerId) {
    const [rows] = await pool.execute(`
      SELECT prescription_id, customer_id, order_id, original_filename, mime_type, file_size,
        storage_path, doctor_name, notes, status,
        uploaded_date AS created_date
      FROM prescription_uploads
      WHERE customer_id = ?
      ORDER BY uploaded_date DESC
    `, [customerId]);
    return rows;
  }

  async findUploadsForReview(status = 'PENDING') {
    const [rows] = await pool.execute(`
      SELECT pu.prescription_id, pu.customer_id, pu.order_id, pu.original_filename,
        pu.mime_type, pu.file_size, pu.doctor_name, pu.status, pu.uploaded_date,
        pu.reviewer_user_id, pu.reviewed_at, pu.rejection_reason,
        CONCAT(c.first_name, ' ', c.last_name) AS customer_name,
        p.id AS structured_prescription_id
      FROM prescription_uploads pu
      INNER JOIN customers c ON c.id = pu.customer_id
      LEFT JOIN prescriptions p ON p.upload_id = pu.prescription_id
      WHERE (? IS NULL OR pu.status = ?)
      ORDER BY pu.uploaded_date DESC, pu.prescription_id DESC
    `, [status, status]);
    return rows;
  }

  async findReadyForBilling() {
    const [rows] = await pool.execute(`
      SELECT p.id AS prescription_id, p.customer_id, p.prescription_date, p.status,
        CONCAT(c.first_name, ' ', c.last_name) AS customer_name,
        COUNT(pi.id) AS item_count
      FROM prescriptions p
      INNER JOIN customers c ON c.id = p.customer_id
      INNER JOIN prescription_items pi ON pi.prescription_id = p.id
      WHERE p.status = 'READY_FOR_BILLING'
      GROUP BY p.id, p.customer_id, p.prescription_date, p.status, c.first_name, c.last_name
      ORDER BY p.prescription_date, p.id
    `);
    return rows;
  }

  async reviewUpload(id, actorUserId, decision, reason) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.execute('SELECT prescription_id, customer_id, order_id, status FROM prescription_uploads WITH (UPDLOCK, HOLDLOCK) WHERE prescription_id = ?', [id]);
      const upload = rows[0];
      if (!upload) throw new ApiError('Prescription upload not found', 404);
      if (upload.order_id) throw new ApiError('Review order-linked uploads through the order review queue', 409);
      if (upload.status !== 'PENDING') throw new ApiError('Prescription upload has already been reviewed', 409);
      await connection.execute(`UPDATE prescription_uploads SET status = ?, reviewer_user_id = ?, reviewed_at = SYSDATETIME(), rejection_reason = ? WHERE prescription_id = ?`,
        [decision, actorUserId, decision === 'REJECTED' ? reason : null, id]);
      await connection.commit();
      return this.findUploadById(id);
    } catch (error) { await safeRollback(connection); throw error; }
    finally { connection.release(); }
  }

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
        p.status,
        p.reviewer_user_id,
        p.reviewed_at,
        p.rejection_reason,
        p.dispensed_at,
        s.id AS sale_id,
        CONCAT(c.first_name, ' ', c.last_name) AS customer_name,
        c.phone AS customer_phone,
        c.email AS customer_email
      FROM prescriptions p
      LEFT JOIN customers c ON p.customer_id = c.id
      LEFT JOIN sales s ON s.prescription_id = p.id
      WHERE 1=1
    `;

    const params = [];

    if (filters.customer_id) {
      query += ` AND p.customer_id = ?`;
      params.push(filters.customer_id);
    }

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
        p.status,
        p.reviewer_user_id,
        p.reviewed_at,
        p.rejection_reason,
        p.dispensed_at,
        s.id AS sale_id,
        c.first_name,
        c.last_name,
        c.phone AS customer_phone,
        c.email AS customer_email,
        c.address AS customer_address
      FROM prescriptions p
      LEFT JOIN customers c ON p.customer_id = c.id
      LEFT JOIN sales s ON s.prescription_id = p.id
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
        pr.product_code,
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
      LEFT JOIN products pr ON pr.medicine_id = m.id
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
      if (prescriptionData.upload_id) {
        const [uploads] = await connection.execute('SELECT prescription_id, customer_id, status, order_id FROM prescription_uploads WITH (UPDLOCK, HOLDLOCK) WHERE prescription_id = ?', [prescriptionData.upload_id]);
        const upload = uploads[0];
        if (!upload || Number(upload.customer_id) !== Number(prescriptionData.customer_id) || upload.status !== 'APPROVED' || upload.order_id) {
          throw new ApiError('Approved standalone upload for this customer is required', 409);
        }
      }
      const prescriptionQuery = `
        INSERT INTO prescriptions (customer_id, prescription_date, instructions, notes, status, reviewer_user_id, reviewed_at, upload_id)
        OUTPUT INSERTED.id AS insertId
        VALUES (?, ?, ?, ?, 'APPROVED', ?, SYSDATETIME(), ?)
      `;

      const [prescriptionResult] = await connection.execute(prescriptionQuery, [
        prescriptionData.customer_id,
        prescriptionData.prescription_date,
        prescriptionData.instructions || null,
        prescriptionData.notes || null,
        prescriptionData.reviewer_user_id || null,
        prescriptionData.upload_id || null
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

  async updateStatus(id, actorUserId, nextStatus, reason = null) {
    const connection = await pool.getConnection();
    const transitions = {
      PENDING: new Set(['UNDER_REVIEW', 'CANCELLED']),
      UNDER_REVIEW: new Set(['APPROVED', 'REJECTED', 'CANCELLED']),
      APPROVED: new Set(['READY_FOR_BILLING', 'CANCELLED']),
      READY_FOR_BILLING: new Set(['DISPENSED', 'CANCELLED']),
      REJECTED: new Set(['UNDER_REVIEW', 'CANCELLED']),
      DISPENSED: new Set(),
      CANCELLED: new Set(),
    };
    try {
      await connection.beginTransaction();
      const [rows] = await connection.execute('SELECT id, status, customer_id FROM prescriptions WITH (UPDLOCK, ROWLOCK) WHERE id = ?', [id]);
      const current = rows[0];
      if (!current) throw new ApiError('Prescription not found', 404);
      if (!transitions[current.status]?.has(nextStatus)) throw new ApiError(`Invalid prescription status transition from ${current.status} to ${nextStatus}`, 409);
      if (nextStatus === 'REJECTED' && !reason) throw new ApiError('A rejection reason is required', 400);
      await connection.execute(`
        UPDATE prescriptions
        SET status = ?, reviewer_user_id = ?, reviewed_at = SYSDATETIME(), rejection_reason = ?,
          dispensed_at = CASE WHEN ? = 'DISPENSED' THEN SYSDATETIME() ELSE dispensed_at END
        WHERE id = ?
      `, [nextStatus, actorUserId, nextStatus === 'REJECTED' ? reason : null, nextStatus, id]);
      await connection.commit();
    } catch (error) {
      await safeRollback(connection);
      throw error;
    } finally { connection.release(); }
    return this.findById(id);
  }

  async prepareForBilling(id, actorUserId) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.execute('SELECT id, status FROM prescriptions WITH (UPDLOCK, ROWLOCK) WHERE id = ?', [id]);
      const prescription = rows[0];
      if (!prescription) throw new ApiError('Prescription not found', 404);
      if (prescription.status === 'READY_FOR_BILLING') { await connection.commit(); return this.findById(id); }
      if (prescription.status !== 'APPROVED') throw new ApiError(`Prescription status ${prescription.status} cannot be sent to billing`, 409);
      await connection.execute("UPDATE prescriptions SET status = 'READY_FOR_BILLING', reviewer_user_id = ?, reviewed_at = SYSDATETIME() WHERE id = ?", [actorUserId, id]);
      await connection.commit();
    } catch (error) { await safeRollback(connection); throw error; }
    finally { connection.release(); }
    return this.findById(id);
  }

  // Check availability of prescribed medicines
  async checkAvailability(prescriptionId) {
    const query = `
      SELECT
        pi.id,
        pi.prescription_id,
        pi.medicine_id,
        pr.product_code,
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
      LEFT JOIN products pr ON pr.medicine_id = m.id
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

    if (filters.customer_id) {
      query += ` AND p.customer_id = ?`;
      params.push(filters.customer_id);
    }

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
