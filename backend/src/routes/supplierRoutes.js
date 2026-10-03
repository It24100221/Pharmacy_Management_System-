const express = require('express');
const router = express.Router();
const supplierController = require('../controllers/supplierController');
const { authorizeRoles } = require('../middleware/auth');

const canReadSuppliers = authorizeRoles('ADMIN', 'INVENTORY', 'SUPPLIER');
const canWriteSuppliers = authorizeRoles('ADMIN', 'INVENTORY');

// Supplier routes
router.get('/', canReadSuppliers, supplierController.getAllSuppliers);
router.get('/:id', canReadSuppliers, supplierController.getSupplierById);
router.post('/', canWriteSuppliers, supplierController.createSupplier);
router.put('/:id', canWriteSuppliers, supplierController.updateSupplier);
router.delete('/:id', canWriteSuppliers, supplierController.deleteSupplier);

module.exports = router;
