const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { buildImportPlan, reviewTemplate } = require('../src/services/productImageImportPlan')

const product = { product_id: 34, product_code: 'P0000000034', medicine_id: 31,
  product_name: 'Test medicine 500mg Tablets (30pcs)', generic_name: 'Test medicine',
  manufacturer: 'Test manufacturer', is_active: true, image_path: null, image_external_url: null }
const candidate = { productId: 34, productCode: product.product_code, name: product.product_name,
  genericName: product.generic_name, manufacturer: product.manufacturer, strength: '500mg', form: 'tablets',
  packSize: '30pcs', filename: 'fixture.webp', mimeType: 'image/webp', verified: true, rightsConfirmed: true,
  sourceUrl: 'https://example.com/owned-fixture', license: 'Owned test fixture' }
const bytes = Buffer.from('UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA', 'base64')
let root
test.before(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'pharmacy-image-preview-')); await fs.writeFile(path.join(root, 'fixture.webp'), bytes) })
test.after(async () => { await fs.unlink(path.join(root, 'fixture.webp')); await fs.rmdir(root) })

test('import preview validates the actual file and hashes reviewed metadata without changing products', async () => {
  const snapshot = structuredClone(product)
  const plan = await buildImportPlan([product], [candidate], root)
  assert.equal(plan.updates.length, 1)
  assert.equal(plan.updates[0].productId, 34)
  assert.equal(plan.updates[0].fileSize, bytes.length)
  assert.match(plan.updates[0].sha256, /^[a-f0-9]{64}$/)
  assert.equal(plan.rejected.length, 0)
  assert.deepEqual(product, snapshot)
  assert.equal((await buildImportPlan([product], [candidate], root)).planSha256, plan.planSha256)
  assert.notEqual((await buildImportPlan([product], [{ ...candidate, license: 'Different permission' }], root)).planSha256, plan.planSha256)
})

test('preview rejects missing files, path traversal, wrong bytes and duplicate Product IDs', async () => {
  for (const change of [{ filename: 'missing.webp' }, { filename: '../fixture.webp' }, { filename: '..\\fixture.webp' }, { mimeType: 'image/png' }, { sha256: '0'.repeat(64) }, { productId: 31 }, { rightsConfirmed: false }]) {
    const plan = await buildImportPlan([product], [{ ...candidate, ...change }], root)
    assert.equal(plan.updates.length, 0)
    assert.equal(plan.rejected.length, 1)
  }
  const duplicates = await buildImportPlan([product], [candidate, candidate], root)
  assert.equal(duplicates.updates.length, 0)
  assert.equal(duplicates.rejected.length, 2)
})

test('existing image references are preserved and generated templates never assert approval', async () => {
  for (const change of [{ image_path: 'products/existing.webp' }, { image_external_url: 'https://example.com/existing.webp' }]) {
    const plan = await buildImportPlan([{ ...product, ...change }], [candidate], root)
    assert.equal(plan.updates.length, 0)
    assert.equal(plan.rejected[0].reason, 'Existing image preserved')
  }
  const template = reviewTemplate([product])
  assert.equal(template.approved[0].productId, 34)
  assert.equal(template.approved[0].verified, false)
  assert.equal(template.approved[0].rightsConfirmed, false)
  assert.equal(template.approved[0].filename, '')
})
