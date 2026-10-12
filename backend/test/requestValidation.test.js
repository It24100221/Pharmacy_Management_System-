const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isIsoDate,
  parseDateRange,
  parsePagination,
  parsePositiveInteger,
  parseRecentLimit,
  parseSearch,
} = require('../src/utils/requestValidation');

test('positive identifiers reject partial, fractional, zero, and unsafe values', () => {
  for (const value of ['1abc', '1.5', 1.5, 0, -1, 2147483648, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => parsePositiveInteger(value, 'record ID'), error => error.statusCode === 400);
  }
  assert.equal(parsePositiveInteger('42', 'record ID'), 42);
});

test('pagination and recent limits are bounded', () => {
  assert.deepEqual(parsePagination({}), { page: 1, limit: 50, pagination: true });
  assert.deepEqual(parsePagination({ page: '2', limit: '25', pagination: 'false' }), { page: 2, limit: 25, pagination: false });
  for (const query of [{ page: '-1' }, { page: '1.5' }, { limit: '101' }, { limit: '1abc' }]) {
    assert.throws(() => parsePagination(query), error => error.statusCode === 400);
  }
  assert.throws(() => parseRecentLimit('101'), error => error.statusCode === 400);
});

test('date ranges require real ISO dates in chronological order', () => {
  assert.equal(isIsoDate('2028-02-29'), true);
  assert.equal(isIsoDate('2027-02-29'), false);
  assert.throws(() => parseDateRange('not-a-date', undefined), error => error.statusCode === 400);
  assert.throws(() => parseDateRange('2099-01-02', '2099-01-01'), error => error.statusCode === 400);
  assert.deepEqual(parseDateRange('2099-01-01', '2099-01-02'), { start_date: '2099-01-01', end_date: '2099-01-02' });
});

test('search rejects wrong types and excessive length', () => {
  assert.equal(parseSearch('  aspirin  '), 'aspirin');
  assert.throws(() => parseSearch({ query: 'aspirin' }), error => error.statusCode === 400);
  assert.throws(() => parseSearch('x'.repeat(101)), error => error.statusCode === 400);
});
