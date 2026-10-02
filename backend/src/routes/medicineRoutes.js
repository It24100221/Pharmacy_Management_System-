const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
router.use(requireAuth, requireRole('INVENTORY_STAFF', 'SALES_STAFF', 'PRESCRIPTION_STAFF', 'SUPPLIER'));
const medicineController = require('../controllers/medicineController');

// Medicine routes
router.get('/', medicineController.getAllMedicines);
router.get('/low-stock', medicineController.getLowStockMedicines);
router.get('/expiry-status', medicineController.getExpiryStatusMedicines);
router.get('/:id', medicineController.getMedicineById);
router.post('/', requireRole('INVENTORY_STAFF'), medicineController.createMedicine);
router.put('/:id', requireRole('INVENTORY_STAFF'), medicineController.updateMedicine);

module.exports = router;
