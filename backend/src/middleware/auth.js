const jwt = require('jsonwebtoken')

const getSecret = () => process.env.JWT_SECRET || 'development-only-change-me'

function authenticateToken(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ success: false, message: 'Authentication required' })
  try {
    req.user = jwt.verify(token, getSecret())
    next()
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired token' })
  }
}

const authorizeRoles = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ success: false, message: 'Insufficient permissions' })
  next()
}

module.exports = { authenticateToken, authorizeRoles }
