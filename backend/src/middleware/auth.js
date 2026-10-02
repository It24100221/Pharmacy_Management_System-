const ApiError = require('./errorHandler');
const asyncHandler = require('../utils/asyncHandler');
const auth = require('../services/authService');

const requireAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  if (!match) throw new ApiError('Authentication required', 401);
  req.user = await auth.authenticateToken(match[1]);
  next();
});

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return next(new ApiError('Authentication required', 401));
  if (!roles.includes(req.user.role)) return next(new ApiError('Access denied for this role', 403));
  next();
};

module.exports = { requireAuth, requireRole };
