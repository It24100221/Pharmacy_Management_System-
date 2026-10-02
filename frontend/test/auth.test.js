import test from 'node:test'
import assert from 'node:assert/strict'
import { ROLE_HOME, homeForRole, routeDecision } from '../src/utils/auth.js'
import { TOKEN_KEY, getToken, setToken, clearToken } from '../src/utils/session.js'
import { linksForUser } from '../src/utils/navigation.js'

test('every approved role redirects to its own dashboard', () => {
  assert.equal(Object.keys(ROLE_HOME).length, 5)
  for (const [role, path] of Object.entries(ROLE_HOME)) {
    assert.equal(homeForRole(role), path)
  }
  assert.equal(homeForRole('UNKNOWN'), '/login')
})

test('protected routes redirect signed-out users and deny the wrong role', () => {
  assert.equal(routeDecision(null, ['SALES_STAFF']), 'login')
  assert.equal(routeDecision({ role: 'CUSTOMER' }, ['SALES_STAFF']), 'unauthorized')
  assert.equal(routeDecision({ role: 'INVENTORY_STAFF' }, ['SALES_STAFF']), 'unauthorized')
  assert.equal(routeDecision({ role: 'SALES_STAFF' }, ['SALES_STAFF']), 'allow')
})

test('session token storage supports restoration and logout', () => {
  const values = new Map()
  const storage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }
  assert.equal(getToken(storage), null)
  setToken('signed-session', storage)
  assert.equal(values.get(TOKEN_KEY), 'signed-session')
  assert.equal(getToken(storage), 'signed-session')
  clearToken(storage)
  assert.equal(getToken(storage), null)
})

test('public navigation has only public links and staff navigation is role-specific', () => {
  assert.deepEqual(linksForUser(null).map(([label]) => label), ['Home', 'About', 'Services', 'Pharmacy Items', 'Login', 'Register'])
  const sales = linksForUser({ role: 'SALES_STAFF' }).map(([, path]) => path)
  assert.ok(sales.includes('/sales'))
  assert.equal(sales.includes('/prescriptions/create'), false)
  assert.equal(sales.includes('/medicines'), false)
  const supplier = linksForUser({ role: 'SUPPLIER' }).map(([, path]) => path)
  assert.ok(supplier.includes('/purchases'))
  assert.equal(supplier.includes('/medicines'), false)
})
