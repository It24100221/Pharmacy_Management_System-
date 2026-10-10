const express = require('express');
const controller = require('../controllers/supplierOperationsController');
const { authorizeRoles } = require('../middleware/auth');

const router = express.Router();
const read = authorizeRoles('ADMIN', 'INVENTORY', 'SUPPLIER');
const write = authorizeRoles('ADMIN', 'INVENTORY');
const purchasing = authorizeRoles('ADMIN', 'INVENTORY');

router.get('/reorder-requests/low-stock', purchasing, controller.lowStock);
router.get('/reorder-requests', read, controller.listReorders);
router.post('/reorder-requests', purchasing, controller.createReorder);
router.patch('/reorder-requests/:id/status', purchasing, controller.updateReorderStatus);

router.get('/supplier-inquiries', read, controller.listInquiries);
router.get('/supplier-inquiries/:id', read, controller.getInquiry);
router.post('/supplier-inquiries', write, controller.createInquiry);
router.post('/supplier-inquiries/:id/messages', write, controller.addInquiryMessage);
router.patch('/supplier-inquiries/:id/status', write, controller.updateInquiryStatus);

router.get('/supplier-invoices', purchasing, controller.listInvoices);
router.get('/supplier-invoices/:id', purchasing, controller.getInvoice);
router.post('/supplier-invoices', purchasing, controller.createInvoice);
router.post('/supplier-invoices/:id/payments', purchasing, controller.recordPayment);

router.get('/goods-receipts', purchasing, controller.listReceipts);
router.get('/goods-receipts/:id', purchasing, controller.getReceipt);
router.post('/goods-receipts', purchasing, controller.createReceipt);

module.exports = router;
