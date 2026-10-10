const { pool } = require('../config/database');
const ApiError = require('../middleware/errorHandler');

class BillingRepository {
  async listInvoices() {
    const [rows] = await pool.execute(`
      SELECT i.customer_invoice_id, i.sale_id, i.customer_id, i.total_amount, i.status, i.issued_at,
        s.invoice_number AS receipt_number, CONCAT(c.first_name, ' ', c.last_name) AS customer_name,
        COALESCE(p.confirmed_amount, 0) AS paid_amount,
        i.total_amount - COALESCE(p.confirmed_amount, 0) AS outstanding_amount
      FROM customer_invoices i
      INNER JOIN sales s ON s.id = i.sale_id
      LEFT JOIN customers c ON c.id = i.customer_id
      OUTER APPLY (SELECT SUM(amount) AS confirmed_amount FROM customer_payments WHERE customer_invoice_id = i.customer_invoice_id AND status = 'CONFIRMED') p
      ORDER BY i.issued_at DESC, i.customer_invoice_id DESC
    `);
    return rows;
  }

  async listAwaitingReviewUploads() {
    const [rows] = await pool.execute(`
      SELECT pu.prescription_id, pu.customer_id, pu.status, pu.uploaded_date,
        CONCAT(c.first_name, ' ', c.last_name) AS customer_name
      FROM prescription_uploads pu
      INNER JOIN customers c ON c.id = pu.customer_id
      LEFT JOIN prescriptions p ON p.upload_id = pu.prescription_id
      WHERE pu.order_id IS NULL AND p.id IS NULL AND pu.status IN ('PENDING', 'APPROVED')
      ORDER BY pu.uploaded_date DESC, pu.prescription_id DESC
    `);
    return rows;
  }
  async findInvoiceBySale(saleId) {
    const [rows] = await pool.execute(`
      SELECT customer_invoice_id, sale_id, customer_id, subtotal, discount_amount, tax_amount,
        total_amount, status, issued_at FROM customer_invoices WHERE sale_id = ?
    `, [saleId]);
    return rows[0] || null;
  }

  async recordPayment({ invoiceId, amount, method, idempotencyKey, actorUserId, providerReference = null }) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [existingRows] = await connection.execute(
        'SELECT TOP 1 customer_payment_id, customer_invoice_id FROM customer_payments WITH (UPDLOCK, HOLDLOCK) WHERE idempotency_key = ?',
        [idempotencyKey]
      );
      const existing = existingRows[0];
      if (existing) {
        if (Number(existing.customer_invoice_id) !== Number(invoiceId)) {
          throw new ApiError('Idempotency key is already used for another invoice', 409);
        }
        await connection.commit();
        return this.findPayment(existing.customer_payment_id);
      }

      const [invoices] = await connection.execute('SELECT customer_invoice_id, sale_id, total_amount, status FROM customer_invoices WITH (UPDLOCK, HOLDLOCK) WHERE customer_invoice_id = ?', [invoiceId]);
      const invoice = invoices[0];
      if (!invoice) throw new ApiError('Invoice not found', 404);
      if (['VOID', 'REFUNDED'].includes(invoice.status)) throw new ApiError('Invoice is not payable', 409);
      const [totals] = await connection.execute(`
        SELECT COALESCE(SUM(amount), 0) AS confirmed_amount
        FROM customer_payments WITH (UPDLOCK, HOLDLOCK)
        WHERE customer_invoice_id = ? AND status = 'CONFIRMED'
      `, [invoiceId]);
      const toCents = value => Math.round(Number(value) * 100);
      const totalCents = toCents(invoice.total_amount);
      const confirmedCents = toCents(totals[0]?.confirmed_amount || 0);
      const amountCents = toCents(amount);
      const outstandingCents = Math.max(totalCents - confirmedCents, 0);
      if (amountCents <= 0 || amountCents > outstandingCents) {
        throw new ApiError('Payment exceeds the outstanding invoice balance', 409);
      }
      const status = method === 'CASH' ? 'CONFIRMED' : 'PENDING';
      const [result] = await connection.execute(`
        INSERT INTO customer_payments (customer_invoice_id, amount, payment_method, status, idempotency_key, provider_reference, created_by, confirmed_at)
        OUTPUT INSERTED.customer_payment_id AS insertId
        VALUES (?, ?, ?, ?, ?, ?, ?, CASE WHEN ? = 'CONFIRMED' THEN SYSDATETIME() ELSE NULL END)
      `, [invoiceId, amount, method, status, idempotencyKey, providerReference, actorUserId, status]);
      if (status === 'CONFIRMED') {
        const cumulativeConfirmed = confirmedCents + amountCents;
        await connection.execute(
          `UPDATE customer_invoices SET status = CASE WHEN ? >= total_amount THEN 'PAID' ELSE 'UNPAID' END WHERE customer_invoice_id = ?`,
          [cumulativeConfirmed / 100, invoiceId]
        );
        if (cumulativeConfirmed >= totalCents) {
          await connection.execute("UPDATE sales SET payment_status = 'PAID', updated_at = SYSDATETIME() WHERE id = ?", [invoice.sale_id]);
        }
      }
      await connection.commit();
      return this.findPayment(result.insertId);
    } catch (error) { try { await connection.rollback(); } catch {} throw error; }
    finally { connection.release(); }
  }

  async findPayment(id) {
    const [rows] = await pool.execute('SELECT customer_payment_id, customer_invoice_id, amount, payment_method, status, idempotency_key, provider_reference, created_at, confirmed_at FROM customer_payments WHERE customer_payment_id = ?', [id]);
    return rows[0] || null;
  }
}

module.exports = new BillingRepository();
