import api from './api.js'

// ============================================================================
// MEDICINE SERVICE
// ============================================================================
export const medicineService = {
  getAll: async (params = {}) => {
    const response = await api.get('/medicines', { params })
    return response.data
  },

  getById: async (id) => {
    const response = await api.get(`/medicines/${id}`)
    return response.data
  },

  create: async (data) => {
    const response = await api.post('/medicines', data)
    return response.data
  },

  update: async (id, data) => {
    const response = await api.put(`/medicines/${id}`, data)
    return response.data
  },

  getLowStock: async () => {
    const response = await api.get('/medicines/low-stock')
    return response.data
  },

  getExpiryStatus: async (status = 'all') => {
    const response = await api.get('/medicines/expiry-status', { params: { status } })
    return response.data
  },
}

// ============================================================================
// SUPPLIER SERVICE
// ============================================================================
export const supplierService = {
  getAll: async (params = {}) => {
    const response = await api.get('/suppliers', { params })
    return response.data
  },

  getById: async (id) => {
    const response = await api.get(`/suppliers/${id}`)
    return response.data
  },

  create: async (data) => {
    const response = await api.post('/suppliers', data)
    return response.data
  },

  update: async (id, data) => {
    const response = await api.put(`/suppliers/${id}`, data)
    return response.data
  },
}

// ============================================================================
// CUSTOMER SERVICE
// ============================================================================
export const customerService = {
  getAll: async (params = {}) => {
    const response = await api.get('/customers', { params })
    return response.data
  },

  getById: async (id) => {
    const response = await api.get(`/customers/${id}`)
    return response.data
  },

  create: async (data) => {
    const response = await api.post('/customers', data)
    return response.data
  },

  update: async (id, data) => {
    const response = await api.put(`/customers/${id}`, data)
    return response.data
  },
}

// ============================================================================
// PURCHASE SERVICE
// ============================================================================
export const purchaseService = {
  getAll: async (params = {}) => {
    const response = await api.get('/purchases', { params })
    return response.data
  },

  getById: async (id) => {
    const response = await api.get(`/purchases/${id}`)
    return response.data
  },

  create: async (data) => {
    const response = await api.post('/purchases', data)
    return response.data
  },
}

// ============================================================================
// PRESCRIPTION SERVICE
// ============================================================================
export const prescriptionService = {
  getAll: async (params = {}) => {
    const response = await api.get('/prescriptions', { params })
    return response.data
  },

  getById: async (id) => {
    const response = await api.get(`/prescriptions/${id}`)
    return response.data
  },

  create: async (data) => {
    const response = await api.post('/prescriptions', data)
    return response.data
  },

  checkAvailability: async (id) => {
    const response = await api.get(`/prescriptions/${id}/availability`)
    return response.data
  },

  sendToBilling: async (id, data) => {
    const response = await api.post(`/prescriptions/${id}/send-to-billing`, data)
    return response.data
  },
}

// ============================================================================
// SALES SERVICE
// ============================================================================
export const salesService = {
  getAll: async (params = {}) => {
    const response = await api.get('/sales', { params })
    return response.data
  },

  getById: async (id) => {
    const response = await api.get(`/sales/${id}`)
    return response.data
  },

  getReceipt: async (id) => {
    const response = await api.get(`/sales/${id}/receipt`)
    return response.data
  },

  create: async (data) => {
    const response = await api.post('/sales', data)
    return response.data
  },

  getTodaySummary: async () => {
    const response = await api.get('/sales/today-summary')
    return response.data
  },
}

// ============================================================================
// COMBINED EXPORT
// ============================================================================
const apiServices = {
  medicine: medicineService,
  supplier: supplierService,
  customer: customerService,
  purchase: purchaseService,
  prescription: prescriptionService,
  sales: salesService,
}

export default apiServices
