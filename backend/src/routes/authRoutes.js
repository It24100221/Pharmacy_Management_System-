const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const service = require('../services/authService');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.post('/register', asyncHandler(async (req, res) => {
  const user = await service.register(req.body);
  res.status(201).json({ success: true, message: 'Registration Successful', data: { user } });
}));
router.post('/login', asyncHandler(async (req, res) => {
  const result = await service.login(req.body);
  res.json({ success: true, message: 'Login successful', data: result });
}));
router.get('/me', requireAuth, (req, res) => {
  res.json({ success: true, data: { user: req.user } });
});
module.exports = router;
