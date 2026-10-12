const { pool } = require('../config/database');

// Supplier notifications are visible only while the authenticated account owns the entity.
const supplierVisibility = role => role !== 'SUPPLIER' ? '' : `AND recipient_user_id IS NOT NULL AND (
  (entity_type='REORDER_REQUEST' AND EXISTS (SELECT 1 FROM reorder_requests rr JOIN supplier_users su ON su.supplier_id=rr.supplier_id WHERE rr.reorder_request_id=notifications.entity_id AND su.user_id=notifications.recipient_user_id)) OR
  (entity_type='PURCHASE_ORDER' AND EXISTS (SELECT 1 FROM purchase_orders po JOIN supplier_users su ON su.supplier_id=po.supplier_id WHERE po.purchase_order_id=notifications.entity_id AND su.user_id=notifications.recipient_user_id)))`;

class NotificationRepository {
  async findUserIdForCustomer(customerId) {
    const [rows] = await pool.execute('SELECT TOP 1 user_id FROM customers WHERE id = ?', [customerId]);
    return rows[0]?.user_id || null;
  }

  async create({ recipientUserId = null, recipientRole = null, type, title, message, entityType = null, entityId = null, deduplicationKey = null }) {
    const [result] = await pool.execute(`
      INSERT INTO notifications
        (recipient_user_id, recipient_role, notification_type, title, message, entity_type, entity_id, deduplication_key)
      OUTPUT INSERTED.notification_id AS insertId
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [recipientUserId, recipientRole, type, title, message, entityType, entityId, deduplicationKey]);
    return result.insertId;
  }

  async notifyRole({ role, type, title, message, entityType, entityId, deduplicationKey }) {
    try {
      return await this.create({ recipientRole: role, type, title, message, entityType, entityId, deduplicationKey });
    } catch (error) {
      // SQL Server's filtered unique index makes notification creation idempotent.
      if (error.number === 2601 || error.number === 2627) return null;
      throw error;
    }
  }

  async findForUser({ userId, role, unreadOnly = false, limit = 50 }) {
    const [rows] = await pool.execute(`
      SELECT TOP (?) notification_id, recipient_user_id, recipient_role, notification_type,
        title, message, entity_type, entity_id, read_at, created_at
      FROM notifications
      WHERE (recipient_user_id = ? OR (recipient_user_id IS NULL AND recipient_role = ?))
        ${supplierVisibility(role)}
        ${unreadOnly ? 'AND read_at IS NULL' : ''}
      ORDER BY created_at DESC, notification_id DESC
    `, [limit, userId, role]);
    return rows;
  }

  async markRead(id, userId, role) {
    const [result] = await pool.execute(`
      UPDATE notifications SET read_at = COALESCE(read_at, SYSDATETIME())
      WHERE notification_id = ? AND (recipient_user_id = ? OR (recipient_user_id IS NULL AND recipient_role = ?))
        ${supplierVisibility(role)}
      ; SELECT @@ROWCOUNT AS affectedRows;
    `, [id, userId, role]);
    return Number(result[0]?.affectedRows || 0) > 0;
  }

  async countUnread(userId, role) {
    const [rows] = await pool.execute(`
      SELECT COUNT(*) AS unread_count FROM notifications
      WHERE read_at IS NULL AND (recipient_user_id = ? OR (recipient_user_id IS NULL AND recipient_role = ?))
        ${supplierVisibility(role)}
    `, [userId, role]);
    return Number(rows[0]?.unread_count || 0);
  }
}

module.exports = new NotificationRepository();
