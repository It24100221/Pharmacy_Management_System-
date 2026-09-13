import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext.jsx'
import { formatLKR } from '../../data/mockMedicines.js'
import { formatDateTime } from '../../utils/dates.js'
import { ShoppingCart, ArrowLeft, Printer } from '../../components/common/Icons.jsx'

const ReceiptPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { sales, getReceipt } = useApp()
  const [sale, setSale] = useState(() => id === 'last' ? sales[sales.length - 1] : null)
  const [loading, setLoading] = useState(id !== 'last')

  useEffect(() => {
    let active = true
    if (id === 'last') {
      setSale(sales[sales.length - 1] || null)
      setLoading(false)
      return () => { active = false }
    }

    setLoading(true)
    getReceipt(id).then(result => {
      if (!active) return
      setSale(result.success ? result.data : null)
      setLoading(false)
    })

    return () => { active = false }
  }, [getReceipt, id, sales])

  if (loading) {
    return <div className="content-container" style={{ padding: 'var(--space-16)', textAlign: 'center' }}>Loading receipt...</div>
  }

  if (!sale) {
    return (
      <div className="content-container" style={{ padding: 'var(--space-16)', textAlign: 'center' }}>
        <h2 style={{ color: 'var(--text-primary)', marginBottom: 'var(--space-4)' }}>Receipt not found</h2>
        <button className="btn btn-primary" onClick={() => navigate('/sales')}>Back to POS</button>
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      <div className="content-container" style={{ maxWidth: '600px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
          <div>
            <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)' }}>Sales Receipt</h1>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>Receipt #{sale.receipt_number}</p>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => window.print()}><Printer size={16} /> Print</button>
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/sales')}><ShoppingCart size={16} /> New Sale</button>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}><ArrowLeft size={16} /> Dashboard</button>
          </div>
        </div>

        <div className="receipt-card">
          <div className="receipt-header">
            <div className="receipt-pharmacy">Senevirathna Medical Pharmacy</div>
            <div className="receipt-tagline">Pharmacy Management System</div>
          </div>
          <div className="receipt-body">
            <div className="receipt-info-row"><span className="label">Receipt Number</span><span className="value">{sale.receipt_number}</span></div>
            <div className="receipt-info-row"><span className="label">Date & Time</span><span className="value">{formatDateTime(sale.sale_date || sale.created_at)}</span></div>
            <div className="receipt-info-row"><span className="label">Customer</span><span className="value">{sale.customer_name || 'Walk-in Customer'}</span></div>
            <div className="receipt-info-row"><span className="label">Payment Method</span><span className="value">{sale.payment_method}</span></div>
            <div className="receipt-divider" />
            <div className="receipt-section-title">Items Purchased</div>
            {sale.items.map((item, idx) => (
              <div key={idx} className="receipt-item">
                <div style={{ flex: 1 }}>
                  <div className="receipt-item-name">{item.medicine_name}</div>
                  <div className="receipt-item-meta">{item.batch_number} | Qty: {item.quantity} x {formatLKR(item.unit_price)}</div>
                </div>
                <div className="receipt-item-price">{formatLKR(item.line_total)}</div>
              </div>
            ))}
            <div className="receipt-divider" />
            <div className="receipt-totals">
              <div className="receipt-total-row"><span className="label">Subtotal</span><span className="value">{formatLKR(sale.subtotal)}</span></div>
              {sale.discount > 0 && <div className="receipt-total-row"><span className="label">Discount</span><span className="value" style={{ color: 'var(--danger)' }}>-{formatLKR(sale.discount)}</span></div>}
              <div className="receipt-total-grand"><span className="label">Grand Total</span><span className="value">{formatLKR(sale.total)}</span></div>
            </div>
          </div>
          <div className="receipt-footer">
            <div className="receipt-thankyou">Thank you for choosing Senevirathna Medical Pharmacy.</div>
            <div className="receipt-footer-note">Get well soon! Visit us again.</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ReceiptPage
