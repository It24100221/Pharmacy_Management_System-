const asyncHandler = require('../utils/asyncHandler');
const prescriptionRepository = require('../repositories/prescriptionRepository');
const PrescriptionValidator = require('../validators/prescriptionValidator');
const customerRepository = require('../repositories/customerRepository');
const medicineRepository = require('../repositories/medicineRepository');

class PrescriptionController {
  // GET /api/prescriptions
  // GET /api/prescriptions?search=...&start_date=...&end_date=...
  getAllPrescriptions = asyncHandler(async (req, res) => {
    const { search, start_date, end_date, page, limit, pagination } = req.query;

    const filters = {
      search: search || undefined,
      start_date: start_date || undefined,
      end_date: end_date || undefined,
      page: page,
      limit: limit,
      pagination: pagination === 'false' ? false : true
    };

    const prescriptions = await prescriptionRepository.findAll(filters);
    const total = await prescriptionRepository.getCount(filters);

    res.json({
      success: true,
      message: 'Prescriptions retrieved successfully',
      data: {
        prescriptions,
        pagination: {
          current_page: parseInt(page) || 1,
          per_page: parseInt(limit) || 50,
          total_items: total,
          total_pages: Math.ceil(total / (parseInt(limit) || 50))
        }
      }
    });
  });

  // GET /api/prescriptions/recent
  getRecentPrescriptions = asyncHandler(async (req, res) => {
    const limit = parseInt(req.query.limit) || 5;
    const prescriptions = await prescriptionRepository.findRecent(limit);

    res.json({
      success: true,
      message: 'Recent prescriptions retrieved successfully',
      data: prescriptions
    });
  });

  // GET /api/prescriptions/:id
  getPrescriptionById = asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);

    const prescription = await prescriptionRepository.findById(id);

    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: 'Prescription not found'
      });
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
    const prescription = await prescriptionRepository.createWithItems(validatedData, validatedData.items);

    res.status(201).json({
      success: true,
      message: 'Prescription created successfully',
      data: prescription
    });
  });

  // GET /api/prescriptions/:id/availability
  // Check medicine availability for a prescription
  checkAvailability = asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);

    // Verify prescription exists
    const prescription = await prescriptionRepository.findById(id);
    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: 'Prescription not found'
      });
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

    // Recheck availability at handoff time without changing stock.
    const availability = await prescriptionRepository.checkAvailability(prescriptionId);

    // Only currently available, non-expired lines may enter the POS cart.
    const billingItems = availability
      .filter(item => item.availability_status === 'available')
      .map(item => ({
      medicine_id: item.medicine_id,
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
        prescription_date: prescription.prescription_date,
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
}

module.exports = new PrescriptionController();
