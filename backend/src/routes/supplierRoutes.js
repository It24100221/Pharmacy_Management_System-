const express = require('express');
const router = express.Router();
const supplierController = require('../controllers/supplierController');
const supply = require('../controllers/inventorySupplyController');
const { authorizeRoles } = require('../middleware/auth');

const canReadSuppliers = authorizeRoles('ADMIN', 'INVENTORY', 'SUPPLIER');
const canWriteSuppliers = authorizeRoles('ADMIN', 'INVENTORY');

// Supplier routes
router.get('/accounts', authorizeRoles('ADMIN'), supply.accounts);
router.post('/accounts', authorizeRoles('ADMIN'), supply.createAccount);
router.put('/accounts/:userId', authorizeRoles('ADMIN'), supply.linkAccount);
router.get('/', canReadSuppliers, supplierController.getAllSuppliers);
router.get('/:id', canReadSuppliers, supplierController.getSupplierById);
router.post('/', canWriteSuppliers, supplierController.createSupplier);
router.put('/:id', canWriteSuppliers, supplierController.updateSupplier);
router.delete('/:id', canWriteSuppliers, supplierController.deleteSupplier);

module.exports = router;
