const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const Module = require('node:module');

const TEST_SECRET = 'phase-a2-test-secret-that-is-at-least-32-characters';
process.env.JWT_SECRET = TEST_SECRET;

const authRepositoryPath = require.resolve('../src/repositories/authRepository');
const originalAuthRepository = require.cache[authRepositoryPath];
const repositoryStub = new Module(authRepositoryPath);
repositoryStub.filename = authRepositoryPath;
repositoryStub.loaded = true;

let currentUser = {
  user_id: 7,
  customer_id: 12,
  username: 'customer-test',
  role: 'CUSTOMER',
};

repositoryStub.exports = {
  findUserById: async () => currentUser,
};
require.cache[authRepositoryPath] = repositoryStub;

const { JWT_AUDIENCE, JWT_ISSUER, getJwtSecret } = require('../src/config/jwt');
const { authenticateToken, authorizeRoles } = require('../src/middleware/auth');

test.after(() => {
  if (originalAuthRepository) require.cache[authRepositoryPath] = originalAuthRepository;
  else delete require.cache[authRepositoryPath];
});

const responseRecorder = () => ({
  statusCode: 200,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

const invokeAuthentication = async authorization => {
  const req = { headers: authorization ? { authorization } : {} };
  const res = responseRecorder();
  let nextError;
  let nextCalled = false;
  await authenticateToken(req, res, error => {
    nextError = error;
    nextCalled = true;
  });
  return { req, res, nextCalled, nextError };
};

const validToken = (overrides = {}, options = {}) => jwt.sign(
  { userId: 7, ...overrides },
  TEST_SECRET,
  { issuer: JWT_ISSUER, audience: JWT_AUDIENCE, expiresIn: '5m', ...options }
);

test('JWT secret is required and must be at least 32 characters', () => {
  const original = process.env.JWT_SECRET;
  delete process.env.JWT_SECRET;
  assert.throws(() => getJwtSecret(), /at least 32 characters/);
  process.env.JWT_SECRET = 'too-short';
  assert.throws(() => getJwtSecret(), /at least 32 characters/);
  process.env.JWT_SECRET = original;
  assert.equal(getJwtSecret(), TEST_SECRET);
});

test('missing bearer token is rejected with 401', async () => {
  const result = await invokeAuthentication();
  assert.equal(result.res.statusCode, 401);
  assert.equal(result.nextCalled, false);
});

test('malformed token is rejected with 401', async () => {
  const result = await invokeAuthentication('Bearer not-a-jwt');
  assert.equal(result.res.statusCode, 401);
  assert.equal(result.nextCalled, false);
});

test('token with an invalid signature is rejected with 401', async () => {
  const token = jwt.sign(
    { userId: 7 },
    'another-test-secret-that-is-at-least-32-characters',
    { issuer: JWT_ISSUER, audience: JWT_AUDIENCE, expiresIn: '5m' }
  );
  const result = await invokeAuthentication(`Bearer ${token}`);
  assert.equal(result.res.statusCode, 401);
  assert.equal(result.nextCalled, false);
});

test('expired token is rejected with 401', async () => {
  const result = await invokeAuthentication(`Bearer ${validToken({}, { expiresIn: -1 })}`);
  assert.equal(result.res.statusCode, 401);
  assert.equal(result.nextCalled, false);
});

test('valid token restores the canonical current database identity', async () => {
  currentUser = { user_id: 7, customer_id: 12, username: 'customer-test', role: 'CUSTOMER' };
  const result = await invokeAuthentication(`Bearer ${validToken({ role: 'ADMIN', customerId: 999 })}`);
  assert.equal(result.res.statusCode, 200);
  assert.equal(result.nextCalled, true);
  assert.equal(result.nextError, undefined);
  assert.deepEqual(result.req.user, {
    userId: 7,
    customerId: 12,
    username: 'customer-test',
    role: 'CUSTOMER',
  });
});

test('role casing and whitespace are canonicalized for customer authorization', async () => {
  currentUser = { user_id: 7, customer_id: 12, username: 'customer-test', role: ' customer ' };
  const result = await invokeAuthentication(`Bearer ${validToken()}`);
  assert.equal(result.res.statusCode, 200);
  assert.equal(result.req.user.role, 'CUSTOMER');
  const res = responseRecorder();
  let nextCalled = false;
  authorizeRoles('CUSTOMER')(result.req, res, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
  currentUser = { user_id: 7, customer_id: 12, username: 'customer-test', role: 'CUSTOMER' };
});

test('token for an unknown or deleted user is rejected with 401', async () => {
  currentUser = null;
  const result = await invokeAuthentication(`Bearer ${validToken()}`);
  assert.equal(result.res.statusCode, 401);
  assert.equal(result.nextCalled, false);
  currentUser = { user_id: 7, customer_id: 12, username: 'customer-test', role: 'CUSTOMER' };
});

test('authenticated role outside the allow-list is rejected with 403', () => {
  const req = { user: { role: 'CUSTOMER' } };
  const res = responseRecorder();
  let nextCalled = false;
  authorizeRoles('ADMIN', 'PHARMACIST')(req, res, () => { nextCalled = true; });
  assert.equal(res.statusCode, 403);
  assert.equal(nextCalled, false);
});

test('normalized pharmacist role is allowed to use the send-to-billing role gate', async () => {
  currentUser = { user_id: 7, customer_id: null, username: 'pharmacist-test', role: ' pharmacist ' };
  const result = await invokeAuthentication(`Bearer ${validToken()}`);
  assert.equal(result.req.user.role, 'PHARMACIST');
  const res = responseRecorder();
  let nextCalled = false;
  authorizeRoles('ADMIN', 'PHARMACIST')(result.req, res, () => { nextCalled = true; });
  assert.equal(res.statusCode, 200);
  assert.equal(nextCalled, true);
  currentUser = { user_id: 7, customer_id: 12, username: 'customer-test', role: 'CUSTOMER' };
});
