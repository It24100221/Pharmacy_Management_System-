const ApiError = require('../middleware/errorHandler');
const { parsePositiveInteger } = require('../utils/requestValidation');

class SupplierValidator {
  // Simple email validation regex
  static isValidEmail(email) {
    if (!email) return true; // Email is optional
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static isValidPhone(phone) {
    if (phone === undefined || phone === null || phone === '') return true;
    if (typeof phone !== 'string') return false;

    const value = phone.trim();
    if (!value) return true;
    return /^\d{10}$/.test(value);
  }

  // Validate supplier creation data
  static validateCreate(data = {}) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) data = {};
    const errors = [];

    // Company name is required
    if (typeof data.company_name !== 'string' || data.company_name.trim() === '') {
      errors.push('Company name is required');
    } else if (data.company_name.trim().length > 255) {
      errors.push('Company name must not exceed 255 characters');
    }

    // Contact person (optional)
    if (data.contact_person !== undefined && data.contact_person !== null && typeof data.contact_person !== 'string') errors.push('Contact person must be text');

    // Email validation (if provided)
    if (data.email !== undefined && data.email !== null && typeof data.email !== 'string') {
      errors.push('Email must be text');
    } else if (data.email && data.email.trim() !== '') {
      if (!this.isValidEmail(data.email.trim())) {
        errors.push('Invalid email format');
      }
    }

    // Phone is optional, but must be a valid Sri Lankan number when supplied.
    if (!this.isValidPhone(data.phone)) {
      errors.push('Phone number must contain exactly 10 digits');
    }

    if (data.address !== undefined && data.address !== null && typeof data.address !== 'string') errors.push('Address must be text');
    if (typeof data.address === 'string' && data.address.trim().length > 5000) errors.push('Address must not exceed 5000 characters');

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
  static validateUpdate(id, data = {}) {
    // Check ID is valid
    parsePositiveInteger(id, 'supplier ID');
    if (!data || typeof data !== 'object' || Array.isArray(data)) data = {};

    const errors = [];

    // Company name is required
    if (typeof data.company_name !== 'string' || data.company_name.trim() === '') {
      errors.push('Company name is required');
    } else if (data.company_name.trim().length > 255) {
      errors.push('Company name must not exceed 255 characters');
    }

    // Email validation (if provided)
    if (data.email !== undefined && data.email !== null && typeof data.email !== 'string') {
      errors.push('Email must be text');
    } else if (data.email !== undefined && data.email !== null) {
      if (data.email && data.email.trim() !== '') {
        if (!this.isValidEmail(data.email.trim())) {
          errors.push('Invalid email format');
        }
      }
    }

    if (data.contact_person !== undefined && data.contact_person !== null && typeof data.contact_person !== 'string') errors.push('Contact person must be text');

    if (!this.isValidPhone(data.phone)) {
      errors.push('Phone number must contain exactly 10 digits');
    }

    if (data.address !== undefined && data.address !== null && typeof data.address !== 'string') errors.push('Address must be text');
    if (typeof data.address === 'string' && data.address.trim().length > 5000) errors.push('Address must not exceed 5000 characters');

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
