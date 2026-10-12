const test = require('node:test');
const assert = require('node:assert/strict');

const MedicineValidator = require('../src/validators/medicineValidator');
const SalesValidator = require('../src/validators/salesValidator');
const RegistrationValidator = require('../src/validators/registrationValidator');
const SupplierValidator = require('../src/validators/supplierValidator');
const PurchaseValidator = require('../src/validators/purchaseValidator');

test('customer registration trims and normalizes all identity fields', () => {
  const result = RegistrationValidator.validate({
    name: '  Maya   Perera ', email: ' Maya@Example.COM ', phone: '+94 77 123 4567',
    address: '  10   Main Street ', username: ' maya.perera ', password: 'securepass', confirmPassword: 'securepass'
  });
  assert.deepEqual(result, {
    name: 'Maya Perera', email: 'maya@example.com', phone: '+94 77 123 4567',
    address: '10 Main Street', username: 'maya.perera', password: 'securepass'
  });
});

test('customer registration rejects invalid and blank required values', () => {
  const valid = { name: 'Maya Perera', email: 'maya@example.com', phone: '+94771234567', address: '10 Main Street', username: 'maya', password: 'securepass', confirmPassword: 'securepass' };
  for (const patch of [
    { email: 'invalid' }, { phone: '12' }, { name: ' ' }, { address: ' ' },
    { username: 'x' }, { password: 'short', confirmPassword: 'short' }, { confirmPassword: 'different' }
  ]) {
    assert.throws(() => RegistrationValidator.validate({ ...valid, ...patch }), error => error.statusCode === 400);
  }
});

test('supplier validation accepts exactly 10 digits', () => {
  for (const phone of ['0772657543', '0112345678', '1234567890']) {
    const result = SupplierValidator.validateCreate({ company_name: 'Supplier', phone });
    assert.equal(result.phone, phone);
  }
});

test('supplier validation rejects phone numbers that are not exactly 10 digits', () => {
  for (const phone of ['772657543', '07726575433', '077-265-7543', '077ABC7543', '+94772657543']) {
    assert.throws(
      () => SupplierValidator.validateCreate({ company_name: 'Supplier', phone }),
      error => error.statusCode === 400 && /exactly 10 digits/.test(error.message)
    );
    assert.throws(
      () => SupplierValidator.validateUpdate(1, { company_name: 'Supplier', phone }),
      error => error.statusCode === 400 && /exactly 10 digits/.test(error.message)
    );
  }
});

test('purchase validation rejects past dates and accepts today or future dates', () => {
  const purchase = {
    supplier_id: 1,
    items: [{ medicine_id: 1, quantity: 1, unit_cost: 10 }]
  };

  assert.throws(
    () => PurchaseValidator.validateCreate({ ...purchase, purchase_date: '2000-01-01' }),
    error => error.statusCode === 400 && /cannot be in the past/.test(error.message)
  );
  assert.doesNotThrow(() => PurchaseValidator.validateCreate({
    ...purchase,
    purchase_date: PurchaseValidator.getTodayDate()
  }));
  assert.doesNotThrow(() => PurchaseValidator.validateCreate({ ...purchase, purchase_date: '2099-12-31' }));
});

test('purchase batch fields must be paired and expiry must be current or future', () => {
  const base = { supplier_id: 1, purchase_date: PurchaseValidator.getTodayDate(), items: [{ medicine_id: 1, quantity: 1, unit_cost: 10 }] };
  assert.throws(() => PurchaseValidator.validateCreate({ ...base, items: [{ ...base.items[0], batch_number: 'B-1' }] }), /provided together/);
  assert.throws(() => PurchaseValidator.validateCreate({ ...base, items: [{ ...base.items[0], batch_number: 'B-1', expiry_date: '2000-01-01' }] }), /valid and not in the past/);
  const valid = PurchaseValidator.validateCreate({ ...base, items: [{ ...base.items[0], batch_number: 'B-1', expiry_date: '2099-01-01' }] });
  assert.equal(valid.items[0].batch_number, 'B-1');
});

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

test('medicine update permits optional fields to be cleared but rejects direct quantity edits', () => {
  const result = MedicineValidator.validateUpdate(1, {
    name: 'Medicine',
    description: '',
    generic_name: null,
    unit_price: 0,
    expiry_date: '2027-01-01',
    min_stock_level: 0
  });

  assert.equal(result.description, null);
  assert.equal(result.generic_name, null);
  assert.equal(result.min_stock_level, 0);
  assert.throws(
    () => MedicineValidator.validateUpdate(1, { name: 'Medicine', quantity: 0 }),
    error => error.statusCode === 400 && /stock adjustment workflow/.test(error.message)
  );
});

test('medicine opening stock requires a batch number', () => {
  assert.throws(
    () => MedicineValidator.validateCreate({ name: 'Medicine', quantity: 1, expiry_date: '2099-01-01' }),
    error => error.statusCode === 400 && /Batch number is required/.test(error.message)
  );
});

test('numeric validators reject partial, fractional, and non-finite values', () => {
  assert.throws(
    () => SalesValidator.validateCreate({ items: [{ medicine_id: 1, quantity: '2abc' }] }),
    error => error.statusCode === 400 && /valid number/.test(error.message)
  );
  assert.throws(
    () => SalesValidator.validateCreate({ items: [{ medicine_id: 1, quantity: 1.5 }] }),
    error => error.statusCode === 400 && /valid number/.test(error.message)
  );
  assert.throws(
    () => PurchaseValidator.validateCreate({
      supplier_id: 1,
      purchase_date: '2099-01-01',
      items: [{ medicine_id: 1, quantity: 1.5, unit_cost: 10 }]
    }),
    error => error.statusCode === 400 && /valid number/.test(error.message)
  );
  assert.throws(
    () => MedicineValidator.validateCreate({ name: 'Medicine', unit_price: '1abc', expiry_date: '2099-01-01' }),
    error => error.statusCode === 400 && /valid number/.test(error.message)
  );
});

test('medicine validation handles wrong field types as controlled client errors', () => {
  assert.throws(
    () => MedicineValidator.validateCreate({ name: 123, expiry_date: '2099-01-01' }),
    error => error.statusCode === 400 && /Medicine name is required/.test(error.message)
  );
  assert.throws(
    () => MedicineValidator.validateUpdate(1, { description: { nested: true } }),
    error => error.statusCode === 400 && /must be text/.test(error.message)
  );
});

test('purchase validation rejects duplicate medicine lines', () => {
  assert.throws(
    () => PurchaseValidator.validateCreate({
      supplier_id: 1,
      purchase_date: '2099-01-01',
      items: [
        { medicine_id: 1, quantity: 1, unit_cost: 10 },
        { medicine_id: '1', quantity: 2, unit_cost: 10 }
      ]
    }),
    error => error.statusCode === 400 && /Duplicate medicine lines/.test(error.message)
  );
});

test('database-bound numeric fields reject overflow and excess money precision', () => {
  assert.throws(
    () => MedicineValidator.validateCreate({ name: 'Medicine', quantity: 2147483648, expiry_date: '2099-01-01' }),
    error => error.statusCode === 400 && /too large/.test(error.message)
  );
  assert.throws(
    () => MedicineValidator.validateCreate({ name: 'Medicine', unit_price: 1.001, expiry_date: '2099-01-01' }),
    error => error.statusCode === 400 && /2 decimal places/.test(error.message)
  );
  assert.throws(
    () => PurchaseValidator.validateCreate({
      supplier_id: 1,
      purchase_date: '2099-01-01',
      items: [{ medicine_id: 1, quantity: 1, unit_cost: 100000000 }]
    }),
    error => error.statusCode === 400 && /must not exceed/.test(error.message)
  );
});

test('medicine validation rejects past expiry dates', () => {
  assert.throws(
    () => MedicineValidator.validateCreate({ name: 'Expired', expiry_date: '2000-01-01' }),
    error => error.statusCode === 400 && /cannot be in the past/.test(error.message)
  );
});
