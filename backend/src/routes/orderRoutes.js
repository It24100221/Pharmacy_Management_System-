const express = require('express');
const controller = require('../controllers/orderController');
const { authorizeRoles } = require('../middleware/auth');

const router = express.Router();
router.post('/checkout', authorizeRoles('CUSTOMER'), controller.checkout);
router.get('/mine', authorizeRoles('CUSTOMER'), controller.getMine);
router.get('/pending-review', authorizeRoles('ADMIN', 'PHARMACIST'), controller.getPendingReview);
router.get('/ready-for-billing', authorizeRoles('ADMIN', 'SALES'), controller.getReadyForBilling);
router.get('/:id', authorizeRoles('CUSTOMER', 'ADMIN', 'PHARMACIST', 'SALES'), controller.getById);
router.post('/:id/review', authorizeRoles('ADMIN', 'PHARMACIST'), controller.review);
router.post('/:id/complete-sale', authorizeRoles('ADMIN', 'SALES'), controller.completeSale);
module.exports = router;
