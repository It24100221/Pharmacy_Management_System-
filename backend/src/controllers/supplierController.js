const asyncHandler = require('../utils/asyncHandler');
const supplierRepository = require('../repositories/supplierRepository');
const SupplierValidator = require('../validators/supplierValidator');

class SupplierController {
  // GET /api/suppliers
  // GET /api/suppliers?search=...
  getAllSuppliers = asyncHandler(async (req, res) => {
    const { search, page, limit, pagination } = req.query;

    const filters = {
      search: search || undefined,
      page: page,
      limit: limit,
      pagination: pagination === 'false' ? false : true
    };

    const suppliers = await supplierRepository.findAll(filters);
    const total = await supplierRepository.getCount(filters);

    res.json({
      success: true,
      message: 'Suppliers retrieved successfully',
      data: {
        suppliers,
        pagination: {
          current_page: parseInt(page) || 1,
          per_page: parseInt(limit) || 50,
          total_items: total,
          total_pages: Math.ceil(total / (parseInt(limit) || 50))
        }
      }
    });
  });

  // GET /api/suppliers/:id
  getSupplierById = asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);

    const supplier = await supplierRepository.findById(id);

    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found'
      });
    }

    res.json({
      success: true,
      message: 'Supplier retrieved successfully',
      data: supplier
    });
  });

  // POST /api/suppliers
  createSupplier = asyncHandler(async (req, res) => {
    // Validate request body
    const validatedData = SupplierValidator.validateCreate(req.body);

    // Create supplier
    const supplierId = await supplierRepository.create(validatedData);

    // Fetch and return the created supplier
    const supplier = await supplierRepository.findById(supplierId);

    res.status(201).json({
      success: true,
      message: 'Supplier created successfully',
      data: supplier
    });
  });

  // PUT /api/suppliers/:id
  updateSupplier = asyncHandler(async (req, res) => {
    const id = req.params.id;

    // Validate request body
    const validatedData = SupplierValidator.validateUpdate(id, req.body);

    // Update supplier
    const supplier = await supplierRepository.update(id, validatedData);

    res.json({
      success: true,
      message: 'Supplier updated successfully',
      data: supplier
    });
  });
}

module.exports = new SupplierController();
