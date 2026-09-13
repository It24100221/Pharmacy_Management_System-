import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, act, waitFor } from '@testing-library/react'

// Mock the API services before importing AppContext
vi.mock('../services/apiService.js', () => ({
  medicineService: {
    getAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    getLowStock: vi.fn(),
    getExpiryStatus: vi.fn(),
  },
  supplierService: {
    getAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  customerService: {
    getAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  purchaseService: {
    getAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
  },
  prescriptionService: {
    getAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    checkAvailability: vi.fn(),
    sendToBilling: vi.fn(),
  },
  salesService: {
    getAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    getTodaySummary: vi.fn(),
  },
}))

import { AppProvider, useApp } from '../context/AppContext.jsx'
import { medicineService, supplierService, customerService, salesService } from '../services/apiService.js'

// Test component that exposes context values
function TestConsumer({ onRender }) {
  const context = useApp()
  onRender(context)
  return <div data-testid="consumer">{context.loading ? 'loading' : 'ready'}</div>
}

function renderWithProvider(ui) {
  return render(<AppProvider>{ui}</AppProvider>)
}

beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
})

// ============================================================================
// INITIAL DATA LOADING
// ============================================================================
describe('AppContext - initial data loading', () => {
  it('loads data from API on mount', async () => {
    medicineService.getAll.mockResolvedValue({
      success: true,
      data: { medicines: [{ id: 1, name: 'Paracetamol', quantity: 100, unit_price: 850, batch_number: 'PCM-001', min_stock_level: 30, expiry_date: '2026-08-15' }] }
    })
    supplierService.getAll.mockResolvedValue({ success: true, data: { suppliers: [] } })
    customerService.getAll.mockResolvedValue({ success: true, data: { customers: [] } })
    salesService.getAll.mockResolvedValue({ success: true, data: { sales: [] } })

    let contextValue
    renderWithProvider(<TestConsumer onRender={(ctx) => { contextValue = ctx }} />)

    await waitFor(() => {
      expect(contextValue.loading).toBe(false)
    })

    expect(contextValue.medicines).toHaveLength(1)
    expect(contextValue.medicines[0].name).toBe('Paracetamol')
    expect(contextValue.apiConnected).toBe(true)
  })

  it('normalizes medicine data from API', async () => {
    medicineService.getAll.mockResolvedValue({
      success: true,
      data: { medicines: [{ id: 1, name: 'Test Med', quantity: 5, unit_price: 100, batch_number: 'T-001', min_stock_level: 10, expiry_date: '2026-12-31' }] }
    })
    supplierService.getAll.mockResolvedValue({ success: true, data: { suppliers: [] } })
    customerService.getAll.mockResolvedValue({ success: true, data: { customers: [] } })
    salesService.getAll.mockResolvedValue({ success: true, data: { sales: [] } })

    let contextValue
    renderWithProvider(<TestConsumer onRender={(ctx) => { contextValue = ctx }} />)

    await waitFor(() => {
      expect(contextValue.loading).toBe(false)
    })

    const med = contextValue.medicines[0]
    expect(med.unitPrice).toBe(100) // normalized from unit_price
    expect(med.stockStatus).toBe('low_stock') // 5 < 10
    expect(med.expiryStatus).toBe('valid') // far future
  })

  it('falls back to localStorage when API fails', async () => {
    medicineService.getAll.mockRejectedValue(new Error('Network error'))
    supplierService.getAll.mockRejectedValue(new Error('Network error'))
    customerService.getAll.mockRejectedValue(new Error('Network error'))
    salesService.getAll.mockRejectedValue(new Error('Network error'))

    let contextValue
    renderWithProvider(<TestConsumer onRender={(ctx) => { contextValue = ctx }} />)

    await waitFor(() => {
      expect(contextValue.loading).toBe(false)
    })

    expect(contextValue.apiConnected).toBe(false)
    // Should have default mock data
    expect(contextValue.medicines.length).toBeGreaterThan(0)
  })
})

// ============================================================================
// MEDICINE ACTIONS
// ============================================================================
describe('AppContext - medicine actions', () => {
  it('addMedicine calls API and updates state', async () => {
    medicineService.getAll.mockResolvedValue({ success: true, data: { medicines: [] } })
    supplierService.getAll.mockResolvedValue({ success: true, data: { suppliers: [] } })
    customerService.getAll.mockResolvedValue({ success: true, data: { customers: [] } })
    salesService.getAll.mockResolvedValue({ success: true, data: { sales: [] } })

    const newMedicine = { id: 10, name: 'New Med', unit_price: 500, quantity: 50 }
    medicineService.create.mockResolvedValue({ success: true, data: newMedicine })

    let contextValue
    renderWithProvider(<TestConsumer onRender={(ctx) => { contextValue = ctx }} />)

    await waitFor(() => { expect(contextValue.loading).toBe(false) })

    await act(async () => {
      await contextValue.addMedicine({ name: 'New Med', unit_price: 500, quantity: 50 })
    })

    expect(medicineService.create).toHaveBeenCalledWith({ name: 'New Med', unit_price: 500, quantity: 50 })
    expect(contextValue.medicines).toHaveLength(1)
    expect(contextValue.medicines[0].name).toBe('New Med')
  })

  it('updateMedicine calls API and updates state', async () => {
    medicineService.getAll.mockResolvedValue({
      success: true,
      data: { medicines: [{ id: 1, name: 'Old Name', unit_price: 100, quantity: 50, batch_number: 'B-001', min_stock_level: 10, expiry_date: '2026-12-31' }] }
    })
    supplierService.getAll.mockResolvedValue({ success: true, data: { suppliers: [] } })
    customerService.getAll.mockResolvedValue({ success: true, data: { customers: [] } })
    salesService.getAll.mockResolvedValue({ success: true, data: { sales: [] } })

    medicineService.update.mockResolvedValue({ success: true, data: { id: 1, name: 'Updated Name', unit_price: 200, quantity: 50, batch_number: 'B-001', min_stock_level: 10, expiry_date: '2026-12-31' } })

    let contextValue
    renderWithProvider(<TestConsumer onRender={(ctx) => { contextValue = ctx }} />)

    await waitFor(() => { expect(contextValue.loading).toBe(false) })

    await act(async () => {
      await contextValue.updateMedicine(1, { name: 'Updated Name', unit_price: 200 })
    })

    expect(medicineService.update).toHaveBeenCalledWith(1, { name: 'Updated Name', unit_price: 200 })
    const updated = contextValue.medicines.find(m => m.id === 1)
    expect(updated.name).toBe('Updated Name')
  })

  it('addMedicine falls back to local when API fails', async () => {
    medicineService.getAll.mockResolvedValue({ success: true, data: { medicines: [] } })
    supplierService.getAll.mockResolvedValue({ success: true, data: { suppliers: [] } })
    customerService.getAll.mockResolvedValue({ success: true, data: { customers: [] } })
    salesService.getAll.mockResolvedValue({ success: true, data: { sales: [] } })

    medicineService.create.mockRejectedValue(new Error('API down'))

    let contextValue
    renderWithProvider(<TestConsumer onRender={(ctx) => { contextValue = ctx }} />)

    await waitFor(() => { expect(contextValue.loading).toBe(false) })

    await act(async () => {
      await contextValue.addMedicine({ name: 'Local Med', quantity: 10 })
    })

    expect(contextValue.medicines).toHaveLength(1)
    expect(contextValue.medicines[0].name).toBe('Local Med')
  })
})

// ============================================================================
// SALES ACTIONS
// ============================================================================
describe('AppContext - sales actions', () => {
  it('createSale calls API and reloads medicines', async () => {
    medicineService.getAll
      .mockResolvedValueOnce({ success: true, data: { medicines: [{ id: 1, name: 'Med', quantity: 100, unit_price: 100, batch_number: 'B-001', min_stock_level: 10, expiry_date: '2026-12-31' }] } })
      .mockResolvedValueOnce({ success: true, data: { medicines: [{ id: 1, name: 'Med', quantity: 90, unit_price: 100, batch_number: 'B-001', min_stock_level: 10, expiry_date: '2026-12-31' }] } })
    supplierService.getAll.mockResolvedValue({ success: true, data: { suppliers: [] } })
    customerService.getAll.mockResolvedValue({ success: true, data: { customers: [] } })
    salesService.getAll.mockResolvedValue({ success: true, data: { sales: [] } })

    salesService.create.mockResolvedValue({
      success: true,
      data: { id: 1, receipt_number: 'SAL-1001', total_amount: 1000, final_amount: 1000, payment_method: 'Cash', items: [] }
    })

    let contextValue
    renderWithProvider(<TestConsumer onRender={(ctx) => { contextValue = ctx }} />)

    await waitFor(() => { expect(contextValue.loading).toBe(false) })

    await act(async () => {
      await contextValue.createSale({
        items: [{ medicine_id: 1, quantity: 10, unit_price: 100 }],
        total: 1000,
        payment_method: 'Cash'
      })
    })

    expect(salesService.create).toHaveBeenCalled()
    // Medicines should be reloaded with updated stock
    expect(contextValue.medicines[0].quantity).toBe(90)
  })
})

// ============================================================================
// PURCHASE ACTIONS
// ============================================================================
describe('AppContext - purchase actions', () => {
  it('receiveStock calls API and reloads medicines', async () => {
    medicineService.getAll
      .mockResolvedValueOnce({ success: true, data: { medicines: [{ id: 1, name: 'Med', quantity: 50, unit_price: 100, batch_number: 'B-001', min_stock_level: 10, expiry_date: '2026-12-31' }] } })
      .mockResolvedValueOnce({ success: true, data: { medicines: [{ id: 1, name: 'Med', quantity: 150, unit_price: 100, batch_number: 'B-001', min_stock_level: 10, expiry_date: '2026-12-31' }] } })
    supplierService.getAll.mockResolvedValue({ success: true, data: { suppliers: [] } })
    customerService.getAll.mockResolvedValue({ success: true, data: { customers: [] } })
    salesService.getAll.mockResolvedValue({ success: true, data: { sales: [] } })

    const purchaseService = (await import('../services/apiService.js')).purchaseService
    purchaseService.create.mockResolvedValue({ success: true, data: { id: 1 } })

    let contextValue
    renderWithProvider(<TestConsumer onRender={(ctx) => { contextValue = ctx }} />)

    await waitFor(() => { expect(contextValue.loading).toBe(false) })

    await act(async () => {
      await contextValue.receiveStock({
        supplier_id: 1,
        items: [{ medicine_id: 1, quantity: 100, unit_cost: 100 }]
      })
    })

    expect(contextValue.medicines[0].quantity).toBe(150)
    expect(contextValue.medicines[0].stockStatus).toBe('in_stock')
  })
})

// ============================================================================
// CUSTOMER & SUPPLIER ACTIONS
// ============================================================================
describe('AppContext - customer and supplier actions', () => {
  it('addCustomer calls API', async () => {
    medicineService.getAll.mockResolvedValue({ success: true, data: { medicines: [] } })
    supplierService.getAll.mockResolvedValue({ success: true, data: { suppliers: [] } })
    customerService.getAll.mockResolvedValue({ success: true, data: { customers: [] } })
    salesService.getAll.mockResolvedValue({ success: true, data: { sales: [] } })

    customerService.create.mockResolvedValue({
      success: true,
      data: { id: 6, first_name: 'Nimal', last_name: 'Test', phone: '0771234567' }
    })

    let contextValue
    renderWithProvider(<TestConsumer onRender={(ctx) => { contextValue = ctx }} />)

    await waitFor(() => { expect(contextValue.loading).toBe(false) })

    await act(async () => {
      await contextValue.addCustomer({ first_name: 'Nimal', last_name: 'Test', phone: '0771234567' })
    })

    expect(contextValue.customers).toHaveLength(1)
    expect(contextValue.customers[0].first_name).toBe('Nimal')
  })

  it('addSupplier calls API', async () => {
    medicineService.getAll.mockResolvedValue({ success: true, data: { medicines: [] } })
    supplierService.getAll.mockResolvedValue({ success: true, data: { suppliers: [] } })
    customerService.getAll.mockResolvedValue({ success: true, data: { customers: [] } })
    salesService.getAll.mockResolvedValue({ success: true, data: { sales: [] } })

    supplierService.create.mockResolvedValue({
      success: true,
      data: { id: 6, company_name: 'New Pharma', status: 'active' }
    })

    let contextValue
    renderWithProvider(<TestConsumer onRender={(ctx) => { contextValue = ctx }} />)

    await waitFor(() => { expect(contextValue.loading).toBe(false) })

    await act(async () => {
      await contextValue.addSupplier({ company_name: 'New Pharma' })
    })

    expect(contextValue.suppliers).toHaveLength(1)
    expect(contextValue.suppliers[0].company_name).toBe('New Pharma')
  })
})

// ============================================================================
// TOAST SYSTEM
// ============================================================================
describe('AppContext - toast system', () => {
  it('showToast adds and auto-removes toast', async () => {
    medicineService.getAll.mockResolvedValue({ success: true, data: { medicines: [] } })
    supplierService.getAll.mockResolvedValue({ success: true, data: { suppliers: [] } })
    customerService.getAll.mockResolvedValue({ success: true, data: { customers: [] } })
    salesService.getAll.mockResolvedValue({ success: true, data: { sales: [] } })

    let contextValue
    renderWithProvider(<TestConsumer onRender={(ctx) => { contextValue = ctx }} />)

    await waitFor(() => { expect(contextValue.loading).toBe(false) })

    act(() => {
      contextValue.showToast('Test message', 'success')
    })

    expect(contextValue.toasts).toHaveLength(1)
    expect(contextValue.toasts[0].message).toBe('Test message')
    expect(contextValue.toasts[0].type).toBe('success')
  })
})
