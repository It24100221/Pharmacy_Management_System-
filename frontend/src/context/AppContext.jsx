import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react'
import { medicineService, supplierService, customerService, purchaseService, prescriptionService, salesService } from '../services/apiService.js'
import { useAuth } from './AuthContext.jsx'
import {
  computeStockStatus,
  normalizeCustomer,
  normalizeMedicine,
  normalizePrescription,
  normalizeSale,
  normalizeSupplier,
} from '../utils/normalization.js'

const AppContext = createContext(null)

// A request that never reached the application (network failure), or one the
// backend answered with 503 "Database unavailable". Everything else (2xx/4xx/500)
// is a real API response and must be surfaced as a failure, never as an outage
// excuse and never as a local success.
const isUnreachable = (error) => !error?.response || error.response?.status === 503

// Stage 0B: business collections start EMPTY and are filled from the API only.
// They are never seeded from mock files and never restored from localStorage,
// so an unreachable backend can never masquerade as persisted data.
// `activities` is a local UI feed (never business data) and stays local.
const initialState = {
  medicines: [],
  suppliers: [],
  customers: [],
  prescriptions: [],
  sales: [],
  activities: [],
  toasts: [],
  loading: true,
  apiConnected: false,
}

let nextActivityId = 1

function appReducer(state, action) {
  switch (action.type) {
    case 'RESET_BUSINESS':
      return { ...state, medicines: [], suppliers: [], customers: [], prescriptions: [], sales: [], activities: [], loading: false, apiConnected: false }
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
  const { user } = useAuth()
  const activeRole = user?.role
  const [state, dispatch] = useReducer(appReducer, initialState)
  const apiAvailableRef = useRef(true)

  // Activity is session-local UI state and is cleared when identity changes.
  // Neither account history nor business records are written to localStorage.

  // Fetch all data from API on mount
  const loadInitialData = useCallback(async () => {
    if (!activeRole) {
      dispatch({ type: 'RESET_BUSINESS' })
      return
    }
    try {
      const [medRes, supRes, custRes, prescRes, salesRes] = await Promise.allSettled([
        ['INVENTORY_STAFF', 'SALES_STAFF', 'PRESCRIPTION_STAFF', 'SUPPLIER'].includes(activeRole) ? medicineService.getAll({ pagination: 'false' }) : null,
        ['INVENTORY_STAFF', 'SUPPLIER'].includes(activeRole) ? supplierService.getAll({ pagination: 'false' }) : null,
        ['PRESCRIPTION_STAFF', 'SALES_STAFF'].includes(activeRole) ? customerService.getAll({ pagination: 'false' }) : null,
        activeRole === 'PRESCRIPTION_STAFF' ? prescriptionService.getAll({ pagination: 'false' }) : null,
        activeRole === 'SALES_STAFF' ? salesService.getAll({ pagination: 'false' }) : null,
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
      console.warn('API unavailable — business data stays empty until the server responds:', error.message)
      apiAvailableRef.current = false
      dispatch({ type: 'SET_API_CONNECTED', payload: false })
      dispatch({ type: 'SET_DATA', payload: {} })
    }
  }, [activeRole])

  useEffect(() => {
    loadInitialData()
  }, [loadInitialData])

  // ==================== ACTION HELPERS ====================

  const showToast = useCallback((message, type = 'success') => {
    const toastId = Date.now()
    dispatch({ type: 'ADD_TOAST', payload: { message, type, id: toastId } })
    setTimeout(() => dispatch({ type: 'REMOVE_TOAST', payload: toastId }), 3000)
  }, [])

  // --- Connection state -------------------------------------------------------
  // These drive only the UI's "server unreachable" indicator and an automatic
  // re-sync. They NEVER skip an API call and never convert a failed write into
  // a local success.
  const noteApiFailure = useCallback((error) => {
    if (isUnreachable(error)) {
      apiAvailableRef.current = false
      dispatch({ type: 'SET_API_CONNECTED', payload: false })
    }
  }, [])

  // The API answered again: recover immediately and re-read server truth.
  const noteApiSuccess = useCallback(() => {
    if (!apiAvailableRef.current) {
      apiAvailableRef.current = true
      dispatch({ type: 'SET_API_CONNECTED', payload: true })
      loadInitialData()
    }
  }, [loadInitialData])

  // Every mutation ends in exactly one of these two: a real persisted record,
  // or an explicit failure. There is no third, local, "offline" outcome.
  const failWrite = useCallback((error, fallbackMessage) => {
    noteApiFailure(error)
    const message = error?.response?.data?.message || error?.message || fallbackMessage
    showToast(message, 'error')
    return { success: false, error: message }
  }, [noteApiFailure, showToast])

  const failUnexpected = useCallback((response, fallbackMessage) => {
    const message = response?.message || fallbackMessage
    showToast(message, 'error')
    return { success: false, error: message }
  }, [showToast])

  // Medicine actions — API only. A failed write is reported as a failure; no
  // local record, no generated id and no "offline" success toast.
  const addMedicine = async (data) => {
    try {
      const res = await medicineService.create(data)
      if (!res?.success) return failUnexpected(res, 'Failed to add medicine')
      noteApiSuccess()
      const medicine = normalizeMedicine(res.data)
      dispatch({ type: 'ADD_MEDICINE', payload: medicine })
      showToast('Medicine added successfully', 'success')
      return { success: true, data: medicine }
    } catch (error) {
      return failWrite(error, 'Failed to add medicine')
    }
  }

  const updateMedicine = async (id, data) => {
    try {
      const res = await medicineService.update(id, data)
      if (!res?.success) return failUnexpected(res, 'Failed to update medicine')
      noteApiSuccess()
      const medicine = normalizeMedicine(res.data)
      dispatch({ type: 'UPDATE_MEDICINE', payload: medicine })
      showToast('Medicine updated successfully', 'success')
      return { success: true, data: medicine }
    } catch (error) {
      return failWrite(error, 'Failed to update medicine')
    }
  }

  // Supplier actions — API only
  const addSupplier = async (data) => {
    try {
      const res = await supplierService.create(data)
      if (!res?.success) return failUnexpected(res, 'Failed to add supplier')
      noteApiSuccess()
      dispatch({ type: 'ADD_SUPPLIER', payload: normalizeSupplier(res.data) })
      showToast('Supplier added successfully', 'success')
      return { success: true, data: normalizeSupplier(res.data) }
    } catch (error) {
      return failWrite(error, 'Failed to add supplier')
    }
  }

  const updateSupplier = async (id, data) => {
    try {
      const res = await supplierService.update(id, data)
      if (!res?.success) return failUnexpected(res, 'Failed to update supplier')
      noteApiSuccess()
      dispatch({ type: 'UPDATE_SUPPLIER', payload: normalizeSupplier(res.data) })
      showToast('Supplier updated successfully', 'success')
      return { success: true, data: normalizeSupplier(res.data) }
    } catch (error) {
      return failWrite(error, 'Failed to update supplier')
    }
  }

  // Customer actions — API only
  const addCustomer = async (data) => {
    try {
      const res = await customerService.create(data)
      if (!res?.success) return failUnexpected(res, 'Failed to add customer')
      noteApiSuccess()
      const customer = normalizeCustomer(res.data)
      dispatch({ type: 'ADD_CUSTOMER', payload: customer })
      showToast('Customer added successfully', 'success')
      return { success: true, data: customer }
    } catch (error) {
      return failWrite(error, 'Failed to add customer')
    }
  }

  const updateCustomer = async (id, data) => {
    try {
      const res = await customerService.update(id, data)
      if (!res?.success) return failUnexpected(res, 'Failed to update customer')
      noteApiSuccess()
      const customer = normalizeCustomer(res.data)
      dispatch({ type: 'UPDATE_CUSTOMER', payload: customer })
      showToast('Customer updated successfully', 'success')
      return { success: true, data: customer }
    } catch (error) {
      return failWrite(error, 'Failed to update customer')
    }
  }

  // Prescription actions — API only
  const addPrescription = async (data) => {
    try {
      const res = await prescriptionService.create(data)
      if (!res?.success) return failUnexpected(res, 'Failed to create prescription')
      noteApiSuccess()
      const prescription = normalizePrescription(res.data)
      dispatch({ type: 'ADD_PRESCRIPTION', payload: prescription })
      showToast('Prescription created successfully', 'success')
      return { success: true, data: prescription }
    } catch (error) {
      return failWrite(error, 'Failed to create prescription')
    }
  }

  // READ path: the API is always tried first. If the server is unreachable an
  // already-loaded record may be displayed from the in-memory session cache
  // (`cached: true`) — display only, never a write. An error that actually
  // reached the API is reported as a failure.
  const getPrescriptionById = useCallback(async (id) => {
    try {
      const res = await prescriptionService.getById(id)
      if (res?.success) {
        noteApiSuccess()
        return { success: true, data: normalizePrescription(res.data) }
      }
      return { success: false, error: res?.message || 'Prescription not found' }
    } catch (error) {
      if (isUnreachable(error)) {
        noteApiFailure(error)
        const cached = state.prescriptions.find(p => p.id === Number(id))
        return cached
          ? { success: true, data: normalizePrescription(cached), cached: true }
          : { success: false, error: 'Cannot reach the server, and this prescription is not loaded' }
      }
      return { success: false, error: error.response?.data?.message || error.message }
    }
  }, [state.prescriptions, noteApiSuccess, noteApiFailure])

  // Handoff to POS. The backend must confirm which lines are available, so an
  // unreachable server is a FAILURE here — the client never invents a billing
  // payload the database never validated.
  const preparePrescriptionForBilling = useCallback(async (id) => {
    try {
      const res = await prescriptionService.sendToBilling(id)
      if (!res?.success) return { success: false, error: res?.message || 'Failed to prepare prescription for billing' }
      noteApiSuccess()
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
    } catch (error) {
      noteApiFailure(error)
      const message = error.response?.data?.message ||
        'Cannot reach the server to prepare this prescription for billing'
      return { success: false, error: message }
    }
  }, [noteApiSuccess, noteApiFailure])

  // Sale actions — API only. If the sale cannot be persisted the operation
  // FAILS: no local sale, no generated receipt number, no offline success.
  const createSale = async (data) => {
    let res
    try {
      res = await salesService.create(data)
    } catch (error) {
      return failWrite(error, 'Failed to complete sale')
    }

    if (!res?.success) return failUnexpected(res, 'Failed to complete sale')
    noteApiSuccess()

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
      noteApiFailure(error)
    }

    if (!stockRefreshed) {
      // Reconcile the in-memory cache with a sale the database already
      // committed — this is not a substitute for persistence.
      data.items?.forEach(item => {
        dispatch({ type: 'DECREASE_STOCK', payload: { medicineId: item.medicine_id || item.medicineId, quantity: item.quantity } })
      })
    }
    showToast('Sale completed successfully!', 'success')
    return { success: true, data: sale }
  }

  const getReceipt = useCallback(async (id) => {
    try {
      const res = await salesService.getReceipt(id)
      if (res?.success) {
        noteApiSuccess()
        return { success: true, data: normalizeSale({ ...res.data, id }) }
      }
      return { success: false, error: res?.message || 'Receipt not found' }
    } catch (error) {
      if (isUnreachable(error)) {
        noteApiFailure(error)
        const cached = state.sales.find(s => s.id === Number(id))
        return cached
          ? { success: true, data: normalizeSale(cached), cached: true }
          : { success: false, error: 'Cannot reach the server, and this receipt is not loaded' }
      }
      return { success: false, error: error.response?.data?.message || error.message }
    }
  }, [state.sales, noteApiSuccess, noteApiFailure])

  // Purchase actions (stock increase) — API only. If the purchase cannot be
  // persisted the operation FAILS; stock is never increased locally.
  const receiveStock = async (data) => {
    let res
    try {
      res = await purchaseService.create(data)
    } catch (error) {
      return failWrite(error, 'Failed to receive stock')
    }

    if (!res?.success) return failUnexpected(res, 'Failed to receive stock')
    noteApiSuccess()

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
      noteApiFailure(error)
    }

    if (!stockRefreshed) {
      // Reconcile the cache with a purchase the database already committed.
      data.items?.forEach(item => {
        dispatch({ type: 'INCREASE_STOCK', payload: { medicineId: item.medicine_id || item.medicineId, quantity: item.quantity } })
      })
    }
    showToast(`Stock received! ${data.items?.reduce((sum, i) => sum + Number(i.quantity), 0) || 0} units added.`, 'success')
    return { success: true, data: res.data }
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
