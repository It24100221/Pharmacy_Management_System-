const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');

const dbPath = require.resolve('../src/config/database');
const repositoryPath = require.resolve('../src/repositories/userRepository');
const originalDb = require.cache[dbPath];

function loadWithPool(pool) {
  const stub = new Module(dbPath);
  stub.filename = dbPath;
  stub.loaded = true;
  stub.exports = { pool };
  require.cache[dbPath] = stub;
  delete require.cache[repositoryPath];
  return require(repositoryPath);
}

test.after(() => {
  delete require.cache[repositoryPath];
  if (originalDb) require.cache[dbPath] = originalDb;
  else delete require.cache[dbPath];
});

test('customer and account inserts commit together and never send plaintext password to SQL', async () => {
  const calls = [];
  const transaction = {
    beginTransaction: async () => calls.push('begin'),
    commit: async () => calls.push('commit'),
    rollback: async () => calls.push('rollback'),
    release: () => calls.push('release'),
    execute: async (sql, values) => {
      calls.push({ sql, values });
      return sql.includes('dbo.customers') ? [[{ id: 31 }]] : [[{ id: 80 }]];
    },
  };
  const repo = loadWithPool({ getConnection: async () => transaction, execute: async () => [[{ id: 80, role: 'CUSTOMER' }]] });
  const created = await repo.createCustomerAccount({ first_name: 'Kamal', last_name: 'Perera', email: 'k@example.com', phone: '123', address: 'Colombo', password: 'plaintext' }, 'bcrypt-hash');
  assert.equal(created.id, 80);
  assert.deepEqual(calls.filter(value => typeof value === 'string'), ['begin', 'commit', 'release']);
  const userInsert = calls.find(value => value.sql?.includes('INSERT INTO dbo.users'));
  assert.match(userInsert.sql, /OUTPUT INSERTED\.id/);
  assert.equal(userInsert.values[2], 'bcrypt-hash');
  assert.equal(userInsert.values[3], 31);
  assert.equal(JSON.stringify(calls).includes('plaintext'), false);
});

test('a failed account insert rolls back the customer insert', async () => {
  const calls = [];
  const repo = loadWithPool({ getConnection: async () => ({
    beginTransaction: async () => calls.push('begin'),
    commit: async () => calls.push('commit'),
    rollback: async () => calls.push('rollback'),
    release: () => calls.push('release'),
    execute: async sql => sql.includes('dbo.customers') ? [[{ id: 31 }]] : Promise.reject(new Error('duplicate')),
  }) });
  await assert.rejects(repo.createCustomerAccount({ first_name: 'K', last_name: 'P' }, 'hash'), /duplicate/);
  assert.deepEqual(calls, ['begin', 'rollback', 'release']);
});

test('auth migration is SQL Server-only and defines the identity and role constraints', () => {
  const migration = fs.readFileSync(path.join(__dirname, '../../database/mssql/migrations/001_add_users_authentication.sql'), 'utf8');
  assert.match(migration, /INT IDENTITY\(1,1\)/);
  assert.match(migration, /NVARCHAR\(255\) NOT NULL/);
  assert.match(migration, /DATETIME2/);
  assert.match(migration, /UNIQUE INDEX UX_users_username/);
  assert.match(migration, /CHECK \(role IN/);
  assert.doesNotMatch(migration, /AUTO_INCREMENT|\bLIMIT\b/i);
});
