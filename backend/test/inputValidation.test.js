const test = require('node:test');
const assert = require('node:assert/strict');
const CustomerValidator = require('../src/validators/customerValidator');
const PrescriptionValidator = require('../src/validators/prescriptionValidator');
const RegistrationValidator = require('../src/validators/registrationValidator');
const SalesValidator = require('../src/validators/salesValidator');
const SupplierValidator = require('../src/validators/supplierValidator');

const isClientError = error => error.statusCode === 400;

test('customer validation rejects wrong types, invalid phones, and impossible dates', () => {
  assert.throws(() => CustomerValidator.validateCreate({ first_name: 123, last_name: 'User' }), isClientError);
  assert.throws(() => CustomerValidator.validateCreate({ first_name: 'Test', last_name: 'User', address: {} }), isClientError);
  assert.throws(() => CustomerValidator.validateCreate({ first_name: 'Test', last_name: 'User', phone: '077-123-4567' }), isClientError);
  assert.throws(() => CustomerValidator.validateCreate({ first_name: 'Test', last_name: 'User', date_of_birth: '2025-02-29' }), isClientError);
});

test('supplier validation rejects wrong optional field types without throwing TypeError', () => {
  assert.throws(() => SupplierValidator.validateCreate({ company_name: 123 }), isClientError);
  assert.throws(() => SupplierValidator.validateCreate({ company_name: 'Supplier', email: {} }), isClientError);
  assert.throws(() => SupplierValidator.validateCreate({ company_name: 'Supplier', address: {} }), isClientError);
});

test('registration rejects non-text identity fields', () => {
  assert.throws(() => RegistrationValidator.validate({
    name: 123,
    email: 'valid@example.com',
    phone: '0771234567',
    address: 'Address',
    username: 'valid-user',
    password: 'password123',
  }), isClientError);
});

test('prescription validation rejects partial numbers, duplicates, malformed items, and wrong text types', () => {
  const base = { customer_id: 1, prescription_date: '2026-10-09' };
  assert.throws(() => PrescriptionValidator.validateCreate({ ...base, items: [null] }), isClientError);
  assert.throws(() => PrescriptionValidator.validateCreate({ ...base, items: [{ medicine_id: 1, quantity: '2abc' }] }), isClientError);
  assert.throws(() => PrescriptionValidator.validateCreate({ ...base, items: [
    { medicine_id: 1, quantity: 1 },
    { medicine_id: '1', quantity: 1 },
  ] }), isClientError);
  assert.throws(() => PrescriptionValidator.validateCreate({ ...base, items: [{ medicine_id: 1, quantity: 1, instructions: {} }] }), isClientError);
});

test('sale cart validation rejects malformed and partial numeric input', () => {
  assert.throws(() => SalesValidator.validateCartItem(null), isClientError);
  assert.throws(() => SalesValidator.validateCartItem({ medicine_id: 1, quantity: '2abc', unit_price: 5 }), isClientError);
});
