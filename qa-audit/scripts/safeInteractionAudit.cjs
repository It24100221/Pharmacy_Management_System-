const fs = require('fs')
const path = require('path')
const dotenv = require('../../backend/node_modules/dotenv')
dotenv.config({ path: path.resolve(__dirname, '../../backend/.env') })
const jwt = require('../../backend/node_modules/jsonwebtoken')
const { pool, closePool } = require('../../backend/src/config/database')
const { getJwtSecret, JWT_AUDIENCE, JWT_ISSUER } = require('../../backend/src/config/jwt')

const FRONTEND = 'http://localhost:3000'
const API = 'http://localhost:5000/api'
const CDP = 'http://127.0.0.1:9222'
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

class Cdp {
  constructor(url) { this.ws = new WebSocket(url); this.id = 0; this.pending = new Map() }
  async connect() { await new Promise((resolve, reject) => { this.ws.addEventListener('open', resolve, { once: true }); this.ws.addEventListener('error', reject, { once: true }) }); this.ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (!m.id) return; const p = this.pending.get(m.id); if (!p) return; this.pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result) }); await this.command('Page.enable'); await this.command('Runtime.enable'); await this.command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }) }
  command(method, params = {}) { const id = ++this.id; this.ws.send(JSON.stringify({ id, method, params })); return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject })) }
  async eval(expression) { const r = await this.command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text); return r.result.value }
  async wait(expression, timeout = 8000) { const start = Date.now(); while (Date.now() - start < timeout) { try { if (await this.eval(expression)) return true } catch {} await sleep(100) } return false }
  async go(pathname) { await this.command('Page.navigate', { url: FRONTEND + pathname }); await this.wait('document.readyState === "complete"'); await sleep(600) }
  close() { this.ws.close() }
}

async function identities() {
  const credentialSource = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../backend/.local/staff-credentials.json'), 'utf8'))
  const adminAccount = credentialSource.accounts.find(account => account.role === 'ADMIN')
  const response = await fetch(`${API}/auth/staff-login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: adminAccount.username, password: adminAccount.password }) })
  const admin = (await response.json()).data
  const [rows] = await pool.execute(`SELECT TOP 1 u.user_id,u.username,u.role,c.id AS customer_id,CONCAT(c.first_name,' ',c.last_name) AS customer_name FROM users u INNER JOIN customers c ON c.user_id=u.user_id WHERE u.role='CUSTOMER' ORDER BY u.user_id`)
  const row = rows[0]
  const customer = { token: jwt.sign({ userId: row.user_id }, getJwtSecret(), { expiresIn: '30m', issuer: JWT_ISSUER, audience: JWT_AUDIENCE }), userId: row.user_id, username: row.username, role: row.role, customerId: row.customer_id, name: row.customer_name }
  const [fixtures] = await pool.execute(`SELECT
    (SELECT TOP 1 id FROM suppliers ORDER BY id) AS supplier_id,
    (SELECT TOP 1 id FROM prescriptions ORDER BY id) AS prescription_id`)
  const [orders] = await pool.execute(`SELECT TOP 1 o.order_id,u.user_id,u.username,u.role,c.id AS customer_id,CONCAT(c.first_name,' ',c.last_name) AS customer_name FROM orders o INNER JOIN customers c ON c.id=o.customer_id INNER JOIN users u ON u.user_id=c.user_id ORDER BY o.order_id`)
  const orderRow = orders[0]
  const orderCustomer = orderRow ? { token: jwt.sign({ userId: orderRow.user_id }, getJwtSecret(), { expiresIn: '30m', issuer: JWT_ISSUER, audience: JWT_AUDIENCE }), userId: orderRow.user_id, username: orderRow.username, role: orderRow.role, customerId: orderRow.customer_id, name: orderRow.customer_name } : null
  return { admin, customer, orderCustomer, orderId: orderRow?.order_id, ...fixtures[0] }
}

const sessionScript = session => `localStorage.clear();sessionStorage.clear();${session ? `localStorage.setItem('pharmacy_auth_session',${JSON.stringify(JSON.stringify(session))});localStorage.setItem('pharmacy_token',${JSON.stringify(session.token)});` : ''}`
const setterScript = (selector, value, event = 'input') => `(() => { const el=document.querySelector(${JSON.stringify(selector)}); if(!el)return false; const proto=el.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event(${JSON.stringify(event)},{bubbles:true}));return true })()`

async function main() {
  const targets = await (await fetch(`${CDP}/json/list`)).json()
  const target = targets.find(item => item.type === 'page' && item.url.startsWith(FRONTEND))
  if (!target) throw new Error('No application browser target')
  const cdp = new Cdp(target.webSocketDebuggerUrl); await cdp.connect()
  const users = await identities(); const results = []
  const test = async (name, run) => { try { const detail = await run(); results.push({ name, passed: Boolean(detail?.passed), detail: detail?.detail || '' }) } catch (error) { results.push({ name, passed: false, detail: error.message }) } }
  try {
    await cdp.eval(sessionScript(null))
    await test('catalogue search empty state', async () => { await cdp.go('/pharmacy-items'); await cdp.eval(setterScript('input[placeholder="Search name or Product ID"]', '__qa_no_match__')); const passed = await cdp.wait('document.body.innerText.includes("No products match your search")'); return { passed, detail: 'search input filters the API-backed catalogue' } })
    await test('catalogue sign-in navigation', async () => { await cdp.go('/pharmacy-items'); await cdp.eval(`[...document.querySelectorAll('button')].find(b=>b.innerText.includes('Sign in to order')&&!b.disabled)?.click()`); const passed = await cdp.wait('location.pathname==="/customer-login"'); return { passed, detail: await cdp.eval('location.pathname') } })
    await test('login chooser customer link', async () => { await cdp.go('/login'); await cdp.eval(`[...document.querySelectorAll('a')].find(a=>a.innerText.includes('Customer Login'))?.click()`); const passed = await cdp.wait('location.pathname==="/customer-login"'); return { passed, detail: await cdp.eval('location.pathname') } })
    await test('not-found recovery link', async () => { await cdp.go('/definitely-missing'); await cdp.eval(`document.querySelector('a[href="/"]')?.click()`); const passed = await cdp.wait('location.pathname==="/"'); return { passed, detail: await cdp.eval('location.pathname') } })
    await test('registration native required validation', async () => { await cdp.go('/customer-register'); return { passed: await cdp.eval('document.querySelector("form").checkValidity()===false'), detail: 'empty required fields rejected without request' } })

    await cdp.eval(sessionScript(users.customer))
    await test('customer logout', async () => { await cdp.go('/customer/dashboard'); await cdp.eval(`document.querySelector('button[title="Log out"]')?.click()`); const passed = await cdp.wait('!localStorage.getItem("pharmacy_auth_session") && location.pathname==="/login"'); return { passed, detail: `path=${await cdp.eval('location.pathname')}` } })

    await test('owned order detail fixture', async () => { if (!users.orderCustomer) return { passed: false, detail: 'no order fixture' }; await cdp.eval(sessionScript(users.orderCustomer)); await cdp.go(`/orders/${users.orderId}`); return { passed: await cdp.eval('!document.body.innerText.includes("Order not found") && document.body.innerText.includes("Order")'), detail: `order=${users.orderId}` } })

    await cdp.eval(sessionScript(users.admin))
    await test('notifications menu toggle', async () => { await cdp.go('/medicines'); await cdp.eval('document.querySelector(".nav-notification-button")?.click()'); return { passed: await cdp.wait('Boolean(document.querySelector(".nav-notification-menu"))'), detail: 'menu opened' } })
    await test('inventory search empty state', async () => { await cdp.go('/medicines'); await cdp.eval(setterScript('input[placeholder^="Search by Product ID"]', '__qa_no_match__')); const passed = await cdp.wait('document.body.innerText.includes("No medicines found")'); return { passed, detail: 'search changed rendered inventory' } })
    await test('inventory stock filter', async () => { await cdp.go('/medicines'); await cdp.eval(setterScript('select', 'out_of_stock', 'change')); await sleep(700); return { passed: await cdp.eval('document.querySelector("select").value==="out_of_stock"'), detail: 'out-of-stock filter retained' } })
    await test('expiry tab control', async () => { await cdp.go('/medicines/expiry'); await cdp.eval(`[...document.querySelectorAll('button')].find(b=>b.innerText.includes('Expired'))?.click()`); await sleep(200); return { passed: await cdp.eval(`[...document.querySelectorAll('.badge')].every(b=>!b.offsetParent||b.innerText.includes('EXPIRED'))`), detail: 'expired tab filters visible badges' } })
    await test('add-medicine required validation', async () => { await cdp.go('/medicines/add'); await cdp.eval(`document.querySelector('button[type="submit"]')?.click()`); const passed = await cdp.wait('document.body.innerText.includes("Medicine name is required")'); return { passed, detail: 'custom validation rejected empty form' } })
    await test('add-medicine cancel', async () => { await cdp.eval(`[...document.querySelectorAll('button')].find(b=>b.innerText.trim()==='Cancel')?.click()`); const passed = await cdp.wait('location.pathname==="/medicines"'); return { passed, detail: await cdp.eval('location.pathname') } })
    await test('add-supplier required validation', async () => { await cdp.go('/suppliers/add'); await cdp.eval(`document.querySelector('button[type="submit"]')?.click()`); const passed = await cdp.wait('document.body.innerText.includes("Supplier name is required")'); return { passed, detail: 'custom validation rejected empty form' } })
    await test('existing supplier edit fixture', async () => { await cdp.go(`/suppliers/edit/${users.supplier_id}`); return { passed: await cdp.eval('Boolean(document.querySelector("input[name=company_name]")?.value)'), detail: `supplier=${users.supplier_id}` } })
    await test('existing prescription detail fixture', async () => { await cdp.go(`/prescriptions/${users.prescription_id}`); return { passed: await cdp.eval('!document.body.innerText.includes("Prescription not found") && document.body.innerText.includes("Prescription")'), detail: `prescription=${users.prescription_id}` } })
    await test('empty POS sale disabled', async () => { await cdp.go('/sales'); return { passed: await cdp.eval(`[...document.querySelectorAll('button')].find(b=>b.innerText.includes('Complete Sale'))?.disabled===true`), detail: 'sale cannot submit without items' } })
    await test('mobile navigation drawer', async () => { await cdp.command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }); await cdp.go('/medicines'); await cdp.eval('document.querySelector(".mobile-nav-toggle")?.click()'); const passed = await cdp.wait('Boolean(document.querySelector("[role=dialog],.mobile-drawer.open,.mobile-drawer-overlay"))'); await cdp.command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }); return { passed, detail: '390px drawer opens' } })
  } finally { cdp.close(); await closePool() }
  const output = { generatedAt: new Date().toISOString(), summary: { total: results.length, passed: results.filter(r=>r.passed).length, failed: results.filter(r=>!r.passed).length }, results }
  const targetPath = path.resolve(__dirname, '../evidence/safe-interaction-audit.json'); fs.writeFileSync(targetPath, JSON.stringify(output, null, 2)); console.log(JSON.stringify(output, null, 2)); if (output.summary.failed) process.exitCode = 1
}

main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1 })
