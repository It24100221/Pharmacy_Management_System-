const { pool } = require('../config/database');
const ApiError = require('../middleware/errorHandler');

class PurchaseOrderRepository {
  async findAll(supplierId = null) {
    const [rows] = await pool.execute(`SELECT po.purchase_order_id, po.purchase_order_number, po.supplier_id, s.company_name AS supplier_name, po.status, po.expected_date, po.notes, po.created_by, po.created_at, po.updated_at, po.reorder_request_id, po.supplier_response_id FROM purchase_orders po INNER JOIN suppliers s ON s.id = po.supplier_id ${supplierId ? 'WHERE po.supplier_id=?' : ''} ORDER BY po.created_at DESC`, supplierId ? [supplierId] : []);
    return rows;
  }

  async findById(id, supplierId = null) {
    const [orders] = await pool.execute(`SELECT po.purchase_order_id, po.purchase_order_number, po.supplier_id, s.company_name AS supplier_name, po.status, po.expected_date, po.notes, po.created_by, po.created_at, po.updated_at, po.reorder_request_id, po.supplier_response_id FROM purchase_orders po INNER JOIN suppliers s ON s.id = po.supplier_id WHERE po.purchase_order_id = ? ${supplierId ? 'AND po.supplier_id=?' : ''}`, supplierId ? [id,supplierId] : [id]);
    if (!orders[0]) return null;
    const [items] = await pool.execute(`SELECT poi.purchase_order_item_id, poi.medicine_id, m.name AS medicine_name, poi.ordered_quantity, poi.received_quantity, poi.unit_cost FROM purchase_order_items poi INNER JOIN medicines m ON m.id = poi.medicine_id WHERE poi.purchase_order_id = ?`, [id]);
    orders[0].items = items; return orders[0];
  }

  async create({ supplierId, expectedDate = null, notes = null, idempotencyKey = null, actorUserId, items }) {
    if (idempotencyKey) { const [existing] = await pool.execute('SELECT TOP 1 purchase_order_id FROM purchase_orders WHERE idempotency_key = ?', [idempotencyKey]); if (existing[0]) return this.findById(existing[0].purchase_order_id); }
    const connection = await pool.getConnection(); let id;
    try {
      await connection.beginTransaction();
      const [result] = await connection.execute(`INSERT INTO purchase_orders (supplier_id, expected_date, notes, idempotency_key, created_by) OUTPUT INSERTED.purchase_order_id AS insertId VALUES (?, ?, ?, ?, ?)`, [supplierId, expectedDate, notes, idempotencyKey, actorUserId]);
      id = result.insertId;
      for (const item of items) await connection.execute(`INSERT INTO purchase_order_items (purchase_order_id, medicine_id, ordered_quantity, unit_cost) VALUES (?, ?, ?, ?)`, [id, item.medicine_id, item.quantity, item.unit_cost]);
      await connection.commit();
    } catch (error) { try { await connection.rollback(); } catch {} throw error; } finally { connection.release(); }
    return this.findById(id);
  }

  async updateStatus(id, status, user = null) {
    const allowed = new Set(['DRAFT', 'SENT', 'CONFIRMED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED']);
    if (!allowed.has(status)) throw new ApiError('Invalid purchase order status', 400);
    const scope = user ? require('../services/inventorySupply').supplierScope(user) : null;
    const [currentRows] = await pool.execute('SELECT status,supplier_id,reorder_request_id FROM purchase_orders WHERE purchase_order_id = ?', [id]);
    if (!currentRows[0]) throw new ApiError('Purchase order not found', 404);
    if (scope && Number(currentRows[0].supplier_id)!==scope) throw new ApiError('Purchase order not found',404);
    if (scope && status!=='CONFIRMED') throw new ApiError('Suppliers may only confirm their assigned sent order',403);
    if (['PARTIALLY_RECEIVED','RECEIVED'].includes(status)) throw new ApiError('Receipt statuses are updated only by posting goods receipts',409);
    const transitions = {
      DRAFT: new Set(['SENT', 'CANCELLED']),
      SENT: new Set(['CONFIRMED', 'CANCELLED']),
      CONFIRMED: new Set(['PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED']),
      PARTIALLY_RECEIVED: new Set(['RECEIVED']),
      RECEIVED: new Set(),
      CANCELLED: new Set(),
    };
    if (currentRows[0].status !== status && !transitions[currentRows[0].status].has(status)) throw new ApiError('Purchase order cannot transition to that status', 409);
    if (currentRows[0].status === status) return this.findById(id);
    await require('../services/inventorySupply').transaction(async connection => {
      const [result] = await connection.execute(`UPDATE purchase_orders SET status = ?, sent_at = CASE WHEN ? = 'SENT' THEN SYSDATETIME() ELSE sent_at END, confirmed_at = CASE WHEN ? = 'CONFIRMED' THEN COALESCE(confirmed_at, SYSDATETIME()) ELSE confirmed_at END, updated_at = SYSDATETIME() WHERE purchase_order_id = ? AND status = ?; SELECT @@ROWCOUNT AS affectedRows`, [status, status, status, id, currentRows[0].status]);
      if (Number(result[0]?.affectedRows) !== 1) throw new ApiError('Purchase order changed; please retry', 409);
      await require('../services/inventorySupply').notifyOrderStatus(connection,id,status);
    });
    return this.findById(id);
  }
}
module.exports = new PurchaseOrderRepository();
