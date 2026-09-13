import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useApp } from '../../context/AppContext.jsx'
import { ArrowLeft } from '../../components/common/Icons.jsx'

const AddMedicinePage = () => {
  const navigate = useNavigate()
  const { addMedicine } = useApp()
  const [form, setForm] = useState({
    name: '', genericName: '', category: '', batchNumber: '',
    unitPrice: '', quantity: '', minStockLevel: '10',
    expiryDate: '', manufacturer: '',
  })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }))
  }

  const validate = () => {
    const errs = {}
    if (!form.name.trim()) errs.name = 'Medicine name is required'
    if (!form.genericName.trim()) errs.genericName = 'Generic name is required'
    if (!form.category.trim()) errs.category = 'Category is required'
    if (!form.batchNumber.trim()) errs.batchNumber = 'Batch number is required'
    if (!form.unitPrice || parseFloat(form.unitPrice) < 0) errs.unitPrice = 'Valid unit price is required'
    if (!form.quantity || parseInt(form.quantity) < 0) errs.quantity = 'Valid quantity is required'
    if (!form.expiryDate) errs.expiryDate = 'Expiry date is required'
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
      category: form.category,
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
          <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
            <div className="card-header"><span className="card-header-title">Medicine Information</span></div>
            <div className="card-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Medicine Name <span className="required">*</span></label>
                  <input type="text" name="name" value={form.name} onChange={handleChange} className={`form-control ${errors.name ? 'is-invalid' : ''}`} placeholder="e.g. Paracetamol 500mg" />
                  {errors.name && <div className="form-error">{errors.name}</div>}
                </div>
                <div className="form-group">
                  <label className="form-label">Generic Name <span className="required">*</span></label>
                  <input type="text" name="genericName" value={form.genericName} onChange={handleChange} className={`form-control ${errors.genericName ? 'is-invalid' : ''}`} placeholder="e.g. Paracetamol" />
                  {errors.genericName && <div className="form-error">{errors.genericName}</div>}
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Category <span className="required">*</span></label>
                  <input type="text" name="category" value={form.category} onChange={handleChange} className={`form-control ${errors.category ? 'is-invalid' : ''}`} placeholder="e.g. Analgesic" />
                  {errors.category && <div className="form-error">{errors.category}</div>}
                </div>
                <div className="form-group">
                  <label className="form-label">Manufacturer</label>
                  <input type="text" name="manufacturer" value={form.manufacturer} onChange={handleChange} className="form-control" placeholder="e.g. Hemas Pharmaceuticals" />
                </div>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
            <div className="card-header"><span className="card-header-title">Pricing & Stock</span></div>
            <div className="card-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Unit Price (LKR) <span className="required">*</span></label>
                  <input type="number" name="unitPrice" value={form.unitPrice} onChange={handleChange} className={`form-control ${errors.unitPrice ? 'is-invalid' : ''}`} placeholder="0.00" min="0" step="0.01" />
                  {errors.unitPrice && <div className="form-error">{errors.unitPrice}</div>}
                </div>
                <div className="form-group">
                  <label className="form-label">Quantity <span className="required">*</span></label>
                  <input type="number" name="quantity" value={form.quantity} onChange={handleChange} className={`form-control ${errors.quantity ? 'is-invalid' : ''}`} placeholder="0" min="0" />
                  {errors.quantity && <div className="form-error">{errors.quantity}</div>}
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Minimum Stock Level</label>
                  <input type="number" name="minStockLevel" value={form.minStockLevel} onChange={handleChange} className="form-control" min="0" />
                </div>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
            <div className="card-header"><span className="card-header-title">Expiry & Batch</span></div>
            <div className="card-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Batch Number <span className="required">*</span></label>
                  <input type="text" name="batchNumber" value={form.batchNumber} onChange={handleChange} className={`form-control ${errors.batchNumber ? 'is-invalid' : ''}`} placeholder="e.g. BAT-2026-001" />
                  {errors.batchNumber && <div className="form-error">{errors.batchNumber}</div>}
                </div>
                <div className="form-group">
                  <label className="form-label">Expiry Date <span className="required">*</span></label>
                  <input type="date" name="expiryDate" value={form.expiryDate} onChange={handleChange} className={`form-control ${errors.expiryDate ? 'is-invalid' : ''}`} />
                  {errors.expiryDate && <div className="form-error">{errors.expiryDate}</div>}
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
