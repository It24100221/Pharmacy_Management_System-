const { pool } = require('../config/database');
const ApiError = require('../middleware/errorHandler');

const safeRollback = async connection => { try { await connection.rollback(); } catch {} };

const orderSelect = `
  SELECT o.order_id, o.customer_id, o.status, o.requires_prescription, o.subtotal,
    o.reviewer_user_id, o.reviewed_at, o.rejection_reason, o.created_at, o.updated_at,
    CONCAT(c.first_name, ' ', c.last_name) AS customer_name, c.email AS customer_email,
    c.phone AS customer_phone, c.address AS customer_address,
    pu.prescription_id, pu.status AS prescription_status, pu.uploaded_date AS prescription_uploaded_at,
    CASE WHEN pu.storage_path IS NOT NULL THEN CONCAT('/api/prescription-uploads/', pu.prescription_id, '/file') ELSE NULL END AS prescription_file_url,
    s.id AS sale_id
  FROM orders o
  INNER JOIN customers c ON c.id = o.customer_id
  LEFT JOIN prescription_uploads pu ON pu.order_id = o.order_id
  LEFT JOIN sales s ON s.order_id = o.order_id
`;

class OrderRepository {
  async findById(orderId) {
    const [rows] = await pool.execute(`${orderSelect} WHERE o.order_id = ?`, [orderId]);
    const order = rows[0];
    if (!order) return null;
    const [items] = await pool.execute(`
      SELECT oi.order_item_id, oi.product_id, oi.medicine_id, oi.product_code, oi.product_name,
        oi.quantity, oi.unit_price, oi.line_total, oi.prescription_required,
        pc.unit_price AS current_unit_price, pc.stock_quantity AS current_stock, pc.availability,
        oi.quantity * pc.unit_price AS current_line_total
      FROM order_items oi
      INNER JOIN v_product_catalog pc ON pc.product_id = oi.product_id
      WHERE oi.order_id = ? ORDER BY oi.order_item_id
    `, [orderId]);
    order.items = items;
    order.current_total = items.reduce((sum, item) => sum + Number(item.current_line_total), 0);
    return order;
  }

  async findMine(customerId) {
    const [rows] = await pool.execute(`${orderSelect} WHERE o.customer_id = ? ORDER BY o.created_at DESC, o.order_id DESC`, [customerId]);
    return rows;
  }

  async findByStatus(status) {
    const [rows] = await pool.execute(`${orderSelect} WHERE o.status = ? ORDER BY o.created_at`, [status]);
    return rows;
  }

  async checkout(customerId) {
    const connection = await pool.getConnection();
    let orderId;
    try {
      await connection.beginTransaction();
      const [carts] = await connection.execute(
        "SELECT TOP 1 cart_id FROM carts WITH (UPDLOCK, HOLDLOCK) WHERE customer_id = ? AND status = 'ACTIVE' ORDER BY cart_id DESC",
        [customerId]
      );
      if (!carts[0]) throw new ApiError('Cart is empty', 400);
      const cartId = carts[0].cart_id;
      const [items] = await connection.execute(`
        SELECT ci.product_id, ci.quantity, p.medicine_id, pc.product_code, pc.product_name,
          pc.unit_price, pc.stock_quantity, pc.availability, pc.prescription_required
        FROM cart_items ci
        INNER JOIN products p ON p.product_id = ci.product_id
        INNER JOIN v_product_catalog pc ON pc.product_id = ci.product_id
        WHERE ci.cart_id = ? ORDER BY ci.cart_item_id
      `, [cartId]);
      if (!items.length) throw new ApiError('Cart is empty', 400);
      for (const item of items) {
        if (!item.medicine_id) throw new ApiError(`${item.product_name} cannot currently be billed online`, 409);
        if (item.availability === 'EXPIRED' || Number(item.stock_quantity) < Number(item.quantity)) {
          throw new ApiError(`Insufficient available stock for ${item.product_name}`, 409);
        }
      }
      const requiresPrescription = items.some(item => Boolean(item.prescription_required));
      const status = requiresPrescription ? 'PRESCRIPTION_REQUIRED' : 'READY_FOR_BILLING';
      const subtotal = items.reduce((sum, item) => sum + Number(item.unit_price) * Number(item.quantity), 0);
      const [created] = await connection.execute(`
        INSERT INTO orders (customer_id, status, requires_prescription, subtotal)
        OUTPUT INSERTED.order_id AS insertId VALUES (?, ?, ?, ?)
      `, [customerId, status, requiresPrescription, subtotal]);
      orderId = created.insertId;
      for (const item of items) {
        const lineTotal = Number(item.unit_price) * Number(item.quantity);
        await connection.execute(`
          INSERT INTO order_items (order_id, product_id, medicine_id, product_code, product_name, quantity, unit_price, line_total, prescription_required)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [orderId, item.product_id, item.medicine_id, item.product_code, item.product_name, item.quantity, item.unit_price, lineTotal, Boolean(item.prescription_required)]);
      }
      await connection.execute("UPDATE carts SET status = 'CHECKED_OUT' WHERE cart_id = ?", [cartId]);
      await connection.commit();
    } catch (error) {
      await safeRollback(connection);
      throw error;
    } finally {
      connection.release();
    }
    return this.findById(orderId);
  }

  async review(orderId, reviewerUserId, decision, reason) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [orders] = await connection.execute(
        "SELECT order_id FROM orders WITH (UPDLOCK, ROWLOCK) WHERE order_id = ? AND status = 'PENDING_REVIEW'",
        [orderId]
      );
      if (!orders[0]) throw new ApiError('Order is not pending pharmacist review', 409);
      const [uploads] = await connection.execute('SELECT prescription_id FROM prescription_uploads WHERE order_id = ?', [orderId]);
      if (!uploads[0]) throw new ApiError('Prescription upload is missing', 409);

      if (decision === 'APPROVE') {
        const [items] = await connection.execute(`
          SELECT oi.quantity, oi.product_name, pc.stock_quantity, pc.availability
          FROM order_items oi INNER JOIN v_product_catalog pc ON pc.product_id = oi.product_id
          WHERE oi.order_id = ?
        `, [orderId]);
        const unavailable = items.find(item => item.availability === 'EXPIRED' || Number(item.stock_quantity) < Number(item.quantity));
        if (unavailable) throw new ApiError(`Cannot approve: insufficient available stock for ${unavailable.product_name}`, 409);
        await connection.execute(`
          UPDATE orders SET status = 'READY_FOR_BILLING', reviewer_user_id = ?, reviewed_at = SYSDATETIME(), rejection_reason = NULL
          WHERE order_id = ?
        `, [reviewerUserId, orderId]);
        await connection.execute("UPDATE prescription_uploads SET status = 'APPROVED', reviewer_user_id = ?, reviewed_at = SYSDATETIME(), rejection_reason = NULL WHERE order_id = ?", [reviewerUserId, orderId]);
      } else {
        await connection.execute(`
          UPDATE orders SET status = 'REJECTED', reviewer_user_id = ?, reviewed_at = SYSDATETIME(), rejection_reason = ?
          WHERE order_id = ?
        `, [reviewerUserId, reason || null, orderId]);
        await connection.execute("UPDATE prescription_uploads SET status = 'REJECTED', reviewer_user_id = ?, reviewed_at = SYSDATETIME(), rejection_reason = ? WHERE order_id = ?", [reviewerUserId, reason || null, orderId]);
      }
      await connection.commit();
    } catch (error) {
      await safeRollback(connection);
      throw error;
    } finally {
      connection.release();
    }
    return this.findById(orderId);
  }
}

module.exports = new OrderRepository();
