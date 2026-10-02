import React, { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { homeForRole } from '../../utils/auth.js'

export default function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  if (user) return <Navigate to={homeForRole(user.role)} replace />

  async function submit(event) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      const signedInUser = await login(identifier, password)
      navigate(homeForRole(signedInUser.role), { replace: true })
    } catch (failure) {
      setError(failure.response?.data?.message || 'Unable to sign in. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return <section className="auth-page"><form className="card auth-card" onSubmit={submit}>
    <h1>Sign in</h1><p>Use your pharmacy account to continue.</p>
    {error && <div className="form-error" role="alert">{error}</div>}
    <label className="form-label" htmlFor="login-identifier">Username or email</label>
    <input className="form-control" id="login-identifier" autoComplete="username" value={identifier} onChange={event => setIdentifier(event.target.value)} required />
    <label className="form-label" htmlFor="login-password">Password</label>
    <input className="form-control" id="login-password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required />
    <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Login'}</button>
    <p>New customer? <Link to="/register">Create an account</Link></p>
  </form></section>
}
