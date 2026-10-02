// Test-only browser fixture. Never used by the production API or npm start.
process.env.CORS_ORIGIN = 'http://127.0.0.1:3000';
const database = require('../src/config/database');
const products = [
  { product_code: 'P001', name: 'Paracetamol 500mg', description: 'Pain relief tablets.', product_type: 'Medicine', category: 'Pain Relief', unit_price: 25, image_url: null, requires_prescription: 1, availability: 'low_stock' },
  { product_code: 'B001', name: 'Baby Cream', description: 'Everyday baby care.', product_type: 'Baby Items', category: 'Baby Care Products', unit_price: 750, image_url: '/images/missing-photo.png', requires_prescription: 0, availability: 'in_stock' },
  { product_code: 'L001', name: 'Test Strips', description: 'Lab testing supplies.', product_type: 'Lab Items', category: 'Testing Items', unit_price: 1200, image_url: null, requires_prescription: 0, availability: 'out_of_stock' },
];

database.pool.execute = async (sql, params = []) => {
  const hasType = sql.includes('m.product_type = ?');
  const hasSearch = sql.includes('m.name LIKE ?');
  const type = hasType ? params[0] : '';
  const search = hasSearch ? params[hasType ? 1 : 0].slice(1, -1).replace(/\[([%_])\]/g, '$1').toLowerCase() : '';
  const filtered = products.filter(product => (!type || product.product_type === type) &&
    (!search || [product.name, product.product_code, product.category].some(value => value.toLowerCase().includes(search))));
  if (sql.includes('COUNT(*)')) return [[{ total: filtered.length }]];
  return [filtered.slice(params.at(-2), params.at(-2) + params.at(-1))];
};

require('../src/app').listen(5000, '127.0.0.1', () => console.log('Catalog browser fixture on 127.0.0.1:5000'));
