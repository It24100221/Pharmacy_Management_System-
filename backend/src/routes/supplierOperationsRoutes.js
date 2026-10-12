const express = require('express');
const controller = require('../controllers/supplierOperationsController');
const supply = require('../controllers/inventorySupplyController');
const { authorizeRoles } = require('../middleware/auth');

const router = express.Router();
const read = authorizeRoles('ADMIN', 'INVENTORY', 'SUPPLIER');
const write = authorizeRoles('ADMIN', 'INVENTORY');
const purchasing = authorizeRoles('ADMIN', 'INVENTORY');

router.get('/reorder-requests/low-stock', purchasing, supply.lowStock);
router.get('/reorder-requests', read, supply.list);
router.get('/reorder-requests/:id', read, supply.get);
router.post('/reorder-requests', purchasing, supply.create);
router.post('/reorder-requests/:id/respond', authorizeRoles('SUPPLIER'), supply.respond);
router.post('/reorder-requests/:id/review', purchasing, supply.review);
router.patch('/reorder-requests/:id/status', purchasing, controller.updateReorderStatus);

router.get('/supplier-inquiries', purchasing, controller.listInquiries);
router.get('/supplier-inquiries/:id', purchasing, controller.getInquiry);
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
