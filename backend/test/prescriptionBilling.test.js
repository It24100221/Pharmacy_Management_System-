const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('fs');
const Module = require('node:module');

test('prescription-sale migration links one sale to one prescription', () => {
  const sql = fs.readFileSync('../database/mssql/migrations/009_prescription_sale_link.sql', 'utf8');
  assert.match(sql, /prescription_id/);
  assert.match(sql, /FK_sales_prescription/);
  assert.match(sql, /UQ_sales_prescription/);
});

test('sales validator preserves a valid prescription reference and rejects malformed references', () => {
  const SalesValidator = require('../src/validators/salesValidator');
  const valid = SalesValidator.validateCreate({ prescription_id: 42, customer_id: 7, items: [{ medicine_id: 1, quantity: 2 }], payment_method: 'Cash' });
  assert.equal(valid.prescription_id, 42);
  assert.throws(() => SalesValidator.validateCreate({ prescription_id: '4.2', items: [{ medicine_id: 1, quantity: 1 }] }), /Invalid prescription ID/);
});

test('prescription status transition rejects dispensing a rejected prescription', async () => {
  const databasePath = require.resolve('../src/config/database');
  const originalDatabase = require.cache[databasePath];
  const stub = new Module(databasePath); stub.filename = databasePath; stub.loaded = true;
  const state = { status: 'REJECTED', committed: 0, rolledBack: 0, released: 0 };
  const connection = {
    async beginTransaction() {},
    async commit() { state.committed += 1; },
    async rollback() { state.rolledBack += 1; },
    release() { state.released += 1; },
    async execute(query) {
      if (query.includes('SELECT id, status')) return [[{ id: 1, status: state.status, customer_id: 9 }]];
      return [{}];
    },
  };
  stub.exports = { pool: { async getConnection() { return connection; } } };
  require.cache[databasePath] = stub;
  const repositoryPath = require.resolve('../src/repositories/prescriptionRepository');
  delete require.cache[repositoryPath];
  const repository = require(repositoryPath);
  repository.findById = async id => ({ id, status: state.status });
  try {
    await assert.rejects(repository.updateStatus(1, 5, 'DISPENSED'), /Invalid prescription status transition/);
    assert.deepEqual(state, { status: 'REJECTED', committed: 0, rolledBack: 1, released: 1 });
  } finally {
    delete require.cache[repositoryPath];
    if (originalDatabase) require.cache[databasePath] = originalDatabase; else delete require.cache[databasePath];
  }
});

test('authorized pharmacist handoff preserves customer and prescribed quantities', async () => {
  const prescriptionController = require('../src/controllers/prescriptionController');
  const prescriptionRepository = require('../src/repositories/prescriptionRepository');
  const original = {
    findById: prescriptionRepository.findById,
    checkAvailability: prescriptionRepository.checkAvailability,
    prepareForBilling: prescriptionRepository.prepareForBilling,
  };
  prescriptionRepository.findById = async id => ({
    id,
    customer_id: 21,
    first_name: 'Synthetic',
    last_name: 'Customer',
    customer_phone: '0770000000',
    customer_email: 'synthetic@example.test',
    prescription_date: '2026-10-10',
    status: 'APPROVED',
  });
  prescriptionRepository.checkAvailability = async () => [
    { medicine_id: 11, product_code: 'AMX-500', medicine_name: 'Amoxicillin', generic_name: 'amoxicillin', batch_number: 'B-11', requested_quantity: 3, unit_price: 100, availability_status: 'available' },
    { medicine_id: 12, product_code: 'PCM-500', medicine_name: 'Paracetamol', generic_name: 'paracetamol', batch_number: 'B-12', requested_quantity: 1, unit_price: 50, availability_status: 'available' },
  ];
  prescriptionRepository.prepareForBilling = async () => ({ status: 'READY_FOR_BILLING' });
  try {
    const result = await new Promise((resolve, reject) => {
      const res = {
        statusCode: 200,
        status(code) { this.statusCode = code; return this; },
        json(body) { resolve({ res: this, body }); },
      };
      prescriptionController.sendToBilling(
        { params: { id: '44' }, user: { userId: 7, role: 'PHARMACIST' } },
        res,
        reject,
      );
    });
    assert.equal(result.res.statusCode, 200);
    assert.equal(result.body.data.prescription_id, 44);
    assert.equal(result.body.data.prescription_status, 'READY_FOR_BILLING');
    assert.equal(result.body.data.customer.id, 21);
    assert.deepEqual(result.body.data.items.map(item => ({ medicine_id: item.medicine_id, quantity: item.requested_quantity })), [
      { medicine_id: 11, quantity: 3 },
      { medicine_id: 12, quantity: 1 },
    ]);
  } finally {
    Object.assign(prescriptionRepository, original);
  }
});
