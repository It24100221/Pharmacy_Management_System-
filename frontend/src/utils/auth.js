export const ROLE_HOME = Object.freeze({
  CUSTOMER: '/customer-dashboard',
  PRESCRIPTION_STAFF: '/prescription-dashboard',
  SUPPLIER: '/supplier-dashboard',
  INVENTORY_STAFF: '/inventory-dashboard',
  SALES_STAFF: '/sales-dashboard',
})

export const homeForRole = role => ROLE_HOME[role] || '/login'

export function routeDecision(user, allowedRoles = []) {
  if (!user) return 'login'
  if (allowedRoles.length && !allowedRoles.includes(user.role)) return 'unauthorized'
  return 'allow'
}
