import api from './api.js'

const SUPPLIERS_ENDPOINT = '/suppliers'

export const supplierService = {
  // Get all suppliers with optional filters
  getAllSuppliers: async (params = {}) => {
    const response = await api.get(SUPPLIERS_ENDPOINT, { params })
    return response.data
  },

  // Get supplier by ID
  getSupplierById: async (id) => {
    const response = await api.get(`${SUPPLIERS_ENDPOINT}/${id}`)
    return response.data
  },

  // Create new supplier
  createSupplier: async (supplierData) => {
    const response = await api.post(SUPPLIERS_ENDPOINT, supplierData)
    return response.data
  },

  // Update supplier
  updateSupplier: async (id, supplierData) => {
    const response = await api.put(`${SUPPLIERS_ENDPOINT}/${id}`, supplierData)
    return response.data
  },
}

export default supplierService
