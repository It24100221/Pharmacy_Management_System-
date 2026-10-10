const test = require('node:test');
const assert = require('node:assert/strict');
const { allocateFefo } = require('../src/services/stockAllocation');

const base = (overrides = {}) => ({ is_active: 1, quantity_available: 0, expiry_date: '2027-01-01', ...overrides });

test('allocates one eligible batch', () => {
  const result = allocateFefo({ medicineName: 'A', requestedQuantity: 4, aggregateQuantity: 4, batches: [base({ batch_id: 3, quantity_available: 4 })], today: '2026-10-09' });
  assert.deepEqual(result.allocation, [{ batchId: 3, quantity: 4 }]);
  assert.equal(result.legacyUnallocated, 0);
});

test('allocates across batches in expiry then id order', () => {
  const result = allocateFefo({ medicineName: 'A', requestedQuantity: 8, aggregateQuantity: 10, batches: [
    base({ batch_id: 8, quantity_available: 3, expiry_date: '2027-03-01' }),
    base({ batch_id: 4, quantity_available: 5, expiry_date: '2027-01-01' }),
  ], today: '2026-10-09' });
  assert.deepEqual(result.allocation.map(item => item.quantity), [5, 3]);
});

test('excludes expired and inactive batches and keeps legacy remainder explicit', () => {
  const result = allocateFefo({ medicineName: 'A', requestedQuantity: 3, aggregateQuantity: 8, batches: [
    base({ batch_id: 1, quantity_available: 4, expiry_date: '2026-10-01' }),
    base({ batch_id: 2, quantity_available: 1, is_active: 0 }),
  ], today: '2026-10-09' });
  assert.deepEqual(result.allocation, [{ batchId: null, quantity: 3 }]);
  assert.equal(result.legacyUnallocated, 3);
});

test('rejects insufficient eligible and legacy stock', () => {
  assert.throws(() => allocateFefo({ medicineName: 'A', requestedQuantity: 2, aggregateQuantity: 1, batches: [], today: '2026-10-09' }), /Insufficient eligible stock/);
});

test('rejects aggregate/batch reconciliation mismatch', () => {
  assert.throws(() => allocateFefo({ medicineName: 'A', requestedQuantity: 1, aggregateQuantity: 1, batches: [base({ batch_id: 1, quantity_available: 2 })], today: '2026-10-09' }), /reconciliation required/);
});
