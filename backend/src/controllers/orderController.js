const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../middleware/errorHandler');
const orderRepository = require('../repositories/orderRepository');
const saleRepository = require('../repositories/saleRepository');
const { parsePositiveInteger } = require('../utils/requestValidation');
const notificationRepository = require('../repositories/notificationRepository');

const orderId = req => {
  return parsePositiveInteger(req.params.id, 'order ID');
};

exports.checkout = asyncHandler(async (req, res) => {
  const order = await orderRepository.checkout(req.user.customerId);
  res.status(201).json({ success: true, message: 'Order created', data: order });
});
exports.getMine = asyncHandler(async (req, res) => res.json({ success: true, data: { orders: await orderRepository.findMine(req.user.customerId) } }));
exports.getPendingReview = asyncHandler(async (req, res) => res.json({ success: true, data: { orders: await orderRepository.findByStatus('PENDING_REVIEW') } }));
exports.getReadyForBilling = asyncHandler(async (req, res) => res.json({ success: true, data: { orders: await orderRepository.findByStatus('READY_FOR_BILLING') } }));
exports.getById = asyncHandler(async (req, res) => {
  const order = await orderRepository.findById(orderId(req));
  if (!order) throw new ApiError('Order not found', 404);
  if (req.user.role === 'CUSTOMER' && Number(order.customer_id) !== Number(req.user.customerId)) throw new ApiError('You can only view your own orders', 403);
  res.json({ success: true, data: order });
});
exports.review = asyncHandler(async (req, res) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const decision = typeof body.decision === 'string' ? body.decision.trim().toUpperCase() : '';
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (!['APPROVE', 'REJECT'].includes(decision)) throw new ApiError('Decision must be APPROVE or REJECT', 400);
  if (decision === 'REJECT' && !reason) throw new ApiError('A rejection reason is required', 400);
  if (reason.length > 1000) throw new ApiError('Rejection reason must not exceed 1000 characters', 400);
  const order = await orderRepository.review(orderId(req), req.user.userId, decision, reason);
  const customerUserId = await notificationRepository.findUserIdForCustomer(order.customer_id);
  if (customerUserId) await notificationRepository.create({
    recipientUserId: customerUserId,
    type: decision === 'APPROVE' ? 'PRESCRIPTION_APPROVED' : 'PRESCRIPTION_REJECTED',
    title: decision === 'APPROVE' ? 'Prescription approved' : 'Prescription rejected',
    message: decision === 'APPROVE' ? `Order #${order.order_id} is ready for billing.` : `Order #${order.order_id} was rejected${reason ? `: ${reason}` : '.'}`,
    entityType: 'order',
    entityId: order.order_id,
    deduplicationKey: `order-review:${order.order_id}:${decision}`,
  });
  res.json({ success: true, message: decision === 'APPROVE' ? 'Order approved for billing' : 'Order rejected', data: order });
});
exports.completeSale = asyncHandler(async (req, res) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const order = await orderRepository.findById(orderId(req));
  if (!order) throw new ApiError('Order not found', 404);
  if (order.status !== 'READY_FOR_BILLING') throw new ApiError('Order is not ready for billing', 409);
  const paymentMethod = typeof body.payment_method === 'string' ? body.payment_method : 'Cash';
  if (!['Cash', 'Card', 'Online'].includes(paymentMethod)) throw new ApiError('Invalid payment method', 400);
  const discount = Number(body.discount ?? 0);
  if (!Number.isFinite(discount) || discount < 0) throw new ApiError('Discount must be zero or greater', 400);
  const sale = await saleRepository.createWithItems({
    customer_id: order.customer_id, payment_method: paymentMethod, discount,
    notes: typeof body.notes === 'string' ? body.notes.trim() || null : null, order_id: order.order_id,
    actor_user_id: req.user.userId,
    idempotency_key: `order:${order.order_id}`,
  }, order.items.map(item => ({ medicine_id: item.medicine_id, quantity: Number(item.quantity) })));
  res.status(201).json({ success: true, message: 'Order sale completed', data: sale });
});
