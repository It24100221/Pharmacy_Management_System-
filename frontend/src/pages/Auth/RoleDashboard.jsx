import React from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'

const roleInfo = {
  CUSTOMER: { title: 'Customer dashboard', links: [] },
  PRESCRIPTION_STAFF: { title: 'Prescription dashboard', links: [['Customers', '/customers'], ['Create prescription', '/prescriptions/create']] },
  SUPPLIER: { title: 'Supplier dashboard', links: [['Suppliers', '/suppliers'], ['Receive stock', '/purchases']] },
  INVENTORY_STAFF: { title: 'Inventory dashboard', links: [['Inventory', '/medicines'], ['Add medicine', '/medicines/add'], ['Low stock', '/medicines/low-stock']] },
  SALES_STAFF: { title: 'Sales dashboard', links: [['New sale', '/sales']] },
}

export default function RoleDashboard() {
  const { user } = useAuth()
  const info = roleInfo[user?.role]
  return <div className="content-container auth-dashboard">
    <h1>{info?.title}</h1><p>Welcome, {user?.username}.</p>
    {info?.links.length ? <div className="auth-dashboard-links">{info.links.map(([label, path]) => <Link className="card" key={path} to={path}>{label} →</Link>)}</div>
      : <p>Your account is ready. Shopping and orders will be added in Stage 2.</p>}
  </div>
}
