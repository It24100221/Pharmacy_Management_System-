const express = require('express');
const router = express.Router();
const prescriptionController = require('../controllers/prescriptionController');
const prescriptionUploadController = require('../controllers/prescriptionUploadController');
const { authorizeRoles } = require('../middleware/auth');
const { parsePrescriptionUpload } = require('../middleware/prescriptionUpload');

// Prescription routes
router.get('/', authorizeRoles('CUSTOMER', 'ADMIN', 'PHARMACIST'), prescriptionController.getAllPrescriptions);
router.post('/upload', authorizeRoles('CUSTOMER'), parsePrescriptionUpload, prescriptionUploadController.uploadPrescription);
router.get('/mine', authorizeRoles('CUSTOMER'), prescriptionUploadController.getOwnUploads);
router.get('/customer/:id', authorizeRoles('CUSTOMER', 'ADMIN', 'PHARMACIST'), prescriptionUploadController.getCustomerUploads);
router.get('/recent', authorizeRoles('ADMIN', 'PHARMACIST'), prescriptionController.getRecentPrescriptions);
router.get('/ready-for-billing', authorizeRoles('ADMIN', 'SALES'), prescriptionController.getReadyForBilling);
router.get('/:id/availability', authorizeRoles('CUSTOMER', 'ADMIN', 'PHARMACIST'), prescriptionController.checkAvailability);
router.get('/:id', authorizeRoles('CUSTOMER', 'ADMIN', 'PHARMACIST'), prescriptionController.getPrescriptionById);
router.post('/', authorizeRoles('ADMIN', 'PHARMACIST'), prescriptionController.createPrescription);
router.post('/:id/send-to-billing', authorizeRoles('ADMIN', 'PHARMACIST'), prescriptionController.sendToBilling);
router.get('/:id/billing', authorizeRoles('ADMIN', 'PHARMACIST', 'SALES'), prescriptionController.getBilling);
router.patch('/:id/status', authorizeRoles('ADMIN', 'PHARMACIST'), prescriptionController.updateStatus);

module.exports = router;
