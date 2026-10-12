const fs = require('fs')
const path = require('path')
require('../../backend/node_modules/dotenv').config({ path: path.resolve(__dirname, '../../backend/.env') })
const jwt = require('../../backend/node_modules/jsonwebtoken')
const { pool, closePool } = require('../../backend/src/config/database')
const { getJwtSecret, JWT_AUDIENCE, JWT_ISSUER } = require('../../backend/src/config/jwt')

const ROOT = path.resolve(__dirname, '..')
const EVIDENCE = path.join(ROOT, 'evidence')
const FRONTEND = process.env.FRONTEND_URL || 'http://localhost:3000'
const API = process.env.API_URL || 'http://localhost:5000/api'
const CDP = process.env.CDP_URL || 'http://localhost:9222'
const credentialsPath = path.resolve(__dirname, '../../backend/.local/staff-credentials.json')
const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'laptop', width: 1366, height: 768 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'narrow-mobile', width: 320, height: 640 },
]

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const clean = value => String(value || '').replace(/\s+/g, ' ').trim().slice(0, 180)

async function api(route, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${API}${route}`, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  let payload = null
  try { payload = await response.json() } catch {}
  return { status: response.status, payload }
}

class Cdp {
  constructor(url) {
    this.ws = new WebSocket(url)
    this.id = 0
    this.pending = new Map()
    this.events = []
  }
  async connect() {
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true })
      this.ws.addEventListener('error', reject, { once: true })
    })
    this.ws.addEventListener('message', event => {
      const message = JSON.parse(event.data)
      if (message.id) {
        const pending = this.pending.get(message.id)
        if (!pending) return
        this.pending.delete(message.id)
        return message.error ? pending.reject(new Error(message.error.message)) : pending.resolve(message.result)
      }
      this.events.push(message)
    })
    for (const domain of ['Page', 'Runtime', 'Network', 'Log']) await this.command(`${domain}.enable`)
  }
  command(method, params = {}) {
    const id = ++this.id
    this.ws.send(JSON.stringify({ id, method, params }))
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }))
  }
  async evaluate(expression) {
    const result = await this.command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text)
    return result.result.value
  }
  async waitFor(expression, timeout = 12000) {
    const start = Date.now()
    while (Date.now() - start < timeout) {
      try { if (await this.evaluate(expression)) return true } catch {}
      await sleep(100)
    }
    return false
  }
  async navigate(url) {
    await this.command('Page.navigate', { url })
    await this.waitFor('document.readyState === "complete"')
    await this.waitFor('!document.body.innerText.includes("Restoring your secure session")')
    await sleep(650)
  }
  close() { this.ws.close() }
}

async function staffSessions() {
  const source = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'))
  const sessions = {}
  for (const account of source.accounts) {
    const response = await api('/auth/staff-login', { method: 'POST', body: { username: account.username, password: account.password } })
    sessions[account.role] = { status: response.status, ...(response.payload?.data || {}) }
  }
  return sessions
}

async function customerSession() {
  const [rows] = await pool.execute(`
    SELECT TOP 1 u.user_id, u.username, u.role, c.id AS customer_id,
      CONCAT(c.first_name, ' ', c.last_name) AS customer_name
    FROM users u JOIN customers c ON c.user_id = u.user_id
    WHERE u.role = 'CUSTOMER'
    ORDER BY u.user_id
  `)
  const row = rows[0]
  if (!row) return null
  return {
    token: jwt.sign({ userId: row.user_id }, getJwtSecret(), { expiresIn: '2h', issuer: JWT_ISSUER, audience: JWT_AUDIENCE }),
    userId: row.user_id,
    username: row.username,
    role: row.role,
    customerId: row.customer_id,
    name: row.customer_name,
  }
}

async function findIds(sessions, customer) {
  const getFirst = payload => {
    const data = payload?.data
    const candidates = Array.isArray(data) ? data : Object.values(data || {}).find(value => Array.isArray(value))
    return candidates?.[0] || null
  }
  const calls = await Promise.all([
    api('/medicines?limit=1', { token: sessions.ADMIN.token }),
    api('/sales?limit=1', { token: sessions.SALES.token }),
    api('/prescriptions?limit=1', { token: sessions.PHARMACIST.token }),
    api('/orders/mine', { token: customer.token }),
    api('/purchase-orders?limit=1', { token: sessions.INVENTORY.token }),
    api('/supplier-inquiries?limit=1', { token: sessions.INVENTORY.token }),
    api('/supplier-invoices?limit=1', { token: sessions.INVENTORY.token }),
  ])
  const first = calls.map(call => getFirst(call.payload))
  return {
    medicine: first[0]?.id || first[0]?.medicine_id || 2147483647,
    sale: first[1]?.id || first[1]?.sale_id || 2147483647,
    prescription: first[2]?.id || first[2]?.prescription_id || 2147483647,
    order: first[3]?.id || first[3]?.order_id || 2147483647,
    purchaseOrder: first[4]?.id || first[4]?.purchase_order_id || 2147483647,
    inquiry: first[5]?.id || first[5]?.supplier_query_id || 2147483647,
    invoice: first[6]?.id || first[6]?.supplier_invoice_id || 2147483647,
    customer: customer.customerId,
  }
}

function routes(ids) {
  return [
    { path: '/', role: null }, { path: '/pharmacy-items', role: null }, { path: '/login', role: null },
    { path: '/customer-login', role: null }, { path: '/staff-login', role: null },
    { path: '/customer-register', role: null }, { path: '/register', role: null },
    { path: '/definitely-missing', role: null },
    { path: '/customer/dashboard', role: 'CUSTOMER' }, { path: '/customer-dashboard', role: 'CUSTOMER' },
    { path: '/customer/checkout', role: 'CUSTOMER' }, { path: '/upload-prescription', role: 'CUSTOMER' },
    { path: '/my-prescriptions', role: 'CUSTOMER' }, { path: '/my-orders', role: 'CUSTOMER' },
    { path: `/orders/${ids.order}`, role: 'CUSTOMER', fixtureMissing: ids.order === 2147483647 },
    { path: '/staff/admin', role: 'ADMIN' }, { path: '/admin-dashboard', role: 'ADMIN' },
    { path: '/staff/inventory', role: 'INVENTORY' }, { path: '/inventory-dashboard', role: 'INVENTORY' },
    { path: '/staff/sales', role: 'SALES' }, { path: '/sales-dashboard', role: 'SALES' },
    { path: '/staff/pharmacist', role: 'PHARMACIST' }, { path: '/pharmacist-dashboard', role: 'PHARMACIST' },
    { path: '/staff/supplier', role: 'SUPPLIER' }, { path: '/supplier-dashboard', role: 'SUPPLIER' },
    { path: '/medicines', role: 'ADMIN' }, { path: '/medicines/low-stock', role: 'ADMIN' },
    { path: '/medicines/expiry', role: 'ADMIN' }, { path: `/medicines/${ids.medicine}/batches`, role: 'ADMIN' },
    { path: '/medicines/add', role: 'ADMIN' }, { path: `/medicines/edit/${ids.medicine}`, role: 'ADMIN' },
    { path: '/suppliers', role: 'ADMIN' }, { path: '/suppliers/add', role: 'ADMIN' },
    { path: '/suppliers/edit/2147483647', role: 'ADMIN', fixtureMissing: true },
    { path: '/purchases', role: 'ADMIN' }, { path: '/purchase-orders', role: 'ADMIN' },
    { path: `/purchase-orders/${ids.purchaseOrder}`, role: 'ADMIN', fixtureMissing: ids.purchaseOrder === 2147483647 },
    { path: '/goods-receipts', role: 'ADMIN' }, { path: '/supplier-purchasing', role: 'ADMIN' },
    { path: `/supplier-inquiries/${ids.inquiry}`, role: 'ADMIN', fixtureMissing: ids.inquiry === 2147483647 },
    { path: `/supplier-invoices/${ids.invoice}`, role: 'ADMIN', fixtureMissing: ids.invoice === 2147483647 },
    { path: '/sales', role: 'ADMIN' }, { path: `/sales/receipt/${ids.sale}`, role: 'ADMIN' },
    { path: '/billing-orders', role: 'ADMIN' }, { path: '/customers', role: 'ADMIN' },
    { path: `/customers/${ids.customer}`, role: 'ADMIN' }, { path: '/customers/add', role: 'ADMIN' },
    { path: `/customers/edit/${ids.customer}`, role: 'ADMIN' }, { path: '/prescriptions/create', role: 'ADMIN' },
    { path: `/prescriptions/${ids.prescription}`, role: 'ADMIN' }, { path: '/prescription-orders', role: 'ADMIN' },
  ]
}

async function setSession(cdp, session) {
  await cdp.evaluate(`localStorage.clear(); sessionStorage.clear(); ${session ? `localStorage.setItem('pharmacy_auth_session', ${JSON.stringify(JSON.stringify(session))}); localStorage.setItem('pharmacy_token', ${JSON.stringify(session.token)})` : ''}`)
}

async function pageSnapshot(cdp) {
  return cdp.evaluate(`(() => {
    const visible = element => {
      const style = getComputedStyle(element); const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    };
    const describe = element => ({
      tag: element.tagName.toLowerCase(), type: element.type || '', name: element.name || '',
      text: (element.innerText || element.value || element.getAttribute('aria-label') || element.title || '').replace(/\\s+/g, ' ').trim().slice(0, 100),
      ariaLabel: element.getAttribute('aria-label') || '', title: element.title || '', disabled: Boolean(element.disabled), visible: visible(element)
    });
    const overflow = [...document.querySelectorAll('body *')].filter(el => visible(el) && el.getBoundingClientRect().right > document.documentElement.clientWidth + 2)
      .slice(0, 10).map(el => ({ tag: el.tagName.toLowerCase(), className: String(el.className || '').slice(0, 100), right: Math.round(el.getBoundingClientRect().right) }));
    return {
      pathname: location.pathname, title: document.title,
      headings: [...document.querySelectorAll('h1,h2,h3')].filter(visible).map(el => el.innerText.replace(/\\s+/g, ' ').trim()).slice(0, 20),
      bodyText: document.body.innerText.replace(/\\s+/g, ' ').trim().slice(0, 700),
      controls: [...document.querySelectorAll('button,input,select,textarea,[role=button]')].filter(visible).map(describe),
      links: [...document.querySelectorAll('a[href]')].filter(visible).map(a => ({ text: (a.innerText || a.getAttribute('aria-label') || '').replace(/\\s+/g, ' ').trim().slice(0, 100), href: a.getAttribute('href') })).slice(0, 100),
      labelsWithoutControl: [...document.querySelectorAll('label')].filter(visible).filter(label => !label.control && !label.querySelector('input,select,textarea')).map(label => label.innerText.trim()).slice(0, 20),
      imagesWithoutAlt: [...document.querySelectorAll('img')].filter(visible).filter(img => !img.hasAttribute('alt')).length,
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
      documentWidth: document.documentElement.scrollWidth, viewportWidth: document.documentElement.clientWidth, overflow,
    };
  })()`)
}

function eventFailures(events) {
  return events.flatMap(event => {
    if (event.method === 'Runtime.exceptionThrown') return [`exception: ${clean(event.params.exceptionDetails.exception?.description || event.params.exceptionDetails.text)}`]
    if (event.method === 'Log.entryAdded' && event.params.entry.level === 'error') return [`console: ${clean(event.params.entry.text)}`]
    if (event.method === 'Network.loadingFailed' && !event.params.canceled) return [`network: ${clean(event.params.errorText)}`]
    if (event.method === 'Network.responseReceived' && event.params.response.status >= 400) return [`http ${event.params.response.status}: ${event.params.response.url.replace(/\?.*$/, '')}`]
    return []
  })
}

async function screenshot(cdp, filename) {
  const shot = await cdp.command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  fs.writeFileSync(path.join(EVIDENCE, filename), Buffer.from(shot.data, 'base64'))
}

async function loginChecks(cdp, credentials) {
  const output = []
  for (const account of credentials.accounts) {
    await setSession(cdp, null)
    const eventStart = cdp.events.length
    await cdp.navigate(`${FRONTEND}/staff-login`)
    const values = JSON.stringify({ username: account.username, password: account.password })
    await cdp.evaluate(`(() => { const values=${values}; const inputs=[...document.querySelectorAll('input')]; const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; setter.call(inputs[0], values.username); inputs[0].dispatchEvent(new Event('input',{bubbles:true})); setter.call(inputs[1], values.password); inputs[1].dispatchEvent(new Event('input',{bubbles:true})); document.querySelector('button.public-auth-submit').click(); })()`)
    const expected = { ADMIN: '/admin-dashboard', PHARMACIST: '/pharmacist-dashboard', INVENTORY: '/inventory-dashboard', SALES: '/sales-dashboard', SUPPLIER: '/supplier-dashboard' }[account.role]
    await cdp.waitFor(`location.pathname === ${JSON.stringify(expected)}`)
    output.push({ role: account.role, expected, actual: await cdp.evaluate('location.pathname'), failures: eventFailures(cdp.events.slice(eventStart)) })
  }
  await setSession(cdp, null)
  await cdp.navigate(`${FRONTEND}/customer-login`)
  await cdp.evaluate(`(() => { const inputs=[...document.querySelectorAll('input')]; const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; setter.call(inputs[0], 'unknown_qa_user'); inputs[0].dispatchEvent(new Event('input',{bubbles:true})); setter.call(inputs[1], 'invalid-password'); inputs[1].dispatchEvent(new Event('input',{bubbles:true})); document.querySelector('button.public-auth-submit').click(); })()`)
  await cdp.waitFor('Boolean(document.querySelector(".public-auth-error"))')
  output.push({ role: 'CUSTOMER_INVALID', expected: '/customer-login with error', actual: `${await cdp.evaluate('location.pathname')} ${clean(await cdp.evaluate('document.querySelector(".public-auth-error")?.innerText'))}` })
  return output
}

async function authorizationChecks(cdp, sessions, customer) {
  const checks = [
    { role: 'CUSTOMER', session: customer, path: '/medicines', expected: '/customer-dashboard' },
    { role: 'SALES', session: sessions.SALES, path: '/suppliers', expected: '/sales-dashboard' },
    { role: 'INVENTORY', session: sessions.INVENTORY, path: '/sales', expected: '/inventory-dashboard' },
    { role: 'SUPPLIER', session: sessions.SUPPLIER, path: '/customers', expected: '/supplier-dashboard' },
    { role: 'PHARMACIST', session: sessions.PHARMACIST, path: '/purchases', expected: '/pharmacist-dashboard' },
  ]
  const output = []
  for (const check of checks) {
    await setSession(cdp, check.session)
    await cdp.navigate(`${FRONTEND}${check.path}`)
    output.push({ role: check.role, attempted: check.path, expected: check.expected, actual: await cdp.evaluate('location.pathname') })
  }
  return output
}

async function main() {
  fs.mkdirSync(EVIDENCE, { recursive: true })
  for (const name of fs.readdirSync(EVIDENCE)) {
    if (name.endsWith('.png') || name === 'browser-audit.json') fs.unlinkSync(path.join(EVIDENCE, name))
  }
  const targetList = await (await fetch(`${CDP}/json/list`)).json()
  const target = targetList.find(item => item.type === 'page' && item.url.startsWith(FRONTEND))
  if (!target) throw new Error(`No browser page target at ${FRONTEND}`)
  const cdp = new Cdp(target.webSocketDebuggerUrl)
  await cdp.connect()
  try {
    const credentialSource = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'))
    const sessions = await staffSessions()
    const customer = await customerSession()
    const ids = await findIds(sessions, customer)
    const loginResults = await loginChecks(cdp, credentialSource)
    const authorizationResults = await authorizationChecks(cdp, sessions, customer)
    const pageResults = []
    for (const route of routes(ids)) {
      const session = route.role === 'CUSTOMER' ? customer : route.role ? sessions[route.role] : null
      await setSession(cdp, session)
      for (const viewport of viewports) {
        await cdp.command('Emulation.setDeviceMetricsOverride', { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: viewport.width <= 390 })
        const eventStart = cdp.events.length
        await cdp.navigate(`${FRONTEND}${route.path}`)
        const snapshot = await pageSnapshot(cdp)
        const failures = [...new Set(eventFailures(cdp.events.slice(eventStart)))]
        const wrongPath = snapshot.pathname !== route.path
        const blank = !snapshot.bodyText || snapshot.headings.length === 0
        const result = wrongPath || blank || failures.some(item => item.startsWith('exception:')) ? 'FAIL' : route.fixtureMissing ? 'BLOCKED' : 'PASS'
        const record = { route: route.path, role: route.role || 'PUBLIC', viewport: viewport.name, result, fixtureMissing: Boolean(route.fixtureMissing), ...snapshot, failures }
        pageResults.push(record)
        if (result === 'FAIL' || snapshot.horizontalOverflow || failures.length) {
          const safe = route.path.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'home'
          await screenshot(cdp, `${safe}-${viewport.name}.png`)
        }
      }
    }
    const summary = {
      uniqueRoutes: new Set(pageResults.map(item => item.route)).size,
      viewportRuns: pageResults.length,
      pass: pageResults.filter(item => item.result === 'PASS').length,
      fail: pageResults.filter(item => item.result === 'FAIL').length,
      blocked: pageResults.filter(item => item.result === 'BLOCKED').length,
      overflowRuns: pageResults.filter(item => item.horizontalOverflow).length,
      routesWithFailures: [...new Set(pageResults.filter(item => item.failures.length).map(item => item.route))],
      controlsDiscovered: pageResults.filter(item => item.viewport === 'desktop').reduce((sum, item) => sum + item.controls.length, 0),
    }
    const result = { generatedAt: new Date().toISOString(), ids, loginResults, authorizationResults, summary, pages: pageResults }
    fs.writeFileSync(path.join(EVIDENCE, 'browser-audit.json'), JSON.stringify(result, null, 2))
    console.log(JSON.stringify({ loginResults, authorizationResults, summary }, null, 2))
    if (summary.fail) process.exitCode = 1
  } finally {
    cdp.close()
    await closePool()
  }
}

main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1 })
