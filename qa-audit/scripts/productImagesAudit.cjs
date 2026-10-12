const fs = require('fs')
const path = require('path')
const assert = require('node:assert/strict')
const dotenv = require('../../backend/node_modules/dotenv')
dotenv.config({ path: path.resolve(__dirname, '../../backend/.env') })
const jwt = require('../../backend/node_modules/jsonwebtoken')
const { pool, closePool } = require('../../backend/src/config/database')
const { getJwtSecret, JWT_AUDIENCE, JWT_ISSUER } = require('../../backend/src/config/jwt')
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const FRONTEND = 'http://localhost:3000'
const WEBP = 'UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA'

class Browser {
  constructor(url) { this.ws = new WebSocket(url); this.id = 0; this.pending = new Map(); this.events = []; this.intercept = null }
  async connect() {
    await new Promise((resolve, reject) => { this.ws.addEventListener('open', resolve, { once: true }); this.ws.addEventListener('error', reject, { once: true }) })
    this.ws.addEventListener('message', event => {
      const message = JSON.parse(event.data)
      if (message.id) { const request = this.pending.get(message.id); if (!request) return; this.pending.delete(message.id); message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result) }
      else { this.events.push(message); if (message.method === 'Fetch.requestPaused') this.intercept?.(message.params).catch(error => console.error(error.message)); if (message.method === 'Page.javascriptDialogOpening' && this.autoConfirm) this.cmd('Page.handleJavaScriptDialog', { accept: true }) }
    })
    await this.cmd('Page.enable'); await this.cmd('Runtime.enable')
  }
  cmd(method, params = {}) { const id = ++this.id; this.ws.send(JSON.stringify({ id, method, params })); return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject })) }
  async eval(expression) { const result = await this.cmd('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text); return result.result.value }
  async wait(expression) { for (let i = 0; i < 100; i++) { if (await this.eval(expression)) return; await sleep(100) } throw new Error(`Timed out: ${expression}`) }
  async go(route) { await this.cmd('Page.navigate', { url: FRONTEND + route }); await sleep(900) }
  async viewport(width, height) { await this.cmd('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 500 }) }
}

async function run() {
  const target = (await (await fetch('http://127.0.0.1:9222/json/list')).json()).find(item => item.type === 'page')
  if (!target) throw new Error('Start a browser with remote debugging on port 9222')
  const browser = new Browser(target.webSocketDebuggerUrl); await browser.connect()
  const results = []
  const test = async (name, action) => { try { await action(); results.push({ name, passed: true }) } catch (error) { results.push({ name, passed: false, error: error.message }) } }
  const setter = (selector, value) => `(()=>{const element=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(element.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(element,${JSON.stringify(value)});element.dispatchEvent(new Event(element.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`
  const products = await (await fetch('http://localhost:5000/api/products?limit=100')).json()
  const [users] = await pool.execute("SELECT TOP 1 user_id,username,role FROM users WHERE role='ADMIN'")
  const admin = users[0]
  const token = jwt.sign({ userId: admin.user_id }, getJwtSecret(), { issuer: JWT_ISSUER, audience: JWT_AUDIENCE, expiresIn: '15m' })
  const session = { userId: admin.user_id, username: admin.username, role: 'ADMIN', token }
  const evidence = path.resolve(__dirname, '../evidence'); fs.mkdirSync(evidence, { recursive: true })
  try {
    await browser.viewport(1440, 1000); await browser.go('/pharmacy-items')
    await browser.eval('localStorage.clear();sessionStorage.clear()')
    await browser.go('/pharmacy-items')
    await test('all real catalogue records use intentional fallbacks', async () => {
      await browser.wait('document.querySelectorAll(".public-product-card").length === 14')
      assert.equal(await browser.eval('document.querySelectorAll(".public-product-card .catalogue-image-placeholder").length'), 14)
      assert.equal(await browser.eval('document.querySelectorAll(".public-product-card img").length'), 0)
      assert.equal(await browser.eval('[...document.querySelectorAll(".public-product-card")].every(card=>!card.innerText.includes("expired")||card.querySelector("button").disabled)'), true)
    })
    await test('search keeps the correct Product ID', async () => {
      await browser.eval(setter('input[placeholder="Search name or Product ID"]', 'P0000000002'))
      await browser.wait('document.querySelectorAll(".public-product-card").length === 1')
      assert.match(await browser.eval('document.querySelector(".public-product-card").innerText'), /Paracetamol/)
    })
    await browser.go('/pharmacy-items')
    await test('category filter keeps images and identities', async () => { await browser.eval(setter('.catalog-toolbar select', 'MEDICINE')); await browser.wait('document.querySelectorAll(".public-product-card").length===14') })
    await test('mobile catalogue fits the viewport', async () => { await browser.viewport(390, 844); assert.equal(await browser.eval('document.documentElement.scrollWidth <= innerWidth'), true); const shot=await browser.cmd('Page.captureScreenshot',{format:'png'}); fs.writeFileSync(path.join(evidence,'product-images-mobile.png'),Buffer.from(shot.data,'base64')) })
    await browser.viewport(1440, 1000)
    const shot = await browser.cmd('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(evidence,'product-images-desktop.png'), Buffer.from(shot.data,'base64'))
    await test('real licensed research photograph decodes in the shared component without catalogue assignment', async () => {
      const photo='data:image/jpeg;base64,'+fs.readFileSync(path.resolve(__dirname,'../../backend/assets/image-review/originals/amoxicillin-500mg-capsules.jpg')).toString('base64')
      // This standalone preview is clearly unassigned and does not replace any SQL product card.
      await browser.eval(`(async()=>{const {default:React}=await import('/node_modules/.vite/deps/react.js');const {default:ReactDOM}=await import('/node_modules/.vite/deps/react-dom_client.js');const {default:ProductImage}=await import('/src/components/CatalogueProductImage.jsx');const host=document.createElement('section');host.id='qa-unassigned-photo';host.style.cssText='position:fixed;top:20px;right:20px;width:360px;z-index:9999;background:white;padding:20px';document.body.appendChild(host);window.qaPhotoRoot=ReactDOM.createRoot(host);window.qaPhotoRoot.render(React.createElement(React.Fragment,null,React.createElement('h2',null,'Unassigned research photo'),React.createElement('p',null,'Sandoz photo: NOT an approved catalogue image'),React.createElement(ProductImage,{product:{name:'Sandoz amoxicillin 500mg research photograph',image:${JSON.stringify(photo)},imageSourceUrl:'https://commons.wikimedia.org/wiki/File:Amoxicillin_500mg_capsules_on_a_plate_(Sandoz).jpg',imageLicense:'Henrysz / CC BY 4.0'}})));})()`)
      try {
        await browser.wait('document.querySelector("#qa-unassigned-photo img")?.naturalWidth>100')
        assert.equal(await browser.eval('getComputedStyle(document.querySelector("#qa-unassigned-photo img")).objectFit'),'contain')
        assert.equal(await browser.eval('document.querySelectorAll(".public-product-card img").length'),0)
        const screenshot=await browser.cmd('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(evidence,'unassigned-real-photo-verification.png'),Buffer.from(screenshot.data,'base64'))
      } finally { await browser.eval('window.qaPhotoRoot?.unmount();document.getElementById("qa-unassigned-photo")?.remove();delete window.qaPhotoRoot') }
    })
    // Fixture responses verify loaded/error states without assigning a wrong photo to SQL records.
    let broken = false; let imageRequests = 0
    browser.intercept = async event => {
      if (event.request.url.includes('/image-fixture.webp')) {
        imageRequests += 1
        await browser.cmd('Fetch.fulfillRequest',{requestId:event.requestId,responseCode:broken?404:200,responseHeaders:[{name:'Content-Type',value:'image/webp'}],body:broken?'':WEBP})
      } else {
        const fixture=structuredClone(products); fixture.data.products[0].image_url='/image-fixture.webp'
        await browser.cmd('Fetch.fulfillRequest',{requestId:event.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify(fixture)).toString('base64')})
      }
    }
    await browser.cmd('Fetch.enable',{patterns:[{urlPattern:'*://localhost:3000/api/products*'},{urlPattern:'*://localhost:3000/image-fixture.webp*'}]})
    await test('valid image renders with contain sizing after refresh', async () => { await browser.go('/pharmacy-items'); await browser.wait('document.querySelector(".public-product-card img")?.naturalWidth>0'); assert.equal(await browser.eval('getComputedStyle(document.querySelector(".public-product-card img")).objectFit'), 'contain'); await browser.go('/pharmacy-items'); await browser.wait('document.querySelector(".public-product-card img")?.naturalWidth>0') })
    await test('broken URL produces a fallback without a request loop', async () => { broken=true; const start=imageRequests; await browser.go('/pharmacy-items'); await browser.wait('document.querySelectorAll(".public-product-card").length===14 && !document.querySelector(".public-product-card img")'); await sleep(500); const settled=imageRequests; assert.ok(settled-start>=1 && settled-start<=2); await sleep(700); assert.equal(imageRequests,settled) })
    await browser.cmd('Fetch.disable'); browser.intercept=null
    await browser.eval(`localStorage.clear();sessionStorage.clear();localStorage.setItem('pharmacy_auth_session',${JSON.stringify(JSON.stringify(session))});localStorage.setItem('pharmacy_token',${JSON.stringify(token)});`)
    for (const route of ['/medicines', '/medicines/low-stock', '/medicines/expiry', '/medicines/1/batches']) {
      await test(`thumbnail display ${route}`, async () => { await browser.go(route); await browser.wait('document.querySelectorAll(".product-thumbnail").length > 0'); assert.equal(await browser.eval('document.querySelectorAll(".product-thumbnail img").length'), 0) })
    }
    await test('edit form has staff image management controls', async () => { await browser.go('/medicines/edit/1'); await browser.wait('Boolean(document.querySelector(".product-image-manager input[type=file]"))'); assert.match(await browser.eval('document.querySelector(".product-image-manager").innerText'), /P0000000001/) })
    await test('new medicine image placeholder explains permanent ID attachment', async () => { await browser.go('/medicines/add'); assert.match(await browser.eval('document.querySelector(".product-image-manager").innerText'), /Save the medicine first/) })
    await test('POS search renders the same product thumbnail', async () => { await browser.go('/sales'); await browser.eval(setter('input[aria-label="Search medicines"]', 'Paracetamol')); await browser.wait('Boolean(document.querySelector(".pos-search-item .product-thumbnail"))'); await browser.eval('document.querySelector(".pos-search-item").click()'); assert.equal(await browser.eval('Boolean(document.querySelector(".cart-item .product-thumbnail"))'), true) })
    await test('purchase search and selected item render shared images', async () => {
      await browser.go('/purchases'); await browser.wait('Boolean(document.querySelector("input[placeholder*=medicine]"))')
      await browser.eval(setter('input[placeholder*=medicine]', 'Paracetamol'))
      await browser.wait('document.querySelectorAll(".product-thumbnail").length>0')
      await browser.eval('document.querySelector(".product-thumbnail").parentElement.click()')
      await browser.wait('Boolean(document.querySelector(".pharmacy-workflow-aside .product-thumbnail"))')
    })
    // UI mutation fixtures remain inside this browser; no product or SQL metadata is changed.
    const mutable=structuredClone(products); const mutations=[]
    browser.intercept=async event=>{
      const method=event.request.method
      const product=mutable.data.products.find(item=>item.product_id===34)
      if(method!=='GET') {
        assert.ok(event.request.url.includes('/id/34/image')); mutations.push(method)
        if(method==='DELETE') product.image_url=null
        else product.image_url=method==='POST'?'/image-fixture.webp':JSON.parse(event.request.postData).image_url
      }
      const response=method==='GET'?mutable:{success:true,data:product}
      await browser.cmd('Fetch.fulfillRequest',{requestId:event.requestId,responseCode:method==='POST'?201:200,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify(response)).toString('base64')})
    }
    await browser.cmd('Fetch.enable',{patterns:[{urlPattern:'*://localhost:3000/api/products*'}]})
    await test('upload preview and validation attach to Product 34 rather than Medicine 31',async()=>{
      await browser.go('/medicines/edit/31'); await browser.wait('Boolean(document.querySelector(".product-image-manager input[type=file]"))')
      assert.match(await browser.eval('document.querySelector(".product-image-manager").innerText'),/P0000000034/)
      await browser.eval(`(()=>{const input=document.querySelector('.product-image-manager input[type=file]');const data=new DataTransfer();data.items.add(new File(['invalid'],'unsafe.svg',{type:'image/svg+xml'}));input.files=data.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`)
      await browser.wait('document.querySelector(".product-image-manager").innerText.includes("non-empty JPEG")')
      await browser.eval(`(()=>{const input=document.querySelector('.product-image-manager input[type=file]');const data=new DataTransfer();data.items.add(new File([Uint8Array.from(atob('${WEBP}'),c=>c.charCodeAt(0))],'test.webp',{type:'image/webp'}));input.files=data.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`)
      await browser.wait('document.querySelector(".product-image-manager img")?.src.startsWith("blob:")')
      await browser.eval('document.querySelector(".product-image-manager input[type=checkbox]").click();document.querySelector(".product-image-actions button").click()')
      await browser.wait('document.querySelector(".product-image-manager").innerText.includes("Product image saved")')
      assert.deepEqual(mutations,['POST'])
    })
    await test('staff URL replacement and removal refresh the preview',async()=>{
      await browser.eval(setter('.product-image-manager input[id$="-url"]','https://example.com/authorized-fixture.webp'))
      await browser.eval('document.querySelector(".product-image-actions button").click()')
      await browser.wait('document.querySelector(".product-image-manager img")?.src==="https://example.com/authorized-fixture.webp" || document.querySelector(".product-image-actions button")?.innerText==="Replace image"')
      await browser.wait('document.querySelector(".product-image-manager input[type=url]").value==="" && document.querySelectorAll(".product-image-actions button").length===2')
      browser.autoConfirm=true
      await browser.eval('[...document.querySelectorAll(".product-image-actions button")].find(button=>button.innerText==="Remove image").click()')
      await browser.wait('document.querySelector(".product-image-manager").innerText.includes("Product image removed")')
      assert.deepEqual(mutations,['POST','PUT','DELETE'])
      assert.equal(await browser.eval('Boolean(document.querySelector(".product-image-manager img"))'),false)
      browser.autoConfirm=false
    })
    await browser.cmd('Fetch.disable'); browser.intercept=null; await browser.go('/medicines')
    assert.equal(browser.events.filter(event=>event.method==='Runtime.exceptionThrown').length, 0)
  } finally { browser.ws.close(); await closePool() }
  const report={generatedAt:new Date().toISOString(),summary:{total:results.length,passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length},results}
  fs.writeFileSync(path.join(evidence,'product-images-browser.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(report.summary.failed)process.exitCode=1
}
run().catch(error=>{console.error(error.stack);process.exitCode=1})
