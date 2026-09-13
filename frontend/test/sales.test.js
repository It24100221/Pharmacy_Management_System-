import test from 'node:test'
import assert from 'node:assert/strict'

import { getSaleValidationError, isMedicineSellable } from '../src/utils/sales.js'

test('only in-stock, non-expired medicines are sellable', () => {
  assert.equal(isMedicineSellable({ quantity: 5, expiryStatus: 'valid' }), true)
  assert.equal(isMedicineSellable({ quantity: 0, expiryStatus: 'valid' }), false)
  assert.equal(isMedicineSellable({ quantity: 5, expiryStatus: 'expired' }), false)
})

test('sale validation rejects an empty cart', () => {
  assert.match(getSaleValidationError([], 0), /Cart is empty/)
})

test('sale validation rejects invalid and excessive discounts', () => {
  const cart = [{ lineTotal: 500 }]
  assert.match(getSaleValidationError(cart, -1), /non-negative/)
  assert.match(getSaleValidationError(cart, Number.NaN), /valid/)
  assert.match(getSaleValidationError(cart, 501), /cannot exceed/)
})

test('sale validation accepts a discount up to the subtotal', () => {
  const cart = [{ lineTotal: 300 }, { lineTotal: 200 }]
  assert.equal(getSaleValidationError(cart, 0), null)
  assert.equal(getSaleValidationError(cart, 500), null)
})
