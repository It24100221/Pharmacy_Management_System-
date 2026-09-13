const ApiError = require('../middleware/errorHandler');

class SalesValidator {
  // Validate sale creation data
  static validateCreate(data) {
    const errors = [];

    // Customer ID is optional but if provided should be valid
    if (data.customer_id !== undefined && data.customer_id !== null && data.customer_id !== '') {
      const customerId = parseInt(data.customer_id);
      if (isNaN(customerId) || customerId <= 0) {
        errors.push('Invalid customer ID');
      }
    }

    // Items are required
    if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
      errors.push('At least one sale item is required');
    } else {
      const medicineIds = new Set();

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
          } else if (medicineIds.has(medicineId)) {
            itemErrors.push(`Item ${index + 1}: Duplicate medicine lines are not allowed`);
          } else {
            medicineIds.add(medicineId);
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

        // Submitted prices are informational only; the repository uses the
        // current database price. Validate a supplied value for clear feedback.
        if (item.unit_price !== undefined && item.unit_price !== null && item.unit_price !== '') {
          const unitPrice = parseFloat(item.unit_price);
          if (isNaN(unitPrice)) {
            itemErrors.push(`Item ${index + 1}: Unit price must be a valid number`);
          } else if (unitPrice < 0) {
            itemErrors.push(`Item ${index + 1}: Unit price cannot be negative`);
          }
        }

        if (itemErrors.length > 0) {
          errors.push(...itemErrors);
        }
      });
    }

    // Discount validation (optional)
    if (data.discount !== undefined && data.discount !== null && data.discount !== '') {
      const discount = parseFloat(data.discount);
      if (isNaN(discount)) {
        errors.push('Discount must be a valid number');
      } else if (discount < 0) {
        errors.push('Discount cannot be negative');
      }
    }

    // Payment method validation (optional)
    const validPaymentMethods = ['Cash', 'Card', 'Cheque', 'Online', 'Credit'];
    if (data.payment_method && !validPaymentMethods.includes(data.payment_method)) {
      errors.push(`Invalid payment method. Valid options: ${validPaymentMethods.join(', ')}`);
    }

    if (errors.length > 0) {
      throw new ApiError(errors.join('; '), 400);
    }

    // Build validated data
    const items = data.items.map(item => ({
      medicine_id: parseInt(item.medicine_id),
      quantity: parseInt(item.quantity)
    }));

    return {
      customer_id: data.customer_id ? parseInt(data.customer_id) : null,
      items: items,
      discount: data.discount !== undefined && data.discount !== null && data.discount !== ''
        ? parseFloat(data.discount)
        : 0,
      payment_method: data.payment_method || 'Cash',
      notes: data.notes ? data.notes.trim() : null
    };
  }

  // Validate cart item for POS
  static validateCartItem(item) {
    const errors = [];

    if (!item.medicine_id) {
      errors.push('Medicine is required');
    }

    if (!item.quantity || parseInt(item.quantity) <= 0) {
      errors.push('Quantity must be greater than 0');
    }

    if (!item.unit_price || parseFloat(item.unit_price) < 0) {
      errors.push('Unit price must be valid');
    }

    if (errors.length > 0) {
      throw new ApiError(errors.join('; '), 400);
    }

    return {
      medicine_id: parseInt(item.medicine_id),
      quantity: parseInt(item.quantity),
      unit_price: parseFloat(item.unit_price)
    };
  }
}

module.exports = SalesValidator;
