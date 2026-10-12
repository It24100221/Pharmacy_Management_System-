const ApiError = require('../middleware/errorHandler');
const { isIsoDate, parsePositiveInteger, todayInTimeZone } = require('../utils/requestValidation');

const decimalPattern = /^-?(?:\d+(?:\.\d+)?|\.\d+)$/;
const parseDecimal = value => {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !decimalPattern.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const parseInteger = value => {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !/^-?\d+$/.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
};
const hasMoneyPrecision = value => Math.abs(Math.round(value * 100) - (value * 100)) < 1e-8;
const optionalText = (data, field, label, max, errors) => {
  if (data[field] === undefined || data[field] === null || data[field] === '') return;
  if (typeof data[field] !== 'string') errors.push(`${label} must be text`);
  else if (data[field].trim().length > max) errors.push(`${label} must not exceed ${max} characters`);
};

class MedicineValidator {
  // Validate medicine creation data
  static validateCreate(data = {}) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) data = {};
    const errors = [];

    // Name is required
    if (typeof data.name !== 'string' || data.name.trim() === '') {
      errors.push('Medicine name is required');
    } else if (data.name.trim().length > 255) {
      errors.push('Medicine name must not exceed 255 characters');
    }

    // Price validation
    if (data.unit_price === null || data.unit_price === '') {
      errors.push('Unit price cannot be empty');
    } else if (data.unit_price !== undefined) {
      const price = parseDecimal(data.unit_price);
      if (price === null) {
        errors.push('Unit price must be a valid number');
      } else if (price < 0) {
        errors.push('Unit price cannot be negative');
      } else if (price > 99999999.99 || !hasMoneyPrecision(price)) {
        errors.push('Unit price must not exceed 99,999,999.99 and may have at most 2 decimal places');
      }
    }

    // Quantity validation
    if (data.quantity === null || data.quantity === '') {
      errors.push('Quantity cannot be empty');
    } else if (data.quantity !== undefined) {
      const quantity = parseInteger(data.quantity);
      if (quantity === null) {
        errors.push('Quantity must be a valid number');
      } else if (quantity < 0) {
        errors.push('Quantity cannot be negative');
      } else if (quantity > 2147483647) {
        errors.push('Quantity is too large');
      }
    }

    // Expiry date validation
    if (!data.expiry_date) {
      errors.push('Expiry date is required');
    } else {
      if (!isIsoDate(data.expiry_date)) errors.push('Expiry date must be a valid date in YYYY-MM-DD format');
      else if (data.expiry_date < todayInTimeZone()) errors.push('Expiry date cannot be in the past');
    }

    // Min stock level validation
    if (data.min_stock_level !== undefined && data.min_stock_level !== null) {
      const minStock = parseInteger(data.min_stock_level);
      if (minStock === null) {
        errors.push('Minimum stock level must be a valid number');
      } else if (minStock < 0) {
        errors.push('Minimum stock level cannot be negative');
      } else if (minStock > 2147483647) {
        errors.push('Minimum stock level is too large');
      }
    }

    optionalText(data, 'description', 'Description', 5000, errors);
    optionalText(data, 'generic_name', 'Generic name', 255, errors);
    optionalText(data, 'manufacturer', 'Manufacturer', 255, errors);
    optionalText(data, 'category', 'Category', 100, errors);
    optionalText(data, 'batch_number', 'Batch number', 100, errors);
    if (parseInteger(data.quantity) > 0 && (typeof data.batch_number !== 'string' || !data.batch_number.trim())) {
      errors.push('Batch number is required when opening quantity is greater than zero');
    }

    if (errors.length > 0) {
      throw new ApiError(errors.join('; '), 400);
    }

    return {
      name: data.name.trim(),
      description: data.description ? data.description.trim() : null,
      generic_name: data.generic_name ? data.generic_name.trim() : null,
      manufacturer: data.manufacturer ? data.manufacturer.trim() : null,
      category: data.category ? data.category.trim() : null,
      batch_number: data.batch_number ? data.batch_number.trim() : null,
      quantity: data.quantity === undefined ? 0 : parseInteger(data.quantity),
      unit_price: data.unit_price === undefined ? 0 : parseDecimal(data.unit_price),
      expiry_date: data.expiry_date,
      min_stock_level: data.min_stock_level === undefined || data.min_stock_level === null || data.min_stock_level === ''
        ? 10
        : parseInteger(data.min_stock_level)
    };
  }

  // Validate medicine update data
  static validateUpdate(id, data = {}) {
    // Check ID is valid
    parsePositiveInteger(id, 'medicine ID');
    if (!data || typeof data !== 'object' || Array.isArray(data)) data = {};

    const errors = [];

    // Validate fields if provided
    if (data.name !== undefined) {
      if (typeof data.name !== 'string' || data.name.trim() === '') {
        errors.push('Medicine name cannot be empty');
      } else if (data.name.trim().length > 255) {
        errors.push('Medicine name must not exceed 255 characters');
      }
    }

    if (data.unit_price === null || data.unit_price === '') {
      errors.push('Unit price cannot be empty');
    } else if (data.unit_price !== undefined) {
      const price = parseDecimal(data.unit_price);
      if (price === null) {
        errors.push('Unit price must be a valid number');
      } else if (price < 0) {
        errors.push('Unit price cannot be negative');
      } else if (price > 99999999.99 || !hasMoneyPrecision(price)) {
        errors.push('Unit price must not exceed 99,999,999.99 and may have at most 2 decimal places');
      }
    }

    if (data.quantity !== undefined) {
      errors.push('Quantity cannot be edited directly; use the stock adjustment workflow');
    }

    if (data.expiry_date === null || data.expiry_date === '') {
      errors.push('Expiry date cannot be empty');
    } else if (data.expiry_date !== undefined) {
      if (!isIsoDate(data.expiry_date)) errors.push('Expiry date must be a valid date in YYYY-MM-DD format');
      else if (data.expiry_date < todayInTimeZone()) errors.push('Expiry date cannot be in the past');
    }

    if (data.min_stock_level === null || data.min_stock_level === '') {
      errors.push('Minimum stock level cannot be empty');
    } else if (data.min_stock_level !== undefined) {
      const minStock = parseInteger(data.min_stock_level);
      if (minStock === null) {
        errors.push('Minimum stock level must be a valid number');
      } else if (minStock < 0) {
        errors.push('Minimum stock level cannot be negative');
      } else if (minStock > 2147483647) {
        errors.push('Minimum stock level is too large');
      }
    }

    optionalText(data, 'description', 'Description', 5000, errors);
    optionalText(data, 'generic_name', 'Generic name', 255, errors);
    optionalText(data, 'manufacturer', 'Manufacturer', 255, errors);
    optionalText(data, 'category', 'Category', 100, errors);
    optionalText(data, 'batch_number', 'Batch number', 100, errors);

    if (errors.length > 0) {
      throw new ApiError(errors.join('; '), 400);
    }

    // Build update data (only include provided values)
    const updateData = {};
    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.description !== undefined) updateData.description = data.description ? data.description.trim() : null;
    if (data.generic_name !== undefined) updateData.generic_name = data.generic_name ? data.generic_name.trim() : null;
    if (data.manufacturer !== undefined) updateData.manufacturer = data.manufacturer ? data.manufacturer.trim() : null;
    if (data.category !== undefined) updateData.category = data.category ? data.category.trim() : null;
    if (data.batch_number !== undefined) updateData.batch_number = data.batch_number ? data.batch_number.trim() : null;
    if (data.unit_price !== undefined) updateData.unit_price = parseDecimal(data.unit_price);
    if (data.expiry_date !== undefined) updateData.expiry_date = data.expiry_date;
    if (data.min_stock_level !== undefined) updateData.min_stock_level = parseInteger(data.min_stock_level);

    return updateData;
  }
}

module.exports = MedicineValidator;
