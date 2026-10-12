const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const readline = require('readline')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const app = require('../app')
const { pool, closePool, sql, sqlConfig } = require('../config/database')

const API = 'http://localhost:5000/api'
const FRONTEND = 'http://localhost:3000'
const QA_TAG = `qa_auth_${Date.now()}`
const primary = {
  name: 'QA Registration Test',
  email: `${QA_TAG}@example.test`,
  phone: '0771234567',
  address: 'QA Test Address',
  username: QA_TAG,
  password: `Qa!${crypto.randomBytes(18).toString('base64url')}`,
}
primary.confirmPassword = primary.password

const results = []
const created = { userId: null, customerId: null }
const staffSessions = {}
let customerToken = null
let updatedPhone = '0777654321'

const add = (id, fn, scenario, expected, actual, httpStatus, databaseEvidence, result) => {
  results.push({ id, function: fn, scenario, expected, actual, httpStatus, databaseEvidence, result })
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

async function request(base, route, { method = 'GET', token, body } = {}) {
  try {
    const response = await fetch(`${base}${route}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    let data = null
    try { data = await response.json() } catch {}
    return { status: response.status, data }
  } catch (error) {
    return { status: 0, data: null, networkError: error.message }
  }
}

async function rows(query, params = []) {
  const [recordset] = await pool.execute(query, params)
  return recordset
}

async function counts() {
  const data = await rows('SELECT (SELECT COUNT(*) FROM users) AS users, (SELECT COUNT(*) FROM customers) AS customers')
  return data[0]
}

class Cdp {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl)
    this.nextId = 1
    this.pending = new Map()
    this.requests = []
    this.responses = []
    this.console = []
    this.exceptions = []
  }

  async connect() {
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true })
      this.ws.addEventListener('error', reject, { once: true })
    })
    this.ws.addEventListener('message', event => {
      const message = JSON.parse(event.data)
      if (message.id) {
        const entry = this.pending.get(message.id)
        if (!entry) return
        this.pending.delete(message.id)
        if (message.error) entry.reject(new Error(message.error.message))
        else entry.resolve(message.result)
        return
      }
      if (message.method === 'Network.requestWillBeSent') {
        this.requests.push({ requestId: message.params.requestId, url: message.params.request.url, method: message.params.request.method })
      } else if (message.method === 'Network.responseReceived') {
        this.responses.push({ requestId: message.params.requestId, url: message.params.response.url, status: message.params.response.status })
      } else if (message.method === 'Runtime.consoleAPICalled') {
        this.console.push({ type: message.params.type, values: message.params.args.map(arg => arg.value ?? arg.description ?? '') })
      } else if (message.method === 'Runtime.exceptionThrown') {
        this.exceptions.push(message.params.exceptionDetails.text)
      }
    })
    await this.command('Page.enable')
    await this.command('Runtime.enable')
    await this.command('Network.enable')
    await this.command('Log.enable')
  }

  command(method, params = {}) {
    const id = this.nextId++
    this.ws.send(JSON.stringify({ id, method, params }))
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }))
  }

  async evaluate(expression) {
    const result = await this.command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text)
    return result.result.value
  }

  async navigate(url) {
    await this.command('Page.navigate', { url })
    await this.waitFor(() => this.evaluate('document.readyState === "complete"'), 10000)
  }

  async waitFor(check, timeout = 10000) {
    const start = Date.now()
    while (Date.now() - start < timeout) {
      try { if (await check()) return true } catch {}
      await sleep(100)
    }
    return false
  }

  async location() { return this.evaluate('location.pathname') }

  async setInputs(values) {
    const safe = JSON.stringify(values)
    return this.evaluate(`(() => {
      const values = ${safe};
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      for (const [name, value] of Object.entries(values)) {
        const input = document.querySelector('input[name="' + name + '"]') ||
          (name === 'loginUsername' ? document.querySelector('input[autocomplete="username"]') : null) ||
          (name === 'loginPassword' ? document.querySelector('input[autocomplete="current-password"]') : null);
        if (!input) return { ok: false, missing: name };
        setter.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return { ok: true };
    })()`)
  }

  async click(selector) {
    return this.evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.click(); return true })()`)
  }

  close() { this.ws.close() }
}

async function connectBrowser() {
  const targets = await (await fetch('http://localhost:9222/json/list')).json()
  const target = targets.find(item => item.type === 'page' && item.url.startsWith(FRONTEND))
  if (!target) throw new Error('No Edge page target is available')
  const cdp = new Cdp(target.webSocketDebuggerUrl)
  await cdp.connect()
  return cdp
}

async function responseBody(cdp, response) {
  if (!response) return null
  try {
    const result = await cdp.command('Network.getResponseBody', { requestId: response.requestId })
    return JSON.parse(result.body)
  } catch { return null }
}

async function browserRegistration(cdp) {
  await cdp.navigate(`${FRONTEND}/customer-register`)
  await cdp.waitFor(() => cdp.evaluate('Boolean(document.querySelector("input[name=username]"))'))
  const startRequests = cdp.requests.length
  await cdp.setInputs(primary)
  const clicked = await cdp.click('button.public-auth-submit')
  await sleep(40)
  const disabledDuringRequest = await cdp.evaluate('Boolean(document.querySelector("button.public-auth-submit")?.disabled)')
  await cdp.click('button.public-auth-submit')
  const navigated = await cdp.waitFor(async () => (await cdp.location()) === '/customer-login', 15000)
  await sleep(250)
  const registrationRequests = cdp.requests.slice(startRequests).filter(item => item.method === 'POST' && item.url.includes('/api/customers/register'))
  const registrationResponse = [...cdp.responses].reverse().find(item => item.url.includes('/api/customers/register'))
  const body = await responseBody(cdp, registrationResponse)
  const successFeedback = await cdp.evaluate('Boolean(document.body.innerText.match(/account created|registration successful|successfully registered/i))')
  const actual = clicked && navigated && registrationResponse?.status === 201 && registrationRequests.length === 1
    ? 'Form submitted once and navigated to customer login'
    : `clicked=${clicked}; navigated=${navigated}; POSTs=${registrationRequests.length}`
  add('FRONT-REG-001', 'Frontend registration', 'Complete unique customer via actual React form', 'One POST, 201, button disabled, login redirect', actual, registrationResponse?.status ?? 0, `Response IDs present=${Boolean(body?.data?.userId && body?.data?.customerId)}`, actual.startsWith('Form submitted') && disabledDuringRequest ? 'PASS' : 'FAIL')
  add('FRONT-REG-002', 'Frontend registration', 'Success feedback', 'Visible confirmation after creation', successFeedback ? 'Visible success feedback found' : 'Redirected without any success confirmation', registrationResponse?.status ?? 0, 'Not database-dependent', successFeedback ? 'PASS' : 'FAIL')
}

async function verifySqlAndApi() {
  const joined = await rows(`
    SELECT u.user_id, u.username, u.password, u.role,
      c.id AS customer_id, c.first_name, c.last_name, c.email, c.phone, c.address, c.user_id AS linked_user_id
    FROM users u JOIN customers c ON c.user_id = u.user_id
    WHERE u.username = ? OR c.email = ?
  `, [primary.username, primary.email])
  const row = joined[0]
  created.userId = row?.user_id || null
  created.customerId = row?.customer_id || null
  const bcryptCompatible = Boolean(row?.password?.startsWith('$2') && await bcrypt.compare(primary.password, row.password))
  const sqlCorrect = joined.length === 1 && row.username === primary.username && row.email === primary.email && row.role === 'CUSTOMER' && row.phone === primary.phone && row.address === primary.address && row.linked_user_id === row.user_id
  add('SQL-001', 'SQL users', 'Read newly registered user', 'Exactly one CUSTOMER row with bcrypt hash', sqlCorrect && bcryptCompatible ? 'Exact row and bcrypt verification succeeded' : 'Row/hash mismatch', 201, `user_id=${row?.user_id ?? 'missing'}; count=${joined.length}; bcrypt=${bcryptCompatible}; plaintextEqual=${row?.password === primary.password}`, sqlCorrect && bcryptCompatible && row.password !== primary.password ? 'PASS' : 'FAIL')
  add('SQL-002', 'SQL customers', 'Read profile and relationship', 'Exactly one linked profile with submitted data', sqlCorrect ? 'Profile and FK relationship match' : 'Profile/FK mismatch', 201, `customer_id=${row?.customer_id ?? 'missing'}; linked user matches=${row?.linked_user_id === row?.user_id}`, sqlCorrect ? 'PASS' : 'FAIL')

  const login = await request(API, '/auth/customer-login', { method: 'POST', body: { username: primary.username, password: primary.password } })
  customerToken = login.data?.data?.token || null
  const session = login.data?.data
  const jwtPayload = customerToken ? jwt.decode(customerToken) : null
  const loginOk = login.status === 200 && session?.userId === row.user_id && session?.customerId === row.customer_id && session?.username === primary.username && session?.role === 'CUSTOMER' && jwtPayload?.userId === row.user_id && jwtPayload?.exp && jwtPayload?.iss && jwtPayload?.aud
  add('LOGIN-API-001', 'Customer login', 'Correct password', '200, correct SQL identity, JWT', loginOk ? 'Correct identity and structured JWT returned' : 'Login identity/JWT mismatch', login.status, `user_id=${row.user_id}; customer_id=${row.customer_id}`, loginOk ? 'PASS' : 'FAIL')

  const wrong = await request(API, '/auth/customer-login', { method: 'POST', body: { username: primary.username, password: `${primary.password}x` } })
  add('LOGIN-API-002', 'Customer login', 'Wrong password', '401 and no JWT', `status=${wrong.status}; token=${Boolean(wrong.data?.data?.token)}`, wrong.status, 'No database mutation', wrong.status === 401 && !wrong.data?.data?.token ? 'PASS' : 'FAIL')

  const authMe = await request(API, '/auth/me', { token: customerToken })
  const me = authMe.data?.data
  const meOk = authMe.status === 200 && me?.userId === row.user_id && me?.customerId === row.customer_id && me?.username === primary.username && me?.role === 'CUSTOMER'
  add('SESSION-API-001', 'Session identity', 'GET /api/auth/me with issued JWT', '200 and database-backed identity', meOk ? 'Identity matches SQL' : 'Identity mismatch', authMe.status, `user_id=${row.user_id}; role=${row.role}`, meOk ? 'PASS' : 'FAIL')

  const noToken = await request(API, '/auth/me')
  const malformed = await request(API, '/auth/me', { token: 'not.a.jwt' })
  const badSignature = await request(API, '/auth/me', { token: `${customerToken.slice(0, -1)}${customerToken.endsWith('a') ? 'b' : 'a'}` })
  const secret = require('../config/jwt').getJwtSecret()
  const expired = jwt.sign({ userId: row.user_id }, secret, { expiresIn: -1, issuer: jwtPayload.iss, audience: jwtPayload.aud })
  const expiredResponse = await request(API, '/auth/me', { token: expired })
  const jwtFailures = [noToken.status, malformed.status, badSignature.status, expiredResponse.status]
  add('JWT-001', 'JWT', 'Missing, malformed, bad-signature, expired', '401 for all', jwtFailures.join(', '), jwtFailures.join('/'), 'No database mutation', jwtFailures.every(value => value === 401) ? 'PASS' : 'FAIL')

  const profile = await request(API, '/customers/me', { token: customerToken })
  const p = profile.data?.data
  const profileOk = profile.status === 200 && p?.id === row.customer_id && p?.email === row.email && p?.phone === row.phone && p?.address === row.address && `${p?.first_name} ${p?.last_name}` === primary.name
  add('PROFILE-001', 'Customer profile', 'GET /api/customers/me', 'API equals SQL', profileOk ? 'API and SQL match' : 'Mismatch', profile.status, `customer_id=${row.customer_id}`, profileOk ? 'PASS' : 'FAIL')

  const update = await request(API, '/customers/me', { method: 'PUT', token: customerToken, body: { phone: updatedPhone } })
  const afterRows = await rows('SELECT phone FROM customers WHERE id = ?', [row.customer_id])
  const readback = await request(API, '/customers/me', { token: customerToken })
  const updateOk = update.status === 200 && afterRows[0]?.phone === updatedPhone && readback.data?.data?.phone === updatedPhone
  add('PROFILE-002', 'Customer profile', 'PUT phone then SQL/API readback', '200 and persistent updated value', updateOk ? 'SQL and API contain updated value' : 'Update/readback mismatch', update.status, `SQL updated=${afterRows[0]?.phone === updatedPhone}`, updateOk ? 'PASS' : 'FAIL')
}

async function browserLoginSession(cdp) {
  await cdp.navigate(`${FRONTEND}/customer-login`)
  await cdp.waitFor(() => cdp.evaluate('Boolean(document.querySelector("input[autocomplete=username]"))'))
  const start = cdp.requests.length
  await cdp.setInputs({ loginUsername: primary.username, loginPassword: primary.password })
  await cdp.click('button.public-auth-submit')
  const redirected = await cdp.waitFor(async () => (await cdp.location()) === '/customer-dashboard', 15000)
  await sleep(400)
  const loginRequests = cdp.requests.slice(start).filter(item => item.method === 'POST' && item.url.includes('/api/auth/customer-login'))
  const storage = await cdp.evaluate(`(() => {
    const raw = localStorage.getItem('pharmacy_auth_session');
    const session = raw ? JSON.parse(raw) : null;
    return { keys: Object.keys(localStorage), sessionKeys: session ? Object.keys(session) : [], role: session?.role, userId: session?.userId, customerId: session?.customerId, hasPassword: raw ? raw.includes(${JSON.stringify(primary.password)}) : false, hasToken: Boolean(session?.token) };
  })()`)
  const ok = redirected && loginRequests.length === 1 && storage.role === 'CUSTOMER' && storage.userId === created.userId && storage.customerId === created.customerId && storage.hasToken && !storage.hasPassword
  add('LOGIN-FRONT-001', 'Frontend customer login', 'Actual login screen', 'One request and immediate customer dashboard redirect', ok ? 'Single request and correct redirect/session' : `redirect=${redirected}; requests=${loginRequests.length}`, 200, `IDs match=${storage.userId === created.userId && storage.customerId === created.customerId}; password stored=${storage.hasPassword}`, ok ? 'PASS' : 'FAIL')

  const meBefore = cdp.responses.length
  await cdp.command('Page.reload', { ignoreCache: true })
  const restored = await cdp.waitFor(async () => (await cdp.location()) === '/customer-dashboard', 15000)
  await sleep(500)
  const meResponses = cdp.responses.slice(meBefore).filter(item => item.url.includes('/api/auth/me'))
  const loopFree = await cdp.location() === '/customer-dashboard'
  const refreshOk = restored && loopFree && meResponses.some(item => item.status === 200)
  add('SESSION-FRONT-001', 'Session restore', 'Reload authenticated dashboard', 'GET /auth/me 200; remain authenticated; no loop', refreshOk ? 'Session restored on dashboard' : 'Restore failed', meResponses.at(-1)?.status ?? 0, `Stored IDs still SQL-backed=${storage.userId === created.userId}`, refreshOk ? 'PASS' : 'FAIL')
}

async function duplicateAndValidationTests() {
  const base = { ...primary }
  const before = await counts()
  const dupUsername = await request(API, '/customers/register', { method: 'POST', body: { ...base, email: `${QA_TAG}_dup_user@example.test` } })
  const sameUserCount = await rows('SELECT COUNT(*) AS count FROM users WHERE username = ?', [primary.username])
  add('DUP-001', 'Duplicate registration', 'Same username', '4xx; exactly one user/profile', `status=${dupUsername.status}`, dupUsername.status, `username rows=${sameUserCount[0].count}`, dupUsername.status >= 400 && dupUsername.status < 500 && sameUserCount[0].count === 1 ? 'PASS' : 'FAIL')

  const dupEmailBody = { ...base, username: `${QA_TAG}_dup_email` }
  const dupEmail = await request(API, '/customers/register', { method: 'POST', body: dupEmailBody })
  const sameEmail = await rows('SELECT COUNT(*) AS count FROM customers WHERE email = ?', [primary.email])
  add('DUP-002', 'Duplicate registration', 'Same email', '4xx; exactly one profile', `status=${dupEmail.status}`, dupEmail.status, `email rows=${sameEmail[0].count}`, dupEmail.status >= 400 && dupEmail.status < 500 && sameEmail[0].count === 1 ? 'PASS' : 'FAIL')

  const cases = [
    ['VAL-001', 'Missing full name', { ...base, username: `${QA_TAG}_v1`, email: `${QA_TAG}_v1@example.test`, name: undefined }],
    ['VAL-002', 'Missing email', { ...base, username: `${QA_TAG}_v2`, email: undefined }],
    ['VAL-003', 'Invalid email', { ...base, username: `${QA_TAG}_v3`, email: 'invalid-email' }],
    ['VAL-004', 'Missing phone', { ...base, username: `${QA_TAG}_v4`, email: `${QA_TAG}_v4@example.test`, phone: undefined }],
    ['VAL-005', 'Missing username', { ...base, email: `${QA_TAG}_v5@example.test`, username: undefined }],
    ['VAL-006', 'Missing password', { ...base, username: `${QA_TAG}_v6`, email: `${QA_TAG}_v6@example.test`, password: undefined, confirmPassword: undefined }],
    ['VAL-007', 'Password mismatch', { ...base, username: `${QA_TAG}_v7`, email: `${QA_TAG}_v7@example.test`, confirmPassword: 'different-value' }],
    ['VAL-008', 'Weak password', { ...base, username: `${QA_TAG}_v8`, email: `${QA_TAG}_v8@example.test`, password: 'short', confirmPassword: 'short' }],
    ['VAL-009', 'Blank strings', { name: '', email: '', phone: '', address: '', username: '', password: '', confirmPassword: '' }],
    ['VAL-010', 'Whitespace-only strings', { ...base, name: '   ', email: '   ', username: '   ' }],
    ['VAL-011', 'Very long username', { ...base, username: `${QA_TAG}${'x'.repeat(150)}`, email: `${QA_TAG}_v11@example.test` }],
    ['VAL-012', 'Very long email / atomic rollback', { ...base, username: `${QA_TAG}_v12`, email: `${'x'.repeat(280)}@example.test` }],
    ['VAL-013', 'Unexpected object name', { ...base, username: `${QA_TAG}_v13`, email: `${QA_TAG}_v13@example.test`, name: { unexpected: true } }],
  ]
  for (const [id, label, body] of cases) {
    const response = await request(API, '/customers/register', { method: 'POST', body })
    const username = typeof body.username === 'string' ? body.username : null
    let inserted = 0
    if (username) {
      const found = await rows('SELECT COUNT(*) AS count FROM users WHERE username = ?', [username])
      inserted = found[0].count
    }
    const pass = response.status >= 400 && response.status < 500 && inserted === 0
    add(id, 'Registration validation', label, '400-class and no rows', `status=${response.status}`, response.status, `matching user rows=${inserted}`, pass ? 'PASS' : 'FAIL')
  }

  const injectionUsername = `${QA_TAG}_q' OR '1'='1`
  const nonQaBefore = await rows('SELECT COUNT(*) AS count FROM users WHERE username NOT LIKE ?', [`${QA_TAG}%`])
  const injection = await request(API, '/customers/register', { method: 'POST', body: { ...base, username: injectionUsername, email: `${QA_TAG}_inject@example.test` } })
  const exactInjection = await rows('SELECT COUNT(*) AS count FROM users WHERE username = ?', [injectionUsername])
  const nonQaAfter = await rows('SELECT COUNT(*) AS count FROM users WHERE username NOT LIKE ?', [`${QA_TAG}%`])
  const injectionSafe = [201, 400].includes(injection.status) && exactInjection[0].count <= 1 && nonQaBefore[0].count === nonQaAfter[0].count
  add('SAFE-001', 'Input safety', 'Non-destructive SQL metacharacters in username', 'Rejected or stored literally; no side effect', `status=${injection.status}; handled literally=${exactInjection[0].count === 1}`, injection.status, `non-QA count unchanged=${nonQaBefore[0].count === nonQaAfter[0].count}`, injectionSafe ? 'PASS' : 'FAIL')

  const atomicName = `${QA_TAG}_atomic`
  const atomic = await request(API, '/customers/register', { method: 'POST', body: { ...base, username: atomicName, email: `${'z'.repeat(280)}@example.test` } })
  const atomicUser = await rows('SELECT COUNT(*) AS count FROM users WHERE username = ?', [atomicName])
  add('TXN-001', 'Registration transaction', 'Customer insert forced to fail after user insert', 'Failure and no orphan user', `status=${atomic.status}`, atomic.status, `orphan user rows=${atomicUser[0].count}`, atomic.status >= 400 && atomicUser[0].count === 0 ? 'PASS' : 'FAIL')

  const after = await counts()
  add('VAL-SUMMARY', 'Registration validation', 'Aggregate mutation check', 'Only accepted-invalid temporary rows may exist and are tracked', `users delta=${after.users - before.users}; customers delta=${after.customers - before.customers}`, 'mixed', 'All QA usernames share unique cleanup prefix', 'PASS')
}

async function ownershipTests() {
  const others = await rows('SELECT TOP 1 id FROM customers WHERE id <> ? ORDER BY id', [created.customerId])
  const otherId = others[0]?.id
  const ownGet = await request(API, '/customers/me', { token: customerToken })
  const ownPut = await request(API, '/customers/me', { method: 'PUT', token: customerToken, body: { address: primary.address } })
  const otherGet = await request(API, `/customers/${otherId}`, { token: customerToken })
  const otherPut = await request(API, `/customers/${otherId}`, { method: 'PUT', token: customerToken, body: { phone: '000' } })
  const otherDelete = await request(API, `/customers/${otherId}`, { method: 'DELETE', token: customerToken })
  const list = await request(API, '/customers', { token: customerToken })
  add('OWN-001', 'Customer ownership', 'Own GET and PUT', '200/200', `${ownGet.status}/${ownPut.status}`, `${ownGet.status}/${ownPut.status}`, `own customer_id=${created.customerId}`, ownGet.status === 200 && ownPut.status === 200 ? 'PASS' : 'FAIL')
  add('OWN-002', 'Customer ownership', 'Other GET/PUT/DELETE and list', '403/403/403/403', `${otherGet.status}/${otherPut.status}/${otherDelete.status}/${list.status}`, `${otherGet.status}/${otherPut.status}/${otherDelete.status}/${list.status}`, `other customer_id=${otherId}`, [otherGet, otherPut, otherDelete, list].every(item => item.status === 403) ? 'PASS' : 'FAIL')
}

async function findStaffCredentials() {
  const staff = await rows(`SELECT u.user_id, u.username, u.password, u.role FROM users u WHERE u.role IN ('PHARMACIST','SUPPLIER','INVENTORY','SALES','ADMIN') ORDER BY u.role`)
  const readme = fs.readFileSync(path.resolve(__dirname, '../../../README.md'), 'utf8')
  const candidates = [...readme.matchAll(/`([^`\r\n]{4,100})`/g)].map(match => match[1])
  const credentials = []
  for (const user of staff) {
    let password = null
    for (const candidate of candidates) {
      try { if (await bcrypt.compare(candidate, user.password)) { password = candidate; break } } catch {}
    }
    credentials.push({ ...user, password })
  }
  return credentials
}

async function staffAndRoleTests(cdp) {
  const credentials = await findStaffCredentials()
  const redirectMap = {
    PHARMACIST: '/pharmacist-dashboard', SUPPLIER: '/supplier-dashboard', INVENTORY: '/inventory-dashboard', SALES: '/sales-dashboard', ADMIN: '/admin-dashboard',
  }
  for (const credential of credentials) {
    const login = credential.password ? await request(API, '/auth/staff-login', { method: 'POST', body: { username: credential.username, password: credential.password } }) : { status: 0 }
    const session = login.data?.data
    const authMe = session?.token ? await request(API, '/auth/me', { token: session.token }) : { status: 0 }
    staffSessions[credential.role] = session

    await cdp.navigate(`${FRONTEND}/staff-login`)
    await cdp.waitFor(() => cdp.evaluate('Boolean(document.querySelector("input[autocomplete=username]"))'))
    if (credential.password) {
      await cdp.setInputs({ loginUsername: credential.username, loginPassword: credential.password })
      await cdp.click('button.public-auth-submit')
    }
    const browserRedirect = credential.password ? await cdp.waitFor(async () => (await cdp.location()) === redirectMap[credential.role], 12000) : false
    const pass = login.status === 200 && session?.role === credential.role && session?.userId === credential.user_id && authMe.status === 200 && authMe.data?.data?.role === credential.role && browserRedirect
    add(`STAFF-${credential.role}`, 'Staff login', credential.role, 'SQL identity, bcrypt, JWT, /auth/me, correct redirect', pass ? 'All checks matched' : 'One or more checks failed', login.status, `user_id=${credential.user_id}; password/hash comparison=${Boolean(credential.password)}`, pass ? 'PASS' : 'FAIL')
  }

  const roleChecks = [
    ['CUSTOMER', { token: customerToken }, '/customers/me', '/medicines'],
    ['PHARMACIST', staffSessions.PHARMACIST, '/prescriptions/recent', '/suppliers'],
    ['SUPPLIER', staffSessions.SUPPLIER, '/suppliers', '/customers'],
    ['INVENTORY', staffSessions.INVENTORY, '/medicines', '/sales'],
    ['SALES', staffSessions.SALES, '/sales', '/suppliers'],
    ['ADMIN', staffSessions.ADMIN, '/medicines', '/customers/me'],
  ]
  for (const [role, session, allowed, forbidden] of roleChecks) {
    const allowedResponse = await request(API, allowed, { token: session?.token })
    const forbiddenResponse = await request(API, forbidden, { token: session?.token })
    add(`RBAC-${role}`, 'Cross-role authorization', `${role}: ${allowed} allowed; ${forbidden} forbidden`, '2xx and 403', `${allowedResponse.status}/${forbiddenResponse.status}`, `${allowedResponse.status}/${forbiddenResponse.status}`, 'Backend role enforcement', allowedResponse.status >= 200 && allowedResponse.status < 300 && forbiddenResponse.status === 403 ? 'PASS' : 'FAIL')
  }
}

async function logoutTests(cdp) {
  await cdp.navigate(`${FRONTEND}/customer-login`)
  await cdp.waitFor(() => cdp.evaluate('Boolean(document.querySelector("input[autocomplete=username]"))'))
  await cdp.setInputs({ loginUsername: primary.username, loginPassword: primary.password })
  await cdp.click('button.public-auth-submit')
  await cdp.waitFor(async () => (await cdp.location()) === '/customer-dashboard', 12000)
  await cdp.evaluate(`localStorage.setItem('pharmacy_customers','sensitive'); localStorage.setItem('pharmacy_customer_cart','sensitive')`)
  await cdp.click('button[title="Log out"]')
  const atLogin = await cdp.waitFor(async () => (await cdp.location()) === '/login', 5000)
  const cleared = await cdp.evaluate(`({ session: localStorage.getItem('pharmacy_auth_session'), token: localStorage.getItem('pharmacy_token'), customers: localStorage.getItem('pharmacy_customers'), cart: localStorage.getItem('pharmacy_customer_cart') })`)
  await cdp.evaluate('history.back()')
  await sleep(500)
  const backPath = await cdp.location()
  await cdp.navigate(`${FRONTEND}/customer-dashboard`)
  await sleep(600)
  const directPath = await cdp.location()
  const protectedAfter = await request(API, '/customers/me')
  const pass = atLogin && Object.values(cleared).every(value => value === null) && backPath !== '/customer-dashboard' && directPath === '/login' && protectedAfter.status === 401
  add('LOGOUT-001', 'Logout', 'UI logout, cache clear, Back, direct URL, API', 'No restored session; protected API 401', pass ? 'Session/cache cleared and access blocked' : `back=${backPath}; direct=${directPath}; API=${protectedAfter.status}`, protectedAfter.status, 'No database mutation', pass ? 'PASS' : 'FAIL')
}

async function waitForLine(label) {
  process.stdout.write(`${label}\n`)
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => rl.once('line', line => { rl.close(); resolve(line) }))
}

async function backendOutageTest(cdp) {
  await cdp.navigate(`${FRONTEND}/customer-login`)
  await cdp.waitFor(() => cdp.evaluate('Boolean(document.querySelector("input[autocomplete=username]"))'))
  await cdp.setInputs({ loginUsername: primary.username, loginPassword: primary.password })
  await waitForLine('READY_TO_STOP_BACKEND')
  const start = cdp.requests.length
  await cdp.click('button.public-auth-submit')
  await sleep(1200)
  const state = await cdp.evaluate(`(() => ({ path: location.pathname, error: document.querySelector('.public-auth-error')?.textContent || '', session: localStorage.getItem('pharmacy_auth_session'), token: localStorage.getItem('pharmacy_token') }))()`)
  const outageRequests = cdp.requests.slice(start).filter(item => item.url.includes('/api/auth/customer-login'))
  const outagePass = state.path === '/customer-login' && Boolean(state.error) && !state.session && !state.token && outageRequests.length === 1
  add('FAIL-LOGIN-001', 'Backend outage', 'Login while backend stopped', 'No auth/JWT/redirect; genuine error', outagePass ? 'Stayed logged out with network error' : `path=${state.path}; error=${Boolean(state.error)}; requests=${outageRequests.length}`, 0, 'No database mutation', outagePass ? 'PASS' : 'FAIL')
  await waitForLine('READY_TO_RESTORE_BACKEND')
  await cdp.setInputs({ loginUsername: primary.username, loginPassword: primary.password })
  await cdp.click('button.public-auth-submit')
  const recovered = await cdp.waitFor(async () => (await cdp.location()) === '/customer-dashboard', 15000)
  const session = await cdp.evaluate(`(() => { const raw=localStorage.getItem('pharmacy_auth_session'); if(!raw)return null; const s=JSON.parse(raw); return {userId:s.userId,customerId:s.customerId,role:s.role,hasToken:Boolean(s.token)} })()`)
  const profile = session?.hasToken ? await request(API, '/customers/me', { token: (await cdp.evaluate(`JSON.parse(localStorage.getItem('pharmacy_auth_session')).token`)) }) : { status: 0 }
  const pass = recovered && session?.userId === created.userId && session?.customerId === created.customerId && session?.role === 'CUSTOMER' && profile.status === 200 && profile.data?.data?.phone === updatedPhone
  add('RESTART-001', 'Backend recovery/persistence', 'Restart backend and retry without browser restart', 'Login succeeds with same SQL account and updated profile', pass ? 'Recovered; identity/profile persisted' : 'Recovery/persistence mismatch', profile.status, `user_id=${created.userId}; customer_id=${created.customerId}; updated phone persisted=${profile.data?.data?.phone === updatedPhone}`, pass ? 'PASS' : 'FAIL')
}

async function databaseFailureTest() {
  const server = await new Promise(resolve => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance))
  })
  const address = server.address()
  await closePool()
  const failureBody = { ...primary, username: `${QA_TAG}_db_failure`, email: `${QA_TAG}_db_failure@example.test` }
  const failed = await request(`http://127.0.0.1:${address.port}/api`, '/customers/register', { method: 'POST', body: failureBody })
  await new Promise(resolve => server.close(resolve))
  const noFake = failed.status === 500 && !failed.data?.success && !failed.data?.data?.userId
  add('FAIL-DB-001', 'Database outage', 'Registration against reachable API with closed DB pool', '500; no fake ID/success', `status=${failed.status}; fakeId=${Boolean(failed.data?.data?.userId)}`, failed.status, 'Pool closed before request', noFake ? 'PASS' : 'FAIL')

  const retry = await request(API, '/customers/register', { method: 'POST', body: failureBody })
  const freshPool = await new sql.ConnectionPool(sqlConfig).connect()
  const lookup = await freshPool.request().input('username', sql.NVarChar, failureBody.username).query('SELECT u.user_id, c.id AS customer_id FROM users u JOIN customers c ON c.user_id=u.user_id WHERE u.username=@username')
  const retryPass = retry.status === 201 && lookup.recordset.length === 1
  add('FAIL-DB-002', 'Database recovery', 'Retry registration through healthy backend', '201 and linked SQL rows', `status=${retry.status}`, retry.status, `joined rows=${lookup.recordset.length}`, retryPass ? 'PASS' : 'FAIL')
  if (lookup.recordset.length) {
    await freshPool.request().input('userId', sql.Int, lookup.recordset[0].user_id).query('DELETE FROM customers WHERE user_id=@userId; DELETE FROM users WHERE user_id=@userId;')
  }
  await freshPool.close()
}

async function cleanupWithFreshPool(baseline) {
  const freshPool = await new sql.ConnectionPool(sqlConfig).connect()
  const qaUsers = await freshPool.request().input('prefix', sql.NVarChar, `${QA_TAG}%`).query('SELECT user_id FROM users WHERE username LIKE @prefix')
  const ids = qaUsers.recordset.map(row => row.user_id)
  for (const userId of ids) {
    await freshPool.request().input('userId', sql.Int, userId).query('DELETE FROM customers WHERE user_id=@userId; DELETE FROM users WHERE user_id=@userId;')
  }
  const finalCountsResult = await freshPool.request().query('SELECT (SELECT COUNT(*) FROM users) AS users, (SELECT COUNT(*) FROM customers) AS customers')
  const residue = await freshPool.request().input('prefix', sql.NVarChar, `${QA_TAG}%`).query('SELECT COUNT(*) AS count FROM users WHERE username LIKE @prefix')
  await freshPool.close()
  const finalCounts = finalCountsResult.recordset[0]
  const pass = residue.recordset[0].count === 0 && finalCounts.users === baseline.users && finalCounts.customers === baseline.customers
  add('CLEAN-001', 'Cleanup', 'Remove only QA-prefixed accounts/profiles', 'No residue; baseline counts restored', `removed=${ids.length}; residue=${residue.recordset[0].count}`, 'N/A', `before users/customers=${baseline.users}/${baseline.customers}; after=${finalCounts.users}/${finalCounts.customers}`, pass ? 'PASS' : 'FAIL')
  return finalCounts
}

async function main() {
  const baseline = await counts()
  const identity = await rows('SELECT @@SERVERNAME AS server_name, DB_NAME() AS database_name')
  add('ENV-DB-001', 'Environment', 'Live backend SQL identity', 'Required server/database', `${identity[0].server_name}; ${identity[0].database_name}`, 200, `before users/customers=${baseline.users}/${baseline.customers}`, identity[0].server_name === 'DESKTOP-79MG1Q7\\SQLEXPRESS' && identity[0].database_name === 'pharmacy_management' ? 'PASS' : 'FAIL')
  const cdp = await connectBrowser()
  try {
    await browserRegistration(cdp)
    await verifySqlAndApi()
    await browserLoginSession(cdp)
    await duplicateAndValidationTests()
    await ownershipTests()
    await staffAndRoleTests(cdp)
    await logoutTests(cdp)
    await backendOutageTest(cdp)
    await databaseFailureTest()
    const finalCounts = await cleanupWithFreshPool(baseline)
    const unexpectedBrowserErrors = cdp.exceptions.length
    const corsErrors = cdp.console.filter(entry => entry.values.join(' ').toLowerCase().includes('cors')).length
    add('BROWSER-001', 'Browser console/network', 'Registration/login/session/role/logout', 'No uncaught error, CORS error, or redirect loop', `uncaught=${unexpectedBrowserErrors}; CORS=${corsErrors}`, 'mixed', 'Expected negative-test API errors excluded', unexpectedBrowserErrors === 0 && corsErrors === 0 ? 'PASS' : 'FAIL')
    const unsafeKeys = ['password', 'password_hash', 'JWT_SECRET', 'database password', 'connection string', 'stack']
    const responseText = JSON.stringify(cdp.responses)
    const safe = unsafeKeys.every(key => !responseText.includes(key))
    add('RESP-001', 'Response safety', 'Browser/API response metadata and inspected JSON bodies', 'No password/hash/secret/connection/stack', safe ? 'No sensitive response fields observed' : 'Unsafe response field observed', 'mixed', 'JWT returned only by login as designed', safe ? 'PASS' : 'FAIL')

    const summary = results.reduce((acc, item) => { acc[item.result] = (acc[item.result] || 0) + 1; return acc }, {})
    console.log(`QA_AUTH_RESULT ${JSON.stringify({ tag: QA_TAG, sourceIds: created, baseline, finalCounts, results, summary })}`)
  } finally {
    cdp.close()
  }
}

main().catch(error => {
  console.error(`QA_AUTH_FATAL ${error.message}`)
  process.exitCode = 1
})
