const express = require('express');
const controller = require('../controllers/notificationController');

const router = express.Router();
router.get('/', controller.list);
router.patch('/:id/read', controller.markRead);

module.exports = router;
