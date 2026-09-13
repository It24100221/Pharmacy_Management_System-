const ApiError = require('./errorHandler');

// Middleware to handle 404
const notFoundHandler = (req, res, next) => {
  next(new ApiError(`Route ${req.method} ${req.originalUrl} not found`, 404));
};

module.exports = notFoundHandler;
