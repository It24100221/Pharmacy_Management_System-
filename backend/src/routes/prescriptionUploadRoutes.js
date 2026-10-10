const express = require('express');
const prescriptionUploadController = require('../controllers/prescriptionUploadController');
const { authorizeRoles } = require('../middleware/auth');

const router = express.Router();
router.get('/review-queue', authorizeRoles('ADMIN', 'PHARMACIST'), prescriptionUploadController.listForReview);
router.post('/:id/review', authorizeRoles('ADMIN', 'PHARMACIST'), prescriptionUploadController.reviewStandalone);
router.get('/:id/file', authorizeRoles('CUSTOMER', 'ADMIN', 'PHARMACIST'), prescriptionUploadController.getFile);

module.exports = router;
