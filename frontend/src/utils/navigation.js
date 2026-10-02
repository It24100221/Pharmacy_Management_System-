import { homeForRole } from './auth.js'

export const PUBLIC_LINKS = Object.freeze([
  ['Home', '/'], ['About', '/about'], ['Services', '/services'],
  ['Pharmacy Items', '/pharmacy-items'],
])

const ROLE_LINKS = Object.freeze({
  CUSTOMER: [],
  PRESCRIPTION_STAFF: [['Customers', '/customers'], ['Prescriptions', '/prescriptions/create']],
  SUPPLIER: [['Suppliers', '/suppliers'], ['Receive Stock', '/purchases']],
  INVENTORY_STAFF: [['Inventory', '/medicines'], ['Low Stock', '/medicines/low-stock']],
  SALES_STAFF: [['Sales & Billing', '/sales']],
})

export function linksForUser(user) {
  return user && user.role !== 'CUSTOMER'
    ? [['Dashboard', homeForRole(user.role)], ...(ROLE_LINKS[user.role] || [])]
    : PUBLIC_LINKS
}

export function accountLinksForUser(user) {
  if (!user) return [['Login', '/login'], ['Register', '/register']]
  return [['Dashboard', homeForRole(user.role)]]
}
