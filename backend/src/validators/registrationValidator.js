const ApiError = require('../middleware/errorHandler');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[A-Za-z0-9._-]{3,50}$/;
const PHONE_PATTERN = /^\+?[0-9][0-9 ()-]{5,18}[0-9]$/;

class RegistrationValidator {
  static validate(data = {}) {
    const name = String(data.name || '').trim().replace(/\s+/g, ' ');
    const email = String(data.email || '').trim().toLowerCase();
    const phone = String(data.phone || '').trim();
    const address = String(data.address || '').trim().replace(/\s+/g, ' ');
    const username = String(data.username || '').trim();
    const password = String(data.password || '');
    const confirmPassword = data.confirmPassword === undefined ? password : String(data.confirmPassword);
    const errors = [];

    if (name.length < 2 || name.length > 200) errors.push('Full name must be between 2 and 200 characters');
    if (!EMAIL_PATTERN.test(email) || email.length > 255) errors.push('A valid email address is required');
    if (!PHONE_PATTERN.test(phone) || (phone.match(/\d/g) || []).length < 7) errors.push('A valid phone number is required');
    if (!address || address.length > 1000) errors.push('Address is required and must not exceed 1000 characters');
    if (!USERNAME_PATTERN.test(username)) errors.push('Username must be 3-50 characters using letters, numbers, dot, dash, or underscore');
    if (password.length < 8 || password.length > 128) errors.push('Password must be between 8 and 128 characters');
    if (password !== confirmPassword) errors.push('Passwords do not match');
    if (errors.length) throw new ApiError(errors.join('; '), 400);

    return { name, email, phone, address, username, password };
  }
}

module.exports = RegistrationValidator;
