const fs = require('fs')
const path = require('path')

const FRONTEND = 'http://localhost:3000'
const API = 'http://localhost:5000/api'
const CDP = process.env.CDP_URL || 'http://localhost:9222'
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const viewports = [
  ['desktop', 1440, 900], ['laptop', 1366, 768], ['tablet', 768, 1024],
  ['mobile', 390, 844], ['narrow-mobile', 320, 640],
]

async function api(route, options = {}) {
  const response = await fetch(`${API}${route}`, options)
  let payload = null
  try { payload = await response.json() } catch {}
  return { status: response.status, payload }
}

class Cdp {
  constructor(url) { this.ws = new WebSocket(url); this.id = 0; this.pending = new Map(); this.events = [] }
  async connect() {
    await new Promise((resolve, reject) => { this.ws.addEventListener('open', resolve, { once: true }); this.ws.addEventListener('error', reject, { once: true }) })
    this.ws.addEventListener('message', event => {
      const message = JSON.parse(event.data)
      if (message.id) { const pending = this.pending.get(message.id); if (!pending) return; this.pending.delete(message.id); return message.error ? pending.reject(new Error(message.error.message)) : pending.resolve(message.result) }
      this.events.push(message)
    })
    for (const domain of ['Page', 'Runtime', 'Network']) await this.command(`${domain}.enable`)
  }
  command(method, params = {}) { const id = ++this.id; this.ws.send(JSON.stringify({ id, method, params })); return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject })) }
  async evaluate(expression) { const result = await this.command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.text); return result.result.value }
  async waitFor(expression, timeout = 8000) { const start = Date.now(); while (Date.now() - start < timeout) { try { if (await this.evaluate(expression)) return true } catch {} await sleep(100) } return false }
  async navigate(url) { await this.command('Page.navigate', { url }); await this.waitFor('document.readyState === "complete"'); await this.waitFor('!document.body.innerText.includes("Restoring your secure session")'); await sleep(450) }
  close() { this.ws.close() }
}

const responseData = payload => payload?.data || {}
const firstArrayItem = payload => Object.values(responseData(payload)).find(Array.isArray)?.[0]

async function main() {
  const credentials = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../backend/.local/staff-credentials.json'), 'utf8'))
  const adminAccount = credentials.accounts.find(account => account.role === 'ADMIN')
  const login = await api('/auth/staff-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: adminAccount.username, password: adminAccount.password }) })
  if (login.status !== 200) throw new Error(`Admin login failed with ${login.status}`)
  const admin = responseData(login.payload)
  const headers = { Authorization: `Bearer ${admin.token}` }
  const [medicines, customers, prescriptions, billing, health, registration] = await Promise.all([
    api('/medicines?limit=1', { headers }), api('/customers?limit=1', { headers }), api('/prescriptions?limit=1', { headers }),
    api('/orders/ready-for-billing', { headers }), api('/health'),
    api('/customers/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }),
  ])
  const medicine = firstArrayItem(medicines.payload)
  const customer = firstArrayItem(customers.payload)
  const apiChecks = {
    healthPublic: health.status === 200,
    registrationPublicValidation: registration.status === 400,
    prescriptionsList: prescriptions.status === 200,
    billingQueue: billing.status === 200,
  }
  const routes = [
    '/billing-orders', '/medicines/add', `/medicines/edit/${medicine.id}`,
    '/suppliers/add', '/purchases', '/sales', '/customers/add',
    `/customers/edit/${customer.id}`, '/prescriptions/create',
  ]

  const targets = await (await fetch(`${CDP}/json/list`)).json()
  const target = targets.find(item => item.type === 'page' && item.url.startsWith(FRONTEND))
  if (!target) throw new Error('No application browser target')
  const cdp = new Cdp(target.webSocketDebuggerUrl)
  await cdp.connect()
  const records = []
  try {
    await cdp.evaluate(`localStorage.clear();sessionStorage.clear();localStorage.setItem('pharmacy_auth_session',${JSON.stringify(JSON.stringify(admin))});localStorage.setItem('pharmacy_token',${JSON.stringify(admin.token)})`)
    for (const route of routes) {
      for (const [viewport, width, height] of viewports) {
        await cdp.command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width <= 390 })
        const eventStart = cdp.events.length
        await cdp.navigate(`${FRONTEND}${route}`)
        const snapshot = await cdp.evaluate(`(() => ({
          pathname: location.pathname,
          headings: [...document.querySelectorAll('h1,h2')].map(item => item.innerText.trim()).filter(Boolean),
          labels: document.querySelectorAll('label').length,
          labelsWithoutControl: [...document.querySelectorAll('label')].filter(label => !label.control).map(label => label.innerText.trim()),
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
          body: document.body.innerText.trim().slice(0, 300)
        }))()`)
        const events = cdp.events.slice(eventStart)
        const failures = events.flatMap(event => {
          if (event.method === 'Runtime.exceptionThrown') return [`exception: ${event.params.exceptionDetails.text}`]
          if (event.method === 'Network.responseReceived' && event.params.response.status >= 500) return [`http ${event.params.response.status}: ${event.params.response.url}`]
          return []
        })
        records.push({ route, viewport, ...snapshot, failures: [...new Set(failures)], pass: snapshot.pathname === route && snapshot.headings.length > 0 && !snapshot.overflow && !snapshot.labelsWithoutControl.length && !failures.length })
      }
    }
  } finally { cdp.close() }

  const desktopLabels = records.filter(record => record.viewport === 'desktop').reduce((sum, record) => sum + record.labels, 0)
  const summary = {
    apiChecks,
    routes: routes.length,
    viewportRuns: records.length,
    passed: records.filter(record => record.pass).length,
    failed: records.filter(record => !record.pass).length,
    overflowRuns: records.filter(record => record.overflow).length,
    labelsWithoutControl: records.reduce((sum, record) => sum + record.labelsWithoutControl.length, 0),
    desktopLabels,
  }
  const result = { generatedAt: new Date().toISOString(), summary, records }
  fs.writeFileSync(path.resolve(__dirname, '../evidence/fixed-paths-browser-audit.json'), JSON.stringify(result, null, 2))
  console.log(JSON.stringify(summary, null, 2))
  if (Object.values(apiChecks).some(value => !value) || summary.failed) process.exitCode = 1
}

main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1 })
