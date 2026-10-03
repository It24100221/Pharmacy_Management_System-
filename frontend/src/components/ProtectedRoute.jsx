import React from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import authService from '../services/authService.js'
import { AUTH_STATES } from '../config/authorization.js'

const ProtectedRoute = ({ roles }) => {
  const { session, status, error, retryAuth } = useAuth()
  const location = useLocation()
  if (status === AUTH_STATES.INITIALIZING) return <main className="public-auth-page"><p>Restoring your secure session…</p></main>
  if (status === AUTH_STATES.API_UNAVAILABLE) return <main className="public-auth-page"><section><h1>API unavailable</h1><p>{error}</p><button type="button" onClick={retryAuth}>Retry</button></section></main>
  if (status !== AUTH_STATES.AUTHENTICATED || !session) return <Navigate to="/login" replace state={{ from: location }} />
  if (roles && !roles.includes(session.role)) return <Navigate to={authService.getDashboardPath(session.role)} replace />
  return <Outlet />
}

export default ProtectedRoute
