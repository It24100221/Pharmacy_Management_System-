import axios from 'axios'
import { VITE_API_BASE_URL } from '../config/env.js'

const api = axios.create({
  baseURL: VITE_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
})

export const classifyApiError = error => {
  if (!error?.response) return 'API_UNAVAILABLE'
  if (error.response.status === 401) return 'UNAUTHENTICATED'
  if (error.response.status === 403) return 'FORBIDDEN'
  return 'API_ERROR'
}

// Request interceptor for logging
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('pharmacy_token')
    if (token) config.headers.Authorization = `Bearer ${token}`
    if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
      delete config.headers['Content-Type']
    }
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
    error.kind = classifyApiError(error)
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
    if (error.kind === 'UNAUTHENTICATED' && error.config?.headers?.Authorization && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pharmacy:auth-invalid'))
    }
    return Promise.reject(error)
  }
)

export default api
