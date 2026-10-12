const ApiError = require('../middleware/errorHandler');

class SalesValidator {
  // Validate sale creation data
  static validateCreate(data = {}) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) data = {};
    const errors = [];
    const integer = value => {
      if (typeof value !== 'number' && typeof value !== 'string') return null;
      if (typeof value === 'string' && !/^\d+$/.test(value.trim())) return null;
      const parsed = Number(value);
      return Number.isSafeInteger(parsed) ? parsed : null;
    };
    const decimal = value => {
      if (typeof value !== 'number' && typeof value !== 'string') return null;
      if (typeof value === 'string' && !/^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(value.trim())) return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };

    // Customer ID is optional but if provided should be valid
    if (data.customer_id !== undefined && data.customer_id !== null && data.customer_id !== '') {
      const customerId = integer(data.customer_id);
      if (customerId === null || customerId <= 0) {
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

        // Quantity
        if (item.quantity === undefined || item.quantity === null || item.quantity === '') {
          itemErrors.push(`Item ${index + 1}: Quantity is required`);
        } else {
          const quantity = integer(item.quantity);
          if (quantity === null) {
            itemErrors.push(`Item ${index + 1}: Quantity must be a valid number`);
          } else if (quantity <= 0) {
            itemErrors.push(`Item ${index + 1}: Quantity must be greater than 0`);
          } else if (quantity > 2147483647) {
            itemErrors.push(`Item ${index + 1}: Quantity is too large`);
          }
        }

        // Submitted prices are informational only; the repository uses the
        // current database price. Validate a supplied value for clear feedback.
        if (item.unit_price !== undefined && item.unit_price !== null && item.unit_price !== '') {
          const unitPrice = decimal(item.unit_price);
          if (unitPrice === null) {
            itemErrors.push(`Item ${index + 1}: Unit price must be a valid number`);
          } else if (unitPrice < 0) {
            itemErrors.push(`Item ${index + 1}: Unit price cannot be negative`);
          } else if (unitPrice > 99999999.99 || Math.abs(Math.round(unitPrice * 100) - (unitPrice * 100)) >= 1e-8) {
            itemErrors.push(`Item ${index + 1}: Unit price must not exceed 99,999,999.99 and may have at most 2 decimal places`);
          }
        }

        if (itemErrors.length > 0) {
          errors.push(...itemErrors);
        }
      });
    }

    // Discount validation (optional)
    if (data.discount !== undefined && data.discount !== null && data.discount !== '') {
      const discount = decimal(data.discount);
      if (discount === null) {
        errors.push('Discount must be a valid number');
      } else if (discount < 0) {
        errors.push('Discount cannot be negative');
      } else if (discount > 99999999.99 || Math.abs(Math.round(discount * 100) - (discount * 100)) >= 1e-8) {
        errors.push('Discount must not exceed 99,999,999.99 and may have at most 2 decimal places');
      }
    }

    // Payment method validation (optional)
    const validPaymentMethods = ['Cash', 'Card', 'Cheque', 'Online', 'Credit'];
    if (data.payment_method && !validPaymentMethods.includes(data.payment_method)) {
      errors.push(`Invalid payment method. Valid options: ${validPaymentMethods.join(', ')}`);
    }
    if (data.notes !== undefined && data.notes !== null && typeof data.notes !== 'string') errors.push('Notes must be text');
    if (typeof data.notes === 'string' && data.notes.trim().length > 5000) errors.push('Notes must not exceed 5000 characters');

    if (errors.length > 0) {
      throw new ApiError(errors.join('; '), 400);
    }

    // Build validated data
    const items = data.items.map(item => ({
      medicine_id: integer(item.medicine_id),
      quantity: integer(item.quantity)
    }));

    const idempotencyKey = data.idempotency_key === undefined || data.idempotency_key === null || data.idempotency_key === ''
      ? null : String(data.idempotency_key).trim();
    if (idempotencyKey && (idempotencyKey.length > 100 || !/^[A-Za-z0-9:_-]+$/.test(idempotencyKey))) throw new ApiError('Invalid idempotency key', 400);
    const prescriptionId = data.prescription_id === undefined || data.prescription_id === null || data.prescription_id === '' ? null : integer(data.prescription_id);
    if (data.prescription_id !== undefined && (prescriptionId === null || prescriptionId <= 0)) throw new ApiError('Invalid prescription ID', 400);
    return {
      customer_id: data.customer_id ? integer(data.customer_id) : null,
      items: items,
      discount: data.discount !== undefined && data.discount !== null && data.discount !== ''
        ? decimal(data.discount)
        : 0,
      payment_method: data.payment_method || 'Cash',
      notes: data.notes ? data.notes.trim() : null,
      idempotency_key: idempotencyKey,
      prescription_id: prescriptionId
    };
  }

  // Validate cart item for POS
  static validateCartItem(item) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new ApiError('Invalid cart item', 400);
    const errors = [];
    const integer = value => {
      if (typeof value !== 'number' && typeof value !== 'string') return null;
      if (typeof value === 'string' && !/^\d+$/.test(value.trim())) return null;
      const parsed = Number(value);
      return Number.isSafeInteger(parsed) ? parsed : null;
    };
    const number = value => {
      if (typeof value !== 'number' && typeof value !== 'string') return null;
      if (typeof value === 'string' && !/^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(value.trim())) return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };

    if (!item.medicine_id || !integer(item.medicine_id)) {
      errors.push('Medicine is required');
    }

    if (!item.quantity || integer(item.quantity) === null || integer(item.quantity) <= 0) {
      errors.push('Quantity must be greater than 0');
    }

    if (item.unit_price === undefined || number(item.unit_price) === null || number(item.unit_price) < 0) {
      errors.push('Unit price must be valid');
    }

    if (errors.length > 0) {
      throw new ApiError(errors.join('; '), 400);
    }

    return {
      medicine_id: integer(item.medicine_id),
      quantity: integer(item.quantity),
      unit_price: number(item.unit_price)
    };
  }
}

module.exports = SalesValidator;
