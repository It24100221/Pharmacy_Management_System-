// Environment configuration
// These are loaded from Vite's import.meta.env

export const VITE_API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'

// Helper to check if we're in development
export const isDevelopment = () => {
  return import.meta.env.DEV === true
}
