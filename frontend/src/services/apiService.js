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

  remove: async (id) => {
    const response = await api.delete(`/suppliers/${id}`)
    return response.data
  },
}

// ============================================================================
// CUSTOMER SERVICE
// ============================================================================
export const customerService = {
  getMe: async () => (await api.get('/customers/me')).data,
  updateMe: async data => (await api.put('/customers/me', data)).data,
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

  remove: async (id) => {
    const response = await api.delete(`/customers/${id}`)
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
  uploadFile: async (file, metadata = {}) => {
    const form = new FormData()
    form.append('file', file)
    if (metadata.doctorName) form.append('doctorName', metadata.doctorName)
    if (metadata.notes) form.append('notes', metadata.notes)
    if (metadata.orderId) form.append('orderId', String(metadata.orderId))
    const response = await api.post('/prescriptions/upload', form)
    return response.data
  },
  getCustomer: async (customerId) => {
    const response = await api.get(`/prescriptions/customer/${customerId}`)
    return response.data
  },
  getMine: async () => (await api.get('/prescriptions/mine')).data,
  getFile: async id => (await api.get(`/prescription-uploads/${id}/file`, { responseType: 'blob' })).data,
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

export const productService = {
  getAll: async (params = {}) => (await api.get('/products', { params })).data,
  getByCode: async productCode => (await api.get(`/products/${productCode}`)).data,
}

export const cartService = {
  get: async () => (await api.get('/cart')).data,
  add: async (productId, quantity = 1) => (await api.post('/cart/items', { product_id: productId, quantity })).data,
  update: async (productId, quantity) => (await api.patch(`/cart/items/${productId}`, { quantity })).data,
  remove: async productId => (await api.delete(`/cart/items/${productId}`)).data,
  clear: async () => (await api.delete('/cart')).data,
}

export const orderService = {
  checkout: async () => (await api.post('/orders/checkout')).data,
  getMine: async () => (await api.get('/orders/mine')).data,
  getById: async id => (await api.get(`/orders/${id}`)).data,
  getPendingReview: async () => (await api.get('/orders/pending-review')).data,
  getReadyForBilling: async () => (await api.get('/orders/ready-for-billing')).data,
  review: async (id, decision, reason = '') => (await api.post(`/orders/${id}/review`, { decision, reason })).data,
  completeSale: async (id, data) => (await api.post(`/orders/${id}/complete-sale`, data)).data,
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
  product: productService,
  cart: cartService,
  order: orderService,
  sales: salesService,
}

export default apiServices
