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
    product_code: 'P008',
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
      product_code: 'P008',
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
    error => error.statusCode === 400 && /Quantity must be/.test(error.message)
  );
});

test('product creation requires a permanent code and supports non-expiring non-medicine items', () => {
  assert.throws(() => MedicineValidator.validateCreate({ name: 'Test', product_type: 'Baby Items' }),
    error => error.statusCode === 400 && /Product ID/.test(error.message));
  const item = MedicineValidator.validateCreate({ name: 'Baby Cream', product_code: 'B001', product_type: 'Baby Items',
    quantity: 2, unit_price: 200, requires_prescription: false });
  assert.equal(item.expiry_date, null);
  assert.equal(item.product_code, 'B001');
  assert.equal(item.requires_prescription, false);
});

test('product ID is immutable and URLs are restricted to safe image references', () => {
  assert.throws(() => MedicineValidator.validateUpdate(1, { product_code: 'P999' }), /cannot be changed/);
  assert.throws(() => MedicineValidator.validateCreate({ name: 'Cream', product_code: 'B001',
    product_type: 'Baby Items', image_url: 'javascript:alert(1)' }), /Image URL/);
});
