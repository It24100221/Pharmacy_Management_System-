const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../middleware/errorHandler');
const billingRepository = require('../repositories/billingRepository');
const saleRepository = require('../repositories/saleRepository');
const { parsePositiveInteger } = require('../utils/requestValidation');

exports.listInvoices = asyncHandler(async (req, res) => res.json({ success: true, data: { invoices: await billingRepository.listInvoices() } }));
exports.listAwaitingReview = asyncHandler(async (req, res) => res.json({ success: true, data: { uploads: await billingRepository.listAwaitingReviewUploads() } }));

exports.getInvoiceBySale = asyncHandler(async (req, res) => {
  const saleId = parsePositiveInteger(req.params.saleId, 'sale ID');
  const invoice = await billingRepository.findInvoiceBySale(saleId);
  if (!invoice) throw new ApiError('Invoice not found', 404);
  res.json({ success: true, data: invoice });
});

exports.recordPayment = asyncHandler(async (req, res) => {
  const invoiceId = parsePositiveInteger(req.params.invoiceId, 'invoice ID');
  const method = typeof req.body?.payment_method === 'string' ? req.body.payment_method.trim().toUpperCase() : '';
  if (!['CASH', 'CARD', 'BANK_TRANSFER', 'MOBILE'].includes(method)) throw new ApiError('Unsupported payment method', 400);
  const amount = Number(req.body?.amount);
  const amountInCents = amount * 100;
  if (!Number.isFinite(amount) || amount <= 0 || amount > 99999999.99 || Math.abs(Math.round(amountInCents) - amountInCents) > 1e-8) {
    throw new ApiError('Payment amount must be between 0.01 and 99,999,999.99 with at most 2 decimal places', 400);
  }
  const key = typeof req.body?.idempotency_key === 'string' ? req.body.idempotency_key.trim() : '';
  if (!/^[A-Za-z0-9:_-]{8,100}$/.test(key)) throw new ApiError('A valid idempotency key is required', 400);
  const payment = await billingRepository.recordPayment({ invoiceId, amount, method, idempotencyKey: key, actorUserId: req.user.userId, providerReference: req.body?.provider_reference || null });
  res.status(201).json({ success: true, message: method === 'CASH' ? 'Cash payment recorded' : 'Payment recorded as pending external confirmation', data: payment });
});

