const express = require('express');
const router = express.Router();
const salesController = require('../controllers/salesController');
const { authorizeRoles } = require('../middleware/auth');

router.use(authorizeRoles('ADMIN', 'SALES'));

// Sales routes
router.get('/', salesController.getAllSales);
router.get('/recent', salesController.getRecentSales);
router.get('/today-summary', salesController.getTodaySummary);
router.get('/:id', salesController.getSaleById);
router.get('/:id/receipt', salesController.getReceipt);
router.post('/', salesController.createSale);

module.exports = router;
