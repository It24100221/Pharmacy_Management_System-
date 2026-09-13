const asyncHandler = require('../utils/asyncHandler');
const purchaseRepository = require('../repositories/purchaseRepository');
const PurchaseValidator = require('../validators/purchaseValidator');
const medicineRepository = require('../repositories/medicineRepository');

class PurchaseController {
  // GET /api/purchases
  // GET /api/purchases?search=...&start_date=...&end_date=...
  getAllPurchases = asyncHandler(async (req, res) => {
    const { search, start_date, end_date, page, limit, pagination } = req.query;

    const filters = {
      search: search || undefined,
      start_date: start_date || undefined,
      end_date: end_date || undefined,
      page: page,
      limit: limit,
      pagination: pagination === 'false' ? false : true
    };

    const purchases = await purchaseRepository.findAll(filters);
    const total = await purchaseRepository.getCount(filters);

    res.json({
      success: true,
      message: 'Purchases retrieved successfully',
      data: {
        purchases,
        pagination: {
          current_page: parseInt(page) || 1,
          per_page: parseInt(limit) || 50,
          total_items: total,
          total_pages: Math.ceil(total / (parseInt(limit) || 50))
        }
      }
    });
  });

  // GET /api/purchases/recent
  getRecentPurchases = asyncHandler(async (req, res) => {
    const limit = parseInt(req.query.limit) || 5;
    const purchases = await purchaseRepository.findRecent(limit);

    res.json({
      success: true,
      message: 'Recent purchases retrieved successfully',
      data: purchases
    });
  });

  // GET /api/purchases/:id
  getPurchaseById = asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);

    const purchase = await purchaseRepository.findById(id);

    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: 'Purchase not found'
      });
    }

    res.json({
      success: true,
      message: 'Purchase retrieved successfully',
      data: purchase
    });
  });

  // POST /api/purchases
  // Creates a purchase and increases medicine stock
  createPurchase = asyncHandler(async (req, res) => {
    // Validate request body
    const validatedData = PurchaseValidator.validateCreate(req.body);

    // Verify supplier exists
    const supplier = await (require('../repositories/supplierRepository')).findById(validatedData.supplier_id);
    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: `Supplier with ID ${validatedData.supplier_id} not found`
      });
    }

    // Verify all medicines exist
    for (const item of validatedData.items) {
      const medicine = await medicineRepository.findById(item.medicine_id);
      if (!medicine) {
        return res.status(404).json({
          success: false,
          message: `Medicine with ID ${item.medicine_id} not found`
        });
      }
    }

    // Create purchase with items (this will also increase stock)
    const purchase = await purchaseRepository.createWithItems(validatedData, validatedData.items);

    res.status(201).json({
      success: true,
      message: 'Purchase recorded successfully. Medicine stock has been increased.',
      data: purchase
    });
  });
}

module.exports = new PurchaseController();
