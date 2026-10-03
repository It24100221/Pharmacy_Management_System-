const express = require('express');
const router = express.Router();
const purchaseController = require('../controllers/purchaseController');
const { authorizeRoles } = require('../middleware/auth');

const canReadPurchases = authorizeRoles('ADMIN', 'INVENTORY', 'SUPPLIER');
const canWritePurchases = authorizeRoles('ADMIN', 'INVENTORY');

// Purchase routes
router.get('/', canReadPurchases, purchaseController.getAllPurchases);
router.get('/recent', canReadPurchases, purchaseController.getRecentPurchases);
router.get('/:id', canReadPurchases, purchaseController.getPurchaseById);
router.post('/', canWritePurchases, purchaseController.createPurchase);

module.exports = router;
