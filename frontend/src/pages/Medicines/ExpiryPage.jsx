import React, { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Clock, AlertCircle, CheckCircle } from '../../components/common/Icons.jsx'
import { useApp } from '../../context/AppContext.jsx'

const ExpiryPage = () => {
  const { medicines } = useApp()
  const [tab, setTab] = useState('all')

  const getDaysRemaining = (date) => Math.ceil((new Date(date) - new Date()) / (1000 * 60 * 60 * 24))

  const nearExpiry = useMemo(() =>
    medicines.filter(m => m.expiryStatus === 'near_expiry').sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate)),
    [medicines]
  )

  const expired = useMemo(() =>
    medicines.filter(m => m.expiryStatus === 'expired').sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate)),
    [medicines]
  )

  const valid = useMemo(() =>
    medicines.filter(m => m.expiryStatus === 'valid'),
    [medicines]
  )

  const filteredMeds = useMemo(() => {
    switch (tab) {
      case 'near_expiry': return nearExpiry
      case 'expired': return expired
      case 'valid': return valid
      default: return [...nearExpiry, ...expired]
    }
  }, [tab, nearExpiry, expired, valid])

  const tabs = [
    { key: 'all', label: 'All Attention', count: nearExpiry.length + expired.length },
    { key: 'near_expiry', label: 'Near Expiry', count: nearExpiry.length },
    { key: 'expired', label: 'Expired', count: expired.length },
    { key: 'valid', label: 'Valid', count: valid.length },
  ]

  return (
    <div className="animate-fade-in">
      <div className="page-header-section">
        <div className="page-header-row">
          <div className="page-header-left">
            <div className="page-header-breadcrumb">
              <Link to="/">Home</Link><span className="sep">/</span>
              <Link to="/medicines">Inventory</Link><span className="sep">/</span>
              <span>Expiry Monitoring</span>
            </div>
            <h1>Expiry Monitoring</h1>
            <p>Track medicine expiry dates and manage expired stock.</p>
          </div>
        </div>
      </div>

      <div className="content-container" style={{ paddingTop: 'var(--space-6)' }}>
        {/* Summary */}
        <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-5)', flexWrap: 'wrap' }}>
          <div style={{ padding: 'var(--space-3) var(--space-5)', background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Clock size={18} style={{ color: 'var(--warning)' }} />
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--warning)' }}><strong>{nearExpiry.length}</strong> Near Expiry</span>
          </div>
          <div style={{ padding: 'var(--space-3) var(--space-5)', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <AlertCircle size={18} style={{ color: 'var(--danger)' }} />
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--danger)' }}><strong>{expired.length}</strong> Expired</span>
          </div>
          <div style={{ padding: 'var(--space-3) var(--space-5)', background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <CheckCircle size={18} style={{ color: 'var(--success)' }} />
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--success)' }}><strong>{valid.length}</strong> Valid</span>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-5)', borderBottom: '1px solid var(--border)', paddingBottom: 'var(--space-1)' }}>
          {tabs.map(t => (
            <button key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: 'var(--space-2) var(--space-4)', border: 'none', borderBottom: '2px solid transparent',
                background: 'transparent', color: tab === t.key ? 'var(--primary-bright)' : 'var(--text-secondary)',
                fontWeight: 'var(--font-weight-semibold)', fontSize: 'var(--font-size-sm)', cursor: 'pointer',
                fontFamily: 'var(--font-family)', borderBottomColor: tab === t.key ? 'var(--primary-bright)' : 'transparent',
                transition: 'all 0.15s',
              }}
            >
              {t.label} ({t.count})
            </button>
          ))}
        </div>

        {filteredMeds.length > 0 ? (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Medicine</th>
                  <th>Batch</th>
                  <th>Expiry Date</th>
                  <th style={{ textAlign: 'center' }}>Days Remaining</th>
                  <th style={{ textAlign: 'center' }}>Stock</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredMeds.map(m => {
                  const days = getDaysRemaining(m.expiryDate)
                  return (
                    <tr key={m.id}>
                      <td style={{ fontWeight: 600 }}>{m.name}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{m.batchNumber}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{m.expiryDate}</td>
                      <td style={{ textAlign: 'center', fontWeight: 600, color: m.expiryStatus === 'expired' ? 'var(--danger)' : 'var(--warning)' }}>
                        {m.expiryStatus === 'expired' ? `${Math.abs(days)} days past` : `${days} days`}
                      </td>
                      <td style={{ textAlign: 'center' }}>{m.quantity}</td>
                      <td style={{ textAlign: 'center' }}>
                        {m.expiryStatus === 'expired' ? (
                          <span className="badge badge-expired">EXPIRED</span>
                        ) : m.expiryStatus === 'near_expiry' ? (
                          <span className="badge badge-near-expiry">NEAR EXPIRY</span>
                        ) : (
                          <span className="badge badge-valid">VALID</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon"><Clock size={36} /></div>
            <h3 className="empty-state-title">No medicines in this category</h3>
            <p className="empty-state-description">
              {tab === 'near_expiry' ? 'No medicines are approaching expiry.' :
               tab === 'expired' ? 'No medicines have expired.' :
               tab === 'valid' ? 'No medicines have valid expiry dates.' :
               'No medicines require expiry attention.'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default ExpiryPage
