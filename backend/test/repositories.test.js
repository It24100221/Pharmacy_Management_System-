const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

const databasePath = require.resolve('../src/config/database');
const originalDatabaseModule = require.cache[databasePath];
const databaseStub = new Module(databasePath);
databaseStub.filename = databasePath;
databaseStub.loaded = true;
databaseStub.exports = {};
require.cache[databasePath] = databaseStub;

test.after(() => {
  if (originalDatabaseModule) require.cache[databasePath] = originalDatabaseModule;
  else delete require.cache[databasePath];
});

function loadRepository(relativePath, pool) {
  const repositoryPath = require.resolve(relativePath);
  databaseStub.exports = { pool };
  require.cache[databasePath] = databaseStub;
  delete require.cache[repositoryPath];

  return {
    repository: require(repositoryPath),
    restore() {
      delete require.cache[repositoryPath];
      databaseStub.exports = {};
    }
  };
}

test('sale transaction uses the locked database price and reduces stock once', async () => {
  const calls = [];
  const state = { began: 0, committed: 0, rolledBack: 0, released: 0 };
  const connection = {
    async beginTransaction() { state.began += 1; },
    async commit() { state.committed += 1; },
    async rollback() { state.rolledBack += 1; },
    release() { state.released += 1; },
    async execute(query, params = []) {
      calls.push({ query, params });
      if (query.includes('FROM medicines WHERE id = ? FOR UPDATE')) {
        return [[{ id: 4, name: 'Database Medicine', quantity: 20, unit_price: '7.50', is_expired: 0 }]];
      }
      if (query.includes('FROM medicine_batches')) return [[]];
      if (query.includes('SET quantity = quantity - ?')) return [[{ affectedRows: 1 }]];
      if (query.includes('SELECT quantity AS balanceAfter')) return [[{ balanceAfter: 18 }]];
      if (query.includes('INSERT INTO sales')) return [{ insertId: 11 }];
      return [{}];
    }
  };
  const pool = {
    async getConnection() { return connection; },
    async execute(query) {
      if (query.includes('FROM sales s')) {
        return [[{ id: 11, total_amount: 15, discount: 1, final_amount: 14 }]];
      }
      if (query.includes('FROM sale_items si')) {
        return [[{ medicine_id: 4, quantity: 2, unit_price: 7.5, line_total: 15 }]];
      }
      throw new Error(`Unexpected pool query: ${query}`);
    }
  };
  const loaded = loadRepository('../src/repositories/saleRepository', pool);

  try {
    const sale = await loaded.repository.createWithItems(
      { customer_id: 2, discount: 1, payment_method: 'Cash', actor_user_id: 9 },
      [{ medicine_id: 4, quantity: 2, unit_price: 999 }]
    );

    const saleInsert = calls.find(call => call.query.includes('INSERT INTO sales'));
    const itemInsert = calls.find(call => call.query.includes('INSERT INTO sale_items'));
    const stockUpdate = calls.find(call => call.query.includes('SET quantity = quantity - ?'));

    assert.deepEqual(saleInsert.params, [2, 15, 1, 14, 'Cash', null]);
    assert.deepEqual(itemInsert.params, [11, 4, 2, 7.5, 15]);
    assert.deepEqual(stockUpdate.params, [2, 4, 2]);
    assert.equal(sale.items.length, 1);
    assert.deepEqual(state, { began: 1, committed: 1, rolledBack: 0, released: 1 });
  } finally {
    loaded.restore();
  }
});

test('prescription-linked sale resolves the authoritative customer when the client omits it', async () => {
  const calls = [];
  const state = { committed: 0, rolledBack: 0, released: 0 };
  const connection = {
    async beginTransaction() {},
    async commit() { state.committed += 1; },
    async rollback() { state.rolledBack += 1; },
    release() { state.released += 1; },
    async execute(query, params = []) {
      calls.push({ query, params });
      if (query.includes('FROM prescriptions WITH')) return [[{ id: 15, customer_id: 7, status: 'READY_FOR_BILLING' }]];
      if (query.includes('FROM prescription_items')) return [[{ medicine_id: 4, quantity: 1 }]];
      if (query.includes('FROM medicines WHERE id = ? FOR UPDATE')) return [[{ id: 4, name: 'Prescription Medicine', quantity: 10, unit_price: 12, is_expired: 0 }]];
      if (query.includes('FROM medicine_batches')) return [[]];
      if (query.includes('INSERT INTO sales')) return [{ insertId: 51 }];
      if (query.includes('SET quantity = quantity - ?')) return [[{ affectedRows: 1 }]];
      if (query.includes('SELECT quantity AS balanceAfter')) return [[{ balanceAfter: 9 }]];
      if (query.includes('SELECT customer_invoice_id FROM customer_invoices')) return [[{ customer_invoice_id: 88 }]];
      return [{}];
    }
  };
  const loaded = loadRepository('../src/repositories/saleRepository', {
    async getConnection() { return connection; },
    async execute(query) {
      if (query.includes('FROM sales s')) return [[{ id: 51, total_amount: 12, final_amount: 12 }]];
      if (query.includes('FROM sale_items si')) return [[{ medicine_id: 4, quantity: 1, unit_price: 12, line_total: 12 }]];
      throw new Error(`Unexpected pool query: ${query}`);
    }
  });

  try {
    await loaded.repository.createWithItems(
      { customer_id: null, prescription_id: 15, payment_method: 'Cash', actor_user_id: 9 },
      [{ medicine_id: 4, quantity: 1 }]
    );
    const saleInsert = calls.find(call => call.query.includes('INSERT INTO sales'));
    assert.deepEqual(saleInsert.params, [7, 15, 12, 0, 12, 'Cash', null]);
    assert.deepEqual(calls.find(call => call.query.includes("UPDATE prescriptions SET status = 'DISPENSED'")).params, [9, 15]);
    assert.deepEqual(state, { committed: 1, rolledBack: 0, released: 1 });
  } finally {
    loaded.restore();
  }
});

test('prescription-linked sale rejects a mismatched customer before writing sale rows', async () => {
  const calls = [];
  const state = { rolledBack: 0, released: 0 };
  const connection = {
    async beginTransaction() {},
    async commit() {},
    async rollback() { state.rolledBack += 1; },
    release() { state.released += 1; },
    async execute(query, params = []) {
      calls.push({ query, params });
      if (query.includes('FROM prescriptions WITH')) return [[{ id: 15, customer_id: 7, status: 'READY_FOR_BILLING' }]];
      return [{}];
    }
  };
  const loaded = loadRepository('../src/repositories/saleRepository', {
    async getConnection() { return connection; }
  });

  try {
    await assert.rejects(
      loaded.repository.createWithItems(
        { customer_id: 8, prescription_id: 15, payment_method: 'Cash', actor_user_id: 9 },
        [{ medicine_id: 4, quantity: 1 }]
      ),
      error => error.statusCode === 409 && error.message === 'Prescription customer mismatch'
    );
    assert.equal(calls.some(call => call.query.includes('INSERT INTO sales')), false);
    assert.deepEqual(state, { rolledBack: 1, released: 1 });
  } finally {
    loaded.restore();
  }
});

test('walk-in cash sale creates a confirmed invoice payment', async () => {
  const calls = [];
  const connection = {
    async beginTransaction() {}, async commit() {}, async rollback() {}, release() {},
    async execute(query, params = []) {
      calls.push({ query, params });
      if (query.includes('FROM medicines WHERE id = ? FOR UPDATE')) return [[{ id: 4, name: 'Cash Medicine', quantity: 10, unit_price: 12, is_expired: 0 }]];
      if (query.includes('FROM medicine_batches')) return [[]];
      if (query.includes('SET quantity = quantity - ?')) return [[{ affectedRows: 1 }]];
      if (query.includes('SELECT quantity AS balanceAfter')) return [[{ balanceAfter: 9 }]];
      if (query.includes('INSERT INTO sales')) return [{ insertId: 41 }];
      if (query.includes('SELECT customer_invoice_id FROM customer_invoices')) return [[{ customer_invoice_id: 77 }]];
      return [{}];
    }
  };
  const loaded = loadRepository('../src/repositories/saleRepository', {
    async getConnection() { return connection; },
    async execute(query) {
      if (query.includes('FROM sales s')) return [[{ id: 41, total_amount: 12, final_amount: 12 }]];
      if (query.includes('FROM sale_items si')) return [[{ medicine_id: 4, quantity: 1, unit_price: 12, line_total: 12 }]];
      throw new Error(`Unexpected pool query: ${query}`);
    }
  });
  try {
    await loaded.repository.createWithItems({ customer_id: null, payment_method: 'Cash', actor_user_id: 9 }, [{ medicine_id: 4, quantity: 1 }]);
    const payment = calls.find(call => call.query.includes('INSERT INTO customer_payments'));
    assert.deepEqual(payment.params, [77, 12, 'payment:sale:41', 9]);
    assert.equal(calls.some(call => call.query.includes("UPDATE customer_invoices SET status = 'PAID'")), true);
    assert.deepEqual(calls.find(call => call.query.includes("UPDATE sales SET payment_status = 'PAID'")).params, [41]);
  } finally { loaded.restore(); }
});

test('sale transaction rolls back and does not update stock for expired medicine', async () => {
  const calls = [];
  const state = { committed: 0, rolledBack: 0, released: 0 };
  const connection = {
    async beginTransaction() {},
    async commit() { state.committed += 1; },
    async rollback() { state.rolledBack += 1; },
    release() { state.released += 1; },
    async execute(query, params = []) {
      calls.push({ query, params });
      if (query.includes('FROM medicine_batches')) return [[]];
      return [[{ id: 4, name: 'Expired Medicine', quantity: 20, unit_price: 10, is_expired: 1 }]];
    }
  };
  const loaded = loadRepository('../src/repositories/saleRepository', {
    async getConnection() { return connection; }
  });

  try {
    await assert.rejects(
      loaded.repository.createWithItems({}, [{ medicine_id: 4, quantity: 2 }]),
      error => error.statusCode === 409 && /Expired medicine/.test(error.message)
    );
    assert.equal(calls.some(call => call.query.includes('UPDATE medicines')), false);
    assert.deepEqual(state, { committed: 0, rolledBack: 1, released: 1 });
  } finally {
    loaded.restore();
  }
});

test('today summary aggregates sale revenue independently from sale item rows', async () => {
  let executedQuery = '';
  const loaded = loadRepository('../src/repositories/saleRepository', {
    async execute(query) { executedQuery = query; return [[{ total_sales: 2, total_revenue: 150, total_items_sold: 3 }]]; }
  });
  try {
    const summary = await loaded.repository.getTodaySummary();
    assert.deepEqual(summary, { total_sales: 2, total_revenue: 150, total_items_sold: 3 });
    assert.match(executedQuery, /SELECT COALESCE\(SUM\(final_amount\), 0\) FROM sales/);
    assert.doesNotMatch(executedQuery, /SUM\(s\.final_amount\)/);
  } finally {
    loaded.restore();
  }
});

test('a post-commit sale read failure does not roll back or release twice', async () => {
  const state = { committed: 0, rolledBack: 0, released: 0 };
  const connection = {
    async beginTransaction() {},
    async commit() { state.committed += 1; },
    async rollback() { state.rolledBack += 1; },
    release() { state.released += 1; },
    async execute(query) {
      if (query.includes('FROM medicines WHERE id = ? FOR UPDATE')) {
        return [[{ id: 1, name: 'Medicine', quantity: 5, unit_price: 10, is_expired: 0 }]];
      }
      if (query.includes('FROM medicine_batches')) return [[]];
      if (query.includes('SET quantity = quantity - ?')) return [[{ affectedRows: 1 }]];
      if (query.includes('SELECT quantity AS balanceAfter')) return [[{ balanceAfter: 4 }]];
      if (query.includes('INSERT INTO sales')) return [{ insertId: 12 }];
      return [{}];
    }
  };
  const loaded = loadRepository('../src/repositories/saleRepository', {
    async getConnection() { return connection; },
    async execute() { throw new Error('Post-commit read failed'); }
  });

  try {
    await assert.rejects(
      loaded.repository.createWithItems({ actor_user_id: 9, payment_method: 'Card' }, [{ medicine_id: 1, quantity: 1 }]),
      /Post-commit read failed/
    );
    assert.deepEqual(state, { committed: 1, rolledBack: 0, released: 1 });
  } finally {
    loaded.restore();
  }
});

test('purchase transaction increases stock and commits once', async () => {
  const calls = [];
  const state = { committed: 0, rolledBack: 0, released: 0 };
  const connection = {
    async beginTransaction() {},
    async commit() { state.committed += 1; },
    async rollback() { state.rolledBack += 1; },
    release() { state.released += 1; },
    async execute(query, params = []) {
      calls.push({ query, params });
      if (query.includes('INSERT INTO purchases')) return [{ insertId: 9 }];
      if (query.includes('SELECT id FROM medicines WITH')) return [[{ id: 3 }]];
      if (query.includes('SET quantity = quantity + ?')) return [[{ affectedRows: 1 }]];
      if (query.includes('SELECT quantity AS balanceAfter')) return [[{ balanceAfter: 100 }]];
      return [{}];
    }
  };
  const pool = {
    async getConnection() { return connection; },
    async execute(query) {
      if (query.includes('FROM purchases p')) return [[{ id: 9, total_amount: 300 }]];
      if (query.includes('FROM purchase_items pi')) return [[{ medicine_id: 3, quantity: 100 }]];
      throw new Error(`Unexpected pool query: ${query}`);
    }
  };
  const loaded = loadRepository('../src/repositories/purchaseRepository', pool);

  try {
    await loaded.repository.createWithItems(
      { supplier_id: 1, purchase_date: '2026-09-12' },
      [{ medicine_id: 3, quantity: 100, unit_cost: 3, total_cost: 300 }]
    );

    const stockUpdate = calls.find(call => call.query.includes('SET quantity = quantity + ?'));
    assert.deepEqual(stockUpdate.params, [100, 3]);
    assert.deepEqual(state, { committed: 1, rolledBack: 0, released: 1 });
  } finally {
    loaded.restore();
  }
});

test('supplier update can clear optional fields with null', async () => {
  const calls = [];
  const connection = {
    async beginTransaction() {},
    async commit() {},
    async rollback() {},
    release() {},
    async execute(query, params = []) {
      calls.push({ query, params });
      if (query.includes('FROM suppliers WITH')) return [[{ id: 1, company_name: 'Supplier', email: null, phone: null }]];
      return [{}];
    }
  };
  const pool = {
    async getConnection() { return connection; },
    async execute(query, params = []) {
      calls.push({ query, params });
      if (query.includes('SELECT') && query.includes('WHERE s.id = ?')) {
        return [[{ id: 1, company_name: 'Supplier' }]];
      }
      return [{}];
    }
  };
  const loaded = loadRepository('../src/repositories/supplierRepository', pool);

  try {
    await loaded.repository.update(1, { contact_person: null, email: null });
    const update = calls.find(call => call.query.includes('UPDATE suppliers'));
    assert.match(update.query, /contact_person = \?, email = \?/);
    assert.doesNotMatch(update.query, /COALESCE/);
    assert.deepEqual(update.params, [null, null, 1]);
  } finally {
    loaded.restore();
  }
});

test('normalized duplicate supplier identity is rejected before insertion', async () => {
  const state = { rolledBack: 0 };
  const connection = {
    async beginTransaction() {},
    async commit() {},
    async rollback() { state.rolledBack += 1; },
    release() {},
    async execute(query) {
      if (query.includes('SELECT TOP (1) id FROM suppliers')) return [[{ id: 8 }]];
      throw new Error('insert should not run');
    }
  };
  const loaded = loadRepository('../src/repositories/supplierRepository', { async getConnection() { return connection; } });
  try {
    await assert.rejects(
      loaded.repository.create({ company_name: ' Acme ', email: 'sales@acme.lk', phone: '0112223333' }),
      error => error.statusCode === 409 && /already exists/.test(error.message)
    );
    assert.equal(state.rolledBack, 1);
  } finally {
    loaded.restore();
  }
});

test('normalized duplicate medicine identity is rejected before insertion', async () => {
  const state = { rolledBack: 0 };
  const connection = {
    async beginTransaction() {},
    async commit() {},
    async rollback() { state.rolledBack += 1; },
    release() {},
    async execute(query) {
      if (query.includes('SELECT TOP (1) id FROM medicines')) return [[{ id: 3 }]];
      throw new Error('insert should not run');
    }
  };
  const loaded = loadRepository('../src/repositories/medicineRepository', { async getConnection() { return connection; } });
  try {
    await assert.rejects(
      loaded.repository.create({ name: 'Paracetamol', generic_name: 'Paracetamol', manufacturer: 'Acme', quantity: 0, expiry_date: '2099-01-01' }),
      error => error.statusCode === 409 && /already exists/.test(error.message)
    );
    assert.equal(state.rolledBack, 1);
  } finally {
    loaded.restore();
  }
});

test('medicine count applies the same search, category, stock, and expiry filters', async () => {
  let captured;
  const pool = {
    async execute(query, params) {
      captured = { query, params };
      return [[{ total: 2 }]];
    }
  };
  const loaded = loadRepository('../src/repositories/medicineRepository', pool);

  try {
    const count = await loaded.repository.getCount({
      search: 'batch',
      category: 'Tablet',
      stock_status: 'low_stock',
      expiry_status: 'near_expiry'
    });

    assert.equal(count, 2);
    assert.match(captured.query, /m\.batch_number LIKE \?/);
    assert.match(captured.query, /m\.category = \?/);
    assert.match(captured.query, /inventory_stock\.available_quantity <= m\.min_stock_level/);
    assert.match(captured.query, /DATE_ADD\(CURDATE\(\), INTERVAL 30 DAY\)/);
    assert.deepEqual(captured.params, ['%batch%', '%batch%', '%batch%', '%batch%', 'Tablet']);
  } finally {
    loaded.restore();
  }
});

test('prescription availability query is read-only and checks expiry', async () => {
  let capturedQuery = '';
  const pool = {
    async execute(query) {
      capturedQuery = query;
      return [[]];
    }
  };
  const loaded = loadRepository('../src/repositories/prescriptionRepository', pool);

  try {
    await loaded.repository.checkAvailability(3);
    assert.match(capturedQuery, /m\.expiry_date < CURDATE\(\)/);
    assert.doesNotMatch(capturedQuery, /UPDATE|INSERT|DELETE/i);
  } finally {
    loaded.restore();
  }
});

test('prescription list joins sales before selecting the linked sale ID', async () => {
  let capturedQuery = '';
  const loaded = loadRepository('../src/repositories/prescriptionRepository', {
    async execute(query) {
      capturedQuery = query;
      return [[]];
    }
  });

  try {
    await loaded.repository.findAll({ pagination: false });
    assert.match(capturedQuery, /LEFT JOIN sales s ON s\.prescription_id = p\.id/);
    assert.match(capturedQuery, /s\.id AS sale_id/);
  } finally {
    loaded.restore();
  }
});

test('medicine creation atomically records its opening batch and stock movement', async () => {
  const calls = [];
  const state = { began: 0, committed: 0, rolledBack: 0, released: 0 };
  const connection = {
    async beginTransaction() { state.began += 1; },
    async commit() { state.committed += 1; },
    async rollback() { state.rolledBack += 1; },
    release() { state.released += 1; },
    async execute(query, params) {
      calls.push({ query, params });
      if (query.includes('SELECT TOP (1) id FROM medicines')) return [[]];
      if (query.includes('INSERT INTO medicines')) return [[{ insertId: 22 }]];
      if (query.includes('INSERT INTO medicine_batches')) return [{ batch_id: 31 }];
      if (query.includes('INSERT INTO stock_movements')) return [{}];
      throw new Error(`Unexpected query: ${query}`);
    }
  };
  const pool = {
    async getConnection() { return connection; }
  };
  const loaded = loadRepository('../src/repositories/medicineRepository', pool);

  try {
    const id = await loaded.repository.create({
      name: 'Mapped medicine', batch_number: 'OPEN-1', quantity: 1, unit_price: 2,
      expiry_date: '2099-12-31', min_stock_level: 1
    }, 7);
    assert.equal(id, 22);
    assert.match(calls[1].query, /DECLARE @created TABLE/);
    assert.match(calls[1].query, /OUTPUT INSERTED\.id INTO @created/);
    assert.match(calls[2].query, /INSERT INTO medicine_batches/);
    assert.deepEqual(calls[2].params, [22, 'OPEN-1', '2099-12-31', 1, null]);
    assert.match(calls[3].query, /'OPENING'/);
    assert.equal(calls[3].params.at(-1), 7);
    assert.deepEqual(state, { began: 1, committed: 1, rolledBack: 0, released: 1 });
  } finally {
    loaded.restore();
  }
});

test('medicine creation rolls back the complete opening-stock transaction on ledger failure', async () => {
  const state = { committed: 0, rolledBack: 0, released: 0 };
  let call = 0;
  const connection = {
    async beginTransaction() {},
    async commit() { state.committed += 1; },
    async rollback() { state.rolledBack += 1; },
    release() { state.released += 1; },
    async execute(query) {
      call += 1;
      if (query.includes('SELECT TOP (1) id FROM medicines')) return [[]];
      if (query.includes('INSERT INTO medicines')) return [[{ insertId: 22 }]];
      if (query.includes('INSERT INTO medicine_batches')) return [{ batch_id: 31 }];
      throw new Error('ledger unavailable');
    }
  };
  const loaded = loadRepository('../src/repositories/medicineRepository', { async getConnection() { return connection; } });
  try {
    await assert.rejects(
      loaded.repository.create({ name: 'Medicine', batch_number: 'B-1', quantity: 5, unit_price: 2, expiry_date: '2099-12-31' }, 1),
      /ledger unavailable/
    );
    assert.deepEqual(state, { committed: 0, rolledBack: 1, released: 1 });
  } finally {
    loaded.restore();
  }
});

test('product catalogue search, category, availability, and pagination are SQL-backed and parameterized', async () => {
  let captured;
  const pool = {
    async execute(query, params) {
      captured = { query, params };
      return [[]];
    }
  };
  const loaded = loadRepository('../src/repositories/productRepository', pool);

  try {
    await loaded.repository.findAll({
      search: 'P0001',
      category: 'medicine',
      availability: 'available',
      page: 2,
      limit: 5,
    });
    assert.match(captured.query, /FROM dbo\.v_product_catalog pc/);
    assert.match(captured.query, /pc\.product_code LIKE \?/);
    assert.match(captured.query, /pc\.category_code = \?/);
    assert.match(captured.query, /pc\.availability = \?/);
    assert.match(captured.query, /LIMIT \? OFFSET \?/);
    assert.deepEqual(captured.params, [
      '%P0001%', '%P0001%', '%P0001%', '%P0001%',
      'MEDICINE', 'medicine', 'AVAILABLE', 5, 5,
    ]);
  } finally {
    loaded.restore();
  }
});

test('public product lookup reads the canonical catalogue view by permanent product code', async () => {
  let captured;
  const pool = {
    async execute(query, params) {
      captured = { query, params };
      return [[{ product_code: 'P0000000001', unit_price: 2500, stock_quantity: 10 }]];
    }
  };
  const loaded = loadRepository('../src/repositories/productRepository', pool);

  try {
    const product = await loaded.repository.findByCode('P0000000001');
    assert.equal(product.product_code, 'P0000000001');
    assert.match(captured.query, /dbo\.v_product_catalog/);
    assert.deepEqual(captured.params, ['P0000000001']);
  } finally {
    loaded.restore();
  }
});
