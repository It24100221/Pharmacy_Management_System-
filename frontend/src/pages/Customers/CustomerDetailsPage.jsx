import React from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useApp } from '../../context/AppContext.jsx'
import { ArrowLeft, Pencil, ClipboardPlus, Mail, Phone, MapPin, User } from '../../components/common/Icons.jsx'

const CustomerDetailsPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { customers, prescriptions } = useApp()
  const customer = customers.find(c => c.id === parseInt(id, 10))
  const customerPrescriptions = prescriptions.filter(p => p.customer_id === parseInt(id, 10))

  if (!customer) {
    return (
      <div className="content-container" style={{ padding: 'var(--space-16)', textAlign: 'center' }}>
        <h2 style={{ color: 'var(--text-primary)', marginBottom: 'var(--space-4)' }}>Customer not found</h2>
        <button className="btn btn-primary" onClick={() => navigate('/customers')}>Back to Customers</button>
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header-section">
        <div className="page-header-row">
          <div className="page-header-left">
            <div className="page-header-breadcrumb">
              <Link to="/">Home</Link><span className="sep">/</span>
              <Link to="/customers">Customers</Link><span className="sep">/</span>
              <span>{customer.first_name} {customer.last_name}</span>
            </div>
            <h1>{customer.first_name} {customer.last_name}</h1>
            <p>Customer details and prescription history.</p>
          </div>
          <div className="page-header-actions">
            <button className="btn btn-ghost" onClick={() => navigate('/customers')}>
              <ArrowLeft size={18} /> Back
            </button>
            <Link to={`/customers/edit/${customer.id}`} className="btn btn-secondary"><Pencil size={18} /> Edit</Link>
            <Link to="/prescriptions/create" className="btn btn-primary"><ClipboardPlus size={18} /> New Prescription</Link>
          </div>
        </div>
      </div>

      <div className="content-container" style={{ paddingTop: 'var(--space-6)' }}>
        <div className="pharmacy-detail-grid">
          {/* Contact Info */}
          <div className="card">
            <div className="card-header"><span className="card-header-title"><User size={18} /> Contact Information</span></div>
            <div className="card-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                  <Phone size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <span>{customer.phone || 'No phone number provided'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                  <Mail size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <span>{customer.email || 'No email provided'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)', color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                  <MapPin size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <span>{customer.address || 'No address provided'}</span>
                </div>
                {customer.date_of_birth && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                    <span style={{ width: 16, textAlign: 'center', color: 'var(--text-muted)', flexShrink: 0 }}>DOB</span>
                    <span>{customer.date_of_birth}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Prescription History */}
          <div className="card">
            <div className="card-header">
              <span className="card-header-title">Prescription History</span>
              <span className="section-badge">{customerPrescriptions.length}</span>
            </div>
            {customerPrescriptions.length > 0 ? (
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {customerPrescriptions.map(p => (
                  <div key={p.id} style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--border-subtle)' }}>
                    <Link to={`/prescriptions/${p.id}`} style={{ fontWeight: 600, color: 'var(--primary-bright)', fontSize: 'var(--font-size-sm)' }}>
                      Prescription #{p.id}
                    </Link>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                      {p.prescription_date} &middot; {p.items?.length || 0} items
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
                No prescriptions found for this customer.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default CustomerDetailsPage
