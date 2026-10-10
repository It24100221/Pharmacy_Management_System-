import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const source = relative => fs.readFileSync(path.resolve(process.cwd(), 'src', relative), 'utf8');

test('low stock keeps row actions while removing the header receive action and identifies products', () => {
  const page = source('pages/Medicines/LowStockPage.jsx');
  assert.equal((page.match(/Receive Stock/g) || []).length, 2);
  assert.match(page, /uniqueMedicines/);
  assert.match(page, /productCode \|\| m\.medicine_number/);
  assert.doesNotMatch(page, /page-header-actions/);
});

test('add medicine expiry uses the pharmacy date and client validation', () => {
  const page = source('pages/Medicines/AddMedicinePage.jsx');
  assert.match(page, /timeZone: 'Asia\/Colombo'/);
  assert.match(page, /min=\{getPharmacyToday\(\)\}/);
  assert.match(page, /Expiry date cannot be earlier than today/);
});

test('customer dashboard removes summary cards while preserving navigation', () => {
  const page = source('pages/CustomerDashboard.jsx');
  assert.doesNotMatch(page, /customer-stat-grid|Items in cart|Prescription status|Persistent orders|Current cart value/);
  assert.match(page, /to="\/pharmacy-items"/);
  assert.match(page, /to="\/my-orders"/);
  assert.match(page, /to="\/my-prescriptions"/);
});

test('customer confirmation names the selected customer and explains deactivation', () => {
  const page = source('pages/Customers/CustomerListPage.jsx');
  assert.match(page, /customerName/);
  assert.match(page, /customer\.email \|\| `Customer #\$\{customer\.id\}`/);
  assert.match(page, /deactivate the customer while preserving historical records/);
});
