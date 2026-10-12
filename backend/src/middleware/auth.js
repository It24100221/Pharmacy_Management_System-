const jwt = require('jsonwebtoken')
const authRepository = require('../repositories/authRepository')
const { JWT_AUDIENCE, JWT_ISSUER, getJwtSecret } = require('../config/jwt')
const { normalizeRole } = require('../utils/roles')

async function authenticateToken(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ success: false, message: 'Authentication required' })
  let payload
  try {
    payload = jwt.verify(token, getJwtSecret(), { issuer: JWT_ISSUER, audience: JWT_AUDIENCE })
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' })
  }

  try {
    const user = await authRepository.findUserById(payload.userId)
    if (!user) return res.status(401).json({ success: false, message: 'Authentication is no longer valid' })
    const role = normalizeRole(user.role)
    req.authUser = { ...user, role }
    req.user = {
      userId: user.user_id,
      customerId: user.customer_id || null,
      ...(role === 'SUPPLIER' ? { supplierId: user.supplier_id || null } : {}),
      username: user.username,
      role,
    }
    return next()
  } catch (error) {
    return next(error)
  }
}

const authorizeRoles = (...roles) => (req, res, next) => {
  const role = normalizeRole(req.user?.role)
  const allowedRoles = roles.map(normalizeRole)
  if (!req.user || !allowedRoles.includes(role)) return res.status(403).json({ success: false, message: 'Insufficient permissions' })
  next()
}

module.exports = { authenticateToken, authorizeRoles }
