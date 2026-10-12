const test = require('node:test')
const assert = require('node:assert/strict')
const Module = require('node:module')
const jwt = require('jsonwebtoken')
process.env.JWT_SECRET ||= 'product-image-test-secret-at-least-32-characters'
const { JWT_AUDIENCE, JWT_ISSUER, getJwtSecret } = require('../src/config/jwt')
const storage = require('../src/services/productImageStorage')

let product = { product_id: 999901, product_code: 'P0000999901', product_name: 'Image test fixture', unit_price: 100, stock_quantity: 3, availability: 'AVAILABLE', image_path: null }
const files = []
const replacements = new Map()
const stub = (name, exports) => { const modulePath = require.resolve(name); replacements.set(modulePath, require.cache[modulePath]); const mod = new Module(modulePath); mod.loaded = true; mod.exports = exports; require.cache[modulePath] = mod }
stub('../src/config/database', { pool: { execute: async () => { throw new Error('Unexpected database access') } } })
stub('../src/repositories/authRepository', { findUserById: async id => ({ user_id: id, username: 'fixture', role: id === 1 ? 'ADMIN' : 'CUSTOMER' }) })
stub('../src/repositories/productRepository', {
  findById: async id => id === product.product_id ? product : null,
  findByCode: async code => code === product.product_code ? product : null,
  updateImage: async (id, metadata) => {
    if (metadata.storedFilename) files.push(metadata.storagePath)
    product = { ...product, image_path: metadata.storagePath || null, image_external_url: metadata.externalUrl || null, image_mime_type: metadata.mimeType || null, image_source_url: metadata.sourceUrl || null, image_license: metadata.license || null, image_alt_text: metadata.altText || null, image_updated_at: new Date() }
    return product
  },
})
const app = require('../src/app')
let server, base
const start = async () => { server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve)); base = `http://127.0.0.1:${server.address().port}` }
const token = id => jwt.sign({ userId: id }, getJwtSecret(), { issuer: JWT_ISSUER, audience: JWT_AUDIENCE })
const request = (route, options = {}, user = 1) => fetch(base + route, { ...options, headers: { ...(user ? { Authorization: `Bearer ${token(user)}` } : {}), ...options.headers } })
test.before(start)
test.after(async () => { await new Promise(resolve => server.close(resolve)); for (const file of files) await storage.deleteFile(file); for (const [name, previous] of replacements) { if (previous) require.cache[name] = previous; else delete require.cache[name] } })

test('image upload, read, URL replacement and removal preserve commerce data and authorization', async () => {
  const endpoint = `/api/products/id/${product.product_id}/image`
  assert.equal((await request(endpoint, { method: 'POST' }, null)).status, 401)
  assert.equal((await request(endpoint, { method: 'DELETE' }, 2)).status, 403)
  assert.equal((await request(endpoint + '-url', { method: 'PUT' }, 2)).status, 403)
  const buffer = Buffer.from('UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA', 'base64')
  const form = () => { const data = new FormData(); data.append('file', new Blob([buffer], { type: 'image/webp' }), 'fixture.webp'); data.append('rights_confirmed', 'true'); data.append('license', 'Owned test fixture'); return data }
  assert.equal((await request('/api/products/id/999902/image', { method: 'POST', body: form() })).status, 404)
  const uploaded = await request(endpoint, { method: 'POST', body: form() }); assert.equal(uploaded.status, 201)
  const saved = (await uploaded.json()).data
  assert.equal(saved.image_kind, 'uploaded'); assert.match(saved.image_url, /^\/api\/products\/P0000999901\/image\?v=/)
  const read = await request(saved.image_url, {}, null)
  assert.equal(read.status, 200); assert.equal(read.headers.get('content-type'), 'image/webp'); assert.deepEqual(Buffer.from(await read.arrayBuffer()), buffer)
  await new Promise(resolve => server.close(resolve)); await start()
  assert.equal((await request(saved.image_url, {}, null)).status, 200)
  const replaced = await request(endpoint, { method: 'POST', body: form() })
  assert.equal(replaced.status, 201)
  assert.notEqual((await replaced.json()).data.image_url, saved.image_url)
  const put = data => request(endpoint + '-url', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
  assert.equal((await put({ image_url: 'javascript:alert(1)', rights_confirmed: true })).status, 400)
  assert.equal((await put({ image_url: 'https://example.com/photo.webp' })).status, 400)
  assert.equal((await put({ image_url: 'https://example.com/photo.webp', rights_confirmed: true })).status, 200)
  assert.equal(product.image_external_url, 'https://example.com/photo.webp')
  assert.equal(product.image_path, null)
  assert.equal((await request(endpoint, { method: 'DELETE' })).status, 200)
  assert.equal(product.image_path, null)
  assert.equal(product.image_external_url, null)
  assert.equal(product.product_name, 'Image test fixture'); assert.equal(product.unit_price, 100); assert.equal(product.stock_quantity, 3)
})
