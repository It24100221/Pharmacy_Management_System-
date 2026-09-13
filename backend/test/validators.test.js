const test = require('node:test');
const assert = require('node:assert/strict');

const MedicineValidator = require('../src/validators/medicineValidator');
const SalesValidator = require('../src/validators/salesValidator');

test('sale validation accepts items without a client-provided price', () => {
  const result = SalesValidator.validateCreate({
    customer_id: '2',
    items: [{ medicine_id: '4', quantity: '3' }],
    discount: '25.50',
    payment_method: 'Online'
  });

  assert.deepEqual(result.items, [{ medicine_id: 4, quantity: 3 }]);
  assert.equal(result.customer_id, 2);
  assert.equal(result.discount, 25.5);
  assert.equal(result.payment_method, 'Online');
  assert.equal(Object.hasOwn(result.items[0], 'unit_price'), false);
});

test('sale validation rejects duplicate medicine lines', () => {
  assert.throws(
    () => SalesValidator.validateCreate({
      items: [
        { medicine_id: 1, quantity: 2 },
        { medicine_id: '1', quantity: 3 }
      ]
    }),
    error => error.statusCode === 400 && /Duplicate medicine lines/.test(error.message)
  );
});

test('sale validation rejects unsupported payment methods', () => {
  assert.throws(
    () => SalesValidator.validateCreate({
      items: [{ medicine_id: 1, quantity: 1 }],
      payment_method: 'Bank Transfer'
    }),
    error => error.statusCode === 400 && /Invalid payment method/.test(error.message)
  );
});

test('medicine creation preserves explicit zero values', () => {
  const result = MedicineValidator.validateCreate({
    name: 'Test Medicine',
    expiry_date: '2027-01-01',
    quantity: 0,
    unit_price: 0,
    min_stock_level: 0
  });

  assert.equal(result.quantity, 0);
  assert.equal(result.unit_price, 0);
  assert.equal(result.min_stock_level, 0);
});

test('medicine creation rejects an invalid expiry date', () => {
  assert.throws(
    () => MedicineValidator.validateCreate({
      name: 'Test Medicine',
      expiry_date: 'not-a-date'
    }),
    error => error.statusCode === 400 && /valid date/.test(error.message)
  );
});

test('medicine update permits optional fields to be cleared but rejects null required values', () => {
  const result = MedicineValidator.validateUpdate(1, {
    name: 'Medicine',
    description: '',
    generic_name: null,
    quantity: 0,
    unit_price: 0,
    expiry_date: '2027-01-01',
    min_stock_level: 0
  });

  assert.equal(result.description, null);
  assert.equal(result.generic_name, null);
  assert.equal(result.quantity, 0);
  assert.equal(result.min_stock_level, 0);
  assert.throws(
    () => MedicineValidator.validateUpdate(1, { name: 'Medicine', quantity: null }),
    error => error.statusCode === 400 && /Quantity cannot be empty/.test(error.message)
  );
});
