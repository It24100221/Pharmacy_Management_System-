import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useApp } from '../../context/AppContext.jsx'
import { ArrowLeft } from '../../components/common/Icons.jsx'
import ProductImageManager from '../../components/ProductImageManager.jsx'

const getPharmacyToday = () => {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Colombo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

const isValidDateOnly = value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

const AddMedicinePage = () => {
  const navigate = useNavigate()
  const { addMedicine } = useApp()
  const [form, setForm] = useState({
    name: '', genericName: '', batchNumber: '',
    unitPrice: '', quantity: '', minStockLevel: '10',
    expiryDate: '', manufacturer: '',
  })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }))
    if (name === 'expiryDate' && value && (!isValidDateOnly(value) || value < getPharmacyToday())) {
      setErrors(prev => ({ ...prev, expiryDate: 'Expiry date cannot be earlier than today\'s date.' }))
    }
  }

  const validate = () => {
    const errs = {}
    if (!form.name.trim()) errs.name = 'Medicine name is required'
    if (!form.genericName.trim()) errs.genericName = 'Generic name is required'
    if (!form.batchNumber.trim()) errs.batchNumber = 'Batch number is required'
    if (!form.unitPrice || parseFloat(form.unitPrice) < 0) errs.unitPrice = 'Valid unit price is required'
    if (!form.quantity || parseInt(form.quantity) < 0) errs.quantity = 'Valid quantity is required'
    if (!form.expiryDate) errs.expiryDate = 'Expiry date is required'
    else if (!isValidDateOnly(form.expiryDate)) errs.expiryDate = 'Expiry date must be a valid calendar date.'
    else if (form.expiryDate < getPharmacyToday()) errs.expiryDate = 'Expiry date cannot be earlier than today\'s date.'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setSubmitting(true)

    const result = await addMedicine({
      name: form.name,
      generic_name: form.genericName,
      batch_number: form.batchNumber,
      unit_price: parseFloat(form.unitPrice),
      quantity: parseInt(form.quantity),
      min_stock_level: form.minStockLevel === '' ? 10 : parseInt(form.minStockLevel),
      expiry_date: form.expiryDate,
      manufacturer: form.manufacturer,
    })

    setSubmitting(false)
    if (result.success) navigate('/medicines')
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header-section">
        <div className="page-header-row">
          <div className="page-header-left">
            <div className="page-header-breadcrumb">
              <Link to="/">Home</Link><span className="sep">/</span>
              <Link to="/medicines">Inventory</Link><span className="sep">/</span>
              <span>Add Medicine</span>
            </div>
            <h1>Add Medicine</h1>
            <p>Add a new medicine to the inventory.</p>
          </div>
          <div className="page-header-actions">
            <button className="btn btn-ghost" onClick={() => navigate('/medicines')}>
              <ArrowLeft size={18} /> Back to Inventory
            </button>
          </div>
        </div>
      </div>

      <div className="content-container" style={{ paddingTop: 'var(--space-6)', maxWidth: '800px' }}>
        <form onSubmit={handleSubmit}>
          <ProductImageManager name={form.name} />
          <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
            <div className="card-header"><span className="card-header-title">Medicine Information</span></div>
            <div className="card-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="add-medicine-name">Medicine Name <span className="required">*</span></label>
                  <input id="add-medicine-name" type="text" name="name" value={form.name} onChange={handleChange} className={`form-control ${errors.name ? 'is-invalid' : ''}`} placeholder="e.g. Paracetamol 500mg" aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'add-medicine-name-error' : undefined} />
                  {errors.name && <div id="add-medicine-name-error" className="form-error" role="alert">{errors.name}</div>}
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="add-medicine-generic">Generic Name <span className="required">*</span></label>
                  <input id="add-medicine-generic" type="text" name="genericName" value={form.genericName} onChange={handleChange} className={`form-control ${errors.genericName ? 'is-invalid' : ''}`} placeholder="e.g. Paracetamol" aria-invalid={Boolean(errors.genericName)} aria-describedby={errors.genericName ? 'add-medicine-generic-error' : undefined} />
                  {errors.genericName && <div id="add-medicine-generic-error" className="form-error" role="alert">{errors.genericName}</div>}
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="add-medicine-manufacturer">Manufacturer</label>
                  <input id="add-medicine-manufacturer" type="text" name="manufacturer" value={form.manufacturer} onChange={handleChange} className="form-control" placeholder="e.g. Hemas Pharmaceuticals" />
                </div>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
            <div className="card-header"><span className="card-header-title">Pricing & Stock</span></div>
            <div className="card-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="add-medicine-price">Unit Price (LKR) <span className="required">*</span></label>
                  <input id="add-medicine-price" type="number" name="unitPrice" value={form.unitPrice} onChange={handleChange} className={`form-control ${errors.unitPrice ? 'is-invalid' : ''}`} placeholder="0.00" min="0" step="0.01" aria-invalid={Boolean(errors.unitPrice)} aria-describedby={errors.unitPrice ? 'add-medicine-price-error' : undefined} />
                  {errors.unitPrice && <div id="add-medicine-price-error" className="form-error" role="alert">{errors.unitPrice}</div>}
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="add-medicine-quantity">Quantity <span className="required">*</span></label>
                  <input id="add-medicine-quantity" type="number" name="quantity" value={form.quantity} onChange={handleChange} className={`form-control ${errors.quantity ? 'is-invalid' : ''}`} placeholder="0" min="0" aria-invalid={Boolean(errors.quantity)} aria-describedby={errors.quantity ? 'add-medicine-quantity-error' : undefined} />
                  {errors.quantity && <div id="add-medicine-quantity-error" className="form-error" role="alert">{errors.quantity}</div>}
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="add-medicine-min-stock">Minimum Stock Level</label>
                  <input id="add-medicine-min-stock" type="number" name="minStockLevel" value={form.minStockLevel} onChange={handleChange} className="form-control" min="0" />
                </div>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
            <div className="card-header"><span className="card-header-title">Expiry & Batch</span></div>
            <div className="card-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="add-medicine-batch">Batch Number <span className="required">*</span></label>
                  <input id="add-medicine-batch" type="text" name="batchNumber" value={form.batchNumber} onChange={handleChange} className={`form-control ${errors.batchNumber ? 'is-invalid' : ''}`} placeholder="e.g. BAT-2026-001" aria-invalid={Boolean(errors.batchNumber)} aria-describedby={errors.batchNumber ? 'add-medicine-batch-error' : undefined} />
                  {errors.batchNumber && <div id="add-medicine-batch-error" className="form-error" role="alert">{errors.batchNumber}</div>}
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="add-medicine-expiry">Expiry Date <span className="required">*</span></label>
                  <input id="add-medicine-expiry" type="date" name="expiryDate" min={getPharmacyToday()} value={form.expiryDate} onChange={handleChange} className={`form-control ${errors.expiryDate ? 'is-invalid' : ''}`} aria-invalid={Boolean(errors.expiryDate)} aria-describedby={errors.expiryDate ? 'add-medicine-expiry-error' : undefined} />
                  {errors.expiryDate && <div id="add-medicine-expiry-error" className="form-error" role="alert">{errors.expiryDate}</div>}
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-ghost" onClick={() => navigate('/medicines')}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-lg" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save Medicine'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AddMedicinePage
