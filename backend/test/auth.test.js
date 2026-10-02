const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const bcrypt = require('bcryptjs');

process.env.AUTH_JWT_SECRET = 'test-only-secret-0123456789-abcdefghijklmnopqrstuvwxyz';
const users = require('../src/repositories/userRepository');
const medicines = require('../src/repositories/medicineRepository');
const prescriptions = require('../src/repositories/prescriptionRepository');
const app = require('../src/app');
const { validateRegistration } = require('../src/validators/authValidator');

const original = {
  findByIdentifier: users.findByIdentifier,
  findById: users.findById,
  createCustomerAccount: users.createCustomerAccount,
  medicineFindAll: medicines.findAll,
  medicineCount: medicines.getCount,
  prescriptionFind: prescriptions.findById,
  prescriptionAvailability: prescriptions.checkAvailability,
};
const records = new Map();
let nextId = 1;
users.findByIdentifier = async value => [...records.values()].find(user => user.username === value || user.email === value) || null;
users.findById = async id => records.get(id) || null;
users.createCustomerAccount = async (data, hash) => {
  assert.notEqual(hash, data.password);
  assert.equal(await bcrypt.compare(data.password, hash), true);
  const user = { id: nextId++, username: data.username, email: data.email, password_hash: hash, role: 'CUSTOMER', account_status: 'ACTIVE', customer_id: 100 };
  records.set(user.id, user);
  return user;
};
medicines.findAll = async () => [];
medicines.getCount = async () => 0;
prescriptions.findById = async id => ({ id, customer_id: 100, first_name: 'Kamal', last_name: 'Perera' });
prescriptions.checkAvailability = async () => [
  { medicine_id: 4, medicine_name: 'Medicine', batch_number: 'B1', requested_quantity: 2, unit_price: 7.5, availability_status: 'available' },
  { medicine_id: 5, medicine_name: 'Unavailable', requested_quantity: 1, unit_price: 9, availability_status: 'out_of_stock' }
];
test.after(() => {
  users.findByIdentifier = original.findByIdentifier;
  users.findById = original.findById;
  users.createCustomerAccount = original.createCustomerAccount;
  medicines.findAll = original.medicineFindAll;
  medicines.getCount = original.medicineCount;
  prescriptions.findById = original.prescriptionFind;
  prescriptions.checkAvailability = original.prescriptionAvailability;
});

const registration = {
  full_name: 'Kamal Perera', email: 'kamal@example.com', phone: '0771234567',
  address: 'Colombo', username: 'kamal', password: 'secret-password-123',
  confirm_password: 'secret-password-123'
};

test('registration validates required details, password and confirmation', () => {
  assert.throws(() => validateRegistration({ ...registration, full_name: 'Kamal' }), /first and last/);
  assert.throws(() => validateRegistration({ ...registration, password: 'short', confirm_password: 'short' }), /at least 12/);
  assert.throws(() => validateRegistration({ ...registration, confirm_password: 'different' }), /do not match/);
  assert.throws(() => validateRegistration({ ...registration, email: 'bad' }), /valid email/);
});

test('registration hashes password, omits hash from response, and rejects duplicate username/email', async () => {
  const first = await request(app).post('/api/auth/register').send(registration);
  assert.equal(first.status, 201);
  assert.equal(first.body.data.user.role, 'CUSTOMER');
  assert.equal(first.body.data.user.password_hash, undefined);
  assert.equal(first.body.data.user.password, undefined);
  assert.equal((await request(app).post('/api/auth/register').send(registration)).status, 409);
  assert.equal((await request(app).post('/api/auth/register').send({ ...registration, username: 'different' })).status, 409);
});

test('login rejects unknown/wrong password and returns a restorable session for a valid account', async () => {
  assert.equal((await request(app).post('/api/auth/login').send({ identifier: 'missing', password: registration.password })).status, 401);
  assert.equal((await request(app).post('/api/auth/login').send({ identifier: 'kamal', password: 'wrong-password' })).status, 401);
  const login = await request(app).post('/api/auth/login').send({ identifier: registration.email, password: registration.password });
  assert.equal(login.status, 200);
  assert.equal(login.body.data.user.role, 'CUSTOMER');
  assert.ok(login.body.data.token);
  const restored = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${login.body.data.token}`);
  assert.equal(restored.status, 200);
  assert.equal(restored.body.data.user.id, login.body.data.user.id);
  assert.equal(restored.body.data.user.password_hash, undefined);
});

test('business APIs return 401 without auth and 403 for the wrong role', async () => {
  assert.equal((await request(app).get('/api/medicines')).status, 401);
  const login = await request(app).post('/api/auth/login').send({ identifier: 'kamal', password: registration.password });
  const token = login.body.data.token;
  assert.equal((await request(app).get('/api/medicines').set('Authorization', `Bearer ${token}`)).status, 403);
  assert.equal((await request(app).post('/api/sales').set('Authorization', `Bearer ${token}`).send({})).status, 403);
  assert.equal((await request(app).get('/api/auth/me').set('Authorization', 'Bearer invalid')).status, 401);
});

test('correct role reaches endpoint; cross-role staff request is denied', async () => {
  const staff = { id: nextId++, username: 'inventory', email: 'inventory@example.com',
    password_hash: await bcrypt.hash(registration.password, 12), role: 'INVENTORY_STAFF', account_status: 'ACTIVE' };
  records.set(staff.id, staff);
  const login = await request(app).post('/api/auth/login').send({ identifier: 'inventory', password: registration.password });
  const token = login.body.data.token;
  assert.equal((await request(app).get('/api/medicines').set('Authorization', `Bearer ${token}`)).status, 200);
  assert.equal((await request(app).post('/api/sales').set('Authorization', `Bearer ${token}`).send({})).status, 403);
  assert.equal((await request(app).get('/api/prescriptions').set('Authorization', `Bearer ${token}`)).status, 403);
  staff.account_status = 'DISABLED';
  assert.equal((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`)).status, 401);
});

test('sales role can load available items by prescription ID without opening prescription management', async () => {
  const staff = { id: nextId++, username: 'sales', email: 'sales@example.com',
    password_hash: await bcrypt.hash(registration.password, 12), role: 'SALES_STAFF', account_status: 'ACTIVE' };
  records.set(staff.id, staff);
  const login = await request(app).post('/api/auth/login').send({ identifier: 'sales', password: registration.password });
  const token = login.body.data.token;
  const result = await request(app).get('/api/sales/prescription/23/billing').set('Authorization', `Bearer ${token}`);
  assert.equal(result.status, 200);
  assert.equal(result.body.data.customer.id, 100);
  assert.equal(result.body.data.items.length, 1);
  assert.equal(result.body.data.unavailable_items.length, 1);
  assert.equal((await request(app).get('/api/prescriptions/23').set('Authorization', `Bearer ${token}`)).status, 403);
});
