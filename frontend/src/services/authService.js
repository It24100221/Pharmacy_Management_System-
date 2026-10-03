import api from './api.js'

const SESSION_KEY = 'pharmacy_auth_session'

export const authService = {
  customerLogin: async credentials => (await api.post('/auth/customer-login', credentials)).data.data,
  staffLogin: async credentials => (await api.post('/auth/staff-login', credentials)).data.data,
  register: async payload => (await api.post('/customers/register', payload)).data.data,
  getSession: () => {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)) } catch { return null }
  },
  saveSession: session => { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); localStorage.setItem('pharmacy_token', session.token) },
  clearSession: () => { localStorage.removeItem(SESSION_KEY); localStorage.removeItem('pharmacy_token') },
  getDashboardPath: role => ({ CUSTOMER: '/customer-dashboard', ADMIN: '/admin-dashboard', PHARMACIST: '/pharmacist-dashboard', INVENTORY: '/inventory-dashboard', SALES: '/sales-dashboard', SUPPLIER: '/supplier-dashboard' }[role] || '/login'),
}

export default authService
