import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react'
import { mockMedicines } from '../data/mockMedicines.js'
import { mockSuppliers } from '../data/mockSuppliers.js'
import { mockPrescriptions } from '../data/mockPrescriptions.js'
import { mockSales } from '../data/mockSales.js'
import { medicineService, supplierService, customerService, purchaseService, prescriptionService, salesService } from '../services/apiService.js'
import {
  computeStockStatus,
  normalizeCustomer,
  normalizeMedicine,
  normalizePrescription,
  normalizeSale,
  normalizeSupplier,
} from '../utils/normalization.js'

const AppContext = createContext(null)

const loadState = (key, defaultValue) => {
  try {
    const saved = localStorage.getItem(key)
    return saved ? JSON.parse(saved) : defaultValue
  } catch {
    return defaultValue
  }
}

// Seed activity data
const defaultActivity = [
  { id: 1, type: 'sale', title: 'Sale completed — Receipt #SAL-1001', time: new Date(Date.now() - 3600000 * 2).toISOString(), icon: 'receipt' },
  { id: 2, type: 'stock', title: 'Stock received for Amoxicillin 500mg', time: new Date(Date.now() - 3600000 * 5).toISOString(), icon: 'package' },
  { id: 3, type: 'prescription', title: 'Prescription created for Kamal Perera', time: new Date(Date.now() - 3600000 * 8).toISOString(), icon: 'clipboard' },
  { id: 4, type: 'medicine', title: 'Medicine details updated — Cetirizine 10mg', time: new Date(Date.now() - 86400000).toISOString(), icon: 'pencil' },
  { id: 5, type: 'customer', title: 'New customer registered — Nimali Abeykoon', time: new Date(Date.now() - 86400000 * 2).toISOString(), icon: 'user' },
]

const initialState = {
  medicines: loadState('pharmacy_medicines', mockMedicines).map(normalizeMedicine),
  suppliers: loadState('pharmacy_suppliers', mockSuppliers).map(normalizeSupplier),
  customers: [],
  prescriptions: loadState('pharmacy_prescriptions', mockPrescriptions).map(normalizePrescription),
  sales: loadState('pharmacy_sales', mockSales).map(normalizeSale),
  activities: loadState('pharmacy_activities', defaultActivity),
  toasts: [],
  loading: true,
  apiConnected: false,
}

let nextActivityId = loadState('pharmacy_activity_next_id', 6)

function appReducer(state, action) {
  switch (action.type) {
    // ============ INIT ============
    case 'SET_DATA':
      return { ...state, ...action.payload, loading: false }
    case 'SET_API_CONNECTED':
      return { ...state, apiConnected: action.payload }

    // ============ MEDICINES ============
    case 'SET_MEDICINES':
      return { ...state, medicines: action.payload }
    case 'ADD_MEDICINE':
      return { ...state, medicines: [...state.medicines, action.payload], activities: addActivity(state.activities, { type: 'medicine', title: `Medicine added — ${action.payload.name}`, icon: 'pill' }) }
    case 'UPDATE_MEDICINE':
      return { ...state, medicines: state.medicines.map(m => m.id === action.payload.id ? { ...m, ...action.payload } : m), activities: addActivity(state.activities, { type: 'medicine', title: `Medicine updated — ${action.payload.name || 'Medicine'}`, icon: 'pencil' }) }

    // ============ SUPPLIERS ============
    case 'SET_SUPPLIERS':
      return { ...state, suppliers: action.payload }
    case 'ADD_SUPPLIER':
      return { ...state, suppliers: [...state.suppliers, action.payload], activities: addActivity(state.activities, { type: 'supplier', title: `Supplier added — ${action.payload.company_name}`, icon: 'building' }) }
    case 'UPDATE_SUPPLIER':
      return { ...state, suppliers: state.suppliers.map(s => s.id === action.payload.id ? { ...s, ...action.payload } : s) }

    // ============ CUSTOMERS ============
    case 'SET_CUSTOMERS':
      return { ...state, customers: action.payload }
    case 'ADD_CUSTOMER':
      return { ...state, customers: [...state.customers, action.payload], activities: addActivity(state.activities, { type: 'customer', title: `Customer registered — ${action.payload.first_name} ${action.payload.last_name}`, icon: 'user' }) }
    case 'UPDATE_CUSTOMER':
      return { ...state, customers: state.customers.map(c => c.id === action.payload.id ? { ...c, ...action.payload } : c) }

    // ============ PRESCRIPTIONS ============
    case 'SET_PRESCRIPTIONS':
      return { ...state, prescriptions: action.payload }
    case 'ADD_PRESCRIPTION':
      return { ...state, prescriptions: [...state.prescriptions, action.payload], activities: addActivity(state.activities, { type: 'prescription', title: `Prescription created — ${action.payload.customer_name || 'Customer'}`, icon: 'clipboard' }) }

    // ============ SALES ============
    case 'SET_SALES':
      return { ...state, sales: action.payload }
    case 'ADD_SALE':
      return { ...state, sales: [...state.sales, action.payload], activities: addActivity(state.activities, { type: 'sale', title: `Sale completed — Receipt ${action.payload.receipt_number || 'N/A'}`, icon: 'receipt' }) }

    // ============ STOCK OPERATIONS (local fallback) ============
    case 'INCREASE_STOCK': {
      const { medicineId, quantity } = action.payload
      const normalizedMedicineId = Number(medicineId)
      const normalizedQuantity = Number(quantity)
      return {
        ...state,
        medicines: state.medicines.map(m =>
          m.id === normalizedMedicineId
            ? { ...m, quantity: m.quantity + normalizedQuantity, stockStatus: computeStockStatus(m.quantity + normalizedQuantity, m.minStockLevel ?? 10) }
            : m
        ),
      }
    }
    case 'DECREASE_STOCK': {
      const { medicineId, quantity } = action.payload
      const normalizedMedicineId = Number(medicineId)
      const normalizedQuantity = Number(quantity)
      return {
        ...state,
        medicines: state.medicines.map(m =>
          m.id === normalizedMedicineId
            ? { ...m, quantity: Math.max(0, m.quantity - normalizedQuantity), stockStatus: computeStockStatus(Math.max(0, m.quantity - normalizedQuantity), m.minStockLevel ?? 10) }
            : m
        ),
      }
    }

    // ============ TOASTS ============
    case 'ADD_TOAST': {
      const toastId = action.payload.id || Date.now()
      return { ...state, toasts: [...state.toasts, { ...action.payload, id: toastId }] }
    }
    case 'REMOVE_TOAST':
      return { ...state, toasts: state.toasts.filter(t => t.id !== action.payload) }

    default:
      return state
  }
}

function addActivity(activities, { type, title, icon }) {
  const newActivity = { id: nextActivityId++, type, title, icon, time: new Date().toISOString() }
  return [newActivity, ...activities].slice(0, 50)
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState)
  const apiAvailableRef = useRef(true)

  // Persist to localStorage (for offline fallback)
  useEffect(() => { localStorage.setItem('pharmacy_medicines', JSON.stringify(state.medicines)) }, [state.medicines])
  useEffect(() => { localStorage.setItem('pharmacy_suppliers', JSON.stringify(state.suppliers)) }, [state.suppliers])
  useEffect(() => { localStorage.removeItem('pharmacy_customers') }, [])
  useEffect(() => { localStorage.setItem('pharmacy_prescriptions', JSON.stringify(state.prescriptions)) }, [state.prescriptions])
  useEffect(() => { localStorage.setItem('pharmacy_sales', JSON.stringify(state.sales)) }, [state.sales])
  useEffect(() => { localStorage.setItem('pharmacy_activities', JSON.stringify(state.activities)) }, [state.activities])
  useEffect(() => { localStorage.setItem('pharmacy_activity_next_id', JSON.stringify(nextActivityId)) }, [state.activities])

  // Fetch all data from API on mount
  const loadInitialData = useCallback(async () => {
    try {
      const [medRes, supRes, custRes, prescRes, salesRes] = await Promise.allSettled([
        medicineService.getAll({ pagination: 'false' }),
        supplierService.getAll({ pagination: 'false' }),
        customerService.getAll({ pagination: 'false' }),
        prescriptionService.getAll({ pagination: 'false' }),
        salesService.getAll({ pagination: 'false' }),
      ])

      const loadData = {}

      let successfulRequests = 0

      if (medRes.status === 'fulfilled' && medRes.value?.success) {
        const medData = medRes.value.data
        const medicines = Array.isArray(medData) ? medData : (medData.medicines || [])
        loadData.medicines = medicines.map(normalizeMedicine)
        successfulRequests += 1
      }

      if (supRes.status === 'fulfilled' && supRes.value?.success) {
        const supData = supRes.value.data
        const suppliers = Array.isArray(supData) ? supData : (supData.suppliers || [])
        loadData.suppliers = suppliers.map(normalizeSupplier)
        successfulRequests += 1
      }

      if (custRes.status === 'fulfilled' && custRes.value?.success) {
        const custData = custRes.value.data
        const customers = Array.isArray(custData) ? custData : (custData.customers || [])
        loadData.customers = customers.map(normalizeCustomer)
        successfulRequests += 1
      }

      if (prescRes.status === 'fulfilled' && prescRes.value?.success) {
        const prescData = prescRes.value.data
        const prescriptions = Array.isArray(prescData) ? prescData : (prescData.prescriptions || [])
        loadData.prescriptions = prescriptions.map(normalizePrescription)
        successfulRequests += 1
      }

      if (salesRes.status === 'fulfilled' && salesRes.value?.success) {
        const salesData = salesRes.value.data
        const sales = Array.isArray(salesData) ? salesData : (salesData.sales || [])
        loadData.sales = sales.map(normalizeSale)
        successfulRequests += 1
      }

      apiAvailableRef.current = successfulRequests > 0
      dispatch({ type: 'SET_API_CONNECTED', payload: successfulRequests > 0 })
      dispatch({ type: 'SET_DATA', payload: loadData })
    } catch (error) {
      console.warn('API unavailable, using local data:', error.message)
      apiAvailableRef.current = false
      dispatch({ type: 'SET_API_CONNECTED', payload: false })
      dispatch({ type: 'SET_DATA', payload: {} })
    }
  }, [])

  useEffect(() => {
    loadInitialData()
  }, [loadInitialData])

  // ==================== ACTION HELPERS ====================

  const showToast = useCallback((message, type = 'success') => {
    const toastId = Date.now()
    dispatch({ type: 'ADD_TOAST', payload: { message, type, id: toastId } })
    setTimeout(() => dispatch({ type: 'REMOVE_TOAST', payload: toastId }), 3000)
  }, [])

  const markApiUnavailable = useCallback((error) => {
    if (error?.response) return false
    apiAvailableRef.current = false
    dispatch({ type: 'SET_API_CONNECTED', payload: false })
    return true
  }, [])

  const failPersistentWrite = useCallback((action, error) => {
    if (error) markApiUnavailable(error)
    const message = error?.response?.data?.message || error?.message || `Failed to ${action}`
    showToast(message, 'error')
    return { success: false, error: message }
  }, [markApiUnavailable, showToast])

  // Medicine actions
  const addMedicine = async (data) => {
    if (!apiAvailableRef.current) return failPersistentWrite('add medicine', new Error('Database unavailable'))

    try {
      const res = await medicineService.create(data)
      if (!res.success) return failPersistentWrite('add medicine', new Error(res.message || 'Medicine creation failed'))
      const medicine = normalizeMedicine(res.data)
      dispatch({ type: 'ADD_MEDICINE', payload: medicine })
      showToast('Medicine added successfully', 'success')
      return { success: true, data: medicine }
    } catch (error) {
      return failPersistentWrite('add medicine', error)
    }
  }

  const updateMedicine = async (id, data) => {
    if (!apiAvailableRef.current) return failPersistentWrite('update medicine', new Error('Database unavailable'))

    try {
      const res = await medicineService.update(id, data)
      if (!res.success) return failPersistentWrite('update medicine', new Error(res.message || 'Medicine update failed'))
      const medicine = normalizeMedicine(res.data)
      dispatch({ type: 'UPDATE_MEDICINE', payload: medicine })
      showToast('Medicine updated successfully', 'success')
      return { success: true, data: medicine }
    } catch (error) {
      return failPersistentWrite('update medicine', error)
    }
  }

  // Supplier actions
  const addSupplier = async (data) => {
    if (!apiAvailableRef.current) return failPersistentWrite('add supplier', new Error('Database unavailable'))

    try {
      const res = await supplierService.create(data)
      if (!res.success) return failPersistentWrite('add supplier', new Error(res.message || 'Supplier creation failed'))
      const supplier = normalizeSupplier(res.data)
      dispatch({ type: 'ADD_SUPPLIER', payload: supplier })
      showToast('Supplier added successfully', 'success')
      return { success: true, data: supplier }
    } catch (error) {
      return failPersistentWrite('add supplier', error)
    }
  }

  const updateSupplier = async (id, data) => {
    if (!apiAvailableRef.current) return failPersistentWrite('update supplier', new Error('Database unavailable'))

    try {
      const res = await supplierService.update(id, data)
      if (!res.success) return failPersistentWrite('update supplier', new Error(res.message || 'Supplier update failed'))
      const supplier = normalizeSupplier(res.data)
      dispatch({ type: 'UPDATE_SUPPLIER', payload: supplier })
      showToast('Supplier updated successfully', 'success')
      return { success: true, data: supplier }
    } catch (error) {
      return failPersistentWrite('update supplier', error)
    }
  }

  const deleteSupplier = async (id) => {
    if (!apiAvailableRef.current) {
      showToast('Cannot delete supplier while the database is unavailable', 'error')
      return { success: false, error: 'Database unavailable' }
    }

    try {
      const res = await supplierService.remove(id)
      if (res.success) {
        dispatch({ type: 'SET_SUPPLIERS', payload: state.suppliers.filter(supplier => supplier.id !== Number(id)) })
        showToast('Supplier deleted successfully', 'success')
        return { success: true }
      }
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to delete supplier', 'error')
      return { success: false, error: error.message }
    }

    return { success: false, error: 'Supplier deletion failed' }
  }

  // Customer actions
  const addCustomer = async (data) => {
    if (!apiAvailableRef.current) return failPersistentWrite('add customer', new Error('Database unavailable'))

    try {
      const res = await customerService.create(data)
      if (!res.success) return failPersistentWrite('add customer', new Error(res.message || 'Customer creation failed'))
      const customer = normalizeCustomer(res.data)
      dispatch({ type: 'ADD_CUSTOMER', payload: customer })
      showToast('Customer added successfully', 'success')
      return { success: true, data: customer }
    } catch (error) {
      return failPersistentWrite('add customer', error)
    }
  }

  const updateCustomer = async (id, data) => {
    if (!apiAvailableRef.current) return failPersistentWrite('update customer', new Error('Database unavailable'))

    try {
      const res = await customerService.update(id, data)
      if (!res.success) return failPersistentWrite('update customer', new Error(res.message || 'Customer update failed'))
      const customer = normalizeCustomer(res.data)
      dispatch({ type: 'UPDATE_CUSTOMER', payload: customer })
      showToast('Customer updated successfully', 'success')
      return { success: true, data: customer }
    } catch (error) {
      return failPersistentWrite('update customer', error)
    }
  }

  const deleteCustomer = async (id) => {
    if (!apiAvailableRef.current) {
      showToast('Cannot delete customer while the database is unavailable', 'error')
      return { success: false, error: 'Database unavailable' }
    }

    try {
      const res = await customerService.remove(id)
      if (res.success) {
        dispatch({ type: 'SET_CUSTOMERS', payload: state.customers.filter(customer => customer.id !== Number(id)) })
        showToast('Customer deleted successfully', 'success')
        return { success: true }
      }
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to delete customer', 'error')
      return { success: false, error: error.message }
    }

    return { success: false, error: 'Customer deletion failed' }
  }

  // Prescription actions
  const addPrescription = async (data) => {
    if (!apiAvailableRef.current) return failPersistentWrite('create prescription', new Error('Database unavailable'))

    try {
      const res = await prescriptionService.create(data)
      if (!res.success) return failPersistentWrite('create prescription', new Error(res.message || 'Prescription creation failed'))
      const prescription = normalizePrescription(res.data)
      dispatch({ type: 'ADD_PRESCRIPTION', payload: prescription })
      showToast('Prescription created successfully', 'success')
      return { success: true, data: prescription }
    } catch (error) {
      return failPersistentWrite('create prescription', error)
    }
  }

  const getPrescriptionById = useCallback(async (id) => {
    if (apiAvailableRef.current) {
      try {
        const res = await prescriptionService.getById(id)
        if (res.success) return { success: true, data: normalizePrescription(res.data) }
      } catch (error) {
        if (!markApiUnavailable(error)) {
          return { success: false, error: error.response?.data?.message || error.message }
        }
      }
    }

    const prescription = state.prescriptions.find(p => p.id === Number(id))
    return prescription
      ? { success: true, data: normalizePrescription(prescription) }
      : { success: false, error: 'Prescription not found' }
  }, [markApiUnavailable, state.prescriptions])

  const preparePrescriptionForBilling = useCallback(async (id, fallbackData) => {
    if (apiAvailableRef.current) {
      try {
        const res = await prescriptionService.sendToBilling(id)
        if (res.success) {
          return {
            success: true,
            data: {
              customer: res.data.customer,
              items: (res.data.items || []).map(item => ({
                medicineId: Number(item.medicine_id),
                medicineName: item.medicine_name,
                batchNumber: item.batch_number,
                unitPrice: Number(item.unit_price),
                quantity: Number(item.requested_quantity),
                lineTotal: Number(item.line_total),
              })),
              unavailableItems: res.data.unavailable_items || [],
            },
          }
        }
      } catch (error) {
        if (!markApiUnavailable(error)) {
          return { success: false, error: error.response?.data?.message || error.message }
        }
      }
    }

    return { success: true, data: fallbackData }
  }, [markApiUnavailable])

  // Sale actions
  const createSale = async (data) => {
    if (!apiAvailableRef.current) return failPersistentWrite('complete sale', new Error('Database unavailable'))

    try {
      const res = await salesService.create(data)
      if (res.success) {
        const sale = normalizeSale(res.data)
        dispatch({ type: 'ADD_SALE', payload: sale })

        // Refresh stock separately: the sale has already committed and must
        // never be recreated locally if this follow-up request fails.
        let stockRefreshed = false
        try {
          const medRes = await medicineService.getAll({ pagination: 'false' })
          if (medRes.success) {
            const medData = medRes.data
            const medicines = Array.isArray(medData) ? medData : (medData.medicines || [])
            dispatch({ type: 'SET_MEDICINES', payload: medicines.map(normalizeMedicine) })
            stockRefreshed = true
          }
        } catch (error) {
          markApiUnavailable(error)
        }

        if (!stockRefreshed) {
          data.items?.forEach(item => {
            dispatch({ type: 'DECREASE_STOCK', payload: { medicineId: item.medicine_id || item.medicineId, quantity: item.quantity } })
          })
        }
        showToast('Sale completed successfully!', 'success')
        return { success: true, data: sale }
      }
      return failPersistentWrite('complete sale', new Error(res.message || 'Sale creation failed'))
    } catch (error) {
      return failPersistentWrite('complete sale', error)
    }
  }

  const getReceipt = useCallback(async (id) => {
    if (apiAvailableRef.current) {
      try {
        const res = await salesService.getReceipt(id)
        if (res.success) return { success: true, data: normalizeSale({ ...res.data, id }) }
      } catch (error) {
        if (!markApiUnavailable(error)) {
          return { success: false, error: error.response?.data?.message || error.message }
        }
      }
    }

    const sale = state.sales.find(s => s.id === Number(id))
    return sale
      ? { success: true, data: normalizeSale(sale) }
      : { success: false, error: 'Receipt not found' }
  }, [markApiUnavailable, state.sales])

  // Purchase actions (stock increase)
  const receiveStock = async (data) => {
    if (!apiAvailableRef.current) return failPersistentWrite('receive stock', new Error('Database unavailable'))

    try {
      const res = await purchaseService.create(data)
      if (res.success) {
        let stockRefreshed = false
        try {
          const medRes = await medicineService.getAll({ pagination: 'false' })
          if (medRes.success) {
            const medData = medRes.data
            const medicines = Array.isArray(medData) ? medData : (medData.medicines || [])
            dispatch({ type: 'SET_MEDICINES', payload: medicines.map(normalizeMedicine) })
            stockRefreshed = true
          }
        } catch (error) {
          markApiUnavailable(error)
        }

        if (!stockRefreshed) {
          data.items?.forEach(item => {
            dispatch({ type: 'INCREASE_STOCK', payload: { medicineId: item.medicine_id || item.medicineId, quantity: item.quantity } })
          })
        }
        showToast(`Stock received! ${data.items?.reduce((sum, i) => sum + Number(i.quantity), 0) || 0} units added.`, 'success')
        return { success: true, data: res.data }
      }
      return failPersistentWrite('receive stock', new Error(res.message || 'Purchase creation failed'))
    } catch (error) {
      return failPersistentWrite('receive stock', error)
    }
  }

  const value = {
    ...state,
    dispatch,
    showToast,
    addMedicine,
    updateMedicine,
    addSupplier,
    updateSupplier,
    deleteSupplier,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    addPrescription,
    getPrescriptionById,
    preparePrescriptionForBilling,
    createSale,
    getReceipt,
    receiveStock,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp must be used within an AppProvider')
  return context
}

export default AppContext
