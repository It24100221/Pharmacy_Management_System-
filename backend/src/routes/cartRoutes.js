const express = require('express');
const controller = require('../controllers/cartController');
const { authorizeRoles } = require('../middleware/auth');

const router = express.Router();
router.use(authorizeRoles('CUSTOMER'));
router.get('/', controller.getCart);
router.post('/items', controller.addItem);
router.patch('/items/:productId', controller.updateItem);
router.delete('/items/:productId', controller.removeItem);
router.delete('/', controller.clear);
module.exports = router;
