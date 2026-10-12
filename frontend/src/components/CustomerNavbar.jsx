import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { LogOut, Plus, ShoppingCart } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useCart } from '../context/CartContext.jsx'
import { useNavigate } from 'react-router-dom'

const CustomerNavbar = () => { const { logout, session } = useAuth(); const { itemCount } = useCart(); const location = useLocation(); const navigate = useNavigate(); const signOut = () => { logout(); navigate('/login', { replace: true }) }; return <header className="customer-navbar"><Link to="/customer/dashboard" className="customer-brand"><span><Plus size={21} strokeWidth={3} /></span><strong>Senevirathna<small>Medical Pharmacy</small></strong></Link><nav><Link className={location.pathname === '/customer/dashboard' ? 'active' : ''} to="/customer/dashboard">Dashboard</Link><Link className={location.pathname === '/pharmacy-items' ? 'active' : ''} to="/pharmacy-items">Pharmacy items</Link><Link className={location.pathname === '/my-orders' ? 'active' : ''} to="/my-orders">My orders</Link><Link className={location.pathname === '/customer/checkout' ? 'active' : ''} to="/customer/checkout"><ShoppingCart size={17} /> Cart <b>{itemCount}</b></Link></nav><div className="customer-user"><span>{session?.name || session?.username}</span><button type="button" onClick={signOut} title="Log out"><LogOut size={17} /></button></div></header> }
export default CustomerNavbar
