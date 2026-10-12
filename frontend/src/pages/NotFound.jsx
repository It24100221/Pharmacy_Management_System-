import React from 'react'
import { Link } from 'react-router-dom'

export default function NotFound() {
  return <main className="public-auth-page"><section className="public-auth-form" style={{ gridColumn: '1 / -1' }}><div className="public-auth-form-inner"><p className="public-kicker">404</p><h2>Page not found</h2><p className="public-auth-intro">The page you requested does not exist or has moved.</p><Link className="customer-primary-action" to="/">Back to Home</Link></div></section></main>
}
