import React from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import authService from '../services/authService.js'

const ProtectedRoute = ({ roles }) => {
  const { session } = useAuth()
  const location = useLocation()
  if (!session) return <Navigate to="/login" replace state={{ from: location }} />
  if (roles && !roles.includes(session.role)) return <Navigate to={authService.getDashboardPath(session.role)} replace />
  return <Outlet />
}

export default ProtectedRoute
