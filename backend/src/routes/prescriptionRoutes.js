const express = require('express');
const router = express.Router();
const prescriptionController = require('../controllers/prescriptionController');

// Prescription routes
router.get('/', prescriptionController.getAllPrescriptions);
router.get('/recent', prescriptionController.getRecentPrescriptions);
router.get('/:id', prescriptionController.getPrescriptionById);
router.get('/:id/availability', prescriptionController.checkAvailability);
router.post('/', prescriptionController.createPrescription);
router.post('/:id/send-to-billing', prescriptionController.sendToBilling);

module.exports = router;
