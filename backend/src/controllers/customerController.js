const asyncHandler = require('../utils/asyncHandler');
const customerRepository = require('../repositories/customerRepository');
const CustomerValidator = require('../validators/customerValidator');

class CustomerController {
  // GET /api/customers
  // GET /api/customers?search=...
  getAllCustomers = asyncHandler(async (req, res) => {
    const { search, page, limit, pagination } = req.query;

    const filters = {
      search: search || undefined,
      page: page,
      limit: limit,
      pagination: pagination === 'false' ? false : true
    };

    const customers = await customerRepository.findAll(filters);
    const total = await customerRepository.getCount(filters);

    res.json({
      success: true,
      message: 'Customers retrieved successfully',
      data: {
        customers,
        pagination: {
          current_page: parseInt(page) || 1,
          per_page: parseInt(limit) || 50,
          total_items: total,
          total_pages: Math.ceil(total / (parseInt(limit) || 50))
        }
      }
    });
  });

  // GET /api/customers/:id
  getCustomerById = asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);

    const customer = await customerRepository.findById(id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    res.json({
      success: true,
      message: 'Customer retrieved successfully',
      data: customer
    });
  });

  // POST /api/customers
  createCustomer = asyncHandler(async (req, res) => {
    // Validate request body
    const validatedData = CustomerValidator.validateCreate(req.body);

    // Create customer
    const customerId = await customerRepository.create(validatedData);

    // Fetch and return the created customer
    const customer = await customerRepository.findById(customerId);

    res.status(201).json({
      success: true,
      message: 'Customer created successfully',
      data: customer
    });
  });

  // PUT /api/customers/:id
  updateCustomer = asyncHandler(async (req, res) => {
    const id = req.params.id;

    // Validate request body
    const validatedData = CustomerValidator.validateUpdate(id, req.body);

    // Update customer
    const customer = await customerRepository.update(id, validatedData);

    res.json({
      success: true,
      message: 'Customer updated successfully',
      data: customer
    });
  });
}

module.exports = new CustomerController();
