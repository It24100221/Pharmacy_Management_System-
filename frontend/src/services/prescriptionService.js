import api from './api.js'

const PRESCRIPTIONS_ENDPOINT = '/prescriptions'

export const prescriptionService = {
  // Get all prescriptions with optional filters
  getAllPrescriptions: async (params = {}) => {
    const response = await api.get(PRESCRIPTIONS_ENDPOINT, { params })
    return response.data
  },

  // Get prescription by ID
  getPrescriptionById: async (id) => {
    const response = await api.get(`${PRESCRIPTIONS_ENDPOINT}/${id}`)
    return response.data
  },

  // Create prescription
  createPrescription: async (prescriptionData) => {
    const response = await api.post(PRESCRIPTIONS_ENDPOINT, prescriptionData)
    return response.data
  },

  // Check prescription availability
  checkAvailability: async (id) => {
    const response = await api.get(`${PRESCRIPTIONS_ENDPOINT}/${id}/availability`)
    return response.data
  },

  // Send prescription to billing (does NOT reduce stock)
  sendToBilling: async (id) => {
    const response = await api.post(`${PRESCRIPTIONS_ENDPOINT}/${id}/send-to-billing`)
    return response.data
  },
}

export default prescriptionService
