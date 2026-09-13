const express = require('express');
const router = express.Router();
const purchaseController = require('../controllers/purchaseController');

// Purchase routes
router.get('/', purchaseController.getAllPurchases);
router.get('/recent', purchaseController.getRecentPurchases);
router.get('/:id', purchaseController.getPurchaseById);
router.post('/', purchaseController.createPurchase);

module.exports = router;
