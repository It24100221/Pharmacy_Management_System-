import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, Plus } from 'lucide-react'

const Navbar = ({ onMobileOpen }) => {
  const location = useLocation()
  const active = path => location.pathname === path
  return <nav className="customer-site-navbar" aria-label="Customer navigation"><div className="customer-site-navbar-inner"><div className="logo-section"><Link to="/" className="customer-site-brand"><span><Plus size={23} strokeWidth={3} /></span><strong>Senevirathna<small>Medical Pharmacy</small></strong></Link></div><div className="nav-links"><Link className={active('/') ? 'active' : ''} to="/">Home</Link><a href="/#about">About</a><a href="/#services">Services</a><Link className={active('/pharmacy-items') ? 'active' : ''} to="/pharmacy-items">Pharmacy Items</Link></div><div className="auth-buttons"><Link className="customer-site-login" to="/login">Login</Link><Link className="customer-site-register" to="/register">Register</Link></div><button type="button" className="customer-site-menu" onClick={onMobileOpen} aria-label="Open navigation"><Menu size={21} /></button></div></nav>
}
export default Navbar
