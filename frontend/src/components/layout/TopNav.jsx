import React, { useState, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Pill, ShoppingCart, Building2, Users,
  ClipboardPlus, Plus, AlertTriangle, Clock, Package,
  Menu, ChevronDown, ArrowRight
} from '../common/Icons.jsx'

const navModules = [
  {
    label: 'Inventory',
    icon: Pill,
    children: [
      { label: 'Medicines', path: '/medicines', icon: Pill },
      { label: 'Add Medicine', path: '/medicines/add', icon: Plus },
      { label: 'Low Stock', path: '/medicines/low-stock', icon: AlertTriangle },
      { label: 'Expiry Monitoring', path: '/medicines/expiry', icon: Clock },
    ]
  },
  {
    label: 'Sales & Billing',
    path: '/sales',
    icon: ShoppingCart,
  },
  {
    label: 'Suppliers',
    icon: Building2,
    children: [
      { label: 'Suppliers', path: '/suppliers', icon: Building2 },
      { label: 'Add Supplier', path: '/suppliers/add', icon: Plus },
      { label: 'Receive Stock', path: '/purchases', icon: Package },
    ]
  },
  {
    label: 'Customers',
    icon: Users,
    children: [
      { label: 'Customers', path: '/customers', icon: Users },
      { label: 'Add Customer', path: '/customers/add', icon: Plus },
      { label: 'Create Prescription', path: '/prescriptions/create', icon: ClipboardPlus },
    ]
  },
]

const TopNav = ({ onMobileOpen }) => {
  const location = useLocation()
  const [openDropdown, setOpenDropdown] = useState(null)
  const dropdownRefs = useRef({})

  // Close dropdown on route change
  useEffect(() => {
    setOpenDropdown(null)
  }, [location.pathname])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (openDropdown && dropdownRefs.current[openDropdown] &&
          !dropdownRefs.current[openDropdown].contains(e.target)) {
        setOpenDropdown(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [openDropdown])

  useEffect(() => {
    const onEscape = (event) => {
      if (event.key === 'Escape' && openDropdown) {
        dropdownRefs.current[openDropdown]?.querySelector('button')?.focus()
        setOpenDropdown(null)
      }
    }
    document.addEventListener('keydown', onEscape)
    return () => document.removeEventListener('keydown', onEscape)
  }, [openDropdown])

  const isItemActive = (path) => {
    if (!path) return false
    return location.pathname === path || location.pathname.startsWith(path + '/')
  }

  return (
    <nav className="site-nav" aria-label="Main navigation">
      <div className="site-nav-inner">
        <Link to="/" className="nav-brand">
          <div className="nav-brand-icon">
            <Plus size={30} strokeWidth={3} />
          </div>
          <div className="nav-brand-text">
            <span className="nav-brand-name">Senevirathna</span>
            <span className="nav-brand-sub">Medical Pharmacy</span>
          </div>
        </Link>

        <div className="nav-links">
          <Link
            to="/"
            className={`nav-link-item ${location.pathname === '/' ? 'active' : ''}`}
          >
            Home
          </Link>

          {navModules.map((mod) => {
            if (mod.children) {
              const isActive = mod.children.some(c => isItemActive(c.path))
              return (
                <div
                  key={mod.label}
                  className={`nav-dropdown ${openDropdown === mod.label ? 'open' : ''}`}
                  ref={el => dropdownRefs.current[mod.label] = el}
                >
                  <button
                    className={`nav-link-item nav-dropdown-trigger ${isActive ? 'active' : ''}`}
                    onClick={() => setOpenDropdown(openDropdown === mod.label ? null : mod.label)}
                    aria-expanded={openDropdown === mod.label}
                    aria-controls={`nav-${mod.label.toLowerCase()}`}
                  >
                    {mod.label}
                    <ChevronDown size={14} className="dropdown-arrow" />
                  </button>
                  <div className="nav-dropdown-menu" id={`nav-${mod.label.toLowerCase()}`} hidden={openDropdown !== mod.label}>
                    {mod.children.map((child) => (
                      <Link
                        key={child.path}
                        to={child.path}
                        className={`nav-dropdown-item ${isItemActive(child.path) ? 'active' : ''}`}
                        onClick={() => setOpenDropdown(null)}
                      >
                        <child.icon size={16} />
                        {child.label}
                      </Link>
                    ))}
                  </div>
                </div>
              )
            }

            return (
              <Link
                key={mod.path}
                to={mod.path}
                className={`nav-link-item ${isItemActive(mod.path) ? 'active' : ''}`}
              >
                {mod.label}
              </Link>
            )
          })}
        </div>

        <Link to="/sales" className="nav-sale-button">New Sale <ArrowRight size={16} /></Link>
        <button type="button" className="mobile-nav-toggle" onClick={onMobileOpen} aria-label="Open navigation" aria-haspopup="dialog">
          <Menu size={22} />
        </button>
      </div>
    </nav>
  )
}

export default TopNav
