import test from 'node:test'
import assert from 'node:assert/strict'
import { classifyApiError } from '../src/services/api.js'
import authService, { isUsableSession, SENSITIVE_CACHE_KEYS, SESSION_KEY } from '../src/services/authService.js'
import { AUTH_STATES, DASHBOARD_PATHS, DATA_SCOPES } from '../src/config/authorization.js'

const token = secondsFromNow => {
  const payload = Buffer.from(JSON.stringify({ userId: 1, exp: Math.floor(Date.now() / 1000) + secondsFromNow })).toString('base64url')
  return `test.${payload}.signature`
}

const installLocalStorage = entries => {
  const values = new Map(Object.entries(entries || {}))
  globalThis.localStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  }
  return values
}

test('HTTP errors classify 401, 403, and network failure distinctly', () => {
  assert.equal(classifyApiError({ response: { status: 401 } }), AUTH_STATES.UNAUTHENTICATED)
  assert.equal(classifyApiError({ response: { status: 403 } }), AUTH_STATES.FORBIDDEN)
  assert.equal(classifyApiError({ request: {} }), AUTH_STATES.API_UNAVAILABLE)
  assert.equal(classifyApiError({ response: { status: 500 } }), 'API_ERROR')
})

test('session restore accepts only a complete, unexpired JWT-backed session', () => {
  assert.equal(isUsableSession({ token: token(300), userId: 1, role: 'CUSTOMER' }), true)
  assert.equal(isUsableSession({ token: token(-1), userId: 1, role: 'CUSTOMER' }), false)
  assert.equal(isUsableSession({ token: 'malformed', userId: 1, role: 'CUSTOMER' }), false)
  assert.equal(isUsableSession({ token: token(300), userId: 1 }), false)
})

test('invalid stored session is removed instead of being restored', () => {
  const values = installLocalStorage({
    [SESSION_KEY]: JSON.stringify({ token: token(-1), userId: 1, role: 'CUSTOMER' }),
    pharmacy_token: 'stale-token',
  })
  assert.equal(authService.getSession(), null)
  assert.equal(values.has(SESSION_KEY), false)
  assert.equal(values.has('pharmacy_token'), false)
})

test('logout storage cleanup removes authentication and sensitive role caches', () => {
  const seeded = Object.fromEntries([
    [SESSION_KEY, 'session'],
    ['pharmacy_token', 'token'],
    ...SENSITIVE_CACHE_KEYS.map(key => [key, 'private']),
    ['public_preference', 'keep'],
  ])
  const values = installLocalStorage(seeded)
  authService.clearSession()
  assert.equal(values.get('public_preference'), 'keep')
  assert.equal(values.has(SESSION_KEY), false)
  assert.equal(values.has('pharmacy_token'), false)
  SENSITIVE_CACHE_KEYS.forEach(key => assert.equal(values.has(key), false))
})

test('every persisted role has an explicit dashboard and least-privilege data scope', () => {
  for (const role of ['CUSTOMER', 'ADMIN', 'PHARMACIST', 'INVENTORY', 'SALES', 'SUPPLIER']) {
    assert.equal(authService.getDashboardPath(role), DASHBOARD_PATHS[role])
    assert.ok(Array.isArray(DATA_SCOPES[role]))
  }
  assert.deepEqual(DATA_SCOPES.CUSTOMER, [])
  assert.deepEqual(DATA_SCOPES.SUPPLIER, ['suppliers'])
  assert.equal(DATA_SCOPES.INVENTORY.includes('sales'), false)
  assert.equal(DATA_SCOPES.SALES.includes('suppliers'), false)
})
