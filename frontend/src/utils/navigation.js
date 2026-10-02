import { homeForRole } from './auth.js'

export const PUBLIC_LINKS = Object.freeze([
  ['Home', '/'], ['About', '/#about'], ['Services', '/#services'],
  ['Pharmacy Items', '/pharmacy-items'], ['Login', '/login'], ['Register', '/register'],
])

const ROLE_LINKS = Object.freeze({
  CUSTOMER: [],
  PRESCRIPTION_STAFF: [['Customers', '/customers'], ['Prescriptions', '/prescriptions/create']],
  SUPPLIER: [['Suppliers', '/suppliers'], ['Receive Stock', '/purchases']],
  INVENTORY_STAFF: [['Inventory', '/medicines'], ['Low Stock', '/medicines/low-stock']],
  SALES_STAFF: [['Sales & Billing', '/sales']],
})

export function linksForUser(user) {
  return user ? [['Dashboard', homeForRole(user.role)], ...(ROLE_LINKS[user.role] || [])] : PUBLIC_LINKS
}
