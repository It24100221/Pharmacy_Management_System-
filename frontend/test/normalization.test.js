import test from 'node:test'
import assert from 'node:assert/strict'

import {
  computeStockStatus,
  getExpiryStatus,
  normalizeMedicine,
  normalizePrescription,
  normalizeSale,
} from '../src/utils/normalization.js'

test('stock thresholds classify zero, low, boundary, and in-stock quantities', () => {
  assert.equal(computeStockStatus(0, 10), 'out_of_stock')
  assert.equal(computeStockStatus(5, 10), 'low_stock')
  assert.equal(computeStockStatus(10, 10), 'low_stock')
  assert.equal(computeStockStatus(11, 10), 'in_stock')
  assert.equal(computeStockStatus(1, 0), 'in_stock')
})

test('expiry status classifies past, near, distant, and missing dates', () => {
  const near = new Date()
  near.setDate(near.getDate() + 15)
  const distant = new Date()
  distant.setDate(distant.getDate() + 60)

  assert.equal(getExpiryStatus('2020-01-01'), 'expired')
  assert.equal(getExpiryStatus(near.toISOString().split('T')[0]), 'near_expiry')
  assert.equal(getExpiryStatus(distant.toISOString().split('T')[0]), 'valid')
  assert.equal(getExpiryStatus(null), 'valid')
  assert.equal(getExpiryStatus('not-a-date'), 'valid')
})

test('medicine normalization supports API and local field names while preserving zero', () => {
  const apiMedicine = normalizeMedicine({
    id: '3',
    quantity: '0',
    unit_price: '850',
    generic_name: 'Paracetamol',
    batch_number: 'PCM-001',
    min_stock_level: '0',
    expiry_date: '2027-08-15',
  })

  assert.equal(apiMedicine.id, 3)
  assert.equal(apiMedicine.quantity, 0)
  assert.equal(apiMedicine.unitPrice, 850)
  assert.equal(apiMedicine.minStockLevel, 0)
  assert.equal(apiMedicine.stockStatus, 'out_of_stock')
  assert.equal(apiMedicine.genericName, 'Paracetamol')
  assert.equal(apiMedicine.batchNumber, 'PCM-001')

  const localMedicine = normalizeMedicine({ quantity: 12, minStockLevel: 5, unitPrice: 125 })
  assert.equal(localMedicine.stockStatus, 'in_stock')
  assert.equal(localMedicine.unitPrice, 125)
})

test('sale normalization handles both list and receipt response shapes', () => {
  const sale = normalizeSale({
    id: '8',
    customer: { name: 'Kamal Perera' },
    total_amount: '350',
    discount: '50',
    final_amount: '300',
    items: [{ name: 'Paracetamol', quantity: '2', unit_price: '150', line_total: '300' }],
  })

  assert.equal(sale.id, 8)
  assert.equal(sale.receipt_number, 'REC-000008')
  assert.equal(sale.customer_name, 'Kamal Perera')
  assert.equal(sale.subtotal, 350)
  assert.equal(sale.discount, 50)
  assert.equal(sale.total, 300)
  assert.deepEqual(sale.items[0], {
    name: 'Paracetamol',
    medicine_id: null,
    medicine_name: 'Paracetamol',
    batch_number: '',
    quantity: 2,
    unit_price: 150,
    line_total: 300,
  })
})

test('prescription normalization maps stored item quantities for billing', () => {
  const prescription = normalizePrescription({
    id: '5',
    customer_id: '2',
    first_name: 'Nimali',
    last_name: 'Abeykoon',
    items: [{ medicine_id: '9', prescribed_quantity: '4', unit_price: '225' }],
  })

  assert.equal(prescription.id, 5)
  assert.equal(prescription.customer_id, 2)
  assert.equal(prescription.customer_name, 'Nimali Abeykoon')
  assert.equal(prescription.items[0].quantity, 4)
  assert.equal(prescription.items[0].unit_price, 225)
})
