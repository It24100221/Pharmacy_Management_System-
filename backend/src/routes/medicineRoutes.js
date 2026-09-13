const express = require('express');
const router = express.Router();
const medicineController = require('../controllers/medicineController');

// Medicine routes
router.get('/', medicineController.getAllMedicines);
router.get('/low-stock', medicineController.getLowStockMedicines);
router.get('/expiry-status', medicineController.getExpiryStatusMedicines);
router.get('/:id', medicineController.getMedicineById);
router.post('/', medicineController.createMedicine);
router.put('/:id', medicineController.updateMedicine);

module.exports = router;
