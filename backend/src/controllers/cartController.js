const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../middleware/errorHandler');
const cartRepository = require('../repositories/cartRepository');

const parseId = value => {
  const id = Number.parseInt(value, 10);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError('Invalid product ID', 400);
  return id;
};
const parseQuantity = value => {
  const quantity = Number(value);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) throw new ApiError('Quantity must be between 1 and 999', 400);
  return quantity;
};

exports.getCart = asyncHandler(async (req, res) => res.json({ success: true, data: await cartRepository.getCart(req.user.customerId) }));
exports.addItem = asyncHandler(async (req, res) => {
  const cart = await cartRepository.setItem(req.user.customerId, parseId(req.body.product_id), parseQuantity(req.body.quantity || 1), true);
  res.status(201).json({ success: true, data: cart });
});
exports.updateItem = asyncHandler(async (req, res) => {
  const cart = await cartRepository.setItem(req.user.customerId, parseId(req.params.productId), parseQuantity(req.body.quantity));
  res.json({ success: true, data: cart });
});
exports.removeItem = asyncHandler(async (req, res) => res.json({ success: true, data: await cartRepository.removeItem(req.user.customerId, parseId(req.params.productId)) }));
exports.clear = asyncHandler(async (req, res) => res.json({ success: true, data: await cartRepository.clear(req.user.customerId) }));
