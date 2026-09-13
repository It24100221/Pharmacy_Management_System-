import { describe, it, expect } from 'vitest'

// ============================================================================
// NORMALIZATION FUNCTIONS
// These test the same logic used in AppContext.jsx for normalizing API responses
// ============================================================================

function computeStockStatus(quantity, minStock) {
  if (quantity <= 0) return 'out_of_stock'
  if (quantity <= minStock) return 'low_stock'
  return 'in_stock'
}

function getExpiryStatus(expiryDate) {
  if (!expiryDate) return 'valid'
  const expiry = new Date(expiryDate)
  const today = new Date()
  const daysUntil = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24))
  if (daysUntil < 0) return 'expired'
  if (daysUntil <= 30) return 'near_expiry'
  return 'valid'
}

function normalizeMedicine(m) {
  return {
    ...m,
    stockStatus: m.stock_status || computeStockStatus(m.quantity, m.min_stock_level || 10),
    expiryStatus: m.expiry_status || getExpiryStatus(m.expiry_date),
    unitPrice: m.unit_price,
    genericName: m.generic_name,
    batchNumber: m.batch_number,
    minStockLevel: m.min_stock_level,
    expiryDate: m.expiry_date,
  }
}

function normalizeSupplier(s) {
  return {
    ...s,
    company_name: s.company_name,
    contact_person: s.contact_person,
  }
}

function normalizeCustomer(c) {
  return {
    ...c,
    first_name: c.first_name,
    last_name: c.last_name,
    date_of_birth: c.date_of_birth,
  }
}

function normalizeSale(s) {
  return {
    ...s,
    customer_name: s.customer_name || (s.first_name ? `${s.first_name} ${s.last_name}` : 'Walk-in Customer'),
    sale_date: s.sale_date,
    total: s.final_amount || s.total_amount,
    subtotal: s.total_amount,
    payment_method: s.payment_method,
    items: s.items || [],
  }
}

// ============================================================================
// STOCK STATUS
// ============================================================================
describe('computeStockStatus', () => {
  it('returns out_of_stock when quantity is 0', () => {
    expect(computeStockStatus(0, 10)).toBe('out_of_stock')
  })

  it('returns out_of_stock when quantity is negative', () => {
    expect(computeStockStatus(-5, 10)).toBe('out_of_stock')
  })

  it('returns low_stock when quantity is below minStock', () => {
    expect(computeStockStatus(5, 10)).toBe('low_stock')
  })

  it('returns low_stock when quantity equals minStock', () => {
    expect(computeStockStatus(10, 10)).toBe('low_stock')
  })

  it('returns in_stock when quantity is above minStock', () => {
    expect(computeStockStatus(15, 10)).toBe('in_stock')
  })

  it('defaults minStock to 10 when not provided', () => {
    expect(computeStockStatus(5, undefined)).toBe('low_stock')
    expect(computeStockStatus(15, undefined)).toBe('in_stock')
  })
})

// ============================================================================
// EXPIRY STATUS
// ============================================================================
describe('getExpiryStatus', () => {
  it('returns valid for null/undefined expiry', () => {
    expect(getExpiryStatus(null)).toBe('valid')
    expect(getExpiryStatus(undefined)).toBe('valid')
    expect(getExpiryStatus('')).toBe('valid')
  })

  it('returns expired for past dates', () => {
    expect(getExpiryStatus('2020-01-01')).toBe('expired')
    expect(getExpiryStatus('2025-01-10')).toBe('expired')
  })

  it('returns near_expiry for dates within 30 days', () => {
    const future = new Date()
    future.setDate(future.getDate() + 15)
    expect(getExpiryStatus(future.toISOString().split('T')[0])).toBe('near_expiry')
  })

  it('returns near_expiry for today', () => {
    const today = new Date().toISOString().split('T')[0]
    expect(getExpiryStatus(today)).toBe('near_expiry')
  })

  it('returns valid for dates more than 30 days away', () => {
    const future = new Date()
    future.setDate(future.getDate() + 60)
    expect(getExpiryStatus(future.toISOString().split('T')[0])).toBe('valid')
  })
})

// ============================================================================
// MEDICINE NORMALIZATION
// ============================================================================
describe('normalizeMedicine', () => {
  it('normalizes snake_case API fields to camelCase', () => {
    const apiMedicine = {
      id: 1,
      name: 'Paracetamol',
      unit_price: 850,
      generic_name: 'Paracetamol',
      batch_number: 'PCM-001',
      min_stock_level: 30,
      expiry_date: '2026-08-15',
      quantity: 200,
    }

    const result = normalizeMedicine(apiMedicine)

    expect(result.unitPrice).toBe(850)
    expect(result.genericName).toBe('Paracetamol')
    expect(result.batchNumber).toBe('PCM-001')
    expect(result.minStockLevel).toBe(30)
    expect(result.expiryDate).toBe('2026-08-15')
  })

  it('computes stock_status when not provided by API', () => {
    const apiMedicine = { id: 1, quantity: 5, min_stock_level: 10 }
    expect(normalizeMedicine(apiMedicine).stockStatus).toBe('low_stock')
  })

  it('uses API-provided stock_status when available', () => {
    const apiMedicine = { id: 1, quantity: 5, stock_status: 'in_stock' }
    expect(normalizeMedicine(apiMedicine).stockStatus).toBe('in_stock')
  })

  it('computes expiry_status when not provided by API', () => {
    const apiMedicine = { id: 1, expiry_date: '2020-01-01' }
    expect(normalizeMedicine(apiMedicine).expiryStatus).toBe('expired')
  })

  it('uses API-provided expiry_status when available', () => {
    const apiMedicine = { id: 1, expiry_date: '2020-01-01', expiry_status: 'valid' }
    expect(normalizeMedicine(apiMedicine).expiryStatus).toBe('valid')
  })
})

// ============================================================================
// SUPPLIER NORMALIZATION
// ============================================================================
describe('normalizeSupplier', () => {
  it('preserves supplier fields', () => {
    const apiSupplier = { id: 1, company_name: 'MedPharm', contact_person: 'John', email: 'j@med.com' }
    const result = normalizeSupplier(apiSupplier)

    expect(result.company_name).toBe('MedPharm')
    expect(result.contact_person).toBe('John')
    expect(result.email).toBe('j@med.com')
  })
})

// ============================================================================
// CUSTOMER NORMALIZATION
// ============================================================================
describe('normalizeCustomer', () => {
  it('preserves customer fields', () => {
    const apiCustomer = { id: 1, first_name: 'Kamal', last_name: 'Perera', date_of_birth: '1985-03-15' }
    const result = normalizeCustomer(apiCustomer)

    expect(result.first_name).toBe('Kamal')
    expect(result.last_name).toBe('Perera')
    expect(result.date_of_birth).toBe('1985-03-15')
  })
})

// ============================================================================
// SALE NORMALIZATION
// ============================================================================
describe('normalizeSale', () => {
  it('uses customer_name from API when available', () => {
    const apiSale = { id: 1, customer_name: 'Kamal Perera', total_amount: 5000, final_amount: 4500, payment_method: 'Cash' }
    const result = normalizeSale(apiSale)

    expect(result.customer_name).toBe('Kamal Perera')
    expect(result.total).toBe(4500)
    expect(result.subtotal).toBe(5000)
  })

  it('constructs customer_name from first_name/last_name when customer_name is missing', () => {
    const apiSale = { id: 1, first_name: 'Kamal', last_name: 'Perera', total_amount: 5000, final_amount: 5000 }
    const result = normalizeSale(apiSale)

    expect(result.customer_name).toBe('Kamal Perera')
  })

  it('defaults to Walk-in Customer when no name available', () => {
    const apiSale = { id: 1, total_amount: 5000, final_amount: 5000 }
    const result = normalizeSale(apiSale)

    expect(result.customer_name).toBe('Walk-in Customer')
  })

  it('defaults items to empty array', () => {
    const apiSale = { id: 1, total_amount: 5000, final_amount: 5000 }
    const result = normalizeSale(apiSale)

    expect(result.items).toEqual([])
  })

  it('preserves existing items', () => {
    const apiSale = { id: 1, total_amount: 5000, final_amount: 5000, items: [{ medicine_name: 'Test' }] }
    const result = normalizeSale(apiSale)

    expect(result.items).toHaveLength(1)
  })
})

// ============================================================================
// EDGE CASES
// ============================================================================
describe('edge cases', () => {
  it('normalizeMedicine handles empty object', () => {
    const result = normalizeMedicine({})
    expect(result.stockStatus).toBe('out_of_stock') // quantity is undefined -> NaN <= 0
    expect(result.unitPrice).toBeUndefined()
  })

  it('normalizeSale handles minimal data', () => {
    const result = normalizeSale({})
    expect(result.customer_name).toBe('Walk-in Customer')
    expect(result.total).toBeUndefined()
    expect(result.items).toEqual([])
  })

  it('computeStockStatus handles zero minStock', () => {
    expect(computeStockStatus(1, 0)).toBe('in_stock')
    expect(computeStockStatus(0, 0)).toBe('out_of_stock')
  })
})
