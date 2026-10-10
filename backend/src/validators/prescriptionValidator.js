const ApiError = require('../middleware/errorHandler');
const { isIsoDate, parsePositiveInteger } = require('../utils/requestValidation');

class PrescriptionValidator {
  // Validate prescription date
  static isValidDate(dateStr) {
    if (!dateStr) return false;
    return isIsoDate(dateStr);
  }

  // Validate prescription creation data
  static validateCreate(data = {}) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) data = {};
    const errors = [];
    const integer = value => {
      if (typeof value !== 'number' && typeof value !== 'string') return null;
      if (typeof value === 'string' && !/^\d+$/.test(value.trim())) return null;
      const parsed = Number(value);
      return Number.isSafeInteger(parsed) ? parsed : null;
    };

    // Customer ID is required
    if (!data.customer_id || data.customer_id === '') {
      errors.push('Customer is required');
    } else {
      const customerId = integer(data.customer_id);
      if (customerId === null || customerId <= 0) {
        errors.push('Invalid customer ID');
      }
    }

    // Prescription date is required
    if (typeof data.prescription_date !== 'string' || data.prescription_date.trim() === '') {
      errors.push('Prescription date is required');
    } else if (!this.isValidDate(data.prescription_date)) {
      errors.push('Invalid prescription date format');
    }

    // Items are required
    if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
      errors.push('At least one prescribed medicine is required');
    } else {
      const medicineIds = new Set();
      // Validate each item
      data.items.forEach((item, index) => {
        const itemErrors = [];
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          errors.push(`Item ${index + 1}: Invalid item`);
          return;
        }

        // Medicine ID
        if (!item.medicine_id || item.medicine_id === '') {
          itemErrors.push(`Item ${index + 1}: Medicine is required`);
        } else {
          const medicineId = integer(item.medicine_id);
          if (medicineId === null || medicineId <= 0) {
            itemErrors.push(`Item ${index + 1}: Invalid medicine ID`);
          } else if (medicineIds.has(medicineId)) {
            itemErrors.push(`Item ${index + 1}: Duplicate medicine lines are not allowed`);
          } else {
            medicineIds.add(medicineId);
          }
        }

        if (item.instructions !== undefined && item.instructions !== null && typeof item.instructions !== 'string') {
          itemErrors.push(`Item ${index + 1}: Instructions must be text`);
        } else if (typeof item.instructions === 'string' && item.instructions.trim().length > 5000) {
          itemErrors.push(`Item ${index + 1}: Instructions must not exceed 5000 characters`);
        }

        // Quantity
        if (item.quantity === undefined || item.quantity === null || item.quantity === '') {
          itemErrors.push(`Item ${index + 1}: Quantity is required`);
        } else {
          const quantity = integer(item.quantity);
          if (quantity === null) {
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

    for (const [field, max] of [['instructions', 5000], ['notes', 5000]]) {
      if (data[field] !== undefined && data[field] !== null && typeof data[field] !== 'string') errors.push(`${field} must be text`);
      if (typeof data[field] === 'string' && data[field].trim().length > max) errors.push(`${field} must not exceed ${max} characters`);
    }
    if (errors.length > 0) {
      throw new ApiError(errors.join('; '), 400);
    }

    // Build validated data
    const items = data.items.map(item => ({
      medicine_id: integer(item.medicine_id),
      quantity: integer(item.quantity),
      instructions: item.instructions ? item.instructions.trim() : null
    }));

    return {
      customer_id: integer(data.customer_id),
      prescription_date: data.prescription_date,
      instructions: data.instructions ? data.instructions.trim() : null,
      notes: data.notes ? data.notes.trim() : null,
      items: items
    };
  }

  // Validate send-to-billing data
  static validateSendToBilling(prescriptionId) {
    return parsePositiveInteger(prescriptionId, 'prescription ID');
  }
}

module.exports = PrescriptionValidator;
