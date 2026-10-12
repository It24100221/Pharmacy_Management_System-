const test = require('node:test')
const assert = require('node:assert/strict')
const storage = require('../src/services/productImageStorage')
const { validateImageUrl, validateImageMetadata } = require('../src/services/productImageMetadata')
const { exactMatch } = require('../src/services/productImageMatching')

test('image URLs allow public HTTPS while rejecting active schemes, local hosts and credentials', () => {
  assert.equal(validateImageUrl('https://example.com/product.webp'), 'https://example.com/product.webp')
  for (const url of ['javascript:alert(1)', 'data:image/png;base64,eA==', 'http://example.com/a', 'https://localhost/a', 'https://127.0.0.1/a', 'https://[::1]/a', 'https://staff:secret@example.com/a', 'https://example.com:8443/a', 'https://service.internal/a']) {
    assert.throws(() => validateImageUrl(url), { statusCode: 400 })
  }
})

test('image metadata requires rights confirmation and bounds attribution fields', () => {
  assert.throws(() => validateImageMetadata({}), { statusCode: 400 })
  assert.throws(() => validateImageMetadata({ rights_confirmed: true, license: 'x'.repeat(501) }), { statusCode: 400 })
  assert.deepEqual(validateImageMetadata({ rights_confirmed: true, source_url: 'https://example.com/source', license: ' CC0 ', alt_text: ' Product ' }), { sourceUrl: 'https://example.com/source', license: 'CC0', altText: 'Product' })
})

test('WebP image uploads use generated filenames and reject malformed RIFF files', async () => {
  // Valid tiny WebP image. This exercises the actual signature and local storage round trip.
  const buffer = Buffer.from('UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA', 'base64')
  const file = { buffer, size: buffer.length, originalName: '../product.webp', declaredMimeType: 'image/webp' }
  const metadata = storage.validateAndDescribe(file)
  assert.match(metadata.storagePath, /^products\/[a-f0-9-]+\.webp$/)
  await storage.saveFile(buffer, metadata)
  try { assert.deepEqual(await storage.readFile(metadata.storagePath), buffer) }
  finally { await storage.deleteFile(metadata.storagePath) }
  const broken = Buffer.from(buffer); broken.writeUInt32LE(0, 4)
  assert.throws(() => storage.validateAndDescribe({ ...file, buffer: broken }), { statusCode: 415 })
  assert.throws(() => storage.validateAndDescribe({ ...file, originalName: 'test.svg' }), { statusCode: 415 })
  await assert.rejects(storage.readFile('../secrets.webp'), { statusCode: 404 })
})

test('offline matching requires exact identifiers, manufacturer, strength, form, pack and rights', () => {
  const product = { product_id: 1, product_code: 'P0000000001', product_name: 'Medicine 500mg Tablets (30pcs)', generic_name: 'Medicine', manufacturer: 'Maker' }
  const candidate = { productId: 1, productCode: 'P0000000001', name: product.product_name, genericName: 'medicine', manufacturer: 'maker', strength: '500mg', form: 'tablets', packSize: '30pcs', verified: true, rightsConfirmed: true, sourceUrl: 'https://example.com/source', license: 'CC0' }
  assert.equal(exactMatch(product, candidate), true)
  for (const change of [{ productId: 2 }, { productCode: 'P0000000002' }, { manufacturer: 'Other' }, { strength: '250mg' }, { form: 'syrup' }, { packSize: '100pcs' }, { verified: false }, { rightsConfirmed: false }]) {
    assert.equal(exactMatch(product, { ...candidate, ...change }), false)
  }
  assert.equal(exactMatch({ ...product, product_name: 'Medicine' }, { ...candidate, name: 'Medicine' }), false)
})
