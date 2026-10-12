import React, { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useApp } from '../../context/AppContext.jsx'
import { ArrowLeft } from '../../components/common/Icons.jsx'
import ProductImageManager from '../../components/ProductImageManager.jsx'

const EditMedicinePage = () => {
  const navigate = useNavigate()
  const { id } = useParams()
  const { medicines, updateMedicine } = useApp()
  const medicine = medicines.find(m => m.id === parseInt(id, 10))

  const [form, setForm] = useState({
    name: '', genericName: '', batchNumber: '',
    unitPrice: '', quantity: '', minStockLevel: '',
    expiryDate: '', manufacturer: '',
  })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (medicine) {
      setForm({
        name: medicine.name || '', genericName: medicine.genericName || '',
        batchNumber: medicine.batchNumber || '',
        unitPrice: medicine.unitPrice ?? '', quantity: medicine.quantity ?? '',
        minStockLevel: medicine.minStockLevel ?? 10,
        expiryDate: medicine.expiryDate || '', manufacturer: medicine.manufacturer || '',
      })
    }
  }, [medicine])

  if (!medicine) {
    return (
      <div className="content-container" style={{ padding: 'var(--space-16)', textAlign: 'center' }}>
        <h2 style={{ color: 'var(--text-primary)', marginBottom: 'var(--space-4)' }}>Medicine not found</h2>
        <button className="btn btn-primary" onClick={() => navigate('/medicines')}>Back to Inventory</button>
      </div>
    )
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }))
  }

  const validate = () => {
    const errs = {}
    if (!form.name.trim()) errs.name = 'Medicine name is required'
    if (!form.genericName.trim()) errs.genericName = 'Generic name is required'
    if (!form.batchNumber.trim()) errs.batchNumber = 'Batch number is required'
    if (!form.unitPrice || parseFloat(form.unitPrice) < 0) errs.unitPrice = 'Valid unit price is required'
    if (!form.expiryDate) errs.expiryDate = 'Expiry date is required'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setSubmitting(true)

    const result = await updateMedicine(medicine.id, {
      name: form.name,
      generic_name: form.genericName,
      batch_number: form.batchNumber,
      unit_price: parseFloat(form.unitPrice),
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
              <span>Edit</span>
            </div>
            <h1>Edit Medicine</h1>
            <p>Update details for {medicine.name}</p>
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
          <ProductImageManager productCode={medicine.productCode} name={medicine.name} />
          <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
            <div className="card-header"><span className="card-header-title">Medicine Information</span></div>
            <div className="card-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-medicine-name">Medicine Name <span className="required">*</span></label>
                  <input id="edit-medicine-name" type="text" name="name" value={form.name} onChange={handleChange} className={`form-control ${errors.name ? 'is-invalid' : ''}`} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'edit-medicine-name-error' : undefined} />
                  {errors.name && <div id="edit-medicine-name-error" className="form-error" role="alert">{errors.name}</div>}
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-medicine-generic">Generic Name <span className="required">*</span></label>
                  <input id="edit-medicine-generic" type="text" name="genericName" value={form.genericName} onChange={handleChange} className={`form-control ${errors.genericName ? 'is-invalid' : ''}`} aria-invalid={Boolean(errors.genericName)} aria-describedby={errors.genericName ? 'edit-medicine-generic-error' : undefined} />
                  {errors.genericName && <div id="edit-medicine-generic-error" className="form-error" role="alert">{errors.genericName}</div>}
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-medicine-manufacturer">Manufacturer</label>
                  <input id="edit-medicine-manufacturer" type="text" name="manufacturer" value={form.manufacturer} onChange={handleChange} className="form-control" />
                </div>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
            <div className="card-header"><span className="card-header-title">Pricing & Stock</span></div>
            <div className="card-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-medicine-price">Unit Price (LKR) <span className="required">*</span></label>
                  <input id="edit-medicine-price" type="number" name="unitPrice" value={form.unitPrice} onChange={handleChange} className={`form-control ${errors.unitPrice ? 'is-invalid' : ''}`} min="0" step="0.01" aria-invalid={Boolean(errors.unitPrice)} aria-describedby={errors.unitPrice ? 'edit-medicine-price-error' : undefined} />
                  {errors.unitPrice && <div id="edit-medicine-price-error" className="form-error" role="alert">{errors.unitPrice}</div>}
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-medicine-quantity">Current Quantity</label>
                  <input id="edit-medicine-quantity" type="number" name="quantity" value={form.quantity} className="form-control" readOnly aria-describedby="quantity-help" />
                  <div id="quantity-help" className="form-help">Use batch receiving or stock adjustment to change inventory.</div>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-medicine-min-stock">Minimum Stock Level</label>
                  <input id="edit-medicine-min-stock" type="number" name="minStockLevel" value={form.minStockLevel} onChange={handleChange} className="form-control" min="0" />
                </div>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
            <div className="card-header"><span className="card-header-title">Expiry & Batch</span></div>
            <div className="card-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-medicine-batch">Batch Number <span className="required">*</span></label>
                  <input id="edit-medicine-batch" type="text" name="batchNumber" value={form.batchNumber} onChange={handleChange} className={`form-control ${errors.batchNumber ? 'is-invalid' : ''}`} aria-invalid={Boolean(errors.batchNumber)} aria-describedby={errors.batchNumber ? 'edit-medicine-batch-error' : undefined} />
                  {errors.batchNumber && <div id="edit-medicine-batch-error" className="form-error" role="alert">{errors.batchNumber}</div>}
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-medicine-expiry">Expiry Date <span className="required">*</span></label>
                  <input id="edit-medicine-expiry" type="date" name="expiryDate" value={form.expiryDate} onChange={handleChange} className={`form-control ${errors.expiryDate ? 'is-invalid' : ''}`} aria-invalid={Boolean(errors.expiryDate)} aria-describedby={errors.expiryDate ? 'edit-medicine-expiry-error' : undefined} />
                  {errors.expiryDate && <div id="edit-medicine-expiry-error" className="form-error" role="alert">{errors.expiryDate}</div>}
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-ghost" onClick={() => navigate('/medicines')}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-lg" disabled={submitting}>
              {submitting ? 'Updating...' : 'Update Medicine'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default EditMedicinePage
