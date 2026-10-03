const express = require('express');
const router = express.Router();
const prescriptionController = require('../controllers/prescriptionController');
const { authorizeRoles } = require('../middleware/auth');

// Prescription routes
router.get('/', authorizeRoles('CUSTOMER', 'ADMIN', 'PHARMACIST'), prescriptionController.getAllPrescriptions);
router.post('/upload', authorizeRoles('CUSTOMER'), prescriptionController.uploadPrescription);
router.get('/mine', authorizeRoles('CUSTOMER'), prescriptionController.getOwnUploads);
router.get('/customer/:id', authorizeRoles('CUSTOMER', 'ADMIN', 'PHARMACIST'), prescriptionController.getCustomerUploads);
router.get('/recent', authorizeRoles('ADMIN', 'PHARMACIST'), prescriptionController.getRecentPrescriptions);
router.get('/:id/availability', authorizeRoles('CUSTOMER', 'ADMIN', 'PHARMACIST'), prescriptionController.checkAvailability);
router.get('/:id', authorizeRoles('CUSTOMER', 'ADMIN', 'PHARMACIST'), prescriptionController.getPrescriptionById);
router.post('/', authorizeRoles('ADMIN', 'PHARMACIST'), prescriptionController.createPrescription);
router.post('/:id/send-to-billing', authorizeRoles('ADMIN', 'PHARMACIST'), prescriptionController.sendToBilling);

module.exports = router;
