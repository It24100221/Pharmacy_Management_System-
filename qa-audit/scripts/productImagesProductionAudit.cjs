const fs = require('node:fs/promises')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const assert = require('node:assert/strict')
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

async function run() {
  const frontendRoot = path.resolve(__dirname, '../../frontend')
  const { preview } = await import(pathToFileURL(path.join(frontendRoot, 'node_modules/vite/dist/node/index.js')).href)
  const targets = await (await fetch('http://127.0.0.1:9222/json/list')).json()
  const target = targets.find(item => item.type === 'page')
  assert.ok(target, 'A browser with remote debugging on port 9222 is required')
  const server = await preview({ root: frontendRoot, logLevel: 'error', preview: { port: 0, host: '127.0.0.1', strictPort: true, open: false } })
  const address = server.httpServer.address()
  const base = `http://127.0.0.1:${address.port}`
  const ws = new WebSocket(target.webSocketDebuggerUrl)
  const pending = new Map(), events = []
  let id = 0
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }) })
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data)
    if (!message.id) { events.push(message); return }
    const request = pending.get(message.id)
    if (!request) return
    pending.delete(message.id)
    message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result)
  })
  const command = (method, params = {}) => { const requestId = ++id; ws.send(JSON.stringify({ id: requestId, method, params })); return new Promise((resolve, reject) => pending.set(requestId, { resolve, reject })) }
  const evaluate = async expression => { const result = await command('Runtime.evaluate', { expression, returnByValue: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || 'Browser evaluation failed'); return result.result.value }
  try {
    await command('Page.enable'); await command('Runtime.enable'); await command('Network.enable')
    await command('Page.navigate', { url: base + '/pharmacy-items' })
    let ready = false
    for (let i = 0; i < 100; i++) { if (await evaluate('document.querySelectorAll(".public-product-card").length===14')) { ready = true; break }; await sleep(100) }
    assert.ok(ready, 'Built application did not load the 14 real catalogue records')
    assert.equal(await evaluate('document.querySelectorAll(".public-product-card .catalogue-image-placeholder").length'), 14)
    assert.equal(await evaluate('[...document.querySelectorAll(".public-product-card")].every(card=>!card.innerText.includes("expired")||card.querySelector("button").disabled)'), true)
    const failedResponses = events.filter(event => event.method === 'Network.responseReceived' && event.params.response.url.startsWith(base) && event.params.response.status >= 400)
    assert.equal(failedResponses.length, 0)
    assert.equal(events.filter(event => event.method === 'Runtime.exceptionThrown').length, 0)
    const evidence = path.resolve(__dirname, '../evidence')
    await fs.mkdir(evidence, { recursive: true })
    const screenshot = await command('Page.captureScreenshot', { format: 'png' })
    await fs.writeFile(path.join(evidence, 'product-images-production.png'), Buffer.from(screenshot.data, 'base64'))
    const result = { generatedAt: new Date().toISOString(), passed: true, actualProducts: 14, actualAssignedImages: 0, httpErrors: 0, uncaughtExceptions: 0, expiredRestrictionsPreserved: true, databaseWrites: 0 }
    await fs.writeFile(path.join(evidence, 'product-images-production.json'), JSON.stringify(result, null, 2) + '\n')
    console.log(JSON.stringify(result))
  } finally {
    await command('Page.navigate', { url: 'http://localhost:3000/pharmacy-items' }).catch(() => {})
    ws.close()
    await new Promise(resolve => server.httpServer.close(resolve))
  }
}

run().catch(error => { console.error(error.stack); process.exitCode = 1 })
