const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');

// ============================================================================
// Stage 0B — SQL Server migration regression tests.
//
// These prove, without a live database, that:
//   * no MySQL-only syntax survived in the runtime persistence layer,
//   * pagination uses SQL Server OFFSET/FETCH over a deterministic ORDER BY,
//   * insert ids come from OUTPUT INSERTED.id,
//   * the sale/purchase transactions request the locking strategy that
//     replaces SELECT ... FOR UPDATE,
//   * `?` placeholders are converted to bound @pN markers (never concatenated),
//   * an unreachable/unconfigured database fails loudly instead of succeeding.
// ============================================================================

// Captured BEFORE the pool stub is installed below.
const realDatabase = require('../src/config/database');

const repositoryDir = path.join(__dirname, '..', 'src', 'repositories');
const databaseModulePath = path.join(__dirname, '..', 'src', 'config', 'database.js');

function listRepositories() {
  return fs.readdirSync(repositoryDir).map((name) => path.join(repositoryDir, name));
}

function stripComments(source) {
  return source
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\/\*|\*)/.test(line))
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n');
}

test('no MySQL-only syntax remains in the persistence layer', () => {
  const files = [...listRepositories(), databaseModulePath];

  const forbidden = [
    'FOR UPDATE',
    'CURDATE(',
    'DATE_ADD(',
    'LIMIT ?',
    'AUTO_INCREMENT',
    'insertId',
    'mysql2',
    'pool.query(',
    'ENGINE=InnoDB'
  ];

  for (const file of files) {
    const source = stripComments(fs.readFileSync(file, 'utf8'));
    for (const token of forbidden) {
      assert.equal(
        source.includes(token),
        false,
        `${path.basename(file)} still contains MySQL syntax: ${token}`
      );
    }
  }
});

test('every repository paginates with OFFSET/FETCH over a stable ORDER BY', () => {
  for (const file of listRepositories()) {
    const source = fs.readFileSync(file, 'utf8');
    assert.equal(source.includes('LIMIT'), false, `${path.basename(file)} still uses LIMIT`);

    if (source.includes('FETCH NEXT')) {
      assert.match(
        source,
        /ORDER BY[^;]*,\s*(m|s|c|p)\.id\b/i,
        `${path.basename(file)} must order by id as a tie-breaker for stable pagination`
      );
    }
  }
});

test('every insert into an identity table reads its id from OUTPUT INSERTED.id', () => {
  const identityTables = new Set([
    'medicines',
    'suppliers',
    'customers',
    'sales',
    'purchases',
    'prescriptions'
  ]);

  let checked = 0;

  for (const file of listRepositories()) {
    const source = fs.readFileSync(file, 'utf8');
    const insertRegex = /INSERT INTO\s+([a-z_]+)/gi;

    let match;
    while ((match = insertRegex.exec(source)) !== null) {
      const table = match[1].toLowerCase();
      if (!identityTables.has(table)) continue;

      const statement = source.slice(match.index, match.index + 600);
      assert.match(
        statement,
        /OUTPUT INSERTED\.id/,
        `${path.basename(file)}: INSERT INTO ${table} must return OUTPUT INSERTED.id`
      );
      checked += 1;
    }
  }

  assert.equal(checked, 6, 'expected one identity insert per entity');
});

// ---------------------------------------------------------------------------
// Repository SQL shape, using a stubbed pool (same technique as
// repositories.test.js — the database module is replaced before requiring).
// ---------------------------------------------------------------------------
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

function loadRepositoryWithPool(relativePath, pool) {
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

test('sale row lock replaces MySQL FOR UPDATE with UPDLOCK + ROWLOCK', async () => {
  const calls = [];
  const connection = {
    async beginTransaction() {},
    async commit() {},
    async rollback() {},
    release() {},
    async execute(query, params = []) {
      calls.push({ query, params });
      if (query.includes('FROM medicines')) {
        return [[{ id: 1, name: 'Med', quantity: 3, unit_price: 10, is_expired: 0 }]];
      }
      if (query.includes('INSERT INTO sales')) return [[{ id: 77 }]];
      return [[]];
    }
  };
  const loaded = loadRepositoryWithPool('../src/repositories/saleRepository', {
    async getConnection() { return connection; },
    async execute(query) {
      if (query.includes('FROM sales s')) return [[{ id: 77 }]];
      if (query.includes('FROM sale_items si')) return [[]];
      throw new Error(`unexpected ${query}`);
    }
  });

  try {
    await loaded.repository.createWithItems(
      { customer_id: null, discount: 0, payment_method: 'Cash' },
      [{ medicine_id: 1, quantity: 1 }]
    );

    const lockRead = calls.find((call) => call.query.includes('FROM medicines'));
    assert.ok(lockRead, 'the medicine row must be read inside the transaction');
    assert.match(lockRead.query, /WITH \(UPDLOCK, ROWLOCK\)/);
    assert.equal(lockRead.query.includes('FOR UPDATE'), false, 'MySQL FOR UPDATE must be gone');
    assert.deepEqual(lockRead.params, [1]);
  } finally {
    loaded.restore();
  }
});

test('medicine list query uses SQL Server pagination with a deterministic order', async () => {
  let captured = null;
  const loaded = loadRepositoryWithPool('../src/repositories/medicineRepository', {
    async execute(query, params) {
      captured = { query, params };
      return [[{ total: 1 }]];
    }
  });

  try {
    await loaded.repository.findAll({ page: '2', limit: '10' });
    assert.match(captured.query, /ORDER BY m\.name ASC, m\.id ASC/);
    assert.match(captured.query, /OFFSET \? ROWS FETCH NEXT \? ROWS ONLY/);
    assert.deepEqual(captured.params, [10, 10], 'offset then limit');
  } finally {
    loaded.restore();
  }
});

test('medicine create returns OUTPUT INSERTED.id instead of insertId', async () => {
  const loaded = loadRepositoryWithPool('../src/repositories/medicineRepository', {
    async execute(query) {
      assert.match(query, /OUTPUT INSERTED\.id/);
      return [[{ id: 42 }]];
    }
  });

  try {
    const id = await loaded.repository.create({
      name: 'Test',
      expiry_date: '2027-01-01',
      quantity: 1,
      unit_price: 100
    });
    assert.equal(id, 42);
  } finally {
    loaded.restore();
  }
});

test('purchase list query aggregates items in a derived table (no bare GROUP BY)', async () => {
  let captured = null;
  const loaded = loadRepositoryWithPool('../src/repositories/purchaseRepository', {
    async execute(query, params) {
      captured = { query, params };
      return [[]];
    }
  });

  try {
    await loaded.repository.findAll({ pagination: false });
    assert.equal(
      captured.query.includes('GROUP BY p.id'),
      false,
      'SQL Server rejects bare columns with GROUP BY p.id'
    );
    assert.match(captured.query, /SELECT purchase_id, COUNT\(\*\) AS item_count\s+FROM purchase_items\s+GROUP BY purchase_id/);
    assert.match(captured.query, /COALESCE\(pi\.item_count, 0\) AS item_count/);
  } finally {
    loaded.restore();
  }
});

// ---------------------------------------------------------------------------
// Central module behaviour
// ---------------------------------------------------------------------------
test('placeholders are converted to named @pN markers, literals left alone', () => {
  const { toNamedParameters } = realDatabase;

  const basic = toNamedParameters('SELECT * FROM t WHERE a = ? AND b = ?');
  assert.equal(basic.sql, 'SELECT * FROM t WHERE a = @p0 AND b = @p1');
  assert.equal(basic.placeholderCount, 2);

  const literal = toNamedParameters("SELECT * FROM t WHERE a = ? AND note = 'what?'");
  assert.equal(literal.sql, "SELECT * FROM t WHERE a = @p0 AND note = 'what?'");
  assert.equal(literal.placeholderCount, 1);

  const commented = toNamedParameters('-- keep ?\nSELECT ?');
  assert.equal(commented.placeholderCount, 1);
  assert.match(commented.sql, /-- keep \?/);
});

test('a parameter count mismatch fails before any connection is opened', async () => {
  await assert.rejects(
    () => realDatabase.pool.execute('SELECT * FROM medicines WHERE id = ?', []),
    (error) => {
      assert.equal(error.statusCode, 500);
      assert.match(error.message, /expects 1 parameter\(s\) but 0 were provided/);
      return true;
    }
  );
});

test('an unconfigured database fails loudly instead of succeeding', async (t) => {
  if (process.env.DB_SERVER) {
    t.skip('DB_SERVER is configured in this environment; the live connection test applies instead');
    return;
  }

  await assert.rejects(
    () => realDatabase.pool.execute('SELECT 1'),
    (error) => {
      assert.equal(error.statusCode, 503);
      assert.match(error.message, /Database unavailable/);
      assert.match(error.message, /DB_SERVER is not set/);
      return true;
    }
  );
});
