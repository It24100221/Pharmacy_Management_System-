const ApiError = require('../middleware/errorHandler');
const { isIsoDate, parsePositiveInteger } = require('../utils/requestValidation');

const PHONE_PATTERN = /^\d{10}$/;
const text = (value, label, max, required, errors) => {
  if (value === undefined || value === null || value === '') {
    if (required) errors.push(`${label} is required`);
    return null;
  }
  if (typeof value !== 'string') {
    errors.push(`${label} must be text`);
    return null;
  }
  const normalized = value.trim();
  if (!normalized && required) errors.push(`${label} is required`);
  if (normalized.length > max) errors.push(`${label} must not exceed ${max} characters`);
  return normalized || null;
};

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
    return isIsoDate(dateStr) && dateStr <= new Date().toISOString().slice(0, 10);
  }

  // Validate customer creation data
  static validateCreate(data = {}) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) data = {};
    const errors = [];
    const firstName = text(data.first_name, 'First name', 100, true, errors);
    const lastName = text(data.last_name, 'Last name', 100, true, errors);

    // First name is required
    // Email validation (if provided)
    if (data.email !== undefined && data.email !== null && typeof data.email !== 'string') {
      errors.push('Email must be text');
    } else if (data.email && data.email.trim() !== '') {
      if (!this.isValidEmail(data.email.trim())) {
        errors.push('Invalid email format');
      }
      if (data.email.trim().length > 255) errors.push('Email must not exceed 255 characters');
    }

    // Phone (optional but should be valid if provided)
    if (data.phone !== undefined && data.phone !== null && data.phone !== '' &&
        (typeof data.phone !== 'string' || !PHONE_PATTERN.test(data.phone.trim()))) errors.push('Phone number must contain exactly 10 digits');
    if (data.address !== undefined && data.address !== null && typeof data.address !== 'string') errors.push('Address must be text');
    if (typeof data.address === 'string' && data.address.trim().length > 1000) errors.push('Address must not exceed 1000 characters');

    // Date of birth validation (if provided)
    if (data.date_of_birth !== undefined && data.date_of_birth !== null && typeof data.date_of_birth !== 'string') {
      errors.push('Date of birth must use YYYY-MM-DD');
    } else if (data.date_of_birth && data.date_of_birth.trim() !== '') {
      if (!this.isValidDate(data.date_of_birth)) {
        errors.push('Date of birth must be a valid, non-future date in YYYY-MM-DD format');
      }
    }

    if (errors.length > 0) {
      throw new ApiError(errors.join('; '), 400);
    }

    return {
      first_name: firstName,
      last_name: lastName,
      email: data.email ? data.email.trim() : null,
      phone: data.phone ? data.phone.trim() : null,
      address: data.address ? data.address.trim() : null,
      date_of_birth: data.date_of_birth || null
    };
  }

  // Validate customer update data
  static validateUpdate(id, data = {}) {
    // Check ID is valid
    parsePositiveInteger(id, 'customer ID');
    if (!data || typeof data !== 'object' || Array.isArray(data)) data = {};

    const errors = [];

    // First name is required
    const firstName = text(data.first_name, 'First name', 100, true, errors);
    const lastName = text(data.last_name, 'Last name', 100, true, errors);

    // Email validation (if provided)
    if (data.email !== undefined && data.email !== null && typeof data.email !== 'string') {
      errors.push('Email must be text');
    } else if (data.email !== undefined && data.email !== null) {
      if (data.email && data.email.trim() !== '') {
        if (!this.isValidEmail(data.email.trim())) {
          errors.push('Invalid email format');
        }
      }
      if (data.email.trim().length > 255) errors.push('Email must not exceed 255 characters');
    }

    if (data.phone !== undefined && data.phone !== null && data.phone !== '' &&
        (typeof data.phone !== 'string' || !PHONE_PATTERN.test(data.phone.trim()))) errors.push('Phone number must contain exactly 10 digits');
    if (data.address !== undefined && data.address !== null && typeof data.address !== 'string') errors.push('Address must be text');
    if (typeof data.address === 'string' && data.address.trim().length > 1000) errors.push('Address must not exceed 1000 characters');

    // Date of birth validation (if provided)
    if (data.date_of_birth !== undefined && data.date_of_birth !== null && typeof data.date_of_birth !== 'string') {
      errors.push('Date of birth must use YYYY-MM-DD');
    } else if (data.date_of_birth !== undefined && data.date_of_birth !== null) {
      if (data.date_of_birth && data.date_of_birth.trim() !== '') {
        if (!this.isValidDate(data.date_of_birth)) {
          errors.push('Date of birth must be a valid, non-future date in YYYY-MM-DD format');
        }
      }
    }

    if (errors.length > 0) {
      throw new ApiError(errors.join('; '), 400);
    }

    // Build update data
    const updateData = {};
    if (data.first_name !== undefined) updateData.first_name = firstName;
    if (data.last_name !== undefined) updateData.last_name = lastName;
    if (data.email !== undefined) updateData.email = data.email ? data.email.trim() : null;
    if (data.phone !== undefined) updateData.phone = data.phone ? data.phone.trim() : null;
    if (data.address !== undefined) updateData.address = data.address ? data.address.trim() : null;
    if (data.date_of_birth !== undefined) updateData.date_of_birth = data.date_of_birth || null;

    return updateData;
  }
}

module.exports = CustomerValidator;
