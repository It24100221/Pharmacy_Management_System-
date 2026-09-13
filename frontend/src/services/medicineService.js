import api from './api.js'

const MEDICINES_ENDPOINT = '/medicines'

export const medicineService = {
  // Get all medicines with optional filters
  getAllMedicines: async (params = {}) => {
    const response = await api.get(MEDICINES_ENDPOINT, { params })
    return response.data
  },

  // Get medicine by ID
  getMedicineById: async (id) => {
    const response = await api.get(`${MEDICINES_ENDPOINT}/${id}`)
    return response.data
  },

  // Create new medicine
  createMedicine: async (medicineData) => {
    const response = await api.post(MEDICINES_ENDPOINT, medicineData)
    return response.data
  },

  // Update medicine
  updateMedicine: async (id, medicineData) => {
    const response = await api.put(`${MEDICINES_ENDPOINT}/${id}`, medicineData)
    return response.data
  },

  // Get low stock medicines
  getLowStockMedicines: async () => {
    const response = await api.get(`${MEDICINES_ENDPOINT}/low-stock`)
    return response.data
  },

  // Get medicines by expiry status
  getExpiryStatusMedicines: async (status = 'all') => {
    const response = await api.get(`${MEDICINES_ENDPOINT}/expiry-status`, {
      params: { status }
    })
    return response.data
  },
}

export default medicineService
