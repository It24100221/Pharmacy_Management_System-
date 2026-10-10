import test from 'node:test'
import assert from 'node:assert/strict'
import { isValidSupplierPhone } from '../src/utils/supplierValidation.js'

test('supplier phone validation accepts blank or exactly 10 digits', () => {
  for (const phone of ['', '0772657543', '0112345678', '1234567890']) {
    assert.equal(isValidSupplierPhone(phone), true)
  }
})

test('supplier phone validation rejects non-digits and incorrect lengths', () => {
  for (const phone of ['772657543', '07726575433', '077-265-7543', '077ABC7543', '+94772657543']) {
    assert.equal(isValidSupplierPhone(phone), false)
  }
})
