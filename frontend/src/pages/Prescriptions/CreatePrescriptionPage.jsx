import React, { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useApp } from '../../context/AppContext.jsx'
import { formatLKR } from '../../data/mockMedicines.js'
import { Search, Trash2, AlertTriangle, CheckCircle, AlertCircle, Send, ArrowLeft } from '../../components/common/Icons.jsx'

const CreatePrescriptionPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { customers, medicines, addPrescription, preparePrescriptionForBilling, showToast } = useApp()
  const [selectedCustomer, setSelectedCustomer] = useState(location.state?.customerId || '')
  const [prescriptionDate, setPrescriptionDate] = useState(new Date().toISOString().split('T')[0])
  const [instructions, setInstructions] = useState('')
  const [items, setItems] = useState([])
  const [searchMedicine, setSearchMedicine] = useState('')
  const [availabilityChecked, setAvailabilityChecked] = useState(false)

  const filteredMedicines = searchMedicine.length >= 2
    ? medicines
        .filter(m => m.expiryStatus !== 'expired')
        .filter(m => m.name.toLowerCase().includes(searchMedicine.toLowerCase()) || m.genericName?.toLowerCase().includes(searchMedicine.toLowerCase()))
        .slice(0, 8)
    : []

  const addItem = (medicine) => {
    if (!items.find(i => i.medicineId === medicine.id)) {
      setItems([...items, { medicineId: medicine.id, medicineName: medicine.name, genericName: medicine.genericName, batchNumber: medicine.batchNumber, currentStock: medicine.quantity, unitPrice: medicine.unitPrice, quantity: 1, instructions: '', availability: medicine.quantity > 0 ? 'available' : 'out_of_stock' }])
      setAvailabilityChecked(false)
    }
    setSearchMedicine('')
  }

  const updateQuantity = (medicineId, qty) => {
    if (qty < 1) {
      setItems(items.filter(i => i.medicineId !== medicineId))
      setAvailabilityChecked(false)
      return
    }
    setItems(items.map(i => {
      if (i.medicineId === medicineId) {
        const avail = qty > i.currentStock && i.currentStock > 0 ? 'insufficient' : i.currentStock === 0 ? 'out_of_stock' : 'available'
        return { ...i, quantity: qty, availability: avail }
      }
      return i
    }))
    setAvailabilityChecked(false)
  }

  const updateInstructions = (medicineId, text) => { setItems(items.map(i => i.medicineId === medicineId ? { ...i, instructions: text } : i)) }

  const checkAvailability = () => {
    setItems(items.map(item => {
      const currentMedicine = medicines.find(m => m.id === item.medicineId)
      if (currentMedicine) {
        const avail = item.quantity > currentMedicine.quantity && currentMedicine.quantity > 0 ? 'insufficient' : currentMedicine.quantity === 0 ? 'out_of_stock' : 'available'
        return { ...item, currentStock: currentMedicine.quantity, availability: avail }
      }
      return item
    }))
    setAvailabilityChecked(true)
    showToast('Availability checked', 'info')
  }

  const sendToBilling = async () => {
    if (!selectedCustomer) { showToast('Please select a customer', 'error'); return }
    if (!prescriptionDate) { showToast('Please select a prescription date', 'error'); return }
    const customer = customers.find(c => c.id === parseInt(selectedCustomer, 10))
    if (!customer) { showToast('The selected customer could not be found', 'error'); return }
    const billingItems = items.filter(i => i.availability === 'available').map(i => ({ medicineId: i.medicineId, medicineName: i.medicineName, batchNumber: i.batchNumber, unitPrice: i.unitPrice, quantity: i.quantity, lineTotal: i.unitPrice * i.quantity }))
    if (billingItems.length === 0) { showToast('No available items to send to billing', 'error'); return }
    const prescriptionData = { customer_id: parseInt(selectedCustomer, 10), customer_name: customer ? `${customer.first_name} ${customer.last_name}` : 'Unknown', prescription_date: prescriptionDate, instructions, items: items.map(i => ({ medicine_id: i.medicineId, medicine_name: i.medicineName, generic_name: i.genericName, batch_number: i.batchNumber, quantity: i.quantity, unit_price: i.unitPrice, instructions: i.instructions })) }
    const result = await addPrescription(prescriptionData)
    if (!result.success) return

    const billingResult = await preparePrescriptionForBilling(result.data.id, {
      items: billingItems,
      customer: { id: customer.id, name: `${customer.first_name} ${customer.last_name}` },
      unavailableItems: items.filter(item => item.availability !== 'available'),
    })
    if (!billingResult.success) {
      showToast(billingResult.error || 'Failed to prepare prescription for billing', 'error')
      return
    }
    if (billingResult.data.items.length === 0) {
      showToast('No prescription items are currently available for billing', 'error')
      return
    }

    navigate('/sales', {
      state: {
        prescriptionItems: billingResult.data.items,
        prescriptionCustomer: billingResult.data.customer,
      },
    })
  }

  const availableCount = items.filter(i => i.availability === 'available').length

  return (
    <div className="animate-fade-in">
      <div className="page-header-section">
        <div className="page-header-row">
          <div className="page-header-left">
            <div className="page-header-breadcrumb">
              <Link to="/">Home</Link><span className="sep">/</span>
              <span>Create Prescription</span>
            </div>
            <h1>Create Prescription</h1>
            <p>Record prescribed medicines and verify availability.</p>
          </div>
          <div className="page-header-actions">
            <button className="btn btn-ghost" onClick={() => navigate('/')}>
              <ArrowLeft size={18} /> Back
            </button>
          </div>
        </div>
      </div>

      <div className="content-container" style={{ paddingTop: 'var(--space-6)' }}>
        <div className="pharmacy-workflow-layout" style={{ '--workflow-aside-width': '420px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div className="card">
              <div className="card-header"><span className="card-header-title">Prescription Details</span></div>
              <div className="card-body">
                <div className="form-group">
                  <label className="form-label">Select Customer <span className="required">*</span></label>
                  <select value={selectedCustomer} onChange={(e) => setSelectedCustomer(e.target.value)} className="form-control">
                    <option value="">-- Select a Customer --</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}{c.phone ? ` (${c.phone})` : ''}</option>)}
                  </select>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Prescription Date</label>
                    <input type="date" value={prescriptionDate} onChange={(e) => setPrescriptionDate(e.target.value)} className="form-control" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">General Instructions</label>
                    <input type="text" value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Optional general instructions..." className="form-control" />
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header"><span className="card-header-title"><Search size={18} /> Add Medicines</span></div>
              <div className="card-body">
                <div className="search-input-wrapper">
                  <span className="search-icon"><Search size={18} /></span>
                  <input type="text" value={searchMedicine} onChange={(e) => setSearchMedicine(e.target.value)} placeholder="Search medicines to prescribe..." className="form-control" />
                </div>
                {filteredMedicines.length > 0 && (
                  <div style={{ marginTop: 'var(--space-3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', maxHeight: '280px', overflowY: 'auto' }}>
                    {filteredMedicines.map(m => (
                      <div key={m.id} onClick={() => addItem(m)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer', transition: 'background 0.15s' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-elevated)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--font-size-sm)' }}>{m.name}</div>
                          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{m.genericName} | Stock: {m.quantity}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}><div style={{ fontWeight: 600, color: 'var(--primary-bright)', fontSize: 'var(--font-size-sm)' }}>{formatLKR(m.unitPrice)}</div></div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="pharmacy-workflow-aside">
            <div className="card">
              <div className="card-header">
                <span className="card-header-title">Prescription Items {items.length > 0 && <span className="section-badge">{items.length}</span>}</span>
                {items.length > 0 && <button className="btn btn-ghost btn-sm" onClick={() => { setItems([]); setAvailabilityChecked(false); }}>Clear All</button>}
              </div>
              {items.length > 0 ? (
                <div>
                  <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
                    {items.map(item => (
                      <div key={item.medicineId} style={{ display: 'flex', flexDirection: 'column', padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--border-subtle)', gap: 'var(--space-2)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--font-size-sm)' }}>{item.medicineName}</div>
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Stock: {item.currentStock} | {formatLKR(item.unitPrice)}/unit</div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            <div className="qty-control">
                              <button className="qty-btn" onClick={() => updateQuantity(item.medicineId, item.quantity - 1)} disabled={item.quantity <= 1}>-</button>
                              <span className="qty-value">{item.quantity}</span>
                              <button className="qty-btn" onClick={() => updateQuantity(item.medicineId, item.quantity + 1)}>+</button>
                            </div>
                            <button className="cart-item-remove" onClick={() => { setItems(items.filter(i => i.medicineId !== item.medicineId)); setAvailabilityChecked(false); }} aria-label="Remove"><Trash2 size={16} /></button>
                          </div>
                        </div>
                        {availabilityChecked && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            {item.availability === 'available' && <span className="badge badge-available"><CheckCircle size={12} /> AVAILABLE</span>}
                            {item.availability === 'insufficient' && <span className="badge badge-insufficient"><AlertTriangle size={12} /> INSUFFICIENT (Stock: {item.currentStock})</span>}
                            {item.availability === 'out_of_stock' && <span className="badge badge-out-of-stock"><AlertCircle size={12} /> OUT OF STOCK</span>}
                          </div>
                        )}
                        <input type="text" value={item.instructions} onChange={(e) => updateInstructions(item.medicineId, e.target.value)} placeholder="Dosage instructions (optional)" className="form-control" style={{ padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--font-size-xs)' }} />
                      </div>
                    ))}
                  </div>
                  <div style={{ padding: 'var(--space-4) var(--space-5)', borderTop: '1px solid var(--border)' }}>
                    <button className="btn btn-secondary" style={{ width: '100%', marginBottom: 'var(--space-3)' }} onClick={checkAvailability}>Check Availability</button>
                    {availabilityChecked && (
                      <div style={{ marginBottom: 'var(--space-3)', padding: 'var(--space-3)', background: 'var(--surface-elevated)', borderRadius: 'var(--radius-lg)', fontSize: 'var(--font-size-sm)' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Available: </span>
                        <span style={{ fontWeight: 700, color: 'var(--success)' }}>{availableCount}</span>
                        <span style={{ color: 'var(--text-muted)' }}> / {items.length} items</span>
                      </div>
                    )}
                    <button className="btn btn-primary btn-lg" style={{ width: '100%' }} onClick={sendToBilling} disabled={!availabilityChecked || availableCount === 0}>
                      <Send size={18} /> Send to Billing
                    </button>
                    <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', textAlign: 'center', marginTop: 'var(--space-3)' }}>Only available items will be sent. Stock is NOT reduced yet.</p>
                  </div>
                </div>
              ) : (
                <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
                  <div className="empty-state-icon" style={{ width: '60px', height: '60px' }}><Search size={28} /></div>
                  <h3 className="empty-state-title" style={{ fontSize: 'var(--font-size-base)' }}>No medicines added</h3>
                  <p className="empty-state-description" style={{ fontSize: 'var(--font-size-sm)' }}>Search for medicines and add them to this prescription.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CreatePrescriptionPage
