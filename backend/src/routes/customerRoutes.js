const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const authController = require('../controllers/authController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Customer routes
router.post('/register', authController.registerCustomer);
router.use(authenticateToken);
router.get('/me', authorizeRoles('CUSTOMER'), customerController.getCurrentCustomer);
router.put('/me', authorizeRoles('CUSTOMER'), customerController.updateCurrentCustomer);
router.get('/', authorizeRoles('ADMIN', 'PHARMACIST', 'SALES'), customerController.getAllCustomers);
router.get('/:id', authorizeRoles('ADMIN', 'PHARMACIST', 'SALES'), customerController.getCustomerById);
router.post('/', authorizeRoles('ADMIN', 'PHARMACIST'), customerController.createCustomer);
router.put('/:id', authorizeRoles('ADMIN', 'PHARMACIST'), customerController.updateCustomer);
router.delete('/:id', authorizeRoles('ADMIN', 'PHARMACIST'), customerController.deleteCustomer);

module.exports = router;
