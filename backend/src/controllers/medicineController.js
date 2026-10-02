const asyncHandler = require('../utils/asyncHandler');
const medicineRepository = require('../repositories/medicineRepository');
const MedicineValidator = require('../validators/medicineValidator');
const ApiError = require('../middleware/errorHandler');

class MedicineController {
  // GET /api/medicines
  // GET /api/medicines?search=...&category=...&stock_status=...&page=...&limit=...
  getAllMedicines = asyncHandler(async (req, res) => {
    const { search, category, stock_status, expiry_status, page, limit, pagination } = req.query;

    const filters = {
      search: search || undefined,
      category: category || undefined,
      stock_status: stock_status || undefined,
      expiry_status: expiry_status || undefined,
      page: page,
      limit: limit,
      pagination: pagination === 'false' ? false : true
    };

    const medicines = await medicineRepository.findAll(filters);
    const total = await medicineRepository.getCount(filters);

    res.json({
      success: true,
      message: 'Medicines retrieved successfully',
      data: {
        medicines,
        pagination: {
          current_page: parseInt(page) || 1,
          per_page: parseInt(limit) || 50,
          total_items: total,
          total_pages: Math.ceil(total / (parseInt(limit) || 50))
        }
      }
    });
  });

  // GET /api/medicines/:id
  getMedicineById = asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);

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

  // POST /api/medicines
  createMedicine = asyncHandler(async (req, res) => {
    // Validate request body
    const validatedData = MedicineValidator.validateCreate(req.body);

    // Create medicine
    let medicineId;
    try {
      medicineId = await medicineRepository.create(validatedData);
    } catch (error) {
      if (/UX_medicines_product_code/i.test(error.message || '')) throw new ApiError('Product ID already exists', 409);
      throw error;
    }

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
    const existing = await medicineRepository.findById(id);
    if (!existing) return res.status(404).json({ success: false, message: 'Product not found' });
    const validatedData = MedicineValidator.validateUpdate(id, req.body, existing);

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
