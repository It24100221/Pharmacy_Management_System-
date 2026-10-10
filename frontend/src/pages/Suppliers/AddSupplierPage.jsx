import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useApp } from '../../context/AppContext.jsx'
import { ArrowLeft } from '../../components/common/Icons.jsx'
import { isValidSupplierPhone, SUPPLIER_PHONE_ERROR } from '../../utils/supplierValidation.js'

const AddSupplierPage = () => {
  const navigate = useNavigate()
  const { addSupplier } = useApp()
  const [form, setForm] = useState({ company_name: '', contact_person: '', phone: '', email: '', address: '' })
  const [errors, setErrors] = useState({})

  const handleChange = (e) => {
    const { name, value } = e.target
    const nextValue = name === 'phone' ? value.replace(/\D/g, '').slice(0, 10) : value
    setForm(prev => ({ ...prev, [name]: nextValue }))
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }))
  }

  const validate = () => {
    const errs = {}
    if (!form.company_name.trim()) errs.company_name = 'Supplier name is required'
    if (!isValidSupplierPhone(form.phone)) errs.phone = SUPPLIER_PHONE_ERROR
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Invalid email format'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    const result = await addSupplier(form)
    if (result.success) navigate('/suppliers')
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header-section">
        <div className="page-header-row">
          <div className="page-header-left">
            <div className="page-header-breadcrumb">
              <Link to="/">Home</Link><span className="sep">/</span>
              <Link to="/suppliers">Suppliers</Link><span className="sep">/</span>
              <span>Add Supplier</span>
            </div>
            <h1>Add Supplier</h1>
            <p>Register a new medicine supplier.</p>
          </div>
          <div className="page-header-actions">
            <button className="btn btn-ghost" onClick={() => navigate('/suppliers')}>
              <ArrowLeft size={18} /> Back
            </button>
          </div>
        </div>
      </div>

      <div className="content-container" style={{ paddingTop: 'var(--space-6)', maxWidth: '700px' }}>
        <form onSubmit={handleSubmit}>
          <div className="card">
            <div className="card-header"><span className="card-header-title">Supplier Information</span></div>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label" htmlFor="add-supplier-company">Supplier Name <span className="required">*</span></label>
                <input id="add-supplier-company" type="text" name="company_name" value={form.company_name} onChange={handleChange}
                  className={`form-control ${errors.company_name ? 'is-invalid' : ''}`} placeholder="e.g. Hemas Pharmaceuticals" aria-invalid={Boolean(errors.company_name)} aria-describedby={errors.company_name ? 'add-supplier-company-error' : undefined} />
                {errors.company_name && <div id="add-supplier-company-error" className="form-error" role="alert">{errors.company_name}</div>}
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="add-supplier-contact">Contact Person</label>
                  <input id="add-supplier-contact" type="text" name="contact_person" value={form.contact_person} onChange={handleChange} className="form-control" placeholder="e.g. Mr. Silva" />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="add-supplier-phone">Phone</label>
                  <input id="add-supplier-phone" type="tel" name="phone" value={form.phone} onChange={handleChange}
                    className={`form-control ${errors.phone ? 'is-invalid' : ''}`} placeholder="e.g. 0112345678"
                    inputMode="numeric" pattern="[0-9]{10}" autoComplete="tel" maxLength={10} aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? 'add-supplier-phone-error' : undefined} />
                  {errors.phone && <div id="add-supplier-phone-error" className="form-error" role="alert">{errors.phone}</div>}
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="add-supplier-email">Email</label>
                  <input id="add-supplier-email" type="email" name="email" value={form.email} onChange={handleChange}
                    className={`form-control ${errors.email ? 'is-invalid' : ''}`} placeholder="e.g. supplier@emas.com" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'add-supplier-email-error' : undefined} />
                  {errors.email && <div id="add-supplier-email-error" className="form-error" role="alert">{errors.email}</div>}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="add-supplier-address">Address</label>
                <textarea id="add-supplier-address" name="address" value={form.address} onChange={handleChange} className="form-control" rows="2" placeholder="Supplier address..." />
              </div>
            </div>
            <div className="card-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
              <button type="button" className="btn btn-ghost" onClick={() => navigate('/suppliers')}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save Supplier</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AddSupplierPage
