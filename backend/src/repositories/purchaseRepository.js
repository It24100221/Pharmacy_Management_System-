const { pool } = require('../config/database');
const ApiError = require('../middleware/errorHandler');

// Microsoft SQL Server implementation (Stage 0B).
//
// `createWithItems` runs inside a SERIALIZABLE transaction so the stock
// increment cannot interleave with a concurrent sale's UPDLOCK read.

class PurchaseRepository {
  // Get all purchases
  async findAll(filters = {}) {
    // MySQL allowed bare p.* / s.* columns with `GROUP BY p.id`; SQL Server
    // does not. The item count is therefore aggregated in a derived table.
    let query = `
      SELECT
        p.id,
        p.supplier_id,
        p.purchase_date,
        p.total_amount,
        p.notes,
        p.created_at,
        p.updated_at,
        s.company_name AS supplier_name,
        s.phone AS supplier_phone,
        COALESCE(pi.item_count, 0) AS item_count
      FROM purchases p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN (
        SELECT purchase_id, COUNT(*) AS item_count
        FROM purchase_items
        GROUP BY purchase_id
      ) pi ON pi.purchase_id = p.id
      WHERE 1=1
    `;

    const params = [];

    // Search by supplier
    if (filters.search) {
      query += ` AND (s.company_name LIKE ? OR s.contact_person LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm);
    }

    // Date range filter
    if (filters.start_date) {
      query += ` AND p.purchase_date >= ?`;
      params.push(filters.start_date);
    }

    if (filters.end_date) {
      query += ` AND p.purchase_date <= ?`;
      params.push(filters.end_date);
    }

    // Deterministic order (OFFSET/FETCH requires a stable ORDER BY).
    query += ` ORDER BY p.purchase_date DESC, p.id DESC`;

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

  // Get purchase by ID with items
  async findById(id) {
    // Get purchase header
    const headerQuery = `
      SELECT
        p.id,
        p.supplier_id,
        p.purchase_date,
        p.total_amount,
        p.notes,
        p.created_at,
        p.updated_at,
        s.id AS supplier_id,
        s.company_name AS supplier_name,
        s.contact_person AS supplier_contact,
        s.email AS supplier_email,
        s.phone AS supplier_phone,
        s.address AS supplier_address
      FROM purchases p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE p.id = ?
    `;

    const [headerRows] = await pool.execute(headerQuery, [id]);
    const purchase = headerRows[0] || null;

    if (!purchase) {
      return null;
    }

    // Get purchase items
    const itemsQuery = `
      SELECT
        pi.id,
        pi.purchase_id,
        pi.medicine_id,
        m.name AS medicine_name,
        m.batch_number,
        pi.quantity,
        pi.unit_cost,
        pi.total_cost
      FROM purchase_items pi
      LEFT JOIN medicines m ON pi.medicine_id = m.id
      WHERE pi.purchase_id = ?
      ORDER BY pi.id
    `;

    const [itemsRows] = await pool.execute(itemsQuery, [id]);
    purchase.items = itemsRows;

    return purchase;
  }

  // Create purchase with items (uses transaction)
  async createWithItems(purchaseData, items) {
    const connection = await pool.getConnection({ serializable: true });
    let purchaseId;

    try {
      await connection.beginTransaction();

      // 1. Create purchase header
      const purchaseQuery = `
        INSERT INTO purchases (supplier_id, purchase_date, total_amount, notes)
        OUTPUT INSERTED.id
        VALUES (?, ?, ?, ?)
      `;

      const totalAmount = items.reduce((sum, item) => sum + parseFloat(item.total_cost), 0);

      const [purchaseResult] = await connection.execute(purchaseQuery, [
        purchaseData.supplier_id,
        purchaseData.purchase_date,
        totalAmount,
        purchaseData.notes || null
      ]);

      purchaseId = purchaseResult[0].id;

      // 2. Create purchase items
      const itemQuery = `
        INSERT INTO purchase_items (purchase_id, medicine_id, quantity, unit_cost, total_cost)
        VALUES (?, ?, ?, ?, ?)
      `;

      for (const item of items) {
        await connection.execute(itemQuery, [
          purchaseId,
          item.medicine_id,
          item.quantity,
          item.unit_cost,
          item.total_cost
        ]);
      }

      // 3. Increase medicine stock for each item
      const stockUpdateQuery = `
        UPDATE medicines
        SET quantity = quantity + ?, updated_at = SYSDATETIME()
        WHERE id = ?
      `;

      for (const item of items) {
        await connection.execute(stockUpdateQuery, [item.quantity, item.medicine_id]);
      }

      // Commit transaction
      await connection.commit();
    } catch (error) {
      // Rollback on error — the whole purchase disappears, no partial stock.
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    // Load the committed record after the transaction connection is closed.
    return this.findById(purchaseId);
  }

  // Get total count
  async getCount(filters = {}) {
    let query = `SELECT COUNT(DISTINCT p.id) AS total
      FROM purchases p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE 1=1`;
    const params = [];

    if (filters.search) {
      query += ` AND (s.company_name LIKE ? OR s.contact_person LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm);
    }

    if (filters.start_date) {
      query += ` AND p.purchase_date >= ?`;
      params.push(filters.start_date);
    }

    if (filters.end_date) {
      query += ` AND p.purchase_date <= ?`;
      params.push(filters.end_date);
    }

    const [rows] = await pool.execute(query, params);
    return rows[0].total;
  }

  // Get recent purchases
  async findRecent(limit = 5) {
    const query = `
      SELECT
        p.id,
        p.supplier_id,
        p.purchase_date,
        p.total_amount,
        s.company_name AS supplier_name
      FROM purchases p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      ORDER BY p.purchase_date DESC, p.id DESC
      OFFSET 0 ROWS FETCH NEXT ? ROWS ONLY
    `;

    const [rows] = await pool.execute(query, [limit]);
    return rows;
  }
}

module.exports = new PurchaseRepository();
