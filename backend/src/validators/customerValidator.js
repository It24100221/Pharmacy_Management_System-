const ApiError = require('../middleware/errorHandler');

class CustomerValidator {
  // Simple email validation regex
  static isValidEmail(email) {
    if (!email) return true; // Email is optional
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Validate date of birth
  static isValidDate(dateStr) {
    if (!dateStr) return true; // DOB is optional
    const date = new Date(dateStr);
    return !isNaN(date.getTime());
  }

  // Validate customer creation data
  static validateCreate(data) {
    const errors = [];

    // First name is required
    if (!data.first_name || data.first_name.trim() === '') {
      errors.push('First name is required');
    }

    // Last name is required
    if (!data.last_name || data.last_name.trim() === '') {
      errors.push('Last name is required');
    }

    // Email validation (if provided)
    if (data.email && data.email.trim() !== '') {
      if (!this.isValidEmail(data.email.trim())) {
        errors.push('Invalid email format');
      }
    }

    // Phone (optional but should be valid if provided)
    if (data.phone && data.phone.trim() !== '' && data.phone.trim().length < 5) {
      errors.push('Invalid phone number');
    }

    // Date of birth validation (if provided)
    if (data.date_of_birth && data.date_of_birth.trim() !== '') {
      if (!this.isValidDate(data.date_of_birth)) {
        errors.push('Invalid date of birth format');
      }
    }

    if (errors.length > 0) {
      throw new ApiError(errors.join('; '), 400);
    }

    return {
      first_name: data.first_name.trim(),
      last_name: data.last_name.trim(),
      email: data.email ? data.email.trim() : null,
      phone: data.phone ? data.phone.trim() : null,
      address: data.address ? data.address.trim() : null,
      date_of_birth: data.date_of_birth || null
    };
  }

  // Validate customer update data
  static validateUpdate(id, data) {
    // Check ID is valid
    const customerId = parseInt(id);
    if (isNaN(customerId) || customerId <= 0) {
      throw new ApiError('Invalid customer ID', 400);
    }

    const errors = [];

    // First name is required
    if (!data.first_name || data.first_name.trim() === '') {
      errors.push('First name is required');
    }

    // Last name is required
    if (!data.last_name || data.last_name.trim() === '') {
      errors.push('Last name is required');
    }

    // Email validation (if provided)
    if (data.email !== undefined && data.email !== null) {
      if (data.email && data.email.trim() !== '') {
        if (!this.isValidEmail(data.email.trim())) {
          errors.push('Invalid email format');
        }
      }
    }

    // Date of birth validation (if provided)
    if (data.date_of_birth !== undefined && data.date_of_birth !== null) {
      if (data.date_of_birth && data.date_of_birth.trim() !== '') {
        if (!this.isValidDate(data.date_of_birth)) {
          errors.push('Invalid date of birth format');
        }
      }
    }

    if (errors.length > 0) {
      throw new ApiError(errors.join('; '), 400);
    }

    // Build update data
    const updateData = {};
    if (data.first_name !== undefined) updateData.first_name = data.first_name.trim();
    if (data.last_name !== undefined) updateData.last_name = data.last_name.trim();
    if (data.email !== undefined) updateData.email = data.email ? data.email.trim() : null;
    if (data.phone !== undefined) updateData.phone = data.phone ? data.phone.trim() : null;
    if (data.address !== undefined) updateData.address = data.address ? data.address.trim() : null;
    if (data.date_of_birth !== undefined) updateData.date_of_birth = data.date_of_birth || null;

    return updateData;
  }
}

module.exports = CustomerValidator;
