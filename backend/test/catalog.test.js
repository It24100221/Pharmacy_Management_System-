const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const fs = require('node:fs');
const path = require('node:path');
const app = require('../src/app');
const database = require('../src/config/database');

test('public catalog categories and catalog are accessible without authentication', async () => {
  const original = database.pool.execute;
  const statements = [];
  database.pool.execute = async (sql, params) => {
    statements.push({ sql, params });
    if (sql.includes('COUNT(*)')) return [[{ total: 1 }]];
    return [[{ product_code: 'P001', name: 'Paracetamol', product_type: 'Medicine',
      category: 'Pain Relief', unit_price: 25, image_url: null, requires_prescription: true,
      availability: 'low_stock' }]];
  };
  try {
    const categories = await request(app).get('/api/catalog/categories');
    assert.equal(categories.status, 200);
    assert.deepEqual(categories.body.data, ['Medicine', 'Baby Items', 'Lab Items', 'Medical Accessories']);
    const result = await request(app).get('/api/catalog?type=Medicine&search=P%5B001%25&page=2');
    assert.equal(result.status, 200);
    assert.equal(result.body.data.products[0].product_code, 'P001');
    assert.equal(result.body.data.pagination.current_page, 2);
    assert.match(statements[0].sql, /m\.is_active = 1/);
    assert.match(statements[1].sql, /CASE WHEN m\.quantity <= 0/);
    assert.ok(statements[0].params.includes('%P[[]001[%]%'));
    assert.deepEqual(statements[1].params.slice(-2), [24, 24]);
  } finally { database.pool.execute = original; }
});

test('public catalog rejects unsupported types and pagination before querying SQL', async () => {
  assert.equal((await request(app).get('/api/catalog?type=Unknown')).status, 400);
  assert.equal((await request(app).get('/api/catalog?page=-1')).status, 400);
  assert.equal((await request(app).get('/api/catalog?limit=1000')).status, 400);
  assert.equal((await request(app).get('/api/medicines')).status, 401);
});

test('catalog migration assigns stable seed codes and enforces an immutable business ID', () => {
  const sql = fs.readFileSync(path.join(__dirname, '../../database/mssql/migrations/002_extend_products_for_public_catalog.sql'), 'utf8');
  assert.match(sql, /product_code NVARCHAR\(32\) NOT NULL/);
  assert.match(sql, /CREATE UNIQUE INDEX UX_medicines_product_code/);
  assert.match(sql, /trg_medicines_product_code_immutable/);
  assert.match(sql, /CK_medicines_product_type/);
  assert.match(sql, /CK_medicines_medicine_expiry/);
  assert.match(sql, /N'P001'/);
  assert.match(sql, /N'P007'/);
  assert.match(sql, /Unmapped products remain/);
});
