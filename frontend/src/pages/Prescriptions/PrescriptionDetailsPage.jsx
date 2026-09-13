import React, { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useApp } from '../../context/AppContext.jsx'
import { formatLKR } from '../../data/mockMedicines.js'
import { ArrowLeft, Send, CheckCircle, AlertTriangle, AlertCircle } from '../../components/common/Icons.jsx'

const PrescriptionDetailsPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { prescriptions, medicines, getPrescriptionById, preparePrescriptionForBilling, showToast } = useApp()
  const [prescription, setPrescription] = useState(() => prescriptions.find(p => p.id === parseInt(id, 10)) || null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    getPrescriptionById(id).then(result => {
      if (!active) return
      setPrescription(result.success ? result.data : null)
      setLoading(false)
    })
    return () => { active = false }
  }, [getPrescriptionById, id])

  if (loading) {
    return <div className="content-container" style={{ padding: 'var(--space-16)', textAlign: 'center' }}>Loading prescription...</div>
  }

  if (!prescription) {
    return (
      <div className="content-container" style={{ padding: 'var(--space-16)', textAlign: 'center' }}>
        <h2 style={{ color: 'var(--text-primary)', marginBottom: 'var(--space-4)' }}>Prescription not found</h2>
        <button className="btn btn-primary" onClick={() => navigate('/')}>Back to Dashboard</button>
      </div>
    )
  }

  const sendToBilling = async () => {
    const billingItems = (prescription.items || [])
      .filter(item => {
        const med = medicines.find(m => m.id === item.medicine_id)
        return med && med.quantity >= item.quantity && med.expiryStatus !== 'expired'
      })
      .map(item => ({
        medicineId: item.medicine_id, medicineName: item.medicine_name,
        batchNumber: item.batch_number, unitPrice: item.unit_price,
        quantity: item.quantity, lineTotal: item.unit_price * item.quantity,
      }))

    const fallbackData = {
      items: billingItems,
      customer: { id: prescription.customer_id, name: prescription.customer_name },
      unavailableItems: [],
    }
    const result = await preparePrescriptionForBilling(prescription.id, fallbackData)

    if (!result.success) {
      showToast(result.error || 'Failed to prepare prescription for billing', 'error')
      return
    }
    if (result.data.items.length === 0) {
      showToast('No available prescription items can be sent to billing', 'error')
      return
    }
    navigate('/sales', {
      state: {
        prescriptionItems: result.data.items,
        prescriptionCustomer: result.data.customer,
      },
    })
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header-section">
        <div className="page-header-row">
          <div className="page-header-left">
            <div className="page-header-breadcrumb">
              <Link to="/">Home</Link><span className="sep">/</span>
              <span>Prescription #{prescription.id}</span>
            </div>
            <h1>Prescription #{prescription.id}</h1>
            <p>Prescription details for {prescription.customer_name || 'Customer'}</p>
          </div>
          <div className="page-header-actions">
            <button className="btn btn-ghost" onClick={() => navigate('/')}>
              <ArrowLeft size={18} /> Back
            </button>
            <button className="btn btn-primary" onClick={sendToBilling}>
              <Send size={18} /> Send to Billing
            </button>
          </div>
        </div>
      </div>

      <div className="content-container" style={{ paddingTop: 'var(--space-6)', maxWidth: '800px' }}>
        <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
          <div className="card-header"><span className="card-header-title">Prescription Information</span></div>
          <div className="card-body">
            <div className="form-row">
              <div><span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Customer</span><div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{prescription.customer_name}</div></div>
              <div><span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Date</span><div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{prescription.prescription_date}</div></div>
              <div><span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Status</span><div><span className="badge badge-info">{prescription.status?.toUpperCase() || 'ACTIVE'}</span></div></div>
            </div>
            {prescription.instructions && (
              <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-3)', background: 'var(--surface-elevated)', borderRadius: 'var(--radius-lg)', fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
                <strong>Instructions:</strong> {prescription.instructions}
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-header-title">Prescribed Medicines</span></div>
          <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Medicine</th>
                  <th style={{ textAlign: 'center' }}>Qty</th>
                  <th style={{ textAlign: 'right' }}>Unit Price</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                  <th>Instructions</th>
                </tr>
              </thead>
              <tbody>
                {(prescription.items || []).map((item, idx) => {
                  const med = medicines.find(m => m.id === item.medicine_id)
                  const avail = !med || med.quantity === 0
                    ? 'out_of_stock'
                    : med.expiryStatus === 'expired'
                      ? 'expired'
                      : item.quantity <= med.quantity ? 'available' : 'insufficient'
                  return (
                    <tr key={idx}>
                      <td>
                        <span style={{ fontWeight: 600 }}>{item.medicine_name}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: '2px' }}>
                          {avail === 'available' && <span className="badge badge-available" style={{ fontSize: '10px' }}><CheckCircle size={10} /> AVAILABLE</span>}
                          {avail === 'insufficient' && <span className="badge badge-insufficient" style={{ fontSize: '10px' }}><AlertTriangle size={10} /> INSUFFICIENT</span>}
                          {avail === 'out_of_stock' && <span className="badge badge-out-of-stock" style={{ fontSize: '10px' }}><AlertCircle size={10} /> OUT OF STOCK</span>}
                          {avail === 'expired' && <span className="badge badge-expired" style={{ fontSize: '10px' }}><AlertCircle size={10} /> EXPIRED</span>}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                      <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{formatLKR(item.unit_price)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatLKR(item.unit_price * item.quantity)}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>{item.instructions || '-'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PrescriptionDetailsPage
