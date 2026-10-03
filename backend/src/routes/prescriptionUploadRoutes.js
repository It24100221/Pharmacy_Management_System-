const express = require('express');
const prescriptionUploadController = require('../controllers/prescriptionUploadController');
const { authorizeRoles } = require('../middleware/auth');

const router = express.Router();
router.get('/:id/file', authorizeRoles('CUSTOMER', 'ADMIN', 'PHARMACIST'), prescriptionUploadController.getFile);

module.exports = router;
