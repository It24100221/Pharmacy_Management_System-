import React from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { routeDecision } from '../../utils/auth.js'

export default function ProtectedRoute({ roles = [] }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <div className="auth-state" role="status">Restoring session…</div>
  const decision = routeDecision(user, roles)
  if (decision === 'login') return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (decision === 'unauthorized') return <Navigate to="/unauthorized" replace />
  return <Outlet />
}
