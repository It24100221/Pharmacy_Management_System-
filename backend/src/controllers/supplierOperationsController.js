const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../middleware/errorHandler');
const repository = require('../repositories/supplierOperationsRepository');
const { parsePositiveInteger, isIsoDate, todayInTimeZone } = require('../utils/requestValidation');

const text = (value, label, max) => {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new ApiError(`${label} is required and must not exceed ${max} characters`, 400);
  return value.trim();
};
const decimal = (value, label) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || Math.round(parsed * 100) !== parsed * 100) throw new ApiError(`${label} must be a non-negative amount with at most 2 decimals`, 400);
  return parsed;
};

exports.lowStock = asyncHandler(async (req, res) => res.json({ success: true, data: { medicines: await repository.findLowStock() } }));
exports.listReorders = asyncHandler(async (req, res) => res.json({ success: true, data: { requests: await repository.listReorderRequests(req.query.status || null) } }));
exports.createReorder = asyncHandler(async (req, res) => {
  const medicineId = parsePositiveInteger(req.body?.medicine_id, 'medicine ID');
  const requestedQuantity = parsePositiveInteger(req.body?.requested_quantity, 'requested quantity');
  const supplierId = req.body?.supplier_id == null ? null : parsePositiveInteger(req.body.supplier_id, 'supplier ID');
  const notes = typeof req.body?.notes === 'string' ? req.body.notes.trim().slice(0, 1000) || null : null;
  const request = await repository.createReorderRequest({ medicineId, requestedQuantity, requestedBy: req.user.userId, supplierId, notes });
  res.status(201).json({ success: true, data: request });
});
exports.updateReorderStatus = asyncHandler(async (req, res) => {
  const request = await repository.updateReorderStatus(parsePositiveInteger(req.params.id, 'reorder request ID'), String(req.body?.status || '').toUpperCase());
  res.json({ success: true, data: request });
});

exports.listInquiries = asyncHandler(async (req, res) => res.json({ success: true, data: { inquiries: await repository.listInquiries(req.query.status || null) } }));
exports.getInquiry = asyncHandler(async (req, res) => { const inquiry = await repository.getInquiry(parsePositiveInteger(req.params.id, 'inquiry ID')); if (!inquiry) throw new ApiError('Supplier inquiry not found', 404); res.json({ success: true, data: inquiry }); });
exports.createInquiry = asyncHandler(async (req, res) => {
  const supplierId = parsePositiveInteger(req.body?.supplier_id, 'supplier ID');
  const subject = text(req.body?.subject, 'Subject', 200);
  const message = text(req.body?.message, 'Message', 2000);
  const inquiry = await repository.createInquiry({ supplierId, subject, message, actorUserId: req.user.userId });
  res.status(201).json({ success: true, data: inquiry });
});
exports.addInquiryMessage = asyncHandler(async (req, res) => { const message = text(req.body?.message, 'Message', 2000); res.status(201).json({ success: true, data: await repository.addInquiryMessage(parsePositiveInteger(req.params.id, 'inquiry ID'), { message, actorUserId: req.user.userId }) }); });
exports.updateInquiryStatus = asyncHandler(async (req, res) => { res.json({ success: true, data: await repository.updateInquiryStatus(parsePositiveInteger(req.params.id, 'inquiry ID'), String(req.body?.status || '').toUpperCase()) }); });

exports.listOrders = asyncHandler(async (req, res) => {
  const purchaseOrderRepository = require('../repositories/purchaseOrderRepository');
  res.json({ success: true, data: { purchase_orders: await purchaseOrderRepository.findAll() } });
});

exports.listInvoices = asyncHandler(async (req, res) => res.json({ success: true, data: { invoices: await repository.listInvoices(req.query.status || null) } }));
exports.getInvoice = asyncHandler(async (req, res) => { const invoice = await repository.getInvoice(parsePositiveInteger(req.params.id, 'supplier invoice ID')); if (!invoice) throw new ApiError('Supplier invoice not found', 404); res.json({ success: true, data: invoice }); });
exports.createInvoice = asyncHandler(async (req, res) => {
  const supplierId = parsePositiveInteger(req.body?.supplier_id, 'supplier ID');
  const invoiceNumber = text(req.body?.invoice_number, 'Invoice number', 100);
  const invoiceDate = req.body?.invoice_date;
  const dueDate = req.body?.due_date || null;
  if (!isIsoDate(invoiceDate) || invoiceDate > todayInTimeZone()) throw new ApiError('Invoice date must be a valid date not in the future', 400);
  if (dueDate && (!isIsoDate(dueDate) || dueDate < invoiceDate)) throw new ApiError('Due date must be valid and not before invoice date', 400);
  const totalAmount = decimal(req.body?.total_amount, 'Invoice total');
  const purchaseOrderId = req.body?.purchase_order_id ? parsePositiveInteger(req.body.purchase_order_id, 'purchase order ID') : null;
  const invoice = await repository.createInvoice({ supplierId, purchaseOrderId, invoiceNumber, invoiceDate, dueDate, totalAmount });
  res.status(201).json({ success: true, data: invoice });
});
exports.recordPayment = asyncHandler(async (req, res) => {
  const method = String(req.body?.payment_method || '').toUpperCase();
  if (!['CASH', 'BANK_TRANSFER', 'CHEQUE', 'CARD'].includes(method)) throw new ApiError('Unsupported supplier payment method', 400);
  const amount = decimal(req.body?.amount, 'Payment amount');
  if (amount <= 0) throw new ApiError('Payment amount must be greater than zero', 400);
  const key = text(req.body?.idempotency_key, 'Idempotency key', 100);
  const referenceNumber = req.body?.reference_number ? text(req.body.reference_number, 'Reference number', 100) : null;
  const payment = await repository.recordSupplierPayment({ invoiceId: parsePositiveInteger(req.params.id, 'supplier invoice ID'), amount, method, referenceNumber, idempotencyKey: key, actorUserId: req.user.userId });
  res.status(201).json({ success: true, message: 'Internal supplier payment recorded; no external transfer was initiated', data: payment });
});

exports.listReceipts = asyncHandler(async (req, res) => res.json({ success: true, data: { goods_receipts: await repository.listGoodsReceipts() } }));
exports.getReceipt = asyncHandler(async (req, res) => { const receipt = await repository.getGoodsReceipt(parsePositiveInteger(req.params.id, 'goods receipt ID')); if (!receipt) throw new ApiError('Goods receipt not found', 404); res.json({ success: true, data: receipt }); });
exports.createReceipt = asyncHandler(async (req, res) => {
  const items = req.body?.items;
  if (!Array.isArray(items) || items.length === 0) throw new ApiError('At least one goods-receipt item is required', 400);
  const seen = new Set();
  const normalized = items.map(item => {
    const orderItemId = parsePositiveInteger(item.purchase_order_item_id, 'purchase-order item ID');
    if (seen.has(orderItemId)) throw new ApiError('Duplicate purchase-order item in receipt', 400);
    seen.add(orderItemId);
    const quantity = parsePositiveInteger(item.quantity_received, 'received quantity');
    const batchNumber = text(item.batch_number, 'Batch number', 100);
    const expiryDate = item.expiry_date;
    if (!isIsoDate(expiryDate) || expiryDate < todayInTimeZone()) throw new ApiError('Batch expiry date must be valid and not in the past', 400);
    const unitCost = item.unit_cost === undefined || item.unit_cost === '' ? undefined : decimal(item.unit_cost, 'Unit cost');
    return { purchase_order_item_id: orderItemId, quantity_received: quantity, batch_number: batchNumber, expiry_date: expiryDate, unit_cost: unitCost };
  });
  const key = text(req.body?.idempotency_key, 'Idempotency key', 100);
  const receipt = await repository.createGoodsReceipt({ purchaseOrderId: parsePositiveInteger(req.body?.purchase_order_id, 'purchase order ID'), deliveryReference: req.body?.supplier_delivery_reference ? text(req.body.supplier_delivery_reference, 'Delivery reference', 100) : null, notes: req.body?.notes ? text(req.body.notes, 'Notes', 2000) : null, idempotencyKey: key, actorUserId: req.user.userId, items: normalized });
  res.status(201).json({ success: true, data: receipt });
});
