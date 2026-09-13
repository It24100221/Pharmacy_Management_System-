import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useApp } from '../../context/AppContext.jsx'
import { ArrowLeft } from '../../components/common/Icons.jsx'

const AddSupplierPage = () => {
  const navigate = useNavigate()
  const { addSupplier } = useApp()
  const [form, setForm] = useState({ company_name: '', contact_person: '', phone: '', email: '', address: '' })
  const [errors, setErrors] = useState({})

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }))
  }

  const validate = () => {
    const errs = {}
    if (!form.company_name.trim()) errs.company_name = 'Supplier name is required'
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
                <label className="form-label">Supplier Name <span className="required">*</span></label>
                <input type="text" name="company_name" value={form.company_name} onChange={handleChange}
                  className={`form-control ${errors.company_name ? 'is-invalid' : ''}`} placeholder="e.g. Hemas Pharmaceuticals" />
                {errors.company_name && <div className="form-error">{errors.company_name}</div>}
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Contact Person</label>
                  <input type="text" name="contact_person" value={form.contact_person} onChange={handleChange} className="form-control" placeholder="e.g. Mr. Silva" />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input type="text" name="phone" value={form.phone} onChange={handleChange} className="form-control" placeholder="e.g. 011-2345678" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input type="email" name="email" value={form.email} onChange={handleChange}
                    className={`form-control ${errors.email ? 'is-invalid' : ''}`} placeholder="e.g. supplier@emas.com" />
                  {errors.email && <div className="form-error">{errors.email}</div>}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Address</label>
                <textarea name="address" value={form.address} onChange={handleChange} className="form-control" rows="2" placeholder="Supplier address..." />
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
