import React, { useState, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Pill, ShoppingCart, Building2, Users,
  ClipboardPlus, Plus, AlertTriangle, Clock, Package,
  Menu, ChevronDown, ArrowRight, Check
  , Bell
} from '../common/Icons.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import authService from '../../services/authService.js'
import { notificationService } from '../../services/apiService.js'

const navModules = [
  {
    label: 'Inventory',
    icon: Pill,
    roles: ['ADMIN', 'PHARMACIST', 'INVENTORY', 'SALES'],
    children: [
      { label: 'Medicines', path: '/medicines', icon: Pill, roles: ['ADMIN', 'PHARMACIST', 'INVENTORY', 'SALES'] },
      { label: 'Add Medicine', path: '/medicines/add', icon: Plus, roles: ['ADMIN', 'INVENTORY'] },
      { label: 'Low Stock', path: '/medicines/low-stock', icon: AlertTriangle, roles: ['ADMIN', 'PHARMACIST', 'INVENTORY', 'SALES'] },
      { label: 'Expiry Monitoring', path: '/medicines/expiry', icon: Clock, roles: ['ADMIN', 'PHARMACIST', 'INVENTORY', 'SALES'] },
    ]
  },
  {
    label: 'Sales & Billing',
    path: '/sales',
    icon: ShoppingCart,
    roles: ['ADMIN', 'SALES'],
  },
  {
    label: 'Suppliers',
    icon: Building2,
    roles: ['ADMIN', 'INVENTORY', 'SUPPLIER'],
    children: [
      { label: 'Suppliers', path: '/suppliers', icon: Building2, roles: ['ADMIN', 'INVENTORY', 'SUPPLIER'] },
      { label: 'Add Supplier', path: '/suppliers/add', icon: Plus, roles: ['ADMIN', 'INVENTORY'] },
      { label: 'Receive Stock', path: '/purchases', icon: Package, roles: ['ADMIN', 'INVENTORY'] },
      { label: 'Purchasing workspace', path: '/supplier-purchasing', icon: ClipboardPlus, roles: ['ADMIN', 'INVENTORY'] },
      { label: 'Purchase orders', path: '/purchase-orders', icon: Package, roles: ['ADMIN', 'INVENTORY'] },
      { label: 'Goods receipts', path: '/goods-receipts', icon: Check, roles: ['ADMIN', 'INVENTORY'] },
    ]
  },
  {
    label: 'Customers',
    icon: Users,
    roles: ['ADMIN', 'PHARMACIST', 'SALES'],
    children: [
      { label: 'Customers', path: '/customers', icon: Users, roles: ['ADMIN', 'PHARMACIST', 'SALES'] },
      { label: 'Add Customer', path: '/customers/add', icon: Plus, roles: ['ADMIN', 'PHARMACIST'] },
      { label: 'Create Prescription', path: '/prescriptions/create', icon: ClipboardPlus, roles: ['ADMIN', 'PHARMACIST'] },
    ]
  },
]

const TopNav = ({ onMobileOpen }) => {
  const { session } = useAuth()
  const role = session?.role
  const location = useLocation()
  const [openDropdown, setOpenDropdown] = useState(null)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
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
    let active = true
    const loadNotifications = () => notificationService.getAll({ limit: 8 })
      .then(response => { if (active) { setNotifications(response.data?.notifications || []); setUnreadCount(Number(response.data?.unread_count || 0)) } })
      .catch(() => {})
    if (role) { loadNotifications(); const timer = window.setInterval(loadNotifications, 30000); return () => { active = false; window.clearInterval(timer) } }
    return () => { active = false }
  }, [role])

  const markNotificationRead = async notification => {
    if (!notification.read_at) {
      try { await notificationService.markRead(notification.notification_id); setNotifications(current => current.map(item => item.notification_id === notification.notification_id ? { ...item, read_at: new Date().toISOString() } : item)); setUnreadCount(count => Math.max(0, count - 1)) } catch {}
    }
  }

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
        <Link to={authService.getDashboardPath(role)} className="nav-brand">
          <div className="nav-brand-icon">
            <Plus size={30} strokeWidth={3} />
          </div>
          <div className="nav-brand-text">
            <span className="nav-brand-name">Senevirathna</span>
            <span className="nav-brand-sub">Medical Pharmacy</span>
          </div>
        </Link>

        <div className="nav-links">
          <Link to={authService.getDashboardPath(role)} className="nav-link-item">Dashboard</Link>

          {navModules.filter(mod => mod.roles.includes(role)).map((mod) => {
            if (mod.children) {
              const children = mod.children.filter(child => child.roles.includes(role))
              const isActive = children.some(c => isItemActive(c.path))
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
                    {children.map((child) => (
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

        <div className="nav-notifications">
          <button type="button" className="nav-notification-button" aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ''}`} onClick={() => setOpenDropdown(openDropdown === 'notifications' ? null : 'notifications')}>
            <Bell size={18} />{unreadCount > 0 && <span className="nav-notification-count">{unreadCount > 99 ? '99+' : unreadCount}</span>}
          </button>
          {openDropdown === 'notifications' && <div className="nav-notification-menu"><strong>Notifications</strong>{notifications.length ? notifications.map(notification => <button type="button" key={notification.notification_id} className={`nav-notification-item ${notification.read_at ? '' : 'unread'}`} onClick={() => markNotificationRead(notification)}><b>{notification.title}</b><span>{notification.message}</span><small>{new Date(notification.created_at).toLocaleString()}</small></button>) : <span className="nav-notification-empty">No notifications</span>}</div>}
        </div>
        {['ADMIN', 'SALES'].includes(role) && <Link to="/sales" className="nav-sale-button">New Sale <ArrowRight size={16} /></Link>}
        <button type="button" className="mobile-nav-toggle" onClick={onMobileOpen} aria-label="Open navigation" aria-haspopup="dialog">
          <Menu size={22} />
        </button>
      </div>
    </nav>
  )
}

export default TopNav
