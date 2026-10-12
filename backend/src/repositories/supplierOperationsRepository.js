const { pool } = require('../config/database');
const ApiError = require('../middleware/errorHandler');
const notificationRepository = require('./notificationRepository');

const dateOnly = value => value instanceof Date ? value.toISOString().slice(0, 10) : String(value || '').slice(0, 10);

class SupplierOperationsRepository {
  async findLowStock() { return require('../services/inventorySupply').lowStock(); }
  async listReorderRequests(status, supplierId = null) { return require('../services/inventorySupply').listRequests({ status, supplierId }); }
  async createReorderRequest(data) { return require('../services/inventorySupply').createRequest(data); }
  async findReorderById(id) { return require('../services/inventorySupply').getRequest(id); }
  async updateReorderStatus(id, status) {
    if (status !== 'CANCELLED') throw new ApiError('Request status is controlled by supplier approval and goods receipt', 409);
    await require('../services/inventorySupply').transaction(async connection => {
      const [rows] = await connection.execute('SELECT status FROM reorder_requests WITH (UPDLOCK,HOLDLOCK) WHERE reorder_request_id=?', [id]);
      if (!rows[0]) throw new ApiError('Supply request not found', 404);
      if (rows[0].status === 'CANCELLED') return;
      if (rows[0].status !== 'OPEN') throw new ApiError('Cancel the linked purchase order instead', 409);
      await connection.execute("UPDATE reorder_requests SET status='CANCELLED',resolved_at=SYSDATETIME() WHERE reorder_request_id=?", [id]);
      const request=await require('../services/inventorySupply').getRequest(id,null,connection);
      await require('../services/inventorySupply').notify(connection,{supplierId:request.supplier_id,type:'SUPPLY_CANCELLED',title:'Supply request cancelled',message:request.request_number,entityType:'REORDER_REQUEST',entityId:id,key:'supply-cancelled:'+id});
    });
    return this.findReorderById(id);
  }

  async listInquiries(status) {
    const params = [];
    const where = status ? ' WHERE q.status = ?' : '';
    if (status) params.push(status);
    const [rows] = await pool.execute(`
      SELECT q.query_id, q.supplier_id, s.company_name AS supplier_name, q.subject, q.status,
        q.created_by, q.created_at, q.closed_at,
        (SELECT COUNT(*) FROM supplier_query_messages qm WHERE qm.query_id = q.query_id) AS message_count
      FROM supplier_queries q INNER JOIN suppliers s ON s.id = q.supplier_id
      ${where} ORDER BY q.created_at DESC, q.query_id DESC
    `, params);
    return rows;
  }

  async getInquiry(id) {
    const [queries] = await pool.execute(`
      SELECT q.query_id, q.supplier_id, s.company_name AS supplier_name, q.subject, q.status,
        q.created_by, q.created_at, q.closed_at
      FROM supplier_queries q INNER JOIN suppliers s ON s.id = q.supplier_id WHERE q.query_id = ?
    `, [id]);
    if (!queries[0]) return null;
    const [messages] = await pool.execute(`
      SELECT message_id, query_id, sender_user_id, message, created_at
      FROM supplier_query_messages WHERE query_id = ? ORDER BY created_at ASC, message_id ASC
    `, [id]);
    queries[0].messages = messages;
    return queries[0];
  }

  async createInquiry({ supplierId, subject, message, actorUserId }) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [supplier] = await connection.execute('SELECT id FROM suppliers WITH (UPDLOCK, HOLDLOCK) WHERE id = ?', [supplierId]);
      if (!supplier[0]) throw new ApiError('Supplier not found', 404);
      const [query] = await connection.execute(`INSERT INTO supplier_queries (supplier_id, subject, created_by) OUTPUT INSERTED.query_id AS insertId VALUES (?, ?, ?)`, [supplierId, subject, actorUserId]);
      await connection.execute('INSERT INTO supplier_query_messages (query_id, sender_user_id, message) VALUES (?, ?, ?)', [query.insertId, actorUserId, message]);
      await connection.commit();
      return this.getInquiry(query.insertId);
    } catch (error) { try { await connection.rollback(); } catch {} throw error; }
    finally { connection.release(); }
  }

  async addInquiryMessage(id, { message, actorUserId }) {
    const [existing] = await pool.execute('SELECT query_id, status FROM supplier_queries WHERE query_id = ?', [id]);
    if (!existing[0]) throw new ApiError('Supplier inquiry not found', 404);
    if (existing[0].status === 'CLOSED') throw new ApiError('Closed inquiries cannot receive messages', 409);
    await pool.execute('INSERT INTO supplier_query_messages (query_id, sender_user_id, message) VALUES (?, ?, ?)', [id, actorUserId, message]);
    return this.getInquiry(id);
  }

  async updateInquiryStatus(id, status) {
    if (!['OPEN', 'ANSWERED', 'CLOSED'].includes(status)) throw new ApiError('Invalid inquiry status', 400);
    const [rows] = await pool.execute(`UPDATE supplier_queries SET status = ?, closed_at = CASE WHEN ? = 'CLOSED' THEN SYSDATETIME() ELSE NULL END WHERE query_id = ?; SELECT @@ROWCOUNT AS affectedRows`, [status, status, id]);
    if (Number(rows[0]?.affectedRows) !== 1) throw new ApiError('Supplier inquiry not found', 404);
    return this.getInquiry(id);
  }

  async listInvoices(status) {
    const params = [];
    const where = status ? ' WHERE si.status = ?' : '';
    if (status) params.push(status);
    const [rows] = await pool.execute(`
      SELECT si.supplier_invoice_id, si.supplier_id, s.company_name AS supplier_name,
        si.purchase_order_id, si.invoice_number, si.invoice_date, si.due_date,
        si.total_amount, si.paid_amount, (si.total_amount - si.paid_amount) AS outstanding_amount,
        si.status, si.created_at
      FROM supplier_invoices si INNER JOIN suppliers s ON s.id = si.supplier_id
      ${where} ORDER BY si.invoice_date DESC, si.supplier_invoice_id DESC
    `, params);
    return rows;
  }

  async getInvoice(id) {
    const [invoices] = await pool.execute(`
      SELECT si.supplier_invoice_id, si.supplier_id, s.company_name AS supplier_name,
        si.purchase_order_id, si.invoice_number, si.invoice_date, si.due_date,
        si.total_amount, si.paid_amount, (si.total_amount - si.paid_amount) AS outstanding_amount,
        si.status, si.created_at
      FROM supplier_invoices si INNER JOIN suppliers s ON s.id = si.supplier_id
      WHERE si.supplier_invoice_id = ?
    `, [id]);
    if (!invoices[0]) return null;
    const [payments] = await pool.execute(`SELECT supplier_payment_id, amount, payment_method, reference_number, status, paid_by, paid_at FROM supplier_payments WHERE supplier_invoice_id = ? ORDER BY paid_at ASC, supplier_payment_id ASC`, [id]);
    invoices[0].payments = payments;
    return invoices[0];
  }

  async createInvoice({ supplierId, purchaseOrderId = null, invoiceNumber, invoiceDate, dueDate = null, totalAmount }) {
    if (purchaseOrderId) {
      const [order] = await pool.execute('SELECT purchase_order_id, supplier_id FROM purchase_orders WHERE purchase_order_id = ?', [purchaseOrderId]);
      if (!order[0]) throw new ApiError('Purchase order not found', 404);
      if (Number(order[0].supplier_id) !== Number(supplierId)) throw new ApiError('Invoice supplier does not match purchase order', 409);
    }
    let created;
    try {
      [created] = await pool.execute(`INSERT INTO supplier_invoices (supplier_id, purchase_order_id, invoice_number, invoice_date, due_date, total_amount) OUTPUT INSERTED.supplier_invoice_id AS insertId VALUES (?, ?, ?, ?, ?, ?)`, [supplierId, purchaseOrderId, invoiceNumber, invoiceDate, dueDate, totalAmount]);
    } catch (error) {
      if (error.number === 2601 || error.number === 2627) throw new ApiError('Supplier invoice reference already exists', 409);
      throw error;
    }
    return this.getInvoice(created.insertId);
  }

  async recordSupplierPayment({ invoiceId, amount, method, referenceNumber = null, idempotencyKey, actorUserId }) {
    const [existing] = await pool.execute('SELECT TOP (1) supplier_payment_id, supplier_invoice_id FROM supplier_payments WHERE idempotency_key = ?', [idempotencyKey]);
    if (existing[0]) {
      if (Number(existing[0].supplier_invoice_id) !== Number(invoiceId)) throw new ApiError('Idempotency key already belongs to another supplier invoice', 409);
      return this.getInvoicePayment(existing[0].supplier_payment_id);
    }
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [invoiceRows] = await connection.execute('SELECT supplier_invoice_id, total_amount, paid_amount, status FROM supplier_invoices WITH (UPDLOCK, HOLDLOCK) WHERE supplier_invoice_id = ?', [invoiceId]);
      const invoice = invoiceRows[0];
      if (!invoice) throw new ApiError('Supplier invoice not found', 404);
      if (['VOID', 'PAID'].includes(invoice.status)) throw new ApiError('Supplier invoice is not payable', 409);
      if (!Number.isFinite(amount) || amount <= 0 || amount > Number(invoice.total_amount) - Number(invoice.paid_amount)) throw new ApiError('Payment exceeds outstanding supplier invoice balance', 400);
      const [created] = await connection.execute(`INSERT INTO supplier_payments (supplier_invoice_id, amount, payment_method, reference_number, idempotency_key, paid_by) OUTPUT INSERTED.supplier_payment_id AS insertId VALUES (?, ?, ?, ?, ?, ?)`, [invoiceId, amount, method, referenceNumber, idempotencyKey, actorUserId]);
      const [updated] = await connection.execute(`
        UPDATE supplier_invoices SET paid_amount = paid_amount + ?, status = CASE WHEN paid_amount + ? >= total_amount THEN 'PAID' ELSE 'PARTIALLY_PAID' END WHERE supplier_invoice_id = ?;
        SELECT @@ROWCOUNT AS affectedRows;
      `, [amount, amount, invoiceId]);
      if (Number(updated[0]?.affectedRows) !== 1) throw new ApiError('Supplier invoice balance could not be updated', 409);
      await connection.commit();
      return this.getInvoicePayment(created.insertId);
    } catch (error) { try { await connection.rollback(); } catch {} if (error.number === 2601 || error.number === 2627) throw new ApiError('Payment reference or idempotency key already exists', 409); throw error; }
    finally { connection.release(); }
  }

  async getInvoicePayment(id) {
    const [rows] = await pool.execute('SELECT supplier_payment_id, supplier_invoice_id, amount, payment_method, reference_number, idempotency_key, status, paid_by, paid_at FROM supplier_payments WHERE supplier_payment_id = ?', [id]);
    return rows[0] || null;
  }

  async listGoodsReceipts() {
    const [rows] = await pool.execute(`SELECT gr.goods_receipt_id, gr.goods_receipt_number, gr.purchase_order_id, po.purchase_order_number, s.company_name AS supplier_name, gr.supplier_delivery_reference, gr.received_by, gr.received_at, gr.idempotency_key FROM goods_receipts gr INNER JOIN purchase_orders po ON po.purchase_order_id = gr.purchase_order_id INNER JOIN suppliers s ON s.id = po.supplier_id ORDER BY gr.received_at DESC, gr.goods_receipt_id DESC`);
    return rows;
  }

  async getGoodsReceipt(id) {
    const [receipts] = await pool.execute(`SELECT gr.goods_receipt_id, gr.goods_receipt_number, gr.purchase_order_id, po.purchase_order_number, s.company_name AS supplier_name, gr.supplier_delivery_reference, gr.received_by, gr.received_at, gr.idempotency_key, gr.notes FROM goods_receipts gr INNER JOIN purchase_orders po ON po.purchase_order_id = gr.purchase_order_id INNER JOIN suppliers s ON s.id = po.supplier_id WHERE gr.goods_receipt_id = ?`, [id]);
    if (!receipts[0]) return null;
    const [items] = await pool.execute(`SELECT gri.goods_receipt_item_id, gri.purchase_order_item_id, gri.medicine_id, m.name AS medicine_name, gri.batch_id, b.batch_number, b.expiry_date, gri.quantity_received, gri.unit_cost FROM goods_receipt_items gri INNER JOIN medicines m ON m.id = gri.medicine_id INNER JOIN medicine_batches b ON b.batch_id = gri.batch_id WHERE gri.goods_receipt_id = ? ORDER BY gri.goods_receipt_item_id`, [id]);
    receipts[0].items = items;
    return receipts[0];
  }

  async createGoodsReceipt({ purchaseOrderId, deliveryReference = null, notes = null, idempotencyKey, actorUserId, items }) {
    const [existing] = await pool.execute('SELECT TOP (1) goods_receipt_id, purchase_order_id FROM goods_receipts WHERE idempotency_key = ?', [idempotencyKey]);
    if (existing[0]) {
      if (Number(existing[0].purchase_order_id) !== Number(purchaseOrderId)) throw new ApiError('Idempotency key already belongs to another purchase order', 409);
      return this.getGoodsReceipt(existing[0].goods_receipt_id);
    }
    const connection = await pool.getConnection();
    let receiptId;
    try {
      await connection.beginTransaction();
      const [orders] = await connection.execute(`SELECT purchase_order_id, status, supplier_id, reorder_request_id FROM purchase_orders WITH (UPDLOCK, HOLDLOCK) WHERE purchase_order_id = ?`, [purchaseOrderId]);
      const order = orders[0];
      if (!order) throw new ApiError('Purchase order not found', 404);
      // Recheck after the order lock: concurrent retries must return the same receipt.
      const [duplicate] = await connection.execute('SELECT goods_receipt_id FROM goods_receipts WHERE idempotency_key = ?', [idempotencyKey]);
      if (duplicate[0]) { await connection.rollback(); return this.getGoodsReceipt(duplicate[0].goods_receipt_id); }
      if (order.reorder_request_id && !['CONFIRMED','PARTIALLY_RECEIVED'].includes(order.status)) throw new ApiError('Linked supply order must be confirmed before receiving',409);
      if (!['SENT', 'CONFIRMED', 'PARTIALLY_RECEIVED'].includes(order.status)) throw new ApiError('Purchase order is not eligible for receiving', 409);
      const [receipt] = await connection.execute(`INSERT INTO goods_receipts (purchase_order_id, supplier_delivery_reference, received_by, idempotency_key, notes) OUTPUT INSERTED.goods_receipt_id AS insertId VALUES (?, ?, ?, ?, ?)`, [purchaseOrderId, deliveryReference, actorUserId, idempotencyKey, notes]);
      receiptId = receipt.insertId;

      for (const item of items) {
        const [orderItems] = await connection.execute(`SELECT purchase_order_item_id, medicine_id, ordered_quantity, received_quantity, unit_cost FROM purchase_order_items WITH (UPDLOCK, HOLDLOCK) WHERE purchase_order_item_id = ? AND purchase_order_id = ?`, [item.purchase_order_item_id, purchaseOrderId]);
        const orderItem = orderItems[0];
        if (!orderItem) throw new ApiError('Purchase-order item not found', 404);
        const quantity = Number(item.quantity_received);
        const outstanding = Number(orderItem.ordered_quantity) - Number(orderItem.received_quantity);
        if (!Number.isSafeInteger(quantity) || quantity <= 0 || quantity > outstanding) throw new ApiError(`Receipt quantity exceeds outstanding quantity for medicine ${orderItem.medicine_id}`, 409);
        const batchNumber = String(item.batch_number || '').trim();
        if (!batchNumber || batchNumber.length > 100 || !/^\d{4}-\d{2}-\d{2}$/.test(String(item.expiry_date || ''))) throw new ApiError('Valid batch number and expiry date are required', 400);
        if (String(item.expiry_date) < require('../utils/requestValidation').todayInTimeZone()) throw new ApiError('Expired batches cannot be received', 400);

        const [medicineRows] = await connection.execute('SELECT id FROM medicines WITH (UPDLOCK, HOLDLOCK) WHERE id = ?', [orderItem.medicine_id]);
        if (!medicineRows[0]) throw new ApiError('Medicine not found', 404);
        const [batches] = await connection.execute('SELECT batch_id, expiry_date, is_active FROM medicine_batches WITH (UPDLOCK, HOLDLOCK) WHERE medicine_id = ? AND batch_number = ?', [orderItem.medicine_id, batchNumber]);
        let batchId;
        if (batches[0]) {
          if (dateOnly(batches[0].expiry_date) !== String(item.expiry_date) || Number(batches[0].is_active) !== 1) throw new ApiError('Batch conflicts with an existing expiry or inactive batch', 409);
          batchId = batches[0].batch_id;
          const [batchUpdate] = await connection.execute('UPDATE medicine_batches SET quantity_available = quantity_available + ? WHERE batch_id = ?; SELECT @@ROWCOUNT AS affectedRows', [quantity, batchId]);
          if (Number(batchUpdate[0]?.affectedRows) !== 1) throw new ApiError('Batch stock could not be updated', 409);
        } else {
          const [createdBatch] = await connection.execute(`INSERT INTO medicine_batches (medicine_id, batch_number, expiry_date, quantity_available, unit_cost) OUTPUT INSERTED.batch_id AS insertId VALUES (?, ?, ?, ?, ?)`, [orderItem.medicine_id, batchNumber, item.expiry_date, quantity, item.unit_cost ?? orderItem.unit_cost]);
          batchId = createdBatch.insertId;
        }
        const [updatedMedicine] = await connection.execute(`UPDATE medicines SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?; SELECT @@ROWCOUNT AS affectedRows`, [quantity, orderItem.medicine_id]);
        if (Number(updatedMedicine[0]?.affectedRows) !== 1) throw new ApiError('Aggregate inventory could not be updated', 409);
        const [balance] = await connection.execute('SELECT quantity AS balance_after FROM medicines WHERE id = ?', [orderItem.medicine_id]);
        await connection.execute(`INSERT INTO stock_movements (medicine_id, batch_id, movement_type, quantity_delta, balance_after, reference_type, reference_id, idempotency_key, notes, created_by) VALUES (?, ?, 'GOODS_RECEIPT', ?, ?, 'GOODS_RECEIPT', ?, ?, ?, ?)`, [orderItem.medicine_id, batchId, quantity, Number(balance[0]?.balance_after || 0), receiptId, `goods-receipt:${receiptId}:item:${orderItem.purchase_order_item_id}`, notes, actorUserId]);
        await connection.execute(`INSERT INTO goods_receipt_items (goods_receipt_id, purchase_order_item_id, medicine_id, batch_id, quantity_received, unit_cost) VALUES (?, ?, ?, ?, ?, ?)`, [receiptId, orderItem.purchase_order_item_id, orderItem.medicine_id, batchId, quantity, item.unit_cost ?? orderItem.unit_cost]);
        const [receivedUpdate] = await connection.execute('UPDATE purchase_order_items SET received_quantity = received_quantity + ? WHERE purchase_order_item_id = ? AND received_quantity + ? <= ordered_quantity; SELECT @@ROWCOUNT AS affectedRows', [quantity, orderItem.purchase_order_item_id, quantity]);
        if (Number(receivedUpdate[0]?.affectedRows) !== 1) throw new ApiError('Purchase-order receiving total changed; please retry', 409);
      }
      const [outstanding] = await connection.execute('SELECT COUNT(*) AS remaining FROM purchase_order_items WHERE purchase_order_id = ? AND received_quantity < ordered_quantity', [purchaseOrderId]);
      const nextStatus = Number(outstanding[0]?.remaining || 0) === 0 ? 'RECEIVED' : 'PARTIALLY_RECEIVED';
      await connection.execute('UPDATE purchase_orders SET status = ?, updated_at = SYSDATETIME() WHERE purchase_order_id = ?', [nextStatus, purchaseOrderId]);
      const supply = require('../services/inventorySupply');
      if (order.reorder_request_id) {
        if (nextStatus === 'RECEIVED') await connection.execute("UPDATE reorder_requests SET status='RECEIVED',resolved_at=SYSDATETIME() WHERE reorder_request_id=? AND status='ORDERED'",[order.reorder_request_id]);
        for (const staff of [false,true]) await supply.notify(connection,{supplierId:order.supplier_id,staff,type:'GOODS_RECEIPT',title:'Medicine delivery received',message:`Purchase order ${purchaseOrderId}: ${nextStatus}`,entityType:'PURCHASE_ORDER',entityId:purchaseOrderId,key:`supply-receipt:${receiptId}`});
      }
      const [medicineIds] = await connection.execute('SELECT medicine_id FROM purchase_order_items WHERE purchase_order_id=?',[purchaseOrderId]);
      await supply.checkLowStock(connection,medicineIds.map(item=>item.medicine_id),actorUserId);
      await connection.commit();
    } catch (error) { try { await connection.rollback(); } catch {} if (error.number === 2601 || error.number === 2627) throw new ApiError('Goods receipt already exists; refresh before retrying', 409); throw error; }
    finally { connection.release(); }
    return this.getGoodsReceipt(receiptId);
  }
}

module.exports = new SupplierOperationsRepository();
