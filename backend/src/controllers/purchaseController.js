const asyncHandler = require('../utils/asyncHandler');
const purchaseRepository = require('../repositories/purchaseRepository');
const PurchaseValidator = require('../validators/purchaseValidator');
const medicineRepository = require('../repositories/medicineRepository');
const { parseDateRange, parsePagination, parsePositiveInteger, parseRecentLimit, parseSearch } = require('../utils/requestValidation');

class PurchaseController {
  // GET /api/purchases
  // GET /api/purchases?search=...&start_date=...&end_date=...
  getAllPurchases = asyncHandler(async (req, res) => {
    const { search, start_date, end_date, page, limit, pagination } = req.query;

    const paging = parsePagination(req.query);
    const filters = { search: parseSearch(search), ...parseDateRange(start_date, end_date), ...paging };

    const purchases = await purchaseRepository.findAll(filters);
    const total = await purchaseRepository.getCount(filters);

    res.json({
      success: true,
      message: 'Purchases retrieved successfully',
      data: {
        purchases,
        pagination: {
          current_page: paging.page,
          per_page: paging.limit,
          total_items: total,
          total_pages: Math.ceil(total / paging.limit)
        }
      }
    });
  });

  // GET /api/purchases/recent
  getRecentPurchases = asyncHandler(async (req, res) => {
    const limit = parseRecentLimit(req.query.limit);
    const purchases = await purchaseRepository.findRecent(limit);

    res.json({
      success: true,
      message: 'Recent purchases retrieved successfully',
      data: purchases
    });
  });

  // GET /api/purchases/:id
  getPurchaseById = asyncHandler(async (req, res) => {
    const id = parsePositiveInteger(req.params.id, 'purchase ID');

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
    if (req.body?.purchase_order_id || req.body?.goods_receipt_id) {
      throw new (require('../middleware/errorHandler'))('Purchase-order deliveries must be posted through goods receipts', 400);
    }
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
    const purchase = await purchaseRepository.createWithItems({ ...validatedData, actor_user_id: req.user?.userId || null }, validatedData.items);

    res.status(201).json({
      success: true,
      message: 'Purchase recorded successfully. Medicine stock has been increased.',
      data: purchase
    });
  });
}

module.exports = new PurchaseController();
