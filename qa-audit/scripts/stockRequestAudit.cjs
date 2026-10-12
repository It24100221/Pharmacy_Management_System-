// Browser regression checks. GETs use localhost data; every mutation is intercepted.
const fs = require('fs')
const path = require('path')
const assert = require('node:assert/strict')
require('../../backend/node_modules/dotenv').config({ path: path.resolve(__dirname, '../../backend/.env') })
const jwt = require('../../backend/node_modules/jsonwebtoken')
const { pool, closePool } = require('../../backend/src/config/database')
const { getJwtSecret, JWT_AUDIENCE, JWT_ISSUER } = require('../../backend/src/config/jwt')
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

class Browser {
  constructor(url) { this.ws = new WebSocket(url); this.id = 0; this.pending = new Map(); this.exceptions = [] }
  async connect() {
    await new Promise((resolve, reject) => { this.ws.addEventListener('open', resolve, { once: true }); this.ws.addEventListener('error', reject, { once: true }) })
    this.ws.addEventListener('message', event => {
      const message = JSON.parse(event.data)
      if (message.id) { const request = this.pending.get(message.id); if (!request) return; this.pending.delete(message.id); message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result) }
      else if (message.method === 'Fetch.requestPaused') this.intercept(message.params).catch(error => { this.exceptions.push(error.message) })
      else if (message.method === 'Runtime.exceptionThrown') this.exceptions.push(message.params.exceptionDetails.text)
    })
    await this.cmd('Page.enable'); await this.cmd('Runtime.enable')
  }
  cmd(method, params = {}) { const id = ++this.id; this.ws.send(JSON.stringify({ id, method, params })); return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject })) }
  async eval(expression) { const result = await this.cmd('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text); return result.result.value }
  async wait(expression) { for (let i = 0; i < 100; i++) { if (await this.eval(expression)) return; await sleep(100) } throw new Error(`Timed out: ${expression}`) }
  async go(route) { await this.cmd('Page.navigate', { url: 'http://localhost:3000' + route }); await this.wait('document.readyState === "complete"'); await sleep(500) }
  async viewport(width, height) { await this.cmd('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 500 }) }
  async reply(event, status, payload) { await this.cmd('Fetch.fulfillRequest', { requestId: event.requestId, responseCode: status, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: Buffer.from(JSON.stringify(payload)).toString('base64') }) }
}

async function run() {
  const evidence = path.resolve(__dirname, '../evidence'); fs.mkdirSync(evidence, { recursive: true })
  const results = []
  const test = async (name, action) => { try { await action(); results.push({ name, passed: true }) } catch (error) { results.push({ name, passed: false, error: error.message }); throw error } }
  const [users] = await pool.execute("SELECT TOP 1 user_id,username,role FROM users WHERE role='ADMIN'")
  const admin = users[0]; assert.ok(admin)
  const token = jwt.sign({ userId: admin.user_id }, getJwtSecret(), { issuer: JWT_ISSUER, audience: JWT_AUDIENCE, expiresIn: '15m' })
  const session = { userId: admin.user_id, username: admin.username, role: admin.role, token }
  const target = await (await fetch('http://127.0.0.1:9222/json/new?http://localhost:3000/pharmacy-items', { method: 'PUT' })).json()
  const browser = new Browser(target.webSocketDebuggerUrl); await browser.connect()
  let originalStorage; let fixtures = false; let role = 'ADMIN'; let mode = 'hold'; let heldRequest
  const mutations = []
  const changeValue = async (selector, value) => browser.eval(`(()=>{const element=document.querySelector(${JSON.stringify(selector)});const prototype=element.tagName==='SELECT'?HTMLSelectElement.prototype:element.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(prototype,'value').set.call(element,${JSON.stringify(value)});element.dispatchEvent(new Event(element.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`)
  const open = async name => { await browser.eval(`(()=>{const rows=[...document.querySelectorAll('tbody tr')];const row=${name ? `rows.find(row=>row.innerText.includes(${JSON.stringify(name)}))` : 'rows[0]'};const button=[...row.querySelectorAll('button')].find(button=>button.innerText==='Request Stock');button.focus();button.click();})()`); await browser.wait('Boolean(document.querySelector("dialog[open]"))') }
  const cancel = async () => { await browser.eval('[...document.querySelectorAll("dialog button")].find(button=>button.innerText==="Cancel").click()'); await browser.wait('!document.querySelector("dialog")') }
  const escape = async () => { await browser.cmd('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await browser.cmd('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await sleep(100) }
  const fixtureMedicines = [
    { id: 31, productCode: 'P0000000034', name: 'Out of stock regression fixture', quantity: 0, minStockLevel: 0, preferred_supplier_id: 1 },
    { id: 4, productCode: 'P0000000004', name: 'Low stock regression fixture', quantity: 5, minStockLevel: 10 },
  ]
  browser.intercept = async event => {
    const url = new URL(event.request.url)
    if (!['GET', 'HEAD'].includes(event.request.method)) {
      mutations.push({ method: event.request.method, path: url.pathname, payload: JSON.parse(event.request.postData || '{}') })
      if (url.pathname !== '/api/reorder-requests' || event.request.method !== 'POST') throw new Error('Unexpected mutation was blocked')
      if (mode === 'hold') { heldRequest = event; return }
      await browser.reply(event, mode === 'error' ? 409 : 201, mode === 'error' ? { success: false, message: 'Medicine is not currently below its reorder threshold' } : { success: true, data: { reorder_request_id: 999, ...mutations.at(-1).payload } })
    } else if (fixtures && url.pathname === '/api/medicines') await browser.reply(event, 200, { success: true, data: { medicines: fixtureMedicines } })
    else if (fixtures && url.pathname === '/api/suppliers') await browser.reply(event, 200, { success: true, data: { suppliers: [{ id: 1, company_name: 'Regression supplier' }] } })
    else if (role !== 'ADMIN' && url.pathname === '/api/auth/me') await browser.reply(event, 200, { success: true, data: { ...session, role } })
    else await browser.cmd('Fetch.continueRequest', { requestId: event.requestId })
  }
  try {
    await browser.go('/pharmacy-items')
    originalStorage = await browser.eval('JSON.stringify(Object.fromEntries(Object.keys(localStorage).map(key=>[key,localStorage.getItem(key)])))')
    await browser.eval(`localStorage.setItem('pharmacy_auth_session',${JSON.stringify(JSON.stringify(session))});localStorage.setItem('pharmacy_token',${JSON.stringify(token)});`)
    await browser.cmd('Fetch.enable', { patterns: [{ urlPattern: '*://localhost:3000/api/*' }] })
    await browser.viewport(1440, 900); await browser.go('/medicines/low-stock')
    await browser.wait('[...document.querySelectorAll("button")].some(button=>button.innerText==="Request Stock")')
    await test('actual localhost medicine opens a visible modal with a valid suggested quantity', async () => {
      await open()
      const state = await browser.eval(`(()=>{const d=document.querySelector('dialog');const r=d.getBoundingClientRect();return {modal:d.matches(':modal'),inView:r.top>=0&&r.bottom<=innerHeight,title:d.innerText,quantity:document.querySelector('#stock-request-quantity').value,focused:document.activeElement.id}})()`)
      assert.equal(state.modal, true); assert.equal(state.inView, true); assert.ok(Number(state.quantity) >= 1); assert.equal(state.focused, 'stock-request-quantity')
      const shot = await browser.cmd('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(evidence, 'stock-request-desktop.png'), Buffer.from(shot.data, 'base64'))
    })
    await test('cancel and Escape close the dialog and restore focus', async () => { await cancel(); assert.equal(await browser.eval('document.activeElement.innerText'), 'Request Stock'); await open(); await escape(); await browser.wait('!document.querySelector("dialog")') })
    await test('dialog remains visible on a narrow mobile viewport', async () => {
      await browser.viewport(320, 640); await open()
      assert.equal(await browser.eval('(()=>{const r=document.querySelector("dialog").getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight})()'), true)
      const shot = await browser.cmd('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(evidence, 'stock-request-mobile.png'), Buffer.from(shot.data, 'base64')); await cancel(); await browser.viewport(1440, 900)
    })
    fixtures = true; await browser.go('/medicines/low-stock'); await browser.wait('document.body.innerText.includes("Out of stock regression fixture")')
    await test('normalized minimum zero and preferred supplier work for out of stock medicines', async () => { await open('Out of stock regression fixture'); assert.equal(await browser.eval('document.querySelector("#stock-request-quantity").value'), '1'); assert.equal(await browser.eval('document.querySelector("#stock-request-supplier").value'), '1') })
    await test('zero and fractional quantities cannot submit', async () => {
      for (const value of ['0', '1.5']) { await changeValue('#stock-request-quantity', value); await browser.eval('document.querySelector("dialog button[type=submit]").click()'); assert.equal(await browser.eval('document.querySelector("dialog form").checkValidity()'), false) }
      assert.equal(mutations.length, 0)
    })
    await test('submission uses medicine ID and prevents duplicate sends and dismissal while saving', async () => {
      await changeValue('#stock-request-quantity', '7'); await changeValue('#stock-request-notes', 'Regression request'); await browser.eval('document.querySelector("dialog button[type=submit]").click()')
      for (let i = 0; !heldRequest && i < 100; i++) await sleep(50)
      assert.ok(heldRequest); await browser.eval('document.querySelector("dialog form").requestSubmit()'); await escape()
      assert.equal(await browser.eval('Boolean(document.querySelector("dialog[open]"))'), true)
      assert.equal(await browser.eval('document.querySelector("dialog button[type=submit]").matches(":disabled")'), true)
      assert.equal(mutations.length, 1); assert.deepEqual(mutations[0].payload, { medicine_id: 31, requested_quantity: 7, supplier_id: 1, notes: 'Regression request' })
      await browser.reply(heldRequest, 201, { success: true, data: { reorder_request_id: 999 } }); heldRequest = null
      await browser.wait('!document.querySelector("dialog") && document.body.innerText.includes("Stock request saved")')
    })
    await test('failed saves keep values and show an error; retry succeeds', async () => {
      await open('Low stock regression fixture'); assert.equal(await browser.eval('document.querySelector("#stock-request-quantity").value'), '15'); mode = 'error'
      await browser.eval('document.querySelector("dialog button[type=submit]").click()'); await browser.wait('Boolean(document.querySelector("dialog [role=alert]"))')
      assert.match(await browser.eval('document.querySelector("dialog [role=alert]").innerText'), /reorder threshold/); assert.equal(await browser.eval('document.querySelector("#stock-request-quantity").value'), '15')
      mode = 'success'; await browser.eval('document.querySelector("dialog button[type=submit]").click()'); await browser.wait('!document.querySelector("dialog")'); assert.equal(mutations.length, 3); assert.equal(mutations[2].payload.supplier_id, null)
    })
    await test('staff with read access see inventory contact guidance rather than forbidden stock actions', async () => { role = 'SALES'; await browser.go('/medicines/low-stock'); await browser.wait('document.body.innerText.includes("Contact inventory staff")'); assert.equal(await browser.eval('[...document.querySelectorAll("button")].some(button=>button.innerText==="Request Stock")'), false); assert.equal(await browser.eval('Boolean(document.querySelector("tbody a[href=\\"/purchases\\"]"))'), false) })
    assert.deepEqual(browser.exceptions, [])
  } finally {
    if (heldRequest) await browser.reply(heldRequest, 503, { success: false, message: 'Audit cleanup' })
    await browser.cmd('Fetch.disable')
    if (originalStorage) await browser.eval(`localStorage.clear();Object.entries(${originalStorage}).forEach(([key,value])=>localStorage.setItem(key,value))`)
    browser.ws.close(); await fetch(`http://127.0.0.1:9222/json/close/${target.id}`); await closePool()
    const report = { generatedAt: new Date().toISOString(), databaseWrites: 0, mutationResponses: 'intercepted fixtures', summary: { total: results.length, passed: results.filter(item => item.passed).length, failed: results.filter(item => !item.passed).length }, results }
    fs.writeFileSync(path.join(evidence, 'stock-request-browser.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2))
  }
}
run().catch(async error => { console.error(error.stack); await closePool(); process.exitCode = 1 })
