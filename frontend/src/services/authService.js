import api from './api.js'
import { DASHBOARD_PATHS } from '../config/authorization.js'

export const SESSION_KEY = 'pharmacy_auth_session'
export const SENSITIVE_CACHE_KEYS = [
  'pharmacy_medicines', 'pharmacy_suppliers', 'pharmacy_customers',
  'pharmacy_prescriptions', 'pharmacy_sales', 'pharmacy_activities',
  'pharmacy_activity_next_id', 'pharmacy_customer_cart',
]

const decodePayload = token => {
  try {
    const encoded = token.split('.')[1]
    if (!encoded) return null
    const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(normalized))
  } catch {
    return null
  }
}

export const isUsableSession = session => {
  if (!session?.token || !session?.userId || !session?.role) return false
  const payload = decodePayload(session.token)
  return Boolean(payload?.exp && payload.exp * 1000 > Date.now())
}

export const authService = {
  customerLogin: async credentials => (await api.post('/auth/customer-login', credentials)).data.data,
  staffLogin: async credentials => (await api.post('/auth/staff-login', credentials)).data.data,
  getCurrent: async () => (await api.get('/auth/me')).data.data,
  register: async payload => (await api.post('/customers/register', payload)).data.data,
  getSession: () => {
    try {
      const session = JSON.parse(localStorage.getItem(SESSION_KEY))
      if (isUsableSession(session)) return session
    } catch {}
    authService.clearSession()
    return null
  },
  saveSession: session => { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); localStorage.setItem('pharmacy_token', session.token) },
  clearSession: () => {
    localStorage.removeItem(SESSION_KEY)
    localStorage.removeItem('pharmacy_token')
    SENSITIVE_CACHE_KEYS.forEach(key => localStorage.removeItem(key))
  },
  getDashboardPath: role => DASHBOARD_PATHS[role] || '/login',
}

export default authService
