import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Menu, Plus } from '../common/Icons.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { linksForUser } from '../../utils/navigation.js'

export default function TopNav({ onMobileOpen }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const links = linksForUser(user)
  function signOut() { logout(); navigate('/', { replace: true }) }
  return <nav className="site-nav" aria-label="Main navigation"><div className="site-nav-inner">
    <Link to="/" className="nav-brand"><div className="nav-brand-icon"><Plus size={30} strokeWidth={3} /></div>
      <div className="nav-brand-text"><span className="nav-brand-name">Senevirathna</span><span className="nav-brand-sub">Medical Pharmacy</span></div>
    </Link>
    <div className="nav-links">{links.map(([label, path]) => <Link key={path} to={path} className="nav-link-item">{label}</Link>)}</div>
    {user && <button type="button" className="nav-sale-button" onClick={signOut}>Logout</button>}
    <button type="button" className="mobile-nav-toggle" onClick={onMobileOpen} aria-label="Open navigation" aria-haspopup="dialog"><Menu size={22} /></button>
  </div></nav>
}
