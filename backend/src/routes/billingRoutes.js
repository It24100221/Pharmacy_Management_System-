const express = require('express');
const controller = require('../controllers/billingController');
const { authorizeRoles } = require('../middleware/auth');

const router = express.Router();
router.get('/invoices', authorizeRoles('ADMIN', 'SALES'), controller.listInvoices);
router.get('/awaiting-review', authorizeRoles('ADMIN', 'SALES'), controller.listAwaitingReview);
router.get('/sales/:saleId/invoice', authorizeRoles('ADMIN', 'SALES'), controller.getInvoiceBySale);
router.post('/invoices/:invoiceId/payments', authorizeRoles('ADMIN', 'SALES'), controller.recordPayment);
module.exports = router;
