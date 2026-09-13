import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Pill,
  ShoppingCart,
  Building2,
  Users,
  ClipboardPlus,
  Plus,
  AlertTriangle,
  Clock,
  Package
} from '../common/Icons.jsx'

const iconProps = { size: 20 }

const navItems = [
  {
    section: 'Overview',
    items: [
      { label: 'Dashboard', path: '/', icon: LayoutDashboard, exact: true }
    ]
  },
  {
    section: 'Inventory',
    items: [
      { label: 'Medicines', path: '/medicines', icon: Pill },
      { label: 'Add Medicine', path: '/medicines/add', icon: Plus },
      { label: 'Low Stock', path: '/medicines/low-stock', icon: AlertTriangle },
      { label: 'Expiry Monitoring', path: '/medicines/expiry', icon: Clock }
    ]
  },
  {
    section: 'Sales',
    items: [
      { label: 'New Sale (POS)', path: '/sales', icon: ShoppingCart }
    ]
  },
  {
    section: 'Suppliers',
    items: [
      { label: 'Suppliers', path: '/suppliers', icon: Building2 },
      { label: 'Add Supplier', path: '/suppliers/add', icon: Plus }
    ]
  },
  {
    section: 'Purchases',
    items: [
      { label: 'Receive Stock', path: '/purchases', icon: Package }
    ]
  },
  {
    section: 'Customers',
    items: [
      { label: 'Customers', path: '/customers', icon: Users },
      { label: 'Add Customer', path: '/customers/add', icon: Plus }
    ]
  },
  {
    section: 'Prescriptions',
    items: [
      { label: 'Create Prescription', path: '/prescriptions/create', icon: ClipboardPlus }
    ]
  }
]

const Sidebar = ({ isOpen, onClose }) => {
  const location = useLocation()

  const isNavActive = (path, exact = false) => {
    if (exact) return location.pathname === path
    return location.pathname.startsWith(path + '/') || location.pathname === path
  }

  return (
    <>
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <div className="sidebar-logo">
              <Pill size={24} />
            </div>
            <div className="sidebar-title">
              <span className="pharmacy-name">Senevirathna</span>
              <h3>Medical Pharmacy</h3>
              <span className="sidebar-subtitle">Pharmacy Management System</span>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((section) => (
            <div key={section.section} className="nav-section">
              <div className="nav-section-header">
                {section.section}
              </div>
              <ul className="nav-list">
                {section.items.map((item) => {
                  const active = isNavActive(item.path, item.exact)
                  return (
                    <li key={item.path}>
                      <NavLink
                        to={item.path}
                        onClick={onClose}
                        className={`nav-link ${active ? 'active' : ''}`}
                      >
                        <item.icon {...iconProps} />
                        <span className="nav-text">{item.label}</span>
                      </NavLink>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-footer-content">
            <div className="pharmacy-badge">
              <strong>Senevirathna Medical Pharmacy</strong>
            </div>
            <div className="pharmacy-badge">
              Pharmacy Management System
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}

export default Sidebar
