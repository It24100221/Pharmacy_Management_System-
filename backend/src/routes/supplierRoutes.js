const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
router.use(requireAuth, requireRole('SUPPLIER', 'INVENTORY_STAFF'));
const supplierController = require('../controllers/supplierController');

// Supplier routes
router.get('/', supplierController.getAllSuppliers);
router.get('/:id', supplierController.getSupplierById);
router.post('/', requireRole('INVENTORY_STAFF'), supplierController.createSupplier);
router.put('/:id', requireRole('INVENTORY_STAFF'), supplierController.updateSupplier);

module.exports = router;
