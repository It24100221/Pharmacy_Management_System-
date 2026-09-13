import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react'
import { mockMedicines } from '../data/mockMedicines.js'
import { mockSuppliers } from '../data/mockSuppliers.js'
import { mockCustomers } from '../data/mockCustomers.js'
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
  customers: loadState('pharmacy_customers', mockCustomers).map(normalizeCustomer),
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
  useEffect(() => { localStorage.setItem('pharmacy_customers', JSON.stringify(state.customers)) }, [state.customers])
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

  // Medicine actions
  const addMedicine = async (data) => {
    if (apiAvailableRef.current) {
      try {
        const res = await medicineService.create(data)
        if (res.success) {
          const medicine = normalizeMedicine(res.data)
          dispatch({ type: 'ADD_MEDICINE', payload: medicine })
          showToast('Medicine added successfully', 'success')
          return { success: true, data: medicine }
        }
      } catch (error) {
        if (markApiUnavailable(error)) {
          const newId = Math.max(0, ...state.medicines.map(m => m.id)) + 1
          const medicine = normalizeMedicine({ ...data, id: newId })
          dispatch({ type: 'ADD_MEDICINE', payload: medicine })
          showToast('Medicine added (offline)', 'success')
          return { success: true, data: medicine }
        }
        showToast(error.response?.data?.message || 'Failed to add medicine', 'error')
        return { success: false, error: error.message }
      }
    } else {
      // Local fallback
      const newId = Math.max(0, ...state.medicines.map(m => m.id)) + 1
      const medicine = normalizeMedicine({ ...data, id: newId })
      dispatch({ type: 'ADD_MEDICINE', payload: medicine })
      showToast('Medicine added (offline)', 'success')
      return { success: true, data: medicine }
    }
  }

  const updateMedicine = async (id, data) => {
    if (apiAvailableRef.current) {
      try {
        const res = await medicineService.update(id, data)
        if (res.success) {
          const medicine = normalizeMedicine(res.data)
          dispatch({ type: 'UPDATE_MEDICINE', payload: medicine })
          showToast('Medicine updated successfully', 'success')
          return { success: true, data: medicine }
        }
      } catch (error) {
        if (markApiUnavailable(error)) {
          const existing = state.medicines.find(m => m.id === Number(id)) || {}
          const medicine = normalizeMedicine({ ...existing, ...data, id: Number(id) })
          dispatch({ type: 'UPDATE_MEDICINE', payload: medicine })
          showToast('Medicine updated (offline)', 'success')
          return { success: true, data: medicine }
        }
        showToast(error.response?.data?.message || 'Failed to update medicine', 'error')
        return { success: false, error: error.message }
      }
    } else {
      const existing = state.medicines.find(m => m.id === Number(id)) || {}
      const medicine = normalizeMedicine({ ...existing, ...data, id: Number(id) })
      dispatch({ type: 'UPDATE_MEDICINE', payload: medicine })
      showToast('Medicine updated (offline)', 'success')
      return { success: true, data: medicine }
    }
  }

  // Supplier actions
  const addSupplier = async (data) => {
    if (apiAvailableRef.current) {
      try {
        const res = await supplierService.create(data)
        if (res.success) {
          dispatch({ type: 'ADD_SUPPLIER', payload: normalizeSupplier(res.data) })
          showToast('Supplier added successfully', 'success')
          return { success: true }
        }
      } catch (error) {
        if (markApiUnavailable(error)) {
          const newId = Math.max(0, ...state.suppliers.map(s => s.id)) + 1
          const supplier = { ...data, id: newId, status: 'active', created_at: new Date().toISOString() }
          dispatch({ type: 'ADD_SUPPLIER', payload: supplier })
          showToast('Supplier added (offline)', 'success')
          return { success: true, data: supplier }
        }
        showToast(error.response?.data?.message || 'Failed to add supplier', 'error')
        return { success: false, error: error.message }
      }
    } else {
      const newId = Math.max(0, ...state.suppliers.map(s => s.id)) + 1
      dispatch({ type: 'ADD_SUPPLIER', payload: { ...data, id: newId, status: 'active', created_at: new Date().toISOString() } })
      showToast('Supplier added (offline)', 'success')
      return { success: true }
    }
  }

  const updateSupplier = async (id, data) => {
    if (apiAvailableRef.current) {
      try {
        const res = await supplierService.update(id, data)
        if (res.success) {
          dispatch({ type: 'UPDATE_SUPPLIER', payload: normalizeSupplier(res.data) })
          showToast('Supplier updated successfully', 'success')
          return { success: true }
        }
      } catch (error) {
        if (markApiUnavailable(error)) {
          const supplier = { id: Number(id), ...data }
          dispatch({ type: 'UPDATE_SUPPLIER', payload: supplier })
          showToast('Supplier updated (offline)', 'success')
          return { success: true, data: supplier }
        }
        showToast(error.response?.data?.message || 'Failed to update supplier', 'error')
        return { success: false, error: error.message }
      }
    } else {
      dispatch({ type: 'UPDATE_SUPPLIER', payload: { id: Number(id), ...data } })
      showToast('Supplier updated (offline)', 'success')
      return { success: true }
    }
  }

  // Customer actions
  const addCustomer = async (data) => {
    if (apiAvailableRef.current) {
      try {
        const res = await customerService.create(data)
        if (res.success) {
          dispatch({ type: 'ADD_CUSTOMER', payload: normalizeCustomer(res.data) })
          showToast('Customer added successfully', 'success')
          return { success: true }
        }
      } catch (error) {
        if (markApiUnavailable(error)) {
          const newId = Math.max(0, ...state.customers.map(c => c.id)) + 1
          const customer = { ...data, id: newId, created_at: new Date().toISOString() }
          dispatch({ type: 'ADD_CUSTOMER', payload: customer })
          showToast('Customer added (offline)', 'success')
          return { success: true, data: customer }
        }
        showToast(error.response?.data?.message || 'Failed to add customer', 'error')
        return { success: false, error: error.message }
      }
    } else {
      const newId = Math.max(0, ...state.customers.map(c => c.id)) + 1
      dispatch({ type: 'ADD_CUSTOMER', payload: { ...data, id: newId, created_at: new Date().toISOString() } })
      showToast('Customer added (offline)', 'success')
      return { success: true }
    }
  }

  const updateCustomer = async (id, data) => {
    if (apiAvailableRef.current) {
      try {
        const res = await customerService.update(id, data)
        if (res.success) {
          dispatch({ type: 'UPDATE_CUSTOMER', payload: normalizeCustomer(res.data) })
          showToast('Customer updated successfully', 'success')
          return { success: true }
        }
      } catch (error) {
        if (markApiUnavailable(error)) {
          const customer = { id: Number(id), ...data }
          dispatch({ type: 'UPDATE_CUSTOMER', payload: customer })
          showToast('Customer updated (offline)', 'success')
          return { success: true, data: customer }
        }
        showToast(error.response?.data?.message || 'Failed to update customer', 'error')
        return { success: false, error: error.message }
      }
    } else {
      dispatch({ type: 'UPDATE_CUSTOMER', payload: { id: Number(id), ...data } })
      showToast('Customer updated (offline)', 'success')
      return { success: true }
    }
  }

  // Prescription actions
  const addPrescription = async (data) => {
    if (apiAvailableRef.current) {
      try {
        const res = await prescriptionService.create(data)
        if (res.success) {
          const prescription = normalizePrescription(res.data)
          dispatch({ type: 'ADD_PRESCRIPTION', payload: prescription })
          showToast('Prescription created successfully', 'success')
          return { success: true, data: prescription }
        }
      } catch (error) {
        if (markApiUnavailable(error)) {
          const newId = Math.max(0, ...state.prescriptions.map(p => p.id)) + 1
          const prescription = normalizePrescription({ ...data, id: newId, status: 'active', created_at: new Date().toISOString() })
          dispatch({ type: 'ADD_PRESCRIPTION', payload: prescription })
          showToast('Prescription created (offline)', 'success')
          return { success: true, data: prescription }
        }
        showToast(error.response?.data?.message || 'Failed to create prescription', 'error')
        return { success: false, error: error.message }
      }
    } else {
      const newId = Math.max(0, ...state.prescriptions.map(p => p.id)) + 1
      const prescription = normalizePrescription({ ...data, id: newId, status: 'active', created_at: new Date().toISOString() })
      dispatch({ type: 'ADD_PRESCRIPTION', payload: prescription })
      showToast('Prescription created (offline)', 'success')
      return { success: true, data: prescription }
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
    if (apiAvailableRef.current) {
      let res
      try {
        res = await salesService.create(data)
      } catch (error) {
        if (markApiUnavailable(error)) {
          return createLocalSale(data)
        }
        showToast(error.response?.data?.message || 'Failed to complete sale', 'error')
        return { success: false, error: error.message }
      }

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
    } else {
      return createLocalSale(data)
    }
  }

  const createLocalSale = (data) => {
    const newId = Math.max(0, ...state.sales.map(s => s.id)) + 1
    const sale = normalizeSale({
      ...data,
      id: newId,
      receipt_number: `REC-${String(newId).padStart(6, '0')}`,
      created_at: new Date().toISOString(),
    })
    data.items?.forEach(item => {
      dispatch({ type: 'DECREASE_STOCK', payload: { medicineId: item.medicine_id || item.medicineId, quantity: item.quantity } })
    })
    dispatch({ type: 'ADD_SALE', payload: sale })
    showToast('Sale completed (offline)', 'success')
    return { success: true, data: sale }
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
    if (apiAvailableRef.current) {
      let res
      try {
        res = await purchaseService.create(data)
      } catch (error) {
        if (markApiUnavailable(error)) {
          data.items?.forEach(item => {
            dispatch({ type: 'INCREASE_STOCK', payload: { medicineId: item.medicine_id || item.medicineId, quantity: item.quantity } })
          })
          showToast('Stock received (offline)', 'success')
          return { success: true }
        }
        showToast(error.response?.data?.message || 'Failed to receive stock', 'error')
        return { success: false, error: error.message }
      }

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
    } else {
      // Local fallback - increase stock
      if (data.items) {
        data.items.forEach(item => {
          dispatch({ type: 'INCREASE_STOCK', payload: { medicineId: item.medicine_id || item.medicineId, quantity: item.quantity } })
        })
      }
      showToast('Stock received (offline)', 'success')
      return { success: true }
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
    addCustomer,
    updateCustomer,
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
