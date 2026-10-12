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

  getBatches: async (id, params = {}) => (await api.get(`/medicines/${id}/batches`, { params })).data,
  getMovements: async (id, params = {}) => (await api.get(`/medicines/${id}/movements`, { params })).data,
  createBatch: async (id, data) => (await api.post(`/medicines/${id}/batches`, data)).data,
  adjustStock: async (id, data) => (await api.post(`/medicines/${id}/adjust-stock`, data)).data,
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
  getUploadReviewQueue: async (status = 'pending') => (await api.get('/prescription-uploads/review-queue', { params: { status } })).data,
  reviewUpload: async (id, decision, reason = '') => (await api.post(`/prescription-uploads/${id}/review`, { decision, reason })).data,
  getReadyForBilling: async () => (await api.get('/prescriptions/ready-for-billing')).data,
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
  getBilling: async id => (await api.get(`/prescriptions/${id}/billing`)).data,
}

export const productService = {
  getAll: async (params = {}) => (await api.get('/products', { params })).data,
  getByCode: async productCode => (await api.get(`/products/${productCode}`)).data,
  uploadImage: async (productId, file, metadata) => {
    const form = new FormData()
    form.append('file', file)
    Object.entries(metadata).forEach(([key, value]) => form.append(key, String(value)))
    return (await api.post(`/products/id/${productId}/image`, form, { headers: { 'Content-Type': undefined } })).data
  },
  setImageUrl: async (productId, data) => (await api.put(`/products/id/${productId}/image-url`, data)).data,
  removeImage: async productId => (await api.delete(`/products/id/${productId}/image`)).data,
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
  getAwaitingReview: async () => (await api.get('/orders/awaiting-review')).data,
  getReadyForBilling: async () => (await api.get('/orders/ready-for-billing')).data,
  review: async (id, decision, reason = '') => (await api.post(`/orders/${id}/review`, { decision, reason })).data,
  completeSale: async (id, data) => (await api.post(`/orders/${id}/complete-sale`, data)).data,
}

export const notificationService = {
  getAll: async (params = {}) => (await api.get('/notifications', { params })).data,
  markRead: async id => (await api.patch(`/notifications/${id}/read`)).data,
}

export const billingService = {
  getInvoices: async () => (await api.get('/billing/invoices')).data,
  getAwaitingReview: async () => (await api.get('/billing/awaiting-review')).data,
  getInvoiceBySale: async saleId => (await api.get(`/billing/sales/${saleId}/invoice`)).data,
  recordPayment: async (invoiceId, data) => (await api.post(`/billing/invoices/${invoiceId}/payments`, data)).data,
}

export const purchaseOrderService = {
  getAll: async () => (await api.get('/purchase-orders')).data,
  getById: async id => (await api.get(`/purchase-orders/${id}`)).data,
  create: async data => (await api.post('/purchase-orders', data)).data,
  updateStatus: async (id, status) => (await api.patch(`/purchase-orders/${id}/status`, { status })).data,
}

export const reorderService = {
  getLowStock: async () => (await api.get('/reorder-requests/low-stock')).data,
  getAll: async (params = {}) => (await api.get('/reorder-requests', { params })).data,
  create: async data => (await api.post('/reorder-requests', data)).data,
  updateStatus: async (id, status) => (await api.patch(`/reorder-requests/${id}/status`, { status })).data,
  getById: async id => (await api.get(`/reorder-requests/${id}`)).data,
  respond: async (id, data) => (await api.post(`/reorder-requests/${id}/respond`, data)).data,
  review: async (id, data) => (await api.post(`/reorder-requests/${id}/review`, data)).data,
}

export const supplySettingsService = {
  get: async id => (await api.get(`/medicines/${id}/supply-settings`)).data,
  save: async (id, data) => (await api.put(`/medicines/${id}/supply-settings`, data)).data,
  accounts: async () => (await api.get('/suppliers/accounts')).data,
  linkAccount: async (userId, supplierId) => (await api.put(`/suppliers/accounts/${userId}`, { supplier_id: supplierId })).data,
  createAccount: async data => (await api.post('/suppliers/accounts', data)).data,
}

export const supplierInquiryService = {
  getAll: async (params = {}) => (await api.get('/supplier-inquiries', { params })).data,
  getById: async id => (await api.get(`/supplier-inquiries/${id}`)).data,
  create: async data => (await api.post('/supplier-inquiries', data)).data,
  addMessage: async (id, message) => (await api.post(`/supplier-inquiries/${id}/messages`, { message })).data,
  updateStatus: async (id, status) => (await api.patch(`/supplier-inquiries/${id}/status`, { status })).data,
}

export const goodsReceiptService = {
  getAll: async () => (await api.get('/goods-receipts')).data,
  getById: async id => (await api.get(`/goods-receipts/${id}`)).data,
  create: async data => (await api.post('/goods-receipts', data)).data,
}

export const supplierInvoiceService = {
  getAll: async (params = {}) => (await api.get('/supplier-invoices', { params })).data,
  getById: async id => (await api.get(`/supplier-invoices/${id}`)).data,
  create: async data => (await api.post('/supplier-invoices', data)).data,
  recordPayment: async (id, data) => (await api.post(`/supplier-invoices/${id}/payments`, data)).data,
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
  notification: notificationService,
  billing: billingService,
  purchaseOrder: purchaseOrderService,
  reorder: reorderService,
  supplierInquiry: supplierInquiryService,
  goodsReceipt: goodsReceiptService,
  supplierInvoice: supplierInvoiceService,
  sales: salesService,
}

export default apiServices
