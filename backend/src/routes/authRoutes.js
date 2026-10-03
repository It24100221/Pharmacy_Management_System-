const express = require('express')
const authController = require('../controllers/authController')

const router = express.Router()
router.post('/customer-login', authController.customerLogin)
router.post('/customer/login', authController.customerLogin)
router.post('/staff-login', authController.staffLogin)

module.exports = router
