const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const asyncHandler = require('../utils/asyncHandler')
const authRepository = require('../repositories/authRepository')

const staffRoles = ['ADMIN', 'PHARMACIST', 'INVENTORY', 'SALES', 'SUPPLIER']
const getSecret = () => process.env.JWT_SECRET || 'development-only-change-me'

const toSession = user => ({
  token: jwt.sign({ userId: user.user_id, customerId: user.customer_id || null, username: user.username, role: user.role }, getSecret(), { expiresIn: '8h' }),
  userId: user.user_id,
  username: user.username,
  role: user.role,
  customerId: user.customer_id || null,
  name: user.role === 'CUSTOMER' ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : user.staff_name || user.username,
})

const login = roles => asyncHandler(async (req, res) => {
  const username = String(req.body.username || req.body.email || '').trim()
  const password = String(req.body.password || '')
  if (!username || !password) return res.status(400).json({ success: false, message: 'Username and password are required' })
  const user = await authRepository.findUser(username, roles)
  if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ success: false, message: 'Invalid login credentials' })
  res.json({ success: true, data: toSession(user) })
})

const registerCustomer = asyncHandler(async (req, res) => {
  const { name, email, phone, address, username, password, confirmPassword } = req.body
  if (!name || !email || !username || !password) return res.status(400).json({ success: false, message: 'Name, email, username, and password are required' })
  if (password.length < 8) return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' })
  if (confirmPassword !== undefined && password !== confirmPassword) return res.status(400).json({ success: false, message: 'Passwords do not match' })
  const account = await authRepository.createCustomer({ name, email, phone, address, username, password: await bcrypt.hash(password, 12) })
  res.status(201).json({ success: true, message: 'Customer account created', data: account })
})

module.exports = { customerLogin: login(['CUSTOMER']), staffLogin: login(staffRoles), registerCustomer }
