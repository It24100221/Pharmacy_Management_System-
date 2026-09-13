const { pool } = require('../config/database');
const ApiError = require('../middleware/errorHandler');

class SaleRepository {
  // Get all sales
  async findAll(filters = {}) {
    let query = `
      SELECT
        s.id,
        s.sale_date,
        s.customer_id,
        s.total_amount,
        s.discount,
        s.final_amount,
        s.payment_method,
        s.notes,
        s.created_at,
        s.updated_at,
        CONCAT(c.first_name, ' ', c.last_name) AS customer_name,
        c.phone AS customer_phone
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
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
      query += ` AND DATE(s.sale_date) >= ?`;
      params.push(filters.start_date);
    }

    if (filters.end_date) {
      query += ` AND DATE(s.sale_date) <= ?`;
      params.push(filters.end_date);
    }

    query += ` ORDER BY s.sale_date DESC, s.id DESC`;

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

  // Get sale by ID with items
  async findById(id) {
    // Get sale header
    const headerQuery = `
      SELECT
        s.id,
        s.sale_date,
        s.customer_id,
        s.total_amount,
        s.discount,
        s.final_amount,
        s.payment_method,
        s.notes,
        s.created_at,
        s.updated_at,
        c.id AS customer_id,
        c.first_name,
        c.last_name,
        c.phone AS customer_phone,
        c.email AS customer_email,
        c.address AS customer_address
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      WHERE s.id = ?
    `;

    const [headerRows] = await pool.execute(headerQuery, [id]);
    const sale = headerRows[0] || null;

    if (!sale) {
      return null;
    }

    // Get sale items with medicine details
    const itemsQuery = `
      SELECT
        si.id,
        si.sale_id,
        si.medicine_id,
        m.name AS medicine_name,
        m.batch_number,
        si.quantity,
        si.unit_price,
        si.line_total
      FROM sale_items si
      LEFT JOIN medicines m ON si.medicine_id = m.id
      WHERE si.sale_id = ?
      ORDER BY si.id
    `;

    const [itemsRows] = await pool.execute(itemsQuery, [id]);
    sale.items = itemsRows;

    return sale;
  }

  // Create sale with items (uses transaction)
  async createWithItems(saleData, items) {
    const connection = await pool.getConnection();
    let saleId;

    try {
      await connection.beginTransaction();

      // 1. Validate and calculate totals
      let totalAmount = 0;
      const validatedItems = [];

      for (const item of items) {
        // Get current medicine stock
        const [medicineRows] = await connection.execute(
          `SELECT id, name, quantity, unit_price,
             CASE WHEN expiry_date < CURDATE() THEN 1 ELSE 0 END AS is_expired
           FROM medicines WHERE id = ? FOR UPDATE`,
          [item.medicine_id]
        );

        const medicine = medicineRows[0];

        if (!medicine) {
          throw new ApiError(`Medicine with ID ${item.medicine_id} not found`, 404);
        }

        if (medicine.is_expired) {
          throw new ApiError(`Expired medicine "${medicine.name}" cannot be sold`, 409);
        }

        // Check if enough stock
        if (medicine.quantity < item.quantity) {
          throw new ApiError(
            `Insufficient stock for "${medicine.name}". Available: ${medicine.quantity}, Requested: ${item.quantity}`,
            409
          );
        }

        // Validate quantity > 0
        if (item.quantity <= 0) {
          throw new ApiError('Quantity must be greater than 0', 400);
        }

        // Calculate line total
        const unitPrice = Number(medicine.unit_price);
        const lineTotal = item.quantity * unitPrice;

        validatedItems.push({
          medicine_id: item.medicine_id,
          quantity: item.quantity,
          unit_price: unitPrice,
          line_total: lineTotal
        });

        totalAmount += lineTotal;
      }

      // Apply discount
      const discount = parseFloat(saleData.discount) || 0;
      const finalAmount = totalAmount - discount;

      if (finalAmount < 0) {
        throw new ApiError('Discount cannot exceed total amount', 400);
      }

      // 2. Create sale header
      const saleQuery = `
        INSERT INTO sales (customer_id, sale_date, total_amount, discount, final_amount, payment_method, notes)
        VALUES (?, NOW(), ?, ?, ?, ?, ?)
      `;

      const [saleResult] = await connection.execute(saleQuery, [
        saleData.customer_id || null,
        totalAmount,
        discount,
        finalAmount,
        saleData.payment_method || 'Cash',
        saleData.notes || null
      ]);

      saleId = saleResult.insertId;

      // 3. Create sale items and reduce stock
      const itemQuery = `
        INSERT INTO sale_items (sale_id, medicine_id, quantity, unit_price, line_total)
        VALUES (?, ?, ?, ?, ?)
      `;

      // Stock reduction query
      const stockReduceQuery = `
        UPDATE medicines
        SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;

      for (const item of validatedItems) {
        // Create sale item
        await connection.execute(itemQuery, [
          saleId,
          item.medicine_id,
          item.quantity,
          item.unit_price,
          item.line_total
        ]);

        // Reduce stock
        await connection.execute(stockReduceQuery, [item.quantity, item.medicine_id]);
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
    return this.findById(saleId);
  }

  // Get total count
  async getCount(filters = {}) {
    let query = `
      SELECT COUNT(DISTINCT s.id) as total
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
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
      query += ` AND DATE(s.sale_date) >= ?`;
      params.push(filters.start_date);
    }

    if (filters.end_date) {
      query += ` AND DATE(s.sale_date) <= ?`;
      params.push(filters.end_date);
    }

    const [rows] = await pool.execute(query, params);
    return rows[0].total;
  }

  // Get recent sales
  async findRecent(limit = 5) {
    const query = `
      SELECT
        s.id,
        s.sale_date,
        s.final_amount,
        s.payment_method,
        CONCAT(c.first_name, ' ', c.last_name) AS customer_name
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      ORDER BY s.sale_date DESC
      LIMIT ?
    `;

    const [rows] = await pool.execute(query, [limit]);
    return rows;
  }

  // Get today's sales summary
  async getTodaySummary() {
    const query = `
      SELECT
        COUNT(DISTINCT s.id) AS total_sales,
        SUM(s.final_amount) AS total_revenue,
        SUM(si.quantity) AS total_items_sold
      FROM sales s
      LEFT JOIN sale_items si ON s.id = si.sale_id
      WHERE DATE(s.sale_date) = CURDATE()
    `;

    const [rows] = await pool.execute(query);
    return rows[0];
  }
}

module.exports = new SaleRepository();
