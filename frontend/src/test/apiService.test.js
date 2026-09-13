import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock axios before importing the service
vi.mock('../services/api.js', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  }
}))

import api from '../services/api.js'
import { medicineService, supplierService, customerService, purchaseService, prescriptionService, salesService } from '../services/apiService.js'

beforeEach(() => {
  vi.clearAllMocks()
})

// ============================================================================
// MEDICINE SERVICE
// ============================================================================
describe('medicineService', () => {
  it('getAll returns medicines list', async () => {
    const mockData = { success: true, data: { medicines: [{ id: 1, name: 'Paracetamol' }] } }
    api.get.mockResolvedValue({ data: mockData })

    const result = await medicineService.getAll()

    expect(api.get).toHaveBeenCalledWith('/medicines', { params: {} })
    expect(result).toEqual(mockData)
    expect(result.data.medicines).toHaveLength(1)
  })

  it('getAll passes filter params', async () => {
    api.get.mockResolvedValue({ data: { success: true, data: [] } })

    await medicineService.getAll({ search: 'para', stock_status: 'low_stock' })

    expect(api.get).toHaveBeenCalledWith('/medicines', {
      params: { search: 'para', stock_status: 'low_stock' }
    })
  })

  it('getById returns single medicine', async () => {
    const mockData = { success: true, data: { id: 1, name: 'Paracetamol' } }
    api.get.mockResolvedValue({ data: mockData })

    const result = await medicineService.getById(1)

    expect(api.get).toHaveBeenCalledWith('/medicines/1')
    expect(result.data.name).toBe('Paracetamol')
  })

  it('create sends POST with medicine data', async () => {
    const medicineData = { name: 'Ibuprofen', unit_price: 500, quantity: 100 }
    const mockResponse = { success: true, data: { id: 5, ...medicineData } }
    api.post.mockResolvedValue({ data: mockResponse })

    const result = await medicineService.create(medicineData)

    expect(api.post).toHaveBeenCalledWith('/medicines', medicineData)
    expect(result.data.id).toBe(5)
  })

  it('update sends PUT with medicine data', async () => {
    const updateData = { unit_price: 600 }
    const mockResponse = { success: true, data: { id: 1, name: 'Paracetamol', unit_price: 600 } }
    api.put.mockResolvedValue({ data: mockResponse })

    const result = await medicineService.update(1, updateData)

    expect(api.put).toHaveBeenCalledWith('/medicines/1', updateData)
    expect(result.data.unit_price).toBe(600)
  })

  it('getLowStock returns low stock medicines', async () => {
    const mockData = { success: true, data: [{ id: 7, name: 'Atorvastatin', quantity: 8 }] }
    api.get.mockResolvedValue({ data: mockData })

    const result = await medicineService.getLowStock()

    expect(api.get).toHaveBeenCalledWith('/medicines/low-stock')
    expect(result.data).toHaveLength(1)
  })

  it('getExpiryStatus returns expiry-filtered medicines', async () => {
    api.get.mockResolvedValue({ data: { success: true, data: [] } })

    await medicineService.getExpiryStatus('expired')

    expect(api.get).toHaveBeenCalledWith('/medicines/expiry-status', { params: { status: 'expired' } })
  })
})

// ============================================================================
// SUPPLIER SERVICE
// ============================================================================
describe('supplierService', () => {
  it('getAll returns suppliers', async () => {
    api.get.mockResolvedValue({ data: { success: true, data: [{ id: 1, company_name: 'MedPharm' }] } })

    const result = await supplierService.getAll()

    expect(api.get).toHaveBeenCalledWith('/suppliers', { params: {} })
    expect(result.data).toHaveLength(1)
  })

  it('create sends POST with supplier data', async () => {
    const supplierData = { company_name: 'New Pharma', phone: '0771234567' }
    api.post.mockResolvedValue({ data: { success: true, data: { id: 6, ...supplierData } } })

    const result = await supplierService.create(supplierData)

    expect(api.post).toHaveBeenCalledWith('/suppliers', supplierData)
    expect(result.data.id).toBe(6)
  })

  it('update sends PUT with supplier data', async () => {
    api.put.mockResolvedValue({ data: { success: true, data: { id: 1, company_name: 'Updated' } } })

    await supplierService.update(1, { company_name: 'Updated' })

    expect(api.put).toHaveBeenCalledWith('/suppliers/1', { company_name: 'Updated' })
  })
})

// ============================================================================
// CUSTOMER SERVICE
// ============================================================================
describe('customerService', () => {
  it('getAll returns customers', async () => {
    api.get.mockResolvedValue({ data: { success: true, data: [{ id: 1, first_name: 'Kamal' }] } })

    const result = await customerService.getAll()

    expect(api.get).toHaveBeenCalledWith('/customers', { params: {} })
    expect(result.data[0].first_name).toBe('Kamal')
  })

  it('create sends POST with customer data', async () => {
    const customerData = { first_name: 'Nimal', last_name: 'Fernando', phone: '0779876543' }
    api.post.mockResolvedValue({ data: { success: true, data: { id: 6, ...customerData } } })

    const result = await customerService.create(customerData)

    expect(api.post).toHaveBeenCalledWith('/customers', customerData)
    expect(result.data.id).toBe(6)
  })
})

// ============================================================================
// PURCHASE SERVICE
// ============================================================================
describe('purchaseService', () => {
  it('create sends POST with purchase data', async () => {
    const purchaseData = {
      supplier_id: 1,
      purchase_date: '2026-09-12',
      items: [{ medicine_id: 1, quantity: 100, unit_cost: 2500 }]
    }
    api.post.mockResolvedValue({ data: { success: true, data: { id: 1 } } })

    const result = await purchaseService.create(purchaseData)

    expect(api.post).toHaveBeenCalledWith('/purchases', purchaseData)
    expect(result.success).toBe(true)
  })
})

// ============================================================================
// PRESCRIPTION SERVICE
// ============================================================================
describe('prescriptionService', () => {
  it('create sends POST with prescription data', async () => {
    const prescriptionData = {
      customer_id: 1,
      prescription_date: '2026-09-12',
      items: [{ medicine_id: 1, quantity: 10 }]
    }
    api.post.mockResolvedValue({ data: { success: true, data: { id: 1 } } })

    const result = await prescriptionService.create(prescriptionData)

    expect(api.post).toHaveBeenCalledWith('/prescriptions', prescriptionData)
    expect(result.success).toBe(true)
  })

  it('checkAvailability fetches availability', async () => {
    api.get.mockResolvedValue({ data: { success: true, data: { available: 5 } } })

    const result = await prescriptionService.checkAvailability(1)

    expect(api.get).toHaveBeenCalledWith('/prescriptions/1/availability')
    expect(result.data.available).toBe(5)
  })

  it('sendToBilling sends POST', async () => {
    api.post.mockResolvedValue({ data: { success: true } })

    await prescriptionService.sendToBilling(1, { items: [] })

    expect(api.post).toHaveBeenCalledWith('/prescriptions/1/send-to-billing', { items: [] })
  })
})

// ============================================================================
// SALES SERVICE
// ============================================================================
describe('salesService', () => {
  it('create sends POST with sale data', async () => {
    const saleData = {
      items: [{ medicine_id: 1, quantity: 10, unit_price: 2500 }],
      total: 25000,
      payment_method: 'Cash'
    }
    api.post.mockResolvedValue({ data: { success: true, data: { id: 1, receipt_number: 'SAL-1001' } } })

    const result = await salesService.create(saleData)

    expect(api.post).toHaveBeenCalledWith('/sales', saleData)
    expect(result.data.receipt_number).toBe('SAL-1001')
  })

  it('getReceipt fetches receipt data', async () => {
    api.get.mockResolvedValue({ data: { success: true, data: { receipt_number: 'REC-000001' } } })

    const result = await salesService.getReceipt(1)

    expect(api.get).toHaveBeenCalledWith('/sales/1/receipt')
    expect(result.data.receipt_number).toBe('REC-000001')
  })

  it('getTodaySummary fetches summary', async () => {
    api.get.mockResolvedValue({ data: { success: true, data: { total_sales: 5, total_revenue: 125000 } } })

    const result = await salesService.getTodaySummary()

    expect(api.get).toHaveBeenCalledWith('/sales/today-summary')
    expect(result.data.total_sales).toBe(5)
  })
})

// ============================================================================
// ERROR HANDLING
// ============================================================================
describe('error handling', () => {
  it('propagates API errors', async () => {
    api.get.mockRejectedValue(new Error('Network Error'))

    await expect(medicineService.getAll()).rejects.toThrow('Network Error')
  })

  it('propagates HTTP errors', async () => {
    const error = new Error('Request failed')
    error.response = { status: 404, data: { message: 'Not found' } }
    api.get.mockRejectedValue(error)

    await expect(medicineService.getById(999)).rejects.toThrow('Request failed')
  })
})
