import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const sourceUrl = new URL('../src/pages/BillingOrderQueue.jsx', import.meta.url)
const posSourceUrl = new URL('../src/pages/Sales/POSPage.jsx', import.meta.url)
const createPrescriptionSourceUrl = new URL('../src/pages/Prescriptions/CreatePrescriptionPage.jsx', import.meta.url)

test('billing queue effect never returns the loading promise as cleanup', async () => {
  const source = await readFile(sourceUrl, 'utf8')
  assert.doesNotMatch(source, /useEffect\(\s*load\s*,/)
  assert.match(source, /useEffect\(\(\) => \{ void load\(\) \}, \[load\]\)/)
})

test('billing queue exposes a persistent empty state and request error', async () => {
  const source = await readFile(sourceUrl, 'utf8')
  assert.match(source, /No orders are ready for billing/)
  assert.match(source, /Unable to load billing queue/)
})

test('POS synchronously locks sale submission and uses one idempotency key per attempt', async () => {
  const source = await readFile(posSourceUrl, 'utf8')
  assert.match(source, /const submissionLock = useRef\(false\)/)
  assert.match(source, /if \(submitting \|\| submissionLock\.current\) return/)
  assert.match(source, /submissionLock\.current = true/)
  assert.match(source, /submissionLock\.current = false/)
  assert.match(source, /idempotency_key: `pos:\$\{crypto\.randomUUID\(\)\}`/)
  assert.match(source, /try \{ const result = await createSale\(saleData\)/)
})

test('create prescription locks the handoff and emits one page-level billing error', async () => {
  const source = await readFile(createPrescriptionSourceUrl, 'utf8')
  assert.match(source, /if \(submitting\) return/)
  assert.match(source, /disabled=\{submitting \|\| !availabilityChecked/)
  assert.match(source, /const billingResult = await preparePrescriptionForBilling\(result\.data\.id\)/)
  assert.match(source, /if \(!billingResult\.success\) \{\s+showToast\(billingResult\.error \|\| 'Failed to prepare prescription for billing', 'error'\)/)
})
