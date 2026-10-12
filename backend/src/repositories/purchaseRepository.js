const { pool } = require('../config/database');
const ApiError = require('../middleware/errorHandler');

class PurchaseRepository {
  // Get all purchases
  async findAll(filters = {}) {
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
        COUNT(pi.id) AS item_count
      FROM purchases p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN purchase_items pi ON p.id = pi.purchase_id
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

    query += ` GROUP BY
      p.id, p.supplier_id, p.purchase_date, p.total_amount, p.notes,
      p.created_at, p.updated_at, s.company_name, s.phone`;
    query += ` ORDER BY p.purchase_date DESC, p.id DESC`;

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
        pr.product_code,
        m.name AS medicine_name,
        m.batch_number,
        pi.quantity,
        pi.unit_cost,
        pi.total_cost
      FROM purchase_items pi
      LEFT JOIN medicines m ON pi.medicine_id = m.id
      LEFT JOIN products pr ON pr.medicine_id = m.id
      WHERE pi.purchase_id = ?
      ORDER BY pi.id
    `;

    const [itemsRows] = await pool.execute(itemsQuery, [id]);
    purchase.items = itemsRows;

    return purchase;
  }

  // Create purchase with items (uses transaction)
  async createWithItems(purchaseData, items) {
    if (purchaseData.idempotency_key) {
      const [existing] = await pool.execute('SELECT TOP 1 id FROM purchases WHERE idempotency_key = ?', [purchaseData.idempotency_key]);
      if (existing[0]) return this.findById(existing[0].id);
    }
    const connection = await pool.getConnection();
    let purchaseId;

    try {
      await connection.beginTransaction();

      // 1. Create purchase header
      const hasIdempotencyKey = Boolean(purchaseData.idempotency_key);
      const purchaseQuery = `
        INSERT INTO purchases (supplier_id, purchase_date, total_amount, notes${hasIdempotencyKey ? ', idempotency_key' : ''})
        OUTPUT INSERTED.id AS insertId
        VALUES (?, ?, ?, ?${hasIdempotencyKey ? ', ?' : ''})
      `;

      const totalAmount = items.reduce((sum, item) => sum + parseFloat(item.total_cost), 0);

      const purchaseParams = [
        purchaseData.supplier_id,
        purchaseData.purchase_date,
        totalAmount,
        purchaseData.notes || null
      ];
      if (hasIdempotencyKey) purchaseParams.push(purchaseData.idempotency_key);
      const [purchaseResult] = await connection.execute(purchaseQuery, purchaseParams);

      purchaseId = purchaseResult.insertId;

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
        SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;

      for (const item of items) {
        const [medicineRows] = await connection.execute('SELECT id FROM medicines WITH (UPDLOCK, HOLDLOCK) WHERE id = ?', [item.medicine_id]);
        if (!medicineRows[0]) throw new ApiError(`Medicine ${item.medicine_id} not found`, 404);
        let batchId = null;
        if (item.batch_number) {
          const [existingBatches] = await connection.execute(`SELECT batch_id, expiry_date, is_active FROM medicine_batches WITH (UPDLOCK, HOLDLOCK) WHERE medicine_id = ? AND batch_number = ?`, [item.medicine_id, item.batch_number]);
          const existing = existingBatches[0];
          if (existing) {
            const existingExpiry = existing.expiry_date instanceof Date ? existing.expiry_date.toISOString().slice(0, 10) : String(existing.expiry_date).slice(0, 10);
            if (existingExpiry !== item.expiry_date || !existing.is_active) throw new ApiError('Batch number conflicts with an existing expiry or inactive batch', 409);
            batchId = existing.batch_id;
            const [batchUpdate] = await connection.execute('UPDATE medicine_batches SET quantity_available = quantity_available + ? WHERE batch_id = ?; SELECT @@ROWCOUNT AS affectedRows', [item.quantity, batchId]);
            if (Number(batchUpdate[0]?.affectedRows) !== 1) throw new ApiError('Unable to update received batch stock', 409);
          } else {
            const [created] = await connection.execute(`INSERT INTO medicine_batches (medicine_id, batch_number, expiry_date, quantity_available, unit_cost)
              OUTPUT INSERTED.batch_id AS insertId VALUES (?, ?, ?, ?, ?)`, [item.medicine_id, item.batch_number, item.expiry_date, item.quantity, item.unit_cost]);
            batchId = created.insertId;
          }
        }
        const [stockUpdate] = await connection.execute(`${stockUpdateQuery}; SELECT @@ROWCOUNT AS affectedRows`, [item.quantity, item.medicine_id]);
        if (Number(stockUpdate[0]?.affectedRows) !== 1) throw new ApiError(`Medicine ${item.medicine_id} stock could not be updated`, 409);
        const [balanceRows] = await connection.execute('SELECT quantity AS balanceAfter FROM medicines WHERE id = ?', [item.medicine_id]);
        const balanceAfter = Number(balanceRows[0]?.balanceAfter);
        if (!Number.isFinite(balanceAfter)) throw new ApiError('Unable to determine updated stock balance', 500);
        await connection.execute(`
          INSERT INTO stock_movements
            (medicine_id, batch_id, movement_type, quantity_delta, balance_after, reference_type, reference_id, idempotency_key, notes, created_by)
          VALUES (?, ?, 'GOODS_RECEIPT', ?, ?, 'PURCHASE', ?, ?, ?, ?)
        `, [item.medicine_id, batchId, item.quantity, balanceAfter, purchaseId, `purchase:${purchaseId}:medicine:${item.medicine_id}`, purchaseData.notes || null, purchaseData.actor_user_id || null]);
      }

      // Commit transaction
      await require('../services/inventorySupply').checkLowStock(connection, items.map(item => item.medicine_id), purchaseData.actor_user_id);
      await connection.commit();
    } catch (error) {
      // Rollback on error
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
    let query = `
      SELECT COUNT(DISTINCT p.id) as total
      FROM purchases p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE 1=1
    `;

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
      ORDER BY p.purchase_date DESC
      LIMIT ?
    `;

    const [rows] = await pool.execute(query, [limit]);
    return rows;
  }
}

module.exports = new PurchaseRepository();
