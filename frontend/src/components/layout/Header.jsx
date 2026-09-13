import React from 'react'
import { useLocation } from 'react-router-dom'
import { Bell, User } from '../common/Icons.jsx'

const mockUserInfo = {
  name: 'Pharmacy Staff',
  role: 'Senevirathna Medical Pharmacy'
}

const pageTitles = {
  '/': 'Dashboard',
  '/medicines': 'Medicine & Inventory',
  '/medicines/add': 'Add Medicine',
  '/medicines/low-stock': 'Low Stock Medicines',
  '/medicines/expiry': 'Expiry Monitoring',
  '/sales': 'Sales & Billing',
  '/suppliers': 'Suppliers',
  '/suppliers/add': 'Add Supplier',
  '/purchases': 'Receive Stock',
  '/customers': 'Customers',
  '/customers/add': 'Add Customer',
  '/prescriptions/create': 'Create Prescription',
}

const Header = ({ currentPage }) => {
  const location = useLocation()
  const pathname = location.pathname

  const getPageTitle = () => {
    // Dynamic routes
    if (pathname.match(/^\/medicines\/edit\/\d+$/)) return 'Edit Medicine'
    if (pathname.match(/^\/suppliers\/edit\/\d+$/)) return 'Edit Supplier'
    if (pathname.match(/^\/customers\/edit\/\d+$/)) return 'Edit Customer'
    if (pathname.match(/^\/customers\/\d+$/)) return 'Customer Details'
    if (pathname.match(/^\/prescriptions\/\d+$/)) return 'Prescription Details'
    if (pathname.match(/^\/sales\/receipt\/\d+$/)) return 'Sales Receipt'
    return pageTitles[pathname] || 'Senevirathna Medical Pharmacy'
  }

  const formatDate = () => {
    const now = new Date()
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
    return now.toLocaleDateString('en-LK', options)
  }

  return (
    <header className="header">
      <div className="header-left">
        <nav className="header-breadcrumb">
          <span className="current">{getPageTitle()}</span>
        </nav>
      </div>

      <div className="header-right">
        <span className="header-date">{formatDate()}</span>

        <button className="icon-button" aria-label="Notifications">
          <Bell size={20} />
        </button>

        <button className="profile-trigger">
          <div className="profile-avatar">
            <User size={18} />
          </div>
          <div className="profile-info">
            <span className="name">{mockUserInfo.name}</span>
            <span className="role">{mockUserInfo.role}</span>
          </div>
        </button>
      </div>
    </header>
  )
}

export default Header
