const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const asyncHandler = require('../utils/asyncHandler')
const authRepository = require('../repositories/authRepository')
const RegistrationValidator = require('../validators/registrationValidator')
const { JWT_AUDIENCE, JWT_ISSUER, getJwtSecret } = require('../config/jwt')
const { normalizeRole } = require('../utils/roles')

const staffRoles = ['ADMIN', 'PHARMACIST', 'INVENTORY', 'SALES', 'SUPPLIER']

const toSession = user => ({
  token: jwt.sign({ userId: user.user_id }, getJwtSecret(), { expiresIn: '8h', issuer: JWT_ISSUER, audience: JWT_AUDIENCE }),
  userId: user.user_id,
  username: user.username,
  role: normalizeRole(user.role),
  customerId: user.customer_id || null,
  supplierId: normalizeRole(user.role) === 'SUPPLIER' ? user.supplier_id || null : null,
  name: normalizeRole(user.role) === 'CUSTOMER' ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : user.staff_name || user.username,
})

const toIdentity = user => ({
  userId: user.user_id,
  username: user.username,
  role: normalizeRole(user.role),
  customerId: user.customer_id || null,
  supplierId: normalizeRole(user.role) === 'SUPPLIER' ? user.supplier_id || null : null,
  name: normalizeRole(user.role) === 'CUSTOMER' ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : user.staff_name || user.username,
})

const login = roles => asyncHandler(async (req, res) => {
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {}
  const rawUsername = body.username ?? body.email
  const username = typeof rawUsername === 'string' ? rawUsername.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  if (!username || !password) return res.status(400).json({ success: false, message: 'Username and password are required' })
  const user = await authRepository.findUser(username, roles)
  if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ success: false, message: 'Invalid login credentials' })
  res.json({ success: true, data: toSession(user) })
})

const registerCustomer = asyncHandler(async (req, res) => {
  const validated = RegistrationValidator.validate(req.body)
  const account = await authRepository.createCustomer({ ...validated, password: await bcrypt.hash(validated.password, 12) })
  res.status(201).json({ success: true, message: 'Customer account created', data: account })
})

const getCurrentSession = asyncHandler(async (req, res) => {
  res.json({ success: true, data: toIdentity(req.authUser) })
})

module.exports = { customerLogin: login(['CUSTOMER']), staffLogin: login(staffRoles), registerCustomer, getCurrentSession }
