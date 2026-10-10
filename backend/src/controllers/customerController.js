const asyncHandler = require('../utils/asyncHandler');
const customerRepository = require('../repositories/customerRepository');
const CustomerValidator = require('../validators/customerValidator');
const { parsePagination, parsePositiveInteger, parseSearch } = require('../utils/requestValidation');

class CustomerController {
  getCurrentCustomer = asyncHandler(async (req, res) => {
    const customer = await customerRepository.findById(req.user.customerId);
    if (!customer) return res.status(404).json({ success: false, message: 'Customer profile not found' });
    res.json({ success: true, message: 'Customer profile retrieved successfully', data: customer });
  });

  updateCurrentCustomer = asyncHandler(async (req, res) => {
    const customerId = req.user.customerId;
    if (!customerId) return res.status(404).json({ success: false, message: 'Customer profile not found' });
    const validatedData = CustomerValidator.validateUpdate(customerId, req.body);
    const customer = await customerRepository.update(customerId, validatedData);
    res.json({ success: true, message: 'Customer profile updated successfully', data: customer });
  });

  // GET /api/customers
  // GET /api/customers?search=...
  getAllCustomers = asyncHandler(async (req, res) => {
    const { search, page, limit, pagination } = req.query;

    const paging = parsePagination(req.query);
    const filters = { search: parseSearch(search), ...paging };

    const customers = await customerRepository.findAll(filters);
    const total = await customerRepository.getCount(filters);

    res.json({
      success: true,
      message: 'Customers retrieved successfully',
      data: {
        customers,
        pagination: {
          current_page: paging.page,
          per_page: paging.limit,
          total_items: total,
          total_pages: Math.ceil(total / paging.limit)
        }
      }
    });
  });

  // GET /api/customers/:id
  getCustomerById = asyncHandler(async (req, res) => {
    const id = parsePositiveInteger(req.params.id, 'customer ID');

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

  // DELETE /api/customers/:id
  deleteCustomer = asyncHandler(async (req, res) => {
    const id = parsePositiveInteger(req.params.id, 'customer ID');

    const result = await customerRepository.remove(id);

    res.json({
      success: true,
      message: result?.deactivated ? 'Customer deactivated successfully' : 'Customer deleted successfully'
    });
  });
}

module.exports = new CustomerController();
