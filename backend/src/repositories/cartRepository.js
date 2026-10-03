const { pool } = require('../config/database');
const ApiError = require('../middleware/errorHandler');

const safeRollback = async connection => { try { await connection.rollback(); } catch {} };

class CartRepository {
  async getOrCreateCart(customerId, connection = pool) {
    const [rows] = await connection.execute(
      "SELECT TOP 1 cart_id FROM carts WHERE customer_id = ? AND status = 'ACTIVE' ORDER BY cart_id DESC",
      [customerId]
    );
    if (rows[0]) return rows[0].cart_id;
    try {
      const [created] = await connection.execute(
        "INSERT INTO carts (customer_id, status) OUTPUT INSERTED.cart_id AS insertId VALUES (?, 'ACTIVE')",
        [customerId]
      );
      return created.insertId;
    } catch (error) {
      if (error.number !== 2601 && error.number !== 2627) throw error;
      const [concurrent] = await connection.execute(
        "SELECT TOP 1 cart_id FROM carts WHERE customer_id = ? AND status = 'ACTIVE' ORDER BY cart_id DESC",
        [customerId]
      );
      return concurrent[0].cart_id;
    }
  }

  async getCart(customerId) {
    const cartId = await this.getOrCreateCart(customerId);
    const [items] = await pool.execute(`
      SELECT ci.cart_item_id, ci.product_id, p.product_code, pc.product_name, pc.category_name,
        ci.quantity, pc.unit_price, ci.quantity * pc.unit_price AS line_total,
        pc.stock_quantity, pc.availability, pc.prescription_required
      FROM cart_items ci
      INNER JOIN products p ON p.product_id = ci.product_id
      INNER JOIN v_product_catalog pc ON pc.product_id = ci.product_id
      WHERE ci.cart_id = ?
      ORDER BY ci.cart_item_id
    `, [cartId]);
    return {
      cart_id: cartId,
      items,
      subtotal: items.reduce((sum, item) => sum + Number(item.line_total), 0),
      total_items: items.reduce((sum, item) => sum + Number(item.quantity), 0),
    };
  }

  async setItem(customerId, productId, quantity, increment = false) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const cartId = await this.getOrCreateCart(customerId, connection);
      const [products] = await connection.execute(`
        SELECT p.product_id, p.medicine_id, pc.stock_quantity, pc.availability
        FROM products p INNER JOIN v_product_catalog pc ON pc.product_id = p.product_id
        WHERE p.product_id = ? AND p.is_active = 1
      `, [productId]);
      const product = products[0];
      if (!product) throw new ApiError('Product not found', 404);
      if (!product.medicine_id) throw new ApiError('This product is not yet available for online ordering', 409);
      if (['OUT_OF_STOCK', 'EXPIRED', 'INACTIVE'].includes(product.availability)) throw new ApiError('Product is unavailable', 409);

      const [existingRows] = await connection.execute(
        'SELECT quantity FROM cart_items WITH (UPDLOCK, ROWLOCK) WHERE cart_id = ? AND product_id = ?',
        [cartId, productId]
      );
      const nextQuantity = increment && existingRows[0] ? Number(existingRows[0].quantity) + quantity : quantity;
      if (!Number.isInteger(nextQuantity) || nextQuantity < 1 || nextQuantity > 999) throw new ApiError('Quantity must be between 1 and 999', 400);
      if (nextQuantity > Number(product.stock_quantity)) throw new ApiError(`Only ${product.stock_quantity} units are currently available`, 409);
      if (existingRows[0]) {
        await connection.execute('UPDATE cart_items SET quantity = ? WHERE cart_id = ? AND product_id = ?', [nextQuantity, cartId, productId]);
      } else {
        await connection.execute('INSERT INTO cart_items (cart_id, product_id, quantity) VALUES (?, ?, ?)', [cartId, productId, nextQuantity]);
      }
      await connection.commit();
    } catch (error) {
      await safeRollback(connection);
      throw error;
    } finally {
      connection.release();
    }
    return this.getCart(customerId);
  }

  async removeItem(customerId, productId) {
    const cartId = await this.getOrCreateCart(customerId);
    await pool.execute('DELETE FROM cart_items WHERE cart_id = ? AND product_id = ?', [cartId, productId]);
    return this.getCart(customerId);
  }

  async clear(customerId) {
    const cartId = await this.getOrCreateCart(customerId);
    await pool.execute('DELETE FROM cart_items WHERE cart_id = ?', [cartId]);
    return this.getCart(customerId);
  }
}

module.exports = new CartRepository();
