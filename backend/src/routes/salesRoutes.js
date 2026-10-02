const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
router.use(requireAuth, requireRole('SALES_STAFF'));
const salesController = require('../controllers/salesController');

// Sales routes
router.get('/', salesController.getAllSales);
router.get('/recent', salesController.getRecentSales);
router.get('/today-summary', salesController.getTodaySummary);
router.get('/prescription/:id/billing', salesController.getPrescriptionForBilling);
router.get('/:id', salesController.getSaleById);
router.get('/:id/receipt', salesController.getReceipt);
router.post('/', salesController.createSale);

module.exports = router;
