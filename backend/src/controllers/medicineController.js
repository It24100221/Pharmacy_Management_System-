const asyncHandler = require('../utils/asyncHandler');
const medicineRepository = require('../repositories/medicineRepository');
const MedicineValidator = require('../validators/medicineValidator');
const ApiError = require('../middleware/errorHandler');
const { parsePagination, parsePositiveInteger, parseSearch, isIsoDate, todayInTimeZone } = require('../utils/requestValidation');

const STOCK_STATUSES = new Set(['low_stock', 'out_of_stock', 'in_stock']);
const EXPIRY_STATUSES = new Set(['expired', 'near_expiry']);

class MedicineController {
  // GET /api/medicines
  // GET /api/medicines?search=...&category=...&stock_status=...&page=...&limit=...
  getAllMedicines = asyncHandler(async (req, res) => {
    const { search, category, stock_status, expiry_status, page, limit, pagination } = req.query;

    const paging = parsePagination(req.query);
    if (stock_status && !STOCK_STATUSES.has(stock_status)) throw new ApiError('Invalid stock status', 400);
    if (expiry_status && !EXPIRY_STATUSES.has(expiry_status)) throw new ApiError('Invalid expiry status', 400);
    const filters = {
      search: parseSearch(search),
      category: category || undefined,
      stock_status: stock_status || undefined,
      expiry_status: expiry_status || undefined,
      ...paging,
    };

    const medicines = await medicineRepository.findAll(filters);
    const total = await medicineRepository.getCount(filters);

    res.json({
      success: true,
      message: 'Medicines retrieved successfully',
      data: {
        medicines,
        pagination: {
          current_page: paging.page,
          per_page: paging.limit,
          total_items: total,
          total_pages: Math.ceil(total / paging.limit)
        }
      }
    });
  });

  // GET /api/medicines/:id
  getMedicineById = asyncHandler(async (req, res) => {
    const id = parsePositiveInteger(req.params.id, 'medicine ID');

    const medicine = await medicineRepository.findById(id);

    if (!medicine) {
      return res.status(404).json({
        success: false,
        message: 'Medicine not found'
      });
    }

    res.json({
      success: true,
      message: 'Medicine retrieved successfully',
      data: medicine
    });
  });

  getStockMovements = asyncHandler(async (req, res) => {
    const id = parsePositiveInteger(req.params.id, 'medicine ID');
    const medicine = await medicineRepository.findById(id);
    if (!medicine) throw new ApiError('Medicine not found', 404);
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 200);
    res.json({ success: true, data: { movements: await medicineRepository.findStockMovements(id, limit) } });
  });

  getBatches = asyncHandler(async (req, res) => {
    const id = parsePositiveInteger(req.params.id, 'medicine ID');
    const medicine = await medicineRepository.findById(id);
    if (!medicine) throw new ApiError('Medicine not found', 404);
    const includeExpired = req.query.include_expired !== 'false';
    res.json({ success: true, data: { batches: await medicineRepository.findBatches(id, { includeExpired }) } });
  });

  createBatch = asyncHandler(async (req, res) => {
    const id = parsePositiveInteger(req.params.id, 'medicine ID');
    const batchNumber = typeof req.body?.batch_number === 'string' ? req.body.batch_number.trim() : '';
    const expiryDate = req.body?.expiry_date;
    const unitCost = req.body?.unit_cost === undefined || req.body?.unit_cost === '' ? null : Number(req.body.unit_cost);
    if (!batchNumber || batchNumber.length > 100) throw new ApiError('Batch number is required and must not exceed 100 characters', 400);
    if (!isIsoDate(expiryDate) || expiryDate < todayInTimeZone()) throw new ApiError('Expiry date must be a valid future date in YYYY-MM-DD format', 400);
    if (unitCost !== null && (!Number.isFinite(unitCost) || unitCost < 0)) throw new ApiError('Unit cost must be a non-negative number', 400);
    const result = await medicineRepository.createBatch(id, { batch_number: batchNumber, expiry_date: expiryDate, unit_cost: unitCost }, req.user?.userId);
    res.status(201).json({ success: true, message: 'Batch created successfully', data: result });
  });

  adjustStock = asyncHandler(async (req, res) => {
    const id = parsePositiveInteger(req.params.id, 'medicine ID');
    const body = req.body || {};
    const quantityDelta = typeof body.quantity_delta === 'string' && body.quantity_delta.trim() !== '' ? Number(body.quantity_delta) : body.quantity_delta;
    if (!Number.isSafeInteger(quantityDelta) || quantityDelta === 0 || Math.abs(quantityDelta) > 2147483647) throw new ApiError('Quantity delta must be a non-zero integer', 400);
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (!reason || reason.length > 1000) throw new ApiError('Adjustment reason is required and must not exceed 1000 characters', 400);
    const idempotencyKey = typeof body.idempotency_key === 'string' ? body.idempotency_key.trim() : '';
    if (!idempotencyKey || idempotencyKey.length > 100) throw new ApiError('A valid idempotency key is required', 400);
    let batchId = null;
    if (body.batch_id !== undefined && body.batch_id !== null && body.batch_id !== '') batchId = parsePositiveInteger(body.batch_id, 'batch ID');
    const result = await medicineRepository.adjustStock(id, { batch_id: batchId, quantity_delta: quantityDelta, reason, idempotency_key: idempotencyKey }, req.user?.userId);
    if (result.duplicate) return res.status(200).json({ success: true, message: 'Adjustment already applied', data: result.movement, duplicate: true });
    res.status(201).json({ success: true, message: 'Stock adjusted successfully', data: result.movement });
  });

  // POST /api/medicines
  createMedicine = asyncHandler(async (req, res) => {
    // Validate request body
    const validatedData = MedicineValidator.validateCreate(req.body);

    // Create medicine
    const medicineId = await medicineRepository.create(validatedData, req.user?.userId);

    // Fetch and return the created medicine
    const medicine = await medicineRepository.findById(medicineId);

    res.status(201).json({
      success: true,
      message: 'Medicine created successfully',
      data: medicine
    });
  });

  // PUT /api/medicines/:id
  updateMedicine = asyncHandler(async (req, res) => {
    const id = req.params.id;

    // Validate request body
    const validatedData = MedicineValidator.validateUpdate(id, req.body);

    // Update medicine
    const medicine = await medicineRepository.update(id, validatedData);

    res.json({
      success: true,
      message: 'Medicine updated successfully',
      data: medicine
    });
  });

  // GET /api/medicines/low-stock
  getLowStockMedicines = asyncHandler(async (req, res) => {
    const lowStockMedicines = await medicineRepository.findLowStock();

    res.json({
      success: true,
      message: 'Low stock medicines retrieved successfully',
      data: lowStockMedicines,
      count: lowStockMedicines.length
    });
  });

  // GET /api/medicines/expiry-status?status=all|expired|near_expiry
  getExpiryStatusMedicines = asyncHandler(async (req, res) => {
    const { status } = req.query;
    const expiryStatus = status || 'all';
    if (!new Set(['all', ...EXPIRY_STATUSES]).has(expiryStatus)) {
      throw new ApiError('Invalid expiry status', 400);
    }

    const medicines = await medicineRepository.findByExpiryStatus(expiryStatus);

    res.json({
      success: true,
      message: 'Expiry status medicines retrieved successfully',
      data: medicines,
      count: medicines.length,
      filters: {
        status: expiryStatus
      }
    });
  });
}

module.exports = new MedicineController();
