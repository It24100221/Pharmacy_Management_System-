const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../middleware/errorHandler');
const repository = require('../repositories/purchaseOrderRepository');
const { parsePositiveInteger, isIsoDate, todayInTimeZone } = require('../utils/requestValidation');

exports.list = asyncHandler(async (req, res) => res.json({ success: true, data: { purchase_orders: await repository.findAll(require('../services/inventorySupply').supplierScope(req.user)) } }));
exports.get = asyncHandler(async (req, res) => { const order = await repository.findById(parsePositiveInteger(req.params.id, 'purchase order ID'),require('../services/inventorySupply').supplierScope(req.user)); if (!order) throw new ApiError('Purchase order not found', 404); res.json({ success: true, data: order }); });
exports.create = asyncHandler(async (req, res) => {
  const body = req.body || {}; const supplierId = parsePositiveInteger(body.supplier_id, 'supplier ID');
  if (!Array.isArray(body.items) || !body.items.length) throw new ApiError('At least one purchase-order item is required', 400);
  if (body.expected_date && (!isIsoDate(body.expected_date) || body.expected_date < todayInTimeZone())) throw new ApiError('Expected date must be a valid date today or later', 400);
  const supplier = await (require('../repositories/supplierRepository')).findById(supplierId);
  if (!supplier) throw new ApiError('Supplier not found', 404);
  const seen = new Set(); const items = body.items.map(item => { const medicineId = parsePositiveInteger(item.medicine_id, 'medicine ID'); const quantity = parsePositiveInteger(item.quantity, 'quantity'); const unitCost = Number(item.unit_cost); if (seen.has(medicineId) || !Number.isFinite(unitCost) || unitCost < 0 || Math.round(unitCost * 100) !== unitCost * 100) throw new ApiError('Invalid or duplicate purchase-order item', 400); seen.add(medicineId); return { medicine_id: medicineId, quantity, unit_cost: unitCost }; });
  const medicineRepository = require('../repositories/medicineRepository');
  for (const item of items) if (!await medicineRepository.findById(item.medicine_id)) throw new ApiError(`Medicine ${item.medicine_id} not found`, 404);
  const idempotencyKey = body.idempotency_key ? String(body.idempotency_key).trim() : null;
  if (idempotencyKey && !/^[A-Za-z0-9:_-]{8,100}$/.test(idempotencyKey)) throw new ApiError('Invalid idempotency key', 400);
  const order = await repository.create({ supplierId, expectedDate: body.expected_date || null, notes: typeof body.notes === 'string' ? body.notes.trim() || null : null, idempotencyKey, actorUserId: req.user.userId, items });
  res.status(201).json({ success: true, message: 'Purchase order created', data: order });
});
exports.updateStatus = asyncHandler(async (req, res) => { const status = String(req.body?.status || '').toUpperCase(); const order = await repository.updateStatus(parsePositiveInteger(req.params.id, 'purchase order ID'), status,req.user); res.json({ success: true, data: order }); });
