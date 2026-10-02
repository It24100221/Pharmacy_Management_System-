import React, { useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, X } from '../common/Icons.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { linksForUser } from '../../utils/navigation.js'

export default function MobileDrawer({ isOpen, onClose }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const drawerRef = useRef(null)
  useEffect(() => {
    if (!isOpen) return
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    drawerRef.current?.querySelector('button')?.focus()
    const onKey = event => {
      if (event.key === 'Escape') onClose()
      if (event.key !== 'Tab') return
      const controls = drawerRef.current?.querySelectorAll('a, button')
      if (!controls?.length) return
      const first = controls[0], last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', onKey); previousFocus?.focus() }
  }, [isOpen, onClose])
  const links = linksForUser(user)
  function signOut() { logout(); onClose(); navigate('/', { replace: true }) }
  return <>{isOpen && <div className="mobile-drawer-overlay" onClick={onClose} />}
    <div className={`mobile-drawer ${isOpen ? 'open' : ''}`} ref={drawerRef} hidden={!isOpen} role="dialog" aria-modal="true" aria-label="Pharmacy navigation">
      <div className="mobile-drawer-header"><Link to="/" className="nav-brand" onClick={onClose}>
        <div className="nav-brand-icon"><Plus size={28} strokeWidth={3} /></div>
        <div className="nav-brand-text"><span className="nav-brand-name">Senevirathna</span><span className="nav-brand-sub">Medical Pharmacy</span></div>
      </Link><button className="mobile-drawer-close" onClick={onClose} aria-label="Close navigation"><X size={18} /></button></div>
      <div className="mobile-drawer-nav">{links.map(([label, path]) => <Link className="mobile-nav-item" key={path} to={path} onClick={onClose}>{label}</Link>)}
        {user && <button className="mobile-nav-item" type="button" onClick={signOut}>Logout</button>}
      </div>
    </div>
  </>
}
