import axios from 'axios'
import { VITE_API_BASE_URL } from '../config/env.js'

const api = axios.create({
  baseURL: VITE_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
})

// Request interceptor for logging
api.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`)
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    return response
  },
  (error) => {
    if (error.response) {
      // Server responded with error status
      console.error('API Error:', error.response.data?.message || error.message)
    } else if (error.request) {
      // Request was made but no response received
      console.error('API Error: No response from server')
    } else {
      // Error in setting up request
      console.error('API Error:', error.message)
    }
    return Promise.reject(error)
  }
)

export default api
