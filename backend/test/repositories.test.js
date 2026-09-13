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
      { customer_id: 2, discount: 1, payment_method: 'Cash' },
      [{ medicine_id: 4, quantity: 2, unit_price: 999 }]
    );

    const saleInsert = calls.find(call => call.query.includes('INSERT INTO sales'));
    const itemInsert = calls.find(call => call.query.includes('INSERT INTO sale_items'));
    const stockUpdate = calls.find(call => call.query.includes('SET quantity = quantity - ?'));

    assert.deepEqual(saleInsert.params, [2, 15, 1, 14, 'Cash', null]);
    assert.deepEqual(itemInsert.params, [11, 4, 2, 7.5, 15]);
    assert.deepEqual(stockUpdate.params, [2, 4]);
    assert.equal(sale.items.length, 1);
    assert.deepEqual(state, { began: 1, committed: 1, rolledBack: 0, released: 1 });
  } finally {
    loaded.restore();
  }
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
      loaded.repository.createWithItems({}, [{ medicine_id: 1, quantity: 1 }]),
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
  const pool = {
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
    assert.match(captured.query, /m\.quantity <= m\.min_stock_level/);
    assert.match(captured.query, /DATE_ADD\(CURDATE\(\), INTERVAL 30 DAY\)/);
    assert.deepEqual(captured.params, ['%batch%', '%batch%', '%batch%', 'Tablet']);
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
