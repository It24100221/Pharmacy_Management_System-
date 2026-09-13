import api from './api.js'

const CUSTOMERS_ENDPOINT = '/customers'

export const customerService = {
  // Get all customers with optional filters
  getAllCustomers: async (params = {}) => {
    const response = await api.get(CUSTOMERS_ENDPOINT, { params })
    return response.data
  },

  // Get customer by ID
  getCustomerById: async (id) => {
    const response = await api.get(`${CUSTOMERS_ENDPOINT}/${id}`)
    return response.data
  },

  // Create new customer
  createCustomer: async (customerData) => {
    const response = await api.post(CUSTOMERS_ENDPOINT, customerData)
    return response.data
  },

  // Update customer
  updateCustomer: async (id, customerData) => {
    const response = await api.put(`${CUSTOMERS_ENDPOINT}/${id}`, customerData)
    return response.data
  },
}

export default customerService
