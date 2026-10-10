const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../middleware/errorHandler');
const prescriptionRepository = require('../repositories/prescriptionRepository');
const PrescriptionValidator = require('../validators/prescriptionValidator');
const customerRepository = require('../repositories/customerRepository');
const medicineRepository = require('../repositories/medicineRepository');
const { parseDateRange, parsePagination, parsePositiveInteger, parseRecentLimit, parseSearch } = require('../utils/requestValidation');

class PrescriptionController {
  canAccessPrescription(req, prescription) {
    return req.user.role !== 'CUSTOMER' || Number(prescription.customer_id) === Number(req.user.customerId);
  }

  // GET /api/prescriptions
  // GET /api/prescriptions?search=...&start_date=...&end_date=...
  getAllPrescriptions = asyncHandler(async (req, res) => {
    const { search, start_date, end_date, page, limit, pagination } = req.query;

    const paging = parsePagination(req.query);
    const filters = { search: parseSearch(search), ...parseDateRange(start_date, end_date), ...paging };

    if (req.user.role === 'CUSTOMER') filters.customer_id = req.user.customerId;

    const prescriptions = await prescriptionRepository.findAll(filters);
    const total = await prescriptionRepository.getCount(filters);

    res.json({
      success: true,
      message: 'Prescriptions retrieved successfully',
      data: {
        prescriptions,
        pagination: {
          current_page: paging.page,
          per_page: paging.limit,
          total_items: total,
          total_pages: Math.ceil(total / paging.limit)
        }
      }
    });
  });

  // GET /api/prescriptions/recent
  getRecentPrescriptions = asyncHandler(async (req, res) => {
    const limit = parseRecentLimit(req.query.limit);
    const prescriptions = await prescriptionRepository.findRecent(limit);

    res.json({
      success: true,
      message: 'Recent prescriptions retrieved successfully',
      data: prescriptions
    });
  });

  getReadyForBilling = asyncHandler(async (req, res) => {
    res.json({ success: true, data: { prescriptions: await prescriptionRepository.findReadyForBilling() } });
  });

  // GET /api/prescriptions/:id
  getPrescriptionById = asyncHandler(async (req, res) => {
    const id = parsePositiveInteger(req.params.id, 'prescription ID');

    const prescription = await prescriptionRepository.findById(id);

    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: 'Prescription not found'
      });
    }

    if (!this.canAccessPrescription(req, prescription)) {
      return res.status(403).json({ success: false, message: 'You can only view your own prescriptions' });
    }

    res.json({
      success: true,
      message: 'Prescription retrieved successfully',
      data: prescription
    });
  });

  // POST /api/prescriptions
  createPrescription = asyncHandler(async (req, res) => {
    // Validate request body
    const validatedData = PrescriptionValidator.validateCreate(req.body);

    // Verify customer exists
    const customer = await customerRepository.findById(validatedData.customer_id);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: `Customer with ID ${validatedData.customer_id} not found`
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

    // Create prescription with items
    const uploadId = req.body?.upload_id == null ? null : parsePositiveInteger(req.body.upload_id, 'upload ID');
    const prescription = await prescriptionRepository.createWithItems({ ...validatedData, upload_id: uploadId, reviewer_user_id: req.user.userId }, validatedData.items);

    res.status(201).json({
      success: true,
      message: 'Prescription created successfully',
      data: prescription
    });
  });

  // GET /api/prescriptions/:id/availability
  // Check medicine availability for a prescription
  checkAvailability = asyncHandler(async (req, res) => {
    const id = parsePositiveInteger(req.params.id, 'prescription ID');

    // Verify prescription exists
    const prescription = await prescriptionRepository.findById(id);
    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: 'Prescription not found'
      });
    }

    if (!this.canAccessPrescription(req, prescription)) {
      return res.status(403).json({ success: false, message: 'You can only view your own prescriptions' });
    }

    // Check availability
    const availability = await prescriptionRepository.checkAvailability(id);

    // Calculate overall status
    const allAvailable = availability.every(item => item.availability_status === 'available');
    const anyAvailable = availability.some(item => item.availability_status === 'available' || item.availability_status === 'insufficient');
    const allOutOfStock = availability.every(item => item.availability_status === 'out_of_stock');

    let overallStatus = 'AVAILABLE';
    if (!allAvailable && anyAvailable) {
      overallStatus = 'PARTIAL';
    } else if (allOutOfStock) {
      overallStatus = 'OUT_OF_STOCK';
    } else if (!anyAvailable) {
      overallStatus = 'NO_MEDICINES';
    }

    res.json({
      success: true,
      message: 'Prescription availability checked successfully',
      data: {
        prescription_id: id,
        overall_status: overallStatus,
        items: availability,
        summary: {
          total_items: availability.length,
          available_count: availability.filter(i => i.availability_status === 'available').length,
          insufficient_count: availability.filter(i => i.availability_status === 'insufficient').length,
          out_of_stock_count: availability.filter(i => i.availability_status === 'out_of_stock').length
        }
      }
    });
  });

  // POST /api/prescriptions/:id/send-to-billing
  // Prepare prescription items to be sent to POS/billing
  // NOTE: This does NOT reduce stock - stock is reduced only when sale is completed
  sendToBilling = asyncHandler(async (req, res) => {
    const prescriptionId = PrescriptionValidator.validateSendToBilling(req.params.id);

    // Verify prescription exists
    const prescription = await prescriptionRepository.findById(prescriptionId);
    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: 'Prescription not found'
      });
    }

    const availability = await prescriptionRepository.checkAvailability(prescriptionId);
    if (!availability.length || availability.some(item => item.availability_status !== 'available')) {
      throw new ApiError('All prescribed medicines must be available before billing handoff', 409);
    }
    const preparedPrescription = await prescriptionRepository.prepareForBilling(prescriptionId, req.user.userId);

    // Only currently available, non-expired lines may enter the POS cart.
    const billingItems = availability
      .filter(item => item.availability_status === 'available')
      .map(item => ({
      medicine_id: item.medicine_id,
      product_code: item.product_code,
      medicine_name: item.medicine_name,
      generic_name: item.generic_name,
      batch_number: item.batch_number,
      requested_quantity: item.requested_quantity,
      unit_price: item.unit_price,
      line_total: item.requested_quantity * item.unit_price
    }));

    const unavailableItems = availability
      .filter(item => item.availability_status !== 'available')
      .map(item => ({
        medicine_id: item.medicine_id,
        medicine_name: item.medicine_name,
        requested_quantity: item.requested_quantity,
        current_stock: item.current_stock,
        availability_status: item.availability_status
      }));

    // Calculate totals
    const totalAmount = billingItems.reduce((sum, item) => sum + item.line_total, 0);

    res.json({
      success: true,
      message: 'Prescription prepared for billing. Stock will be reduced when sale is completed.',
      data: {
        prescription_id: prescriptionId,
        prescription_status: preparedPrescription.status,
        prescription_date: preparedPrescription.prescription_date,
        customer: {
          id: prescription.customer_id,
          name: `${prescription.first_name} ${prescription.last_name}`,
          phone: prescription.customer_phone,
          email: prescription.customer_email
        },
        items: billingItems,
        unavailable_items: unavailableItems,
        totals: {
          subtotal: totalAmount,
          discount: 0,
          total: totalAmount
        },
        billing_note: 'Stock will be reduced only after completing the sale.'
      }
    });
  });

  getBilling = asyncHandler(async (req, res) => {
    const id = parsePositiveInteger(req.params.id, 'prescription ID');
    const prescription = await prescriptionRepository.findById(id);
    if (!prescription) throw new ApiError('Prescription not found', 404);
    if (!['APPROVED', 'READY_FOR_BILLING'].includes(prescription.status)) throw new ApiError(`Prescription status ${prescription.status} cannot be billed`, 409);
    const availability = await prescriptionRepository.checkAvailability(id);
    if (!availability.length || availability.some(item => item.availability_status !== 'available')) throw new ApiError('Prescription medicines are no longer fully available', 409);
    const items = availability.filter(item => item.availability_status === 'available').map(item => ({ medicine_id: item.medicine_id, product_code: item.product_code, medicine_name: item.medicine_name, batch_number: item.batch_number, unit_price: item.unit_price, quantity: item.requested_quantity, line_total: Number(item.unit_price) * Number(item.requested_quantity) }));
    res.json({ success: true, data: { prescription_id: id, status: prescription.status, customer: { id: prescription.customer_id, name: `${prescription.first_name} ${prescription.last_name}` }, items, unavailable_items: availability.filter(item => item.availability_status !== 'available') } });
  });

  updateStatus = asyncHandler(async (req, res) => {
    const id = parsePositiveInteger(req.params.id, 'prescription ID');
    const status = typeof req.body?.status === 'string' ? req.body.status.trim().toUpperCase() : '';
    const allowed = new Set(['UNDER_REVIEW', 'APPROVED', 'REJECTED', 'READY_FOR_BILLING', 'DISPENSED', 'CANCELLED']);
    if (!allowed.has(status)) throw new ApiError('Invalid prescription status', 400);
    const prescription = await prescriptionRepository.updateStatus(id, req.user.userId, status, typeof req.body?.reason === 'string' ? req.body.reason.trim() : null);
    res.json({ success: true, message: 'Prescription status updated', data: prescription });
  });
}

module.exports = new PrescriptionController();
