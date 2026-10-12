import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const formFiles = [
  '../src/pages/Medicines/AddMedicinePage.jsx',
  '../src/pages/Medicines/EditMedicinePage.jsx',
  '../src/pages/Suppliers/AddSupplierPage.jsx',
  '../src/pages/Purchases/CreatePurchasePage.jsx',
  '../src/pages/Sales/POSPage.jsx',
  '../src/pages/Customers/AddCustomerPage.jsx',
  '../src/pages/Customers/EditCustomerPage.jsx',
  '../src/pages/Prescriptions/CreatePrescriptionPage.jsx',
  '../src/pages/BillingOrderQueue.jsx',
]

test('all audited form labels target an existing control', async () => {
  let labelCount = 0
  for (const relativePath of formFiles) {
    const source = await readFile(new URL(relativePath, import.meta.url), 'utf8')
    const labels = [...source.matchAll(/<label\b([^>]*)>/g)]
    labelCount += labels.length
    for (const label of labels) {
      const target = label[1].match(/htmlFor="([^"]+)"/)?.[1]
      assert.ok(target, `${relativePath} contains a label without htmlFor`)
      assert.match(source, new RegExp(`\\bid="${target}"`), `${relativePath} is missing #${target}`)
    }
  }
  assert.ok(labelCount >= 41, `expected at least 41 audited labels, found ${labelCount}`)
})

test('inline validation errors are announced and referenced by invalid fields', async () => {
  const errorFormFiles = formFiles.slice(0, 2).concat(formFiles.slice(2, 3), formFiles.slice(5, 7))
  for (const relativePath of errorFormFiles) {
    const source = await readFile(new URL(relativePath, import.meta.url), 'utf8')
    assert.doesNotMatch(source, /<div className="form-error">/)
    assert.match(source, /role="alert"/)
    assert.match(source, /aria-describedby=/)
    assert.match(source, /aria-invalid=/)
  }
})
