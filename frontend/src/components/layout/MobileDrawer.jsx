import React, { useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Pill, ShoppingCart, Building2, Users,
  ClipboardPlus, Plus, AlertTriangle, Clock, Package, X
} from '../common/Icons.jsx'

const mobileNavSections = [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard', path: '/', icon: LayoutDashboard },
    ]
  },
  {
    title: 'Inventory',
    items: [
      { label: 'Medicines', path: '/medicines', icon: Pill },
      { label: 'Add Medicine', path: '/medicines/add', icon: Plus },
      { label: 'Low Stock', path: '/medicines/low-stock', icon: AlertTriangle },
      { label: 'Expiry Monitoring', path: '/medicines/expiry', icon: Clock },
    ]
  },
  {
    title: 'Sales',
    items: [
      { label: 'New Sale / POS', path: '/sales', icon: ShoppingCart },
    ]
  },
  {
    title: 'Suppliers & Purchases',
    items: [
      { label: 'Suppliers', path: '/suppliers', icon: Building2 },
      { label: 'Add Supplier', path: '/suppliers/add', icon: Plus },
      { label: 'Receive Stock', path: '/purchases', icon: Package },
    ]
  },
  {
    title: 'Customers & Prescriptions',
    items: [
      { label: 'Customers', path: '/customers', icon: Users },
      { label: 'Add Customer', path: '/customers/add', icon: Plus },
      { label: 'Create Prescription', path: '/prescriptions/create', icon: ClipboardPlus },
    ]
  },
]

const MobileDrawer = ({ isOpen, onClose }) => {
  const location = useLocation()
  const drawerRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    drawerRef.current?.querySelector('button')?.focus()
    const handleKeyDown = event => {
      if (event.key === 'Escape') onClose()
      if (event.key !== 'Tab') return
      const controls = drawerRef.current?.querySelectorAll('a, button')
      if (!controls?.length) return
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
      previousFocus?.focus()
    }
  }, [isOpen, onClose])

  const isItemActive = (path) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname === path || location.pathname.startsWith(path + '/')
  }

  return (
    <>
      {isOpen && <div className="mobile-drawer-overlay" onClick={onClose} />}
      <div className={`mobile-drawer ${isOpen ? 'open' : ''}`} ref={drawerRef} hidden={!isOpen} role="dialog" aria-modal="true" aria-label="Pharmacy navigation">
        <div className="mobile-drawer-header">
          <Link to="/" className="nav-brand" onClick={onClose}>
            <div className="nav-brand-icon">
              <Plus size={28} strokeWidth={3} />
            </div>
            <div className="nav-brand-text">
              <span className="nav-brand-name">Senevirathna</span>
              <span className="nav-brand-sub">Medical Pharmacy</span>
            </div>
          </Link>
          <button className="mobile-drawer-close" onClick={onClose} aria-label="Close navigation">
            <X size={18} />
          </button>
        </div>

        <div className="mobile-drawer-nav">
          {mobileNavSections.map((section) => (
            <div key={section.title}>
              <div className="mobile-nav-section-title">{section.title}</div>
              {section.items.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`mobile-nav-item ${isItemActive(item.path) ? 'active' : ''}`}
                  onClick={onClose}
                >
                  <item.icon size={18} />
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

export default MobileDrawer
