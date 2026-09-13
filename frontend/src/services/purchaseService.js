import api from './api.js'

const PURCHASES_ENDPOINT = '/purchases'

export const purchaseService = {
  // Get all purchases with optional filters
  getAllPurchases: async (params = {}) => {
    const response = await api.get(PURCHASES_ENDPOINT, { params })
    return response.data
  },

  // Get purchase by ID
  getPurchaseById: async (id) => {
    const response = await api.get(`${PURCHASES_ENDPOINT}/${id}`)
    return response.data
  },

  // Create purchase (increases stock)
  createPurchase: async (purchaseData) => {
    const response = await api.post(PURCHASES_ENDPOINT, purchaseData)
    return response.data
  },
}

export default purchaseService
