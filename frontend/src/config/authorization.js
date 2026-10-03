export const AUTH_STATES = Object.freeze({
  INITIALIZING: 'AUTH_INITIALIZING',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  AUTHENTICATED: 'AUTHENTICATED',
  API_UNAVAILABLE: 'API_UNAVAILABLE',
  FORBIDDEN: 'FORBIDDEN',
})

export const ROLES = Object.freeze({
  CUSTOMER: 'CUSTOMER',
  ADMIN: 'ADMIN',
  PRESCRIPTION: 'PHARMACIST',
  INVENTORY: 'INVENTORY',
  SALES: 'SALES',
  SUPPLIER: 'SUPPLIER',
})

export const DASHBOARD_PATHS = Object.freeze({
  CUSTOMER: '/customer-dashboard',
  ADMIN: '/admin-dashboard',
  PHARMACIST: '/pharmacist-dashboard',
  INVENTORY: '/inventory-dashboard',
  SALES: '/sales-dashboard',
  SUPPLIER: '/supplier-dashboard',
})

export const DATA_SCOPES = Object.freeze({
  CUSTOMER: [],
  ADMIN: ['medicines', 'suppliers', 'customers', 'prescriptions', 'sales'],
  PHARMACIST: ['medicines', 'customers', 'prescriptions'],
  INVENTORY: ['medicines', 'suppliers'],
  SALES: ['medicines', 'customers', 'sales'],
  SUPPLIER: ['suppliers'],
})
