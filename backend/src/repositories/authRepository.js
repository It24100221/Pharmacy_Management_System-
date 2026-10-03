const { pool } = require('../config/database')

class AuthRepository {
  async findUserById(userId) {
    const [rows] = await pool.execute(`
      SELECT TOP 1 u.user_id, u.username, u.password, u.role,
        c.id AS customer_id, c.first_name, c.last_name, c.email,
        s.staff_id, s.staff_name, s.email AS staff_email, s.phone AS staff_phone
      FROM users u
      LEFT JOIN customers c ON c.user_id = u.user_id
      LEFT JOIN staff s ON s.user_id = u.user_id
      WHERE u.user_id = ?
    `, [userId])
    return rows[0] || null
  }

  async findUser(username, roles = []) {
    const roleClause = roles.length ? ` AND u.role IN (${roles.map(() => '?').join(', ')})` : ''
    const [rows] = await pool.execute(`
      SELECT TOP 1 u.user_id, u.username, u.password, u.role,
        c.id AS customer_id, c.first_name, c.last_name, c.email,
        s.staff_id, s.staff_name, s.email AS staff_email, s.phone AS staff_phone
      FROM users u
      LEFT JOIN customers c ON c.user_id = u.user_id
      LEFT JOIN staff s ON s.user_id = u.user_id
      WHERE (u.username = ? OR c.email = ? OR s.email = ?)${roleClause}
    `, [username, username, username, ...roles])
    return rows[0] || null
  }

  async createCustomer({ username, password, name, email, phone, address }) {
    const connection = await pool.getConnection()
    try {
      await connection.beginTransaction()
      const [userResult] = await connection.execute(
        'INSERT INTO users (username, password, role) OUTPUT INSERTED.user_id AS insertId VALUES (?, ?, ?)',
        [username, password, 'CUSTOMER']
      )
      const names = name.trim().split(/\s+/)
      const firstName = names.shift()
      const lastName = names.join(' ') || firstName
      const [customerResult] = await connection.execute(
        'INSERT INTO customers (user_id, first_name, last_name, email, phone, address) OUTPUT INSERTED.id AS insertId VALUES (?, ?, ?, ?, ?, ?)',
        [userResult.insertId, firstName, lastName, email, phone || null, address || null]
      )
      await connection.commit()
      return { userId: userResult.insertId, customerId: customerResult.insertId }
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }
}

module.exports = new AuthRepository()
