const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../middleware/errorHandler');
const cartRepository = require('../repositories/cartRepository');
const { parsePositiveInteger } = require('../utils/requestValidation');

const parseId = value => {
  return parsePositiveInteger(value, 'product ID');
};
const parseQuantity = value => {
  const quantity = Number(value);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) throw new ApiError('Quantity must be between 1 and 999', 400);
  return quantity;
};

exports.getCart = asyncHandler(async (req, res) => res.json({ success: true, data: await cartRepository.getCart(req.user.customerId) }));
exports.addItem = asyncHandler(async (req, res) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const cart = await cartRepository.setItem(req.user.customerId, parseId(body.product_id), parseQuantity(body.quantity ?? 1), true);
  res.status(201).json({ success: true, data: cart });
});
exports.updateItem = asyncHandler(async (req, res) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const cart = await cartRepository.setItem(req.user.customerId, parseId(req.params.productId), parseQuantity(body.quantity));
  res.json({ success: true, data: cart });
});
exports.removeItem = asyncHandler(async (req, res) => res.json({ success: true, data: await cartRepository.removeItem(req.user.customerId, parseId(req.params.productId)) }));
exports.clear = asyncHandler(async (req, res) => res.json({ success: true, data: await cartRepository.clear(req.user.customerId) }));
