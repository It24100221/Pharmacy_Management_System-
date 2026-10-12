const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

const databasePath = require.resolve('../src/config/database');
const original = require.cache[databasePath];
const stub = new Module(databasePath);
stub.filename = databasePath;
stub.loaded = true;
require.cache[databasePath] = stub;
test.after(() => { if (original) require.cache[databasePath] = original; else delete require.cache[databasePath]; });

function load(pool, path = '../src/repositories/supplierOperationsRepository') {
  stub.exports = { pool };
  delete require.cache[require.resolve('../src/services/inventorySupply')];
  const file = require.resolve(path);
  delete require.cache[file];
  return { repository: require(file), restore: () => { delete require.cache[file]; } };
}

test('duplicate open reorder request is returned without another insert', async () => {
  let inserts = 0;
  const execute = async query => {
    if (query.includes('SELECT id FROM medicines')) return [[{id:7}]];
    if (query.includes('SELECT * FROM v_inventory_supply_stock')) return [[{medicine_id:7,available_quantity:0,min_stock_level:10,reorder_target:100}]];
    if (query.includes('SELECT supplier_medicine_id')) return [[{supplier_medicine_id:1}]];
    if (query.includes("status IN ('OPEN','ORDERED')")) return [[{ reorder_request_id: 5 }]];
    if (query.includes('INSERT INTO reorder_requests')) inserts += 1;
    if (query.includes('FROM reorder_requests rr')) return [[{ reorder_request_id: 5, medicine_id: 7, status: 'OPEN' }]];
    return [[]];
  };
  const loaded = load({execute, async getConnection(){return {execute,async beginTransaction(){},async commit(){},async rollback(){},release(){}}}});
  try { const row = await loaded.repository.createReorderRequest({ medicineId: 7, supplierId:3, requestedQuantity: 10, requestedBy: 1 }); assert.equal(row.reorder_request_id, 5); assert.equal(inserts, 0); }
  finally { loaded.restore(); }
});

test('purchase-order transition uses SQL Server rowcount and prevents cancellation after receipt', async () => {
  const calls = [];
  const loaded = load({ async execute(query, params = []) {
    calls.push({ query, params });
    if (query.startsWith('SELECT status')) return [[{ status: 'RECEIVED' }]];
    return [[]];
  } }, '../src/repositories/purchaseOrderRepository');
  try {
    await assert.rejects(loaded.repository.updateStatus(2, 'CANCELLED'), /cannot transition/);
    assert.equal(calls.some(call => call.query.includes('UPDATE purchase_orders')), false);
  } finally { loaded.restore(); }
});

test('goods receipt posts one partial delivery and records exact batch movement', async () => {
  const calls = [];
  const state = { received: 0, stock: 0, committed: 0, rolledBack: 0, receiptCount: 0 };
  const connection = {
    async beginTransaction() {}, async commit() { state.committed += 1; }, async rollback() { state.rolledBack += 1; }, release() {},
    async execute(query, params = []) {
      calls.push({ query, params });
      if (query.includes('FROM purchase_orders WITH')) return [[{ purchase_order_id: 1, status: 'CONFIRMED' }]];
      if (query.includes('INSERT INTO goods_receipts')) { state.receiptCount += 1; return [{ insertId: state.receiptCount }]; }
      if (query.includes('FROM purchase_order_items WITH')) return [[{ purchase_order_item_id: 3, medicine_id: 8, ordered_quantity: 100, received_quantity: state.received, unit_cost: 2 }]];
      if (query.includes('SELECT id FROM medicines WITH')) return [[{ id: 8 }]];
      if (query.includes('FROM medicine_batches WITH')) return [[]];
      if (query.includes('INSERT INTO medicine_batches')) return [{ insertId: 9 }];
      if (query.includes('UPDATE medicines SET quantity')) { state.stock += Number(params[0]); return [[{ affectedRows: 1 }]]; }
      if (query.includes('SELECT quantity AS balance_after')) return [[{ balance_after: state.stock }]];
      if (query.includes('UPDATE purchase_order_items SET received_quantity')) { state.received += Number(params[0]); return [[{ affectedRows: 1 }]]; }
      if (query.includes('SELECT COUNT(*) AS remaining')) return [[{ remaining: state.received < 100 ? 1 : 0 }]];
      return [[]];
    },
  };
  const loaded = load({ async getConnection() { return connection; }, async execute(query) {
    if (query.includes('WHERE idempotency_key')) return [[]];
    if (query.includes('FROM goods_receipts gr')) return [[{ goods_receipt_id: state.receiptCount, purchase_order_id: 1 }]];
    if (query.includes('FROM goods_receipt_items gri')) return [[{ goods_receipt_item_id: 1 }]];
    return [[]];
  } });
  try {
    await loaded.repository.createGoodsReceipt({ purchaseOrderId: 1, idempotencyKey: 'grn:test:1', actorUserId: 2, items: [{ purchase_order_item_id: 3, quantity_received: 40, batch_number: 'B-1', expiry_date: '2099-01-01' }] });
    assert.equal(state.stock, 40); assert.equal(state.received, 40); assert.equal(state.committed, 1); assert.equal(state.rolledBack, 0);
    assert.ok(calls.some(call => call.query.includes("'PARTIALLY_RECEIVED'") || (call.query.includes('UPDATE purchase_orders SET status') && call.params[0] === 'PARTIALLY_RECEIVED')));
    const movement = calls.find(call => call.query.includes('INSERT INTO stock_movements'));
    assert.deepEqual(movement.params.slice(0, 4), [8, 9, 40, 40]);
  } finally { loaded.restore(); }
});

test('goods receipt rejects over-receiving and rolls back before stock changes', async () => {
  const state = { rolledBack: 0, stockUpdates: 0 };
  const connection = { async beginTransaction() {}, async commit() {}, async rollback() { state.rolledBack += 1; }, release() {}, async execute(query) {
    if (query.includes('FROM purchase_orders WITH')) return [[{ purchase_order_id: 1, status: 'CONFIRMED' }]];
    if (query.includes('INSERT INTO goods_receipts')) return [{ insertId: 1 }];
    if (query.includes('FROM purchase_order_items WITH')) return [[{ purchase_order_item_id: 3, medicine_id: 8, ordered_quantity: 100, received_quantity: 90, unit_cost: 2 }]];
    if (query.includes('UPDATE medicines')) state.stockUpdates += 1;
    return [[]];
  } };
  const loaded = load({ async getConnection() { return connection; }, async execute() { return [[]]; } });
  try {
    await assert.rejects(loaded.repository.createGoodsReceipt({ purchaseOrderId: 1, idempotencyKey: 'grn:test:2', actorUserId: 2, items: [{ purchase_order_item_id: 3, quantity_received: 40, batch_number: 'B-1', expiry_date: '2099-01-01' }] }), /exceeds outstanding/);
    assert.equal(state.rolledBack, 1); assert.equal(state.stockUpdates, 0);
  } finally { loaded.restore(); }
});

test('supplier payment rejects an amount above locked outstanding balance', async () => {
  const state = { rolledBack: 0, inserted: 0 };
  const connection = { async beginTransaction() {}, async commit() {}, async rollback() { state.rolledBack += 1; }, release() {}, async execute(query) {
    if (query.includes('FROM supplier_invoices WITH')) return [[{ supplier_invoice_id: 4, total_amount: 50000, paid_amount: 20000, status: 'PARTIALLY_PAID' }]];
    if (query.includes('INSERT INTO supplier_payments')) state.inserted += 1;
    return [[]];
  } };
  const loaded = load({ async getConnection() { return connection; }, async execute() { return [[]]; } });
  try {
    await assert.rejects(loaded.repository.recordSupplierPayment({ invoiceId: 4, amount: 40000, method: 'CASH', idempotencyKey: 'supplier-payment:test:1', actorUserId: 1 }), /exceeds outstanding/);
    assert.equal(state.rolledBack, 1); assert.equal(state.inserted, 0);
  } finally { loaded.restore(); }
});
