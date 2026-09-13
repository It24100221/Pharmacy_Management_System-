import api from './api.js'

const SALES_ENDPOINT = '/sales'

export const salesService = {
  // Get all sales with optional filters
  getAllSales: async (params = {}) => {
    const response = await api.get(SALES_ENDPOINT, { params })
    return response.data
  },

  // Get sale by ID
  getSaleById: async (id) => {
    const response = await api.get(`${SALES_ENDPOINT}/${id}`)
    return response.data
  },

  // Get receipt for a sale
  getReceipt: async (id) => {
    const response = await api.get(`${SALES_ENDPOINT}/${id}/receipt`)
    return response.data
  },

  // Get today's sales summary
  getTodaySummary: async () => {
    const response = await api.get(`${SALES_ENDPOINT}/today-summary`)
    return response.data
  },

  // Create sale (reduces stock)
  createSale: async (saleData) => {
    const response = await api.post(SALES_ENDPOINT, saleData)
    return response.data
  },

  // Get recent sales
  getRecentSales: async (limit = 5) => {
    const response = await api.get(`${SALES_ENDPOINT}/recent`, { params: { limit } })
    return response.data
  },
}

export default salesService
