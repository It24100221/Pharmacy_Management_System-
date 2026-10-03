const express = require('express');
const router = express.Router();
const medicineController = require('../controllers/medicineController');
const { authorizeRoles } = require('../middleware/auth');

const canReadMedicines = authorizeRoles('ADMIN', 'PHARMACIST', 'INVENTORY', 'SALES');
const canWriteMedicines = authorizeRoles('ADMIN', 'INVENTORY');

// Medicine routes
router.get('/', canReadMedicines, medicineController.getAllMedicines);
router.get('/low-stock', canReadMedicines, medicineController.getLowStockMedicines);
router.get('/expiry-status', canReadMedicines, medicineController.getExpiryStatusMedicines);
router.get('/:id', canReadMedicines, medicineController.getMedicineById);
router.post('/', canWriteMedicines, medicineController.createMedicine);
router.put('/:id', canWriteMedicines, medicineController.updateMedicine);

module.exports = router;
