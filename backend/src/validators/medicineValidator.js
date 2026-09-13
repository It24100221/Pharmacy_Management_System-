const ApiError = require('../middleware/errorHandler');

class MedicineValidator {
  // Validate medicine creation data
  static validateCreate(data) {
    const errors = [];

    // Name is required
    if (!data.name || data.name.trim() === '') {
      errors.push('Medicine name is required');
    }

    // Price validation
    if (data.unit_price === null || data.unit_price === '') {
      errors.push('Unit price cannot be empty');
    } else if (data.unit_price !== undefined) {
      const price = parseFloat(data.unit_price);
      if (isNaN(price)) {
        errors.push('Unit price must be a valid number');
      } else if (price < 0) {
        errors.push('Unit price cannot be negative');
      }
    }

    // Quantity validation
    if (data.quantity === null || data.quantity === '') {
      errors.push('Quantity cannot be empty');
    } else if (data.quantity !== undefined) {
      const quantity = parseInt(data.quantity);
      if (isNaN(quantity)) {
        errors.push('Quantity must be a valid number');
      } else if (quantity < 0) {
        errors.push('Quantity cannot be negative');
      }
    }

    // Expiry date validation
    if (!data.expiry_date) {
      errors.push('Expiry date is required');
    } else {
      const expiryDate = new Date(data.expiry_date);
      if (isNaN(expiryDate.getTime())) {
        errors.push('Expiry date must be a valid date');
      }
    }

    // Min stock level validation
    if (data.min_stock_level !== undefined && data.min_stock_level !== null) {
      const minStock = parseInt(data.min_stock_level);
      if (isNaN(minStock)) {
        errors.push('Minimum stock level must be a valid number');
      } else if (minStock < 0) {
        errors.push('Minimum stock level cannot be negative');
      }
    }

    // Batch number (optional but should be valid if provided)
    if (data.batch_number && data.batch_number.trim() === '') {
      errors.push('Batch number cannot be empty');
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
      quantity: data.quantity === undefined || data.quantity === null || data.quantity === '' ? 0 : parseInt(data.quantity),
      unit_price: data.unit_price === undefined || data.unit_price === null || data.unit_price === '' ? 0 : parseFloat(data.unit_price),
      expiry_date: data.expiry_date,
      min_stock_level: data.min_stock_level === undefined || data.min_stock_level === null || data.min_stock_level === ''
        ? 10
        : parseInt(data.min_stock_level)
    };
  }

  // Validate medicine update data
  static validateUpdate(id, data) {
    // Check ID is valid
    const medicineId = parseInt(id);
    if (isNaN(medicineId) || medicineId <= 0) {
      throw new ApiError('Invalid medicine ID', 400);
    }

    const errors = [];

    // Validate fields if provided
    if (data.name !== undefined) {
      if (data.name === null) {
        throw new ApiError('Name cannot be set to null', 400);
      }
      if (data.name.trim() === '') {
        errors.push('Medicine name cannot be empty');
      }
    }

    if (data.unit_price === null || data.unit_price === '') {
      errors.push('Unit price cannot be empty');
    } else if (data.unit_price !== undefined) {
      const price = parseFloat(data.unit_price);
      if (isNaN(price)) {
        errors.push('Unit price must be a valid number');
      } else if (price < 0) {
        errors.push('Unit price cannot be negative');
      }
    }

    if (data.quantity === null || data.quantity === '') {
      errors.push('Quantity cannot be empty');
    } else if (data.quantity !== undefined) {
      const quantity = parseInt(data.quantity);
      if (isNaN(quantity)) {
        errors.push('Quantity must be a valid number');
      } else if (quantity < 0) {
        errors.push('Quantity cannot be negative');
      }
    }

    if (data.expiry_date === null || data.expiry_date === '') {
      errors.push('Expiry date cannot be empty');
    } else if (data.expiry_date !== undefined) {
      const expiryDate = new Date(data.expiry_date);
      if (isNaN(expiryDate.getTime())) {
        errors.push('Expiry date must be a valid date');
      }
    }

    if (data.min_stock_level === null || data.min_stock_level === '') {
      errors.push('Minimum stock level cannot be empty');
    } else if (data.min_stock_level !== undefined) {
      const minStock = parseInt(data.min_stock_level);
      if (isNaN(minStock)) {
        errors.push('Minimum stock level must be a valid number');
      } else if (minStock < 0) {
        errors.push('Minimum stock level cannot be negative');
      }
    }

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
    if (data.quantity !== undefined) updateData.quantity = parseInt(data.quantity);
    if (data.unit_price !== undefined) updateData.unit_price = parseFloat(data.unit_price);
    if (data.expiry_date !== undefined) updateData.expiry_date = data.expiry_date;
    if (data.min_stock_level !== undefined) updateData.min_stock_level = parseInt(data.min_stock_level);

    return updateData;
  }
}

module.exports = MedicineValidator;
