const { pool } = require('../config/database')
const ApiError = require('../middleware/errorHandler')

class AuthRepository {
  async findUserById(userId) {
    const [rows] = await pool.execute(`
      SELECT TOP 1 u.user_id, u.username, u.password, UPPER(LTRIM(RTRIM(u.role))) AS role,
        c.id AS customer_id, c.first_name, c.last_name, c.email,
        s.staff_id, s.staff_name, s.email AS staff_email, s.phone AS staff_phone
      FROM users u
      LEFT JOIN customers c ON c.user_id = u.user_id
      LEFT JOIN staff s ON s.user_id = u.user_id
      WHERE u.user_id = ?
        AND (UPPER(LTRIM(RTRIM(u.role))) <> 'CUSTOMER' OR c.is_active = 1)
    `, [userId])
    return rows[0] || null
  }

  async findUser(username, roles = []) {
    const roleClause = roles.length ? ` AND UPPER(LTRIM(RTRIM(u.role))) IN (${roles.map(() => '?').join(', ')})` : ''
    const [rows] = await pool.execute(`
      SELECT TOP 1 u.user_id, u.username, u.password, UPPER(LTRIM(RTRIM(u.role))) AS role,
        c.id AS customer_id, c.first_name, c.last_name, c.email,
        s.staff_id, s.staff_name, s.email AS staff_email, s.phone AS staff_phone
      FROM users u
      LEFT JOIN customers c ON c.user_id = u.user_id
      LEFT JOIN staff s ON s.user_id = u.user_id
      WHERE (u.username = ? OR c.email = ? OR s.email = ?)${roleClause}
        AND (UPPER(LTRIM(RTRIM(u.role))) <> 'CUSTOMER' OR c.is_active = 1)
    `, [username, username, username, ...roles])
    return rows[0] || null
  }

  async createCustomer({ username, password, name, email, phone, address }) {
    const connection = await pool.getConnection()
    try {
      await connection.beginTransaction()
      const [existingUsers] = await connection.execute(
        'SELECT TOP 1 user_id FROM users WITH (UPDLOCK, HOLDLOCK) WHERE username = ?',
        [username]
      )
      if (existingUsers.length) throw new ApiError('Username is already registered', 409)
      const [existingCustomers] = await connection.execute(
        'SELECT TOP 1 id FROM customers WITH (UPDLOCK, HOLDLOCK) WHERE email = ?',
        [email]
      )
      if (existingCustomers.length) throw new ApiError('Email is already registered', 409)
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
      if (error.number === 2601 || error.number === 2627) {
        throw new ApiError('Username or email is already registered', 409)
      }
      throw error
    } finally {
      connection.release()
    }
  }
}

module.exports = new AuthRepository()
