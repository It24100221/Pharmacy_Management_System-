const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

const databasePath = require.resolve('../src/config/database');
const repositoryPath = require.resolve('../src/repositories/billingRepository');
const originalDatabaseModule = require.cache[databasePath];
const databaseStub = new Module(databasePath);
databaseStub.filename = databasePath;
databaseStub.loaded = true;

test.after(() => {
  delete require.cache[repositoryPath];
  if (originalDatabaseModule) require.cache[databasePath] = originalDatabaseModule;
  else delete require.cache[databasePath];
});

function loadBillingRepository({ total = 100, confirmed = 0, existing = null, failInsert = false } = {}) {
  const calls = [];
  const state = { began: 0, committed: 0, rolledBack: 0, released: 0 };
  const connection = {
    async beginTransaction() { state.began += 1; },
    async commit() { state.committed += 1; },
    async rollback() { state.rolledBack += 1; },
    release() { state.released += 1; },
    async execute(query, params = []) {
      calls.push({ query, params });
      if (query.includes('WHERE idempotency_key = ?')) return [[existing].filter(Boolean)];
      if (query.includes('FROM customer_invoices WITH')) return [[{ customer_invoice_id: 5, sale_id: 11, total_amount: total, status: 'UNPAID' }]];
      if (query.includes('SUM(amount)')) return [[{ confirmed_amount: confirmed }]];
      if (query.includes('INSERT INTO customer_payments')) {
        if (failInsert) throw new Error('insert failed');
        return [{ insertId: 19 }];
      }
      if (query.includes('UPDATE customer_invoices')) return [[]];
      if (query.includes('UPDATE sales SET payment_status')) return [[]];
      throw new Error(`Unexpected query: ${query}`);
    }
  };
  const pool = {
    async getConnection() { return connection; },
    async execute(query, params) {
      calls.push({ query, params, outsideTransaction: true });
      return [[{ customer_payment_id: params[0], customer_invoice_id: 5, amount: 20, status: 'CONFIRMED' }]];
    }
  };
  databaseStub.exports = { pool };
  require.cache[databasePath] = databaseStub;
  delete require.cache[repositoryPath];
  return { repository: require(repositoryPath), calls, state };
}

test('cash payments use locked cumulative confirmed totals and mark a fully paid invoice', async () => {
  const { repository, calls, state } = loadBillingRepository({ total: 100, confirmed: 40 });
  await repository.recordPayment({ invoiceId: 5, amount: 60, method: 'CASH', idempotencyKey: 'payment:full:1', actorUserId: 2 });

  assert.match(calls[0].query, /UPDLOCK, HOLDLOCK/);
  assert.match(calls[1].query, /customer_invoices WITH \(UPDLOCK, HOLDLOCK\)/);
  assert.match(calls[2].query, /SUM\(amount\)/);
  const update = calls.find(call => call.query.includes('UPDATE customer_invoices'));
  assert.deepEqual(update.params, [100, 5]);
  const saleUpdate = calls.find(call => call.query.includes('UPDATE sales SET payment_status'));
  assert.deepEqual(saleUpdate.params, [11]);
  assert.deepEqual(state, { began: 1, committed: 1, rolledBack: 0, released: 1 });
});

test('multiple partial payments update status from the cumulative amount, not only the latest payment', async () => {
  const { repository, calls } = loadBillingRepository({ total: 100, confirmed: 30 });
  await repository.recordPayment({ invoiceId: 5, amount: 20, method: 'CASH', idempotencyKey: 'payment:partial:1', actorUserId: 2 });
  const update = calls.find(call => call.query.includes('UPDATE customer_invoices'));
  assert.deepEqual(update.params, [50, 5]);
});

test('a payment exceeding the remaining balance is rejected and rolled back', async () => {
  const { repository, calls, state } = loadBillingRepository({ total: 100, confirmed: 40 });
  await assert.rejects(
    repository.recordPayment({ invoiceId: 5, amount: 60.01, method: 'CASH', idempotencyKey: 'payment:over:1', actorUserId: 2 }),
    error => error.statusCode === 409 && /outstanding invoice balance/.test(error.message)
  );
  assert.equal(calls.some(call => call.query.includes('INSERT INTO customer_payments')), false);
  assert.deepEqual(state, { began: 1, committed: 0, rolledBack: 1, released: 1 });
});

test('an idempotent retry returns the existing same-invoice payment without another insert', async () => {
  const { repository, calls, state } = loadBillingRepository({ existing: { customer_payment_id: 9, customer_invoice_id: 5 } });
  const payment = await repository.recordPayment({ invoiceId: 5, amount: 20, method: 'CASH', idempotencyKey: 'payment:retry:1', actorUserId: 2 });
  assert.equal(payment.customer_payment_id, 9);
  assert.equal(calls.some(call => call.query.includes('INSERT INTO customer_payments')), false);
  assert.deepEqual(state, { began: 1, committed: 1, rolledBack: 0, released: 1 });
});

test('payment insertion failures roll back and never update invoice status', async () => {
  const { repository, calls, state } = loadBillingRepository({ failInsert: true });
  await assert.rejects(
    repository.recordPayment({ invoiceId: 5, amount: 20, method: 'CASH', idempotencyKey: 'payment:failure:1', actorUserId: 2 }),
    /insert failed/
  );
  assert.equal(calls.some(call => call.query.includes('UPDATE customer_invoices')), false);
  assert.deepEqual(state, { began: 1, committed: 0, rolledBack: 1, released: 1 });
});
