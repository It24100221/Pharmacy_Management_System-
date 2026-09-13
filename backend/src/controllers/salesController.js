const asyncHandler = require('../utils/asyncHandler');
const saleRepository = require('../repositories/saleRepository');
const SalesValidator = require('../validators/salesValidator');
const medicineRepository = require('../repositories/medicineRepository');
const customerRepository = require('../repositories/customerRepository');

class SalesController {
  // GET /api/sales
  // GET /api/sales?search=...&start_date=...&end_date=...
  getAllSales = asyncHandler(async (req, res) => {
    const { search, start_date, end_date, page, limit, pagination } = req.query;

    const filters = {
      search: search || undefined,
      start_date: start_date || undefined,
      end_date: end_date || undefined,
      page: page,
      limit: limit,
      pagination: pagination === 'false' ? false : true
    };

    const sales = await saleRepository.findAll(filters);
    const total = await saleRepository.getCount(filters);

    res.json({
      success: true,
      message: 'Sales retrieved successfully',
      data: {
        sales,
        pagination: {
          current_page: parseInt(page) || 1,
          per_page: parseInt(limit) || 50,
          total_items: total,
          total_pages: Math.ceil(total / (parseInt(limit) || 50))
        }
      }
    });
  });

  // GET /api/sales/recent
  getRecentSales = asyncHandler(async (req, res) => {
    const limit = parseInt(req.query.limit) || 5;
    const sales = await saleRepository.findRecent(limit);

    res.json({
      success: true,
      message: 'Recent sales retrieved successfully',
      data: sales
    });
  });

  // GET /api/sales/today-summary
  getTodaySummary = asyncHandler(async (req, res) => {
    const summary = await saleRepository.getTodaySummary();

    res.json({
      success: true,
      message: 'Today sales summary retrieved successfully',
      data: {
        date: new Date().toISOString().split('T')[0],
        total_sales: summary.total_sales || 0,
        total_revenue: summary.total_revenue || 0,
        total_items_sold: summary.total_items_sold || 0
      }
    });
  });

  // GET /api/sales/:id
  getSaleById = asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);

    const sale = await saleRepository.findById(id);

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
      });
    }

    res.json({
      success: true,
      message: 'Sale retrieved successfully',
      data: sale
    });
  });

  // POST /api/sales
  // Creates a sale and reduces medicine stock
  createSale = asyncHandler(async (req, res) => {
    // Validate request body
    const validatedData = SalesValidator.validateCreate(req.body);

    if (validatedData.customer_id) {
      const customer = await customerRepository.findById(validatedData.customer_id);
      if (!customer) {
        return res.status(404).json({
          success: false,
          message: `Customer with ID ${validatedData.customer_id} not found`
        });
      }
    }

    // Verify all medicines exist and have enough stock
    for (const item of validatedData.items) {
      const medicine = await medicineRepository.findById(item.medicine_id);
      if (!medicine) {
        return res.status(404).json({
          success: false,
          message: `Medicine with ID ${item.medicine_id} not found`
        });
      }

      if (medicine.expiry_status === 'expired') {
        return res.status(409).json({
          success: false,
          message: `Expired medicine "${medicine.name}" cannot be sold`
        });
      }

      if (medicine.quantity < item.quantity) {
        return res.status(409).json({
          success: false,
          message: `Insufficient stock for "${medicine.name}". Available: ${medicine.quantity}, Requested: ${item.quantity}`
        });
      }
    }

    // Create sale with items (this will also reduce stock)
    const sale = await saleRepository.createWithItems(validatedData, validatedData.items);

    res.status(201).json({
      success: true,
      message: 'Sale completed successfully. Medicine stock has been reduced.',
      data: sale
    });
  });

  // GET /api/sales/:id/receipt
  // Get sale data formatted for receipt display
  getReceipt = asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);

    const sale = await saleRepository.findById(id);

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
      });
    }

    // Format for receipt display
    const receipt = {
      receipt_number: `REC-${String(sale.id).padStart(6, '0')}`,
      sale_date: sale.sale_date,
      customer: sale.customer_id
        ? {
            name: `${sale.first_name} ${sale.last_name}`,
            phone: sale.customer_phone,
            email: sale.customer_email
          }
        : null,
      pharmacy_name: 'Senevirathna Medical Pharmacy',
      pharmacy_address: 'Your Pharmacy Address',
      items: sale.items.map(item => ({
        name: item.medicine_name,
        batch_number: item.batch_number,
        quantity: item.quantity,
        unit_price: item.unit_price,
        line_total: item.line_total
      })),
      subtotal: sale.total_amount,
      discount: sale.discount,
      total: sale.final_amount,
      payment_method: sale.payment_method,
      notes: sale.notes
    };

    res.json({
      success: true,
      message: 'Receipt retrieved successfully',
      data: receipt
    });
  });
}

module.exports = new SalesController();
