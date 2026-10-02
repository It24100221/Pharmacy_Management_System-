import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'

const initial = { full_name: '', email: '', phone: '', address: '', username: '', password: '', confirm_password: '' }

export default function RegisterPage() {
  const { register } = useAuth()
  const [form, setForm] = useState(initial)
  const [error, setError] = useState('')
  const [complete, setComplete] = useState(false)
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setError('')
    if (form.password.length < 12) { setError('Password must be at least 12 characters'); return }
    if (form.password !== form.confirm_password) { setError('Passwords do not match'); return }
    setBusy(true)
    try {
      await register(form)
      setComplete(true)
      setForm(initial)
    } catch (failure) {
      setError(failure.response?.data?.message || 'Registration failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  if (complete) return <section className="auth-page"><div className="card auth-card" role="status">
    <h1>Registration Successful</h1><p>Your customer account is ready.</p><Link className="btn btn-primary" to="/login">Go to Login</Link>
  </div></section>

  const fields = [
    ['full_name', 'Full Name', 'text', 'name'], ['email', 'Email', 'email', 'email'],
    ['phone', 'Phone Number', 'tel', 'tel'], ['address', 'Address', 'text', 'street-address'],
    ['username', 'Username', 'text', 'username'], ['password', 'Password', 'password', 'new-password'],
    ['confirm_password', 'Confirm Password', 'password', 'new-password'],
  ]
  return <section className="auth-page"><form className="card auth-card" onSubmit={submit}>
    <h1>Create customer account</h1><p>Enter your details to register.</p>
    {error && <div className="form-error" role="alert">{error}</div>}
    {fields.map(([name, label, type, autoComplete]) => <React.Fragment key={name}>
      <label className="form-label" htmlFor={`register-${name}`}>{label}</label>
      <input className="form-control" id={`register-${name}`} type={type} autoComplete={autoComplete}
        value={form[name]} onChange={event => setForm(previous => ({ ...previous, [name]: event.target.value }))} required />
    </React.Fragment>)}
    <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Creating account…' : 'Register'}</button>
    <p>Already registered? <Link to="/login">Login</Link></p>
  </form></section>
}
