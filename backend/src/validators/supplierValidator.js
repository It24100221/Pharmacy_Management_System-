const ApiError = require('../middleware/errorHandler');

class SupplierValidator {
  // Simple email validation regex
  static isValidEmail(email) {
    if (!email) return true; // Email is optional
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Validate supplier creation data
  static validateCreate(data) {
    const errors = [];

    // Company name is required
    if (!data.company_name || data.company_name.trim() === '') {
      errors.push('Company name is required');
    }

    // Contact person (optional)
    if (data.contact_person && data.contact_person.trim() === '') {
      errors.push('Contact person cannot be empty');
    }

    // Email validation (if provided)
    if (data.email && data.email.trim() !== '') {
      if (!this.isValidEmail(data.email.trim())) {
        errors.push('Invalid email format');
      }
    }

    // Phone validation (optional but should be valid if provided)
    if (data.phone && data.phone.trim() === '') {
      errors.push('Phone cannot be empty');
    }

    if (errors.length > 0) {
      throw new ApiError(errors.join('; '), 400);
    }

    return {
      company_name: data.company_name.trim(),
      contact_person: data.contact_person ? data.contact_person.trim() : null,
      email: data.email ? data.email.trim() : null,
      phone: data.phone ? data.phone.trim() : null,
      address: data.address ? data.address.trim() : null
    };
  }

  // Validate supplier update data
  static validateUpdate(id, data) {
    // Check ID is valid
    const supplierId = parseInt(id);
    if (isNaN(supplierId) || supplierId <= 0) {
      throw new ApiError('Invalid supplier ID', 400);
    }

    const errors = [];

    // Company name is required
    if (!data.company_name || data.company_name.trim() === '') {
      errors.push('Company name is required');
    }

    // Email validation (if provided)
    if (data.email !== undefined && data.email !== null) {
      if (data.email && data.email.trim() !== '') {
        if (!this.isValidEmail(data.email.trim())) {
          errors.push('Invalid email format');
        }
      }
    }

    if (errors.length > 0) {
      throw new ApiError(errors.join('; '), 400);
    }

    // Build update data
    const updateData = {};
    if (data.company_name !== undefined) updateData.company_name = data.company_name.trim();
    if (data.contact_person !== undefined) updateData.contact_person = data.contact_person ? data.contact_person.trim() : null;
    if (data.email !== undefined) updateData.email = data.email ? data.email.trim() : null;
    if (data.phone !== undefined) updateData.phone = data.phone ? data.phone.trim() : null;
    if (data.address !== undefined) updateData.address = data.address ? data.address.trim() : null;

    return updateData;
  }
}

module.exports = SupplierValidator;
