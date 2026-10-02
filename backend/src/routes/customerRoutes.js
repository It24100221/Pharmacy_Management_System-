const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
router.use(requireAuth, requireRole('PRESCRIPTION_STAFF', 'SALES_STAFF'));
const customerController = require('../controllers/customerController');

// Customer routes
router.get('/', customerController.getAllCustomers);
router.get('/:id', customerController.getCustomerById);
router.post('/', requireRole('PRESCRIPTION_STAFF'), customerController.createCustomer);
router.put('/:id', requireRole('PRESCRIPTION_STAFF'), customerController.updateCustomer);

module.exports = router;
