const express = require('express')
const authController = require('../controllers/authController')
const { authenticateToken } = require('../middleware/auth')

const router = express.Router()
router.post('/customer-login', authController.customerLogin)
router.post('/customer/login', authController.customerLogin)
router.post('/staff-login', authController.staffLogin)
router.get('/me', authenticateToken, authController.getCurrentSession)

module.exports = router
