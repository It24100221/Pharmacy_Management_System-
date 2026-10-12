const test = require('node:test');
const assert = require('node:assert/strict');
const MedicineValidator = require('../src/validators/medicineValidator');
const customerController = require('../src/controllers/customerController');
const customerRepository = require('../src/repositories/customerRepository');
const { todayInTimeZone } = require('../src/utils/requestValidation');

const invoke = (handler, req) => new Promise((resolve, reject) => {
  const res = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; resolve({ res: this, body }); return this; },
  };
  Promise.resolve(handler(req, res, error => error ? reject(error) : resolve({ res, body: res.body }))).catch(reject);
});

test('medicine creation accepts today and rejects past or impossible expiry dates', () => {
  const today = todayInTimeZone();
  const valid = { name: 'Expiry test', quantity: 0, expiry_date: today };
  assert.equal(MedicineValidator.validateCreate(valid).expiry_date, today);
  assert.throws(() => MedicineValidator.validateCreate({ ...valid, expiry_date: '2000-01-01' }), /cannot be in the past/);
  assert.throws(() => MedicineValidator.validateCreate({ ...valid, expiry_date: '2026-02-30' }), /valid date/);
});

test('customer delete endpoint reports safe deactivation', async () => {
  const original = customerRepository.remove;
  customerRepository.remove = async id => { assert.equal(id, 42); return { deactivated: true }; };
  try {
    const result = await invoke(customerController.deleteCustomer, { params: { id: '42' } });
    assert.equal(result.res.statusCode, 200);
    assert.equal(result.body.message, 'Customer deactivated successfully');
  } finally {
    customerRepository.remove = original;
  }
});
