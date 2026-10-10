const { pool } = require('../config/database');

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
        ${unreadOnly ? 'AND read_at IS NULL' : ''}
      ORDER BY created_at DESC, notification_id DESC
    `, [limit, userId, role]);
    return rows;
  }

  async markRead(id, userId, role) {
    const [result] = await pool.execute(`
      UPDATE notifications SET read_at = COALESCE(read_at, SYSDATETIME())
      WHERE notification_id = ? AND (recipient_user_id = ? OR (recipient_user_id IS NULL AND recipient_role = ?))
    `, [id, userId, role]);
    return result.affectedRows > 0;
  }

  async countUnread(userId, role) {
    const [rows] = await pool.execute(`
      SELECT COUNT(*) AS unread_count FROM notifications
      WHERE read_at IS NULL AND (recipient_user_id = ? OR (recipient_user_id IS NULL AND recipient_role = ?))
    `, [userId, role]);
    return Number(rows[0]?.unread_count || 0);
  }
}

module.exports = new NotificationRepository();
