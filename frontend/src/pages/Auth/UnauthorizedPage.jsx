import React from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { homeForRole } from '../../utils/auth.js'

export default function UnauthorizedPage() {
  const { user } = useAuth()
  return <div className="content-container auth-dashboard" role="alert"><h1>Access denied</h1>
    <p>Your account does not have permission to open this page.</p>
    <Link to={homeForRole(user?.role)}>Go to your dashboard</Link>
  </div>
}
