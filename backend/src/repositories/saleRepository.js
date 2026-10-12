const { pool } = require('../config/database');
const ApiError = require('../middleware/errorHandler');
const { allocateFefo } = require('../services/stockAllocation');
const { todayInTimeZone } = require('../utils/requestValidation');

class SaleRepository {
  // Get all sales
  async findAll(filters = {}) {
    let query = `
      SELECT
        s.id,
        s.order_id,
        s.prescription_id,
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
        s.order_id,
        s.prescription_id,
        s.sale_date,
        s.customer_id,
        s.total_amount,
        s.discount,
        s.final_amount,
        s.payment_method,
        s.notes,
        s.created_at,
        s.updated_at,
        c.first_name,
        c.last_name,
        c.phone AS customer_phone,
        c.email AS customer_email,
        c.address AS customer_address
        ,ci.customer_invoice_id, ci.status AS invoice_status
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      LEFT JOIN customer_invoices ci ON ci.sale_id = s.id
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
        pr.product_code,
        m.name AS medicine_name,
        m.batch_number,
        si.quantity,
        si.unit_price,
        si.line_total
      FROM sale_items si
      LEFT JOIN medicines m ON si.medicine_id = m.id
      LEFT JOIN products pr ON pr.medicine_id = m.id
      WHERE si.sale_id = ?
      ORDER BY si.id
    `;

    const [itemsRows] = await pool.execute(itemsQuery, [id]);
    sale.items = itemsRows;

    return sale;
  }

  // Create sale with items (uses transaction)
  async createWithItems(saleData, items) {
    if (saleData.idempotency_key) {
      const [existing] = await pool.execute('SELECT TOP 1 id FROM sales WHERE idempotency_key = ?', [saleData.idempotency_key]);
      if (existing[0]) return this.findById(existing[0].id);
    }
    const connection = await pool.getConnection();
    let saleId;

    try {
      await connection.beginTransaction();

      if (saleData.order_id) {
        const [orderRows] = await connection.execute(
          "SELECT order_id, customer_id FROM orders WITH (UPDLOCK, ROWLOCK) WHERE order_id = ? AND status = 'READY_FOR_BILLING'",
          [saleData.order_id]
        );
        if (!orderRows[0]) throw new ApiError('Order is no longer ready for billing', 409);
        if (Number(orderRows[0].customer_id) !== Number(saleData.customer_id)) throw new ApiError('Order customer mismatch', 409);
      }

      let prescriptionItems = null;
      if (saleData.prescription_id) {
        const [prescriptions] = await connection.execute(
          "SELECT id, customer_id, status FROM prescriptions WITH (UPDLOCK, ROWLOCK) WHERE id = ? AND status = 'READY_FOR_BILLING'",
          [saleData.prescription_id]
        );
        const prescription = prescriptions[0];
        if (!prescription) throw new ApiError('Prescription is not ready for billing or has already been dispensed', 409);
        if (saleData.customer_id === null || saleData.customer_id === undefined) {
          saleData.customer_id = Number(prescription.customer_id);
        } else if (Number(prescription.customer_id) !== Number(saleData.customer_id)) {
          throw new ApiError('Prescription customer mismatch', 409);
        }
        const [prescribed] = await connection.execute('SELECT medicine_id, quantity FROM prescription_items WHERE prescription_id = ?', [saleData.prescription_id]);
        prescriptionItems = prescribed.map(item => ({ medicine_id: Number(item.medicine_id), quantity: Number(item.quantity) })).sort((a, b) => a.medicine_id - b.medicine_id);
        const submitted = items.map(item => ({ medicine_id: Number(item.medicine_id), quantity: Number(item.quantity) })).sort((a, b) => a.medicine_id - b.medicine_id);
        if (JSON.stringify(submitted) !== JSON.stringify(prescriptionItems)) throw new ApiError('Sale items must match the approved prescription', 409);
      }

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

        // Plan against locked batches. A legacy medicine-level expiry only
        // blocks unallocated stock; valid, active batches may still be sold.
        const [batches] = await connection.execute(`
          SELECT batch_id, batch_number, expiry_date, quantity_available, is_active
          FROM medicine_batches WITH (UPDLOCK, HOLDLOCK)
          WHERE medicine_id = ? ORDER BY expiry_date, batch_id
        `, [item.medicine_id]);
        const today = todayInTimeZone();
        const stockPlan = allocateFefo({ medicineName: medicine.name, requestedQuantity: item.quantity,
          aggregateQuantity: medicine.quantity, batches, today });
        if (medicine.is_expired && stockPlan.allocation.some(allocation => allocation.batchId === null)) {
          throw new ApiError(`Expired medicine "${medicine.name}" cannot be sold`, 409);
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
          ,allocation: stockPlan.allocation
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
      const hasIdempotencyKey = Boolean(saleData.idempotency_key);
      const hasPrescription = Boolean(saleData.prescription_id);
      const saleQuery = saleData.order_id ? `
        INSERT INTO sales (customer_id, order_id${hasPrescription ? ', prescription_id' : ''}, sale_date, total_amount, discount, final_amount, payment_method, notes${hasIdempotencyKey ? ', idempotency_key' : ''})
        OUTPUT INSERTED.id AS insertId
        VALUES (?, ?${hasPrescription ? ', ?' : ''}, NOW(), ?, ?, ?, ?, ?${hasIdempotencyKey ? ', ?' : ''})
      ` : `
        INSERT INTO sales (customer_id${hasPrescription ? ', prescription_id' : ''}, sale_date, total_amount, discount, final_amount, payment_method, notes${hasIdempotencyKey ? ', idempotency_key' : ''})
        OUTPUT INSERTED.id AS insertId
        VALUES (?${hasPrescription ? ', ?' : ''}, NOW(), ?, ?, ?, ?, ?${hasIdempotencyKey ? ', ?' : ''})
      `;

      const saleParams = [saleData.customer_id || null];
      if (saleData.order_id) saleParams.push(saleData.order_id);
      if (hasPrescription) saleParams.push(saleData.prescription_id);
      saleParams.push(totalAmount, discount, finalAmount, saleData.payment_method || 'Cash', saleData.notes || null);
      if (hasIdempotencyKey) saleParams.push(saleData.idempotency_key);
      const [saleResult] = await connection.execute(saleQuery, saleParams);

      saleId = saleResult.insertId;

      // 3. Create sale items and reduce stock
      const itemQuery = `
        INSERT INTO sale_items (sale_id, medicine_id, quantity, unit_price, line_total)
        VALUES (?, ?, ?, ?, ?)
      `;

      // Stock reduction query
      for (const item of validatedItems) {
        // Create sale item
        await connection.execute(itemQuery, [
          saleId,
          item.medicine_id,
          item.quantity,
          item.unit_price,
          item.line_total
        ]);

        for (const allocation of item.allocation) {
          if (allocation.batchId !== null) {
            const [batchUpdate] = await connection.execute(`UPDATE medicine_batches SET quantity_available = quantity_available - ?
              WHERE batch_id = ? AND medicine_id = ? AND quantity_available >= ?;
              SELECT @@ROWCOUNT AS affectedRows`,
              [allocation.quantity, allocation.batchId, item.medicine_id, allocation.quantity]);
            if (Number(batchUpdate[0]?.affectedRows) !== 1) throw new ApiError('Batch stock changed; please retry', 409);
          }
          const [medicineUpdate] = await connection.execute(`UPDATE medicines SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND quantity >= ?;
            SELECT @@ROWCOUNT AS affectedRows`, [allocation.quantity, item.medicine_id, allocation.quantity]);
          if (Number(medicineUpdate[0]?.affectedRows) !== 1) throw new ApiError('Aggregate stock changed; please retry', 409);
          const [balanceRows] = await connection.execute('SELECT quantity AS balanceAfter FROM medicines WHERE id = ?', [item.medicine_id]);
          const balanceAfter = Number(balanceRows[0]?.balanceAfter);
          if (!Number.isFinite(balanceAfter)) throw new ApiError('Unable to determine updated stock balance', 500);
          await connection.execute(`
            INSERT INTO stock_movements
              (medicine_id, batch_id, movement_type, quantity_delta, balance_after, reference_type, reference_id, idempotency_key, notes, created_by)
            VALUES (?, ?, 'SALE', ?, ?, 'SALE', ?, ?, ?, ?)
          `, [item.medicine_id, allocation.batchId, -allocation.quantity, balanceAfter, saleId,
            `sale:${saleId}:medicine:${item.medicine_id}:batch:${allocation.batchId || 'legacy'}`,
            saleData.notes || null, saleData.actor_user_id || null]);
        }
      }

      // Every completed sale gets one durable invoice. Payment confirmation is
      // deliberately handled separately so Card/Online is never treated as
      // externally settled merely because a method was selected.
      await connection.execute(`
        INSERT INTO customer_invoices (sale_id, customer_id, subtotal, discount_amount, tax_amount, total_amount, status)
        VALUES (?, ?, ?, ?, 0, ?, 'UNPAID')
      `, [saleId, saleData.customer_id || null, totalAmount, discount, finalAmount]);

      if (String(saleData.payment_method || 'Cash').toUpperCase() === 'CASH') {
        if (!saleData.actor_user_id) throw new ApiError('A staff identity is required for cash payment', 400);
        const [invoiceRows] = await connection.execute('SELECT customer_invoice_id FROM customer_invoices WHERE sale_id = ?', [saleId]);
        const invoiceId = invoiceRows[0]?.customer_invoice_id;
        if (finalAmount > 0) {
          await connection.execute(`
            INSERT INTO customer_payments (customer_invoice_id, amount, payment_method, status, idempotency_key, created_by, confirmed_at)
            VALUES (?, ?, 'CASH', 'CONFIRMED', ?, ?, SYSDATETIME())
          `, [invoiceId, finalAmount, `payment:sale:${saleId}`, saleData.actor_user_id]);
        }
        await connection.execute("UPDATE customer_invoices SET status = 'PAID' WHERE customer_invoice_id = ?", [invoiceId]);
        await connection.execute("UPDATE sales SET payment_status = 'PAID', updated_at = SYSDATETIME() WHERE id = ?", [saleId]);
        if (hasPrescription) {
          await connection.execute("UPDATE prescriptions SET status = 'DISPENSED', dispensed_at = SYSDATETIME(), reviewer_user_id = ? WHERE id = ? AND status = 'READY_FOR_BILLING'", [saleData.actor_user_id, saleData.prescription_id]);
        }
      }

      if (saleData.order_id) {
        await connection.execute("UPDATE orders SET status = 'COMPLETED' WHERE order_id = ?", [saleData.order_id]);
        await connection.execute("UPDATE prescription_uploads SET status = 'COMPLETED' WHERE order_id = ?", [saleData.order_id]);
      }

      // Commit transaction
      await require('../services/inventorySupply').checkLowStock(connection, validatedItems.map(item => item.medicine_id), saleData.actor_user_id);
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
        (SELECT COUNT(*) FROM sales WHERE DATE(sale_date) = CURDATE()) AS total_sales,
        (SELECT COALESCE(SUM(final_amount), 0) FROM sales WHERE DATE(sale_date) = CURDATE()) AS total_revenue,
        (SELECT COALESCE(SUM(si.quantity), 0)
         FROM sale_items si INNER JOIN sales item_sales ON item_sales.id = si.sale_id
         WHERE DATE(item_sales.sale_date) = CURDATE()) AS total_items_sold
    `;

    const [rows] = await pool.execute(query);
    return rows[0];
  }
}

module.exports = new SaleRepository();
