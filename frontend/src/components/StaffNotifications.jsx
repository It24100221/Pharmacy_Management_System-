import React, { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { notificationService } from '../services/apiService.js'

export default function StaffNotifications() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const host = useRef(null)
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unread, setUnread] = useState(0)
  const [error, setError] = useState('')
  useEffect(() => { setOpen(false) }, [location.pathname, location.search])
  useEffect(() => {
    let active = true
    const load = async () => { try { const response = await notificationService.getAll({ limit: 50 }); if (active) { setNotifications(response.data.notifications); setUnread(response.data.unread_count); setError('') } } catch { if (active) setError('Unable to load notifications') } }
    load(); const timer = window.setInterval(load, 30000); window.addEventListener('pharmacy:notifications-updated', load)
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('pharmacy:notifications-updated', load) }
  }, [session?.userId])
  useEffect(() => {
    const outside = event => { if (!host.current?.contains(event.target)) setOpen(false) }
    const escape = event => { if (event.key === 'Escape') { setOpen(false); host.current?.querySelector('button')?.focus() } }
    if (open) { document.addEventListener('mousedown', outside); document.addEventListener('keydown', escape) }
    return () => { document.removeEventListener('mousedown', outside); document.removeEventListener('keydown', escape) }
  }, [open])
  const view = async notification => {
    try {
      if (!notification.read_at) await notificationService.markRead(notification.notification_id)
      window.dispatchEvent(new Event('pharmacy:notifications-updated')); setOpen(false)
      if (notification.entity_type === 'REORDER_REQUEST') navigate(session.role === 'SUPPLIER' ? `/supplier-dashboard?request=${notification.entity_id}` : `/supplier-purchasing?request=${notification.entity_id}`)
      else if (notification.entity_type === 'PURCHASE_ORDER') navigate(session.role === 'SUPPLIER' ? `/supplier-dashboard?order=${notification.entity_id}` : `/purchase-orders/${notification.entity_id}`)
    } catch { setError('Unable to open notification. Please try again.') }
  }
  return <div className="nav-notifications" ref={host}><button type="button" className="nav-notification-button" aria-expanded={open} aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`} onClick={() => setOpen(!open)}><Bell size={18} />{unread > 0 && <span className="nav-notification-count">{unread > 99 ? '99+' : unread}</span>}</button>{open && <div className="nav-notification-menu"><strong>Notifications</strong>{error && <p role="alert">{error}</p>}{notifications.length ? notifications.map(notification => <button type="button" key={notification.notification_id} className={`nav-notification-item ${notification.read_at ? '' : 'unread'}`} onClick={() => view(notification)}><b>{notification.title}</b><span>{notification.message}</span><small>{new Date(notification.created_at).toLocaleString()}</small></button>) : <span className="nav-notification-empty">No notifications</span>}</div>}</div>
}
