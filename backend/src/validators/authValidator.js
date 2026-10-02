const ApiError = require('../middleware/errorHandler');

function requiredText(value, label, max) {
  if (typeof value !== 'string' || !value.trim()) throw new ApiError(`${label} is required`, 400);
  const text = value.trim();
  if (text.length > max) throw new ApiError(`${label} is too long`, 400);
  return text;
}

function validateRegistration(body = {}) {
  const fullName = requiredText(body.full_name, 'Full name', 201);
  const parts = fullName.split(/\s+/);
  if (parts.length < 2 || parts[0].length > 100 || parts.slice(1).join(' ').length > 100) {
    throw new ApiError('Enter first and last name', 400);
  }
  const email = requiredText(body.email, 'Email', 255).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError('Enter a valid email', 400);
  const username = requiredText(body.username, 'Username', 100).toLowerCase();
  if (!/^[a-z0-9._-]{3,100}$/.test(username)) throw new ApiError('Username must be 3–100 letters, numbers, dots, underscores or hyphens', 400);
  const phone = requiredText(body.phone, 'Phone number', 50);
  const address = requiredText(body.address, 'Address', 2000);
  const password = requiredText(body.password, 'Password', 200);
  if (password.length < 12) throw new ApiError('Password must be at least 12 characters', 400);
  if (password !== body.confirm_password) throw new ApiError('Passwords do not match', 400);
  return { first_name: parts[0], last_name: parts.slice(1).join(' '), email, username, phone, address, password };
}

function validateLogin(body = {}) {
  const identifier = requiredText(body.identifier, 'Username or email', 255).toLowerCase();
  const password = requiredText(body.password, 'Password', 200);
  return { identifier, password };
}

module.exports = { validateRegistration, validateLogin };
