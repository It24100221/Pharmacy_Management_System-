const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
router.use(requireAuth, requireRole('SUPPLIER', 'INVENTORY_STAFF'));
const purchaseController = require('../controllers/purchaseController');

// Purchase routes
router.get('/', purchaseController.getAllPurchases);
router.get('/recent', purchaseController.getRecentPurchases);
router.get('/:id', purchaseController.getPurchaseById);
router.post('/', purchaseController.createPurchase);

module.exports = router;
