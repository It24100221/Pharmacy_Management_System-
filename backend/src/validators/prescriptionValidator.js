const ApiError = require('../middleware/errorHandler');

class PrescriptionValidator {
  // Validate prescription date
  static isValidDate(dateStr) {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    return !isNaN(date.getTime());
  }

  // Validate prescription creation data
  static validateCreate(data) {
    const errors = [];

    // Customer ID is required
    if (!data.customer_id || data.customer_id === '') {
      errors.push('Customer is required');
    } else {
      const customerId = parseInt(data.customer_id);
      if (isNaN(customerId) || customerId <= 0) {
        errors.push('Invalid customer ID');
      }
    }

    // Prescription date is required
    if (!data.prescription_date || data.prescription_date.trim() === '') {
      errors.push('Prescription date is required');
    } else if (!this.isValidDate(data.prescription_date)) {
      errors.push('Invalid prescription date format');
    }

    // Items are required
    if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
      errors.push('At least one prescribed medicine is required');
    } else {
      // Validate each item
      data.items.forEach((item, index) => {
        const itemErrors = [];

        // Medicine ID
        if (!item.medicine_id || item.medicine_id === '') {
          itemErrors.push(`Item ${index + 1}: Medicine is required`);
        } else {
          const medicineId = parseInt(item.medicine_id);
          if (isNaN(medicineId) || medicineId <= 0) {
            itemErrors.push(`Item ${index + 1}: Invalid medicine ID`);
          }
        }

        // Quantity
        if (item.quantity === undefined || item.quantity === null || item.quantity === '') {
          itemErrors.push(`Item ${index + 1}: Quantity is required`);
        } else {
          const quantity = parseInt(item.quantity);
          if (isNaN(quantity)) {
            itemErrors.push(`Item ${index + 1}: Quantity must be a valid number`);
          } else if (quantity <= 0) {
            itemErrors.push(`Item ${index + 1}: Quantity must be greater than 0`);
          }
        }

        if (itemErrors.length > 0) {
          errors.push(...itemErrors);
        }
      });
    }

    if (errors.length > 0) {
      throw new ApiError(errors.join('; '), 400);
    }

    // Build validated data
    const items = data.items.map(item => ({
      medicine_id: parseInt(item.medicine_id),
      quantity: parseInt(item.quantity),
      instructions: item.instructions ? item.instructions.trim() : null
    }));

    return {
      customer_id: parseInt(data.customer_id),
      prescription_date: data.prescription_date,
      instructions: data.instructions ? data.instructions.trim() : null,
      notes: data.notes ? data.notes.trim() : null,
      items: items
    };
  }

  // Validate send-to-billing data
  static validateSendToBilling(prescriptionId) {
    const prescriptionIdNum = parseInt(prescriptionId);
    if (isNaN(prescriptionIdNum) || prescriptionIdNum <= 0) {
      throw new ApiError('Invalid prescription ID', 400);
    }
    return prescriptionIdNum;
  }
}

module.exports = PrescriptionValidator;
