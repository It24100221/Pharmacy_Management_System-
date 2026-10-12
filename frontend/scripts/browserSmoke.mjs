const FRONTEND = process.env.FRONTEND_URL || 'http://localhost:3000'
const CDP = process.env.CDP_URL || 'http://localhost:9222'

const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))

class CdpClient {
  constructor(webSocketUrl) {
    this.socket = new WebSocket(webSocketUrl)
    this.nextId = 1
    this.pending = new Map()
    this.events = []
  }

  async connect() {
    await new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once: true })
      this.socket.addEventListener('error', reject, { once: true })
    })
    this.socket.addEventListener('message', event => {
      const message = JSON.parse(event.data)
      if (message.id) {
        const pending = this.pending.get(message.id)
        if (!pending) return
        this.pending.delete(message.id)
        if (message.error) pending.reject(new Error(message.error.message))
        else pending.resolve(message.result)
        return
      }
      this.events.push(message)
    })
    await this.command('Page.enable')
    await this.command('Runtime.enable')
    await this.command('Network.enable')
    await this.command('Log.enable')
  }

  command(method, params = {}) {
    const id = this.nextId++
    this.socket.send(JSON.stringify({ id, method, params }))
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }))
  }

  async evaluate(expression) {
    const response = await this.command('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    })
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.text)
    return response.result.value
  }

  async waitFor(check, timeout = 10000) {
    const startedAt = Date.now()
    while (Date.now() - startedAt < timeout) {
      if (await check()) return true
      await sleep(100)
    }
    return false
  }

  async navigate(pathname) {
    const eventStart = this.events.length
    await this.command('Page.navigate', { url: `${FRONTEND}${pathname}` })
    const loaded = await this.waitFor(() => this.evaluate('document.readyState === "complete"'))
    await sleep(700)
    const page = await this.evaluate(`({
      pathname: location.pathname,
      title: document.title,
      headings: [...document.querySelectorAll('h1, h2')].map(element => element.innerText),
      text: document.body?.innerText?.slice(0, 500) || ''
    })`)
    const routeEvents = this.events.slice(eventStart)
    const failures = routeEvents.flatMap(event => {
      if (event.method === 'Runtime.exceptionThrown') {
        return [`exception: ${event.params.exceptionDetails.text}`]
      }
      if (event.method === 'Log.entryAdded' && event.params.entry.level === 'error') {
        return [`console: ${event.params.entry.text}`]
      }
      if (event.method === 'Network.loadingFailed') {
        return [`network: ${event.params.errorText}`]
      }
      if (event.method === 'Network.responseReceived' && event.params.response.status >= 400) {
        return [`http ${event.params.response.status}: ${event.params.response.url}`]
      }
      return []
    })
    return { loaded, ...page, failures }
  }

  close() {
    this.socket.close()
  }
}

const targetList = await (await fetch(`${CDP}/json/list`)).json()
const target = targetList.find(item => item.type === 'page' && item.url.startsWith(FRONTEND))
if (!target) throw new Error(`No browser tab is open at ${FRONTEND}`)

const browser = new CdpClient(target.webSocketDebuggerUrl)
await browser.connect()

try {
  await browser.evaluate("localStorage.clear(); sessionStorage.clear()")
  const scenarios = [
    { path: '/', expectedPath: '/', content: /better care[\s\S]*smarter pharmacy/i },
    { path: '/pharmacy-items', expectedPath: '/pharmacy-items', content: /pharmacy items/i },
    { path: '/login', expectedPath: '/login', content: /choose your sign in/i },
    { path: '/customer-login', expectedPath: '/customer-login', content: /sign in to your customer account/i },
    { path: '/staff-login', expectedPath: '/staff-login', content: /sign in to your staff workspace/i },
    { path: '/customer-register', expectedPath: '/customer-register', content: /create your customer account/i },
    { path: '/definitely-missing', expectedPath: '/definitely-missing', content: /page not found/i },
    { path: '/admin-dashboard', expectedPath: '/login', content: /choose your sign in/i },
  ]

  const results = []
  for (const scenario of scenarios) {
    const actual = await browser.navigate(scenario.path)
    const passed = actual.loaded && actual.pathname === scenario.expectedPath && scenario.content.test(actual.text) && actual.failures.length === 0
    results.push({ route: scenario.path, expectedPath: scenario.expectedPath, ...actual, result: passed ? 'PASS' : 'FAIL' })
  }

  console.log(JSON.stringify({ frontend: FRONTEND, results }, null, 2))
  if (results.some(result => result.result === 'FAIL')) process.exitCode = 1
} finally {
  browser.close()
}
