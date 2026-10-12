import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LogOut, Plus } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import authService from '../services/authService.js'
import StaffNotifications from './StaffNotifications.jsx'
import Toast from './common/Toast.jsx'

const StaffNavbar = () => { const { session, logout } = useAuth(); const navigate = useNavigate(); const signOut = () => { logout(); navigate('/login', { replace: true }) }; return <><header className="staff-navbar"><Link to={session ? authService.getDashboardPath(session.role) : '/'} className="customer-brand"><span><Plus size={21} strokeWidth={3} /></span><strong>Senevirathna<small>Staff workspace</small></strong></Link><div className="staff-user"><StaffNotifications /><span>{session?.name || session?.username} · {session?.role}</span><button type="button" onClick={signOut} title="Log out"><LogOut size={17} /></button></div></header><Toast /></> }
export default StaffNavbar
