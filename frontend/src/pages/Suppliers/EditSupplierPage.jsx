import React, { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useApp } from '../../context/AppContext.jsx'
import { ArrowLeft } from '../../components/common/Icons.jsx'

const EditSupplierPage = () => {
  const navigate = useNavigate()
  const { id } = useParams()
  const { suppliers, updateSupplier } = useApp()
  const supplier = suppliers.find(s => s.id === parseInt(id, 10))

  const [form, setForm] = useState({ company_name: '', contact_person: '', phone: '', email: '', address: '' })
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (supplier) {
      setForm({
        company_name: supplier.company_name || '', contact_person: supplier.contact_person || '',
        phone: supplier.phone || '', email: supplier.email || '', address: supplier.address || '',
      })
    }
  }, [supplier])

  if (!supplier) {
    return (
      <div className="content-container" style={{ padding: 'var(--space-16)', textAlign: 'center' }}>
        <h2 style={{ color: 'var(--text-primary)', marginBottom: 'var(--space-4)' }}>Supplier not found</h2>
        <button className="btn btn-primary" onClick={() => navigate('/suppliers')}>Back to Suppliers</button>
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
    if (!form.company_name.trim()) errs.company_name = 'Supplier name is required'
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Invalid email format'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    const result = await updateSupplier(supplier.id, form)
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
              <span>Edit</span>
            </div>
            <h1>Edit Supplier</h1>
            <p>Update details for {supplier.company_name}</p>
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
                  className={`form-control ${errors.company_name ? 'is-invalid' : ''}`} />
                {errors.company_name && <div className="form-error">{errors.company_name}</div>}
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Contact Person</label>
                  <input type="text" name="contact_person" value={form.contact_person} onChange={handleChange} className="form-control" />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input type="text" name="phone" value={form.phone} onChange={handleChange} className="form-control" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input type="email" name="email" value={form.email} onChange={handleChange}
                    className={`form-control ${errors.email ? 'is-invalid' : ''}`} />
                  {errors.email && <div className="form-error">{errors.email}</div>}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Address</label>
                <textarea name="address" value={form.address} onChange={handleChange} className="form-control" rows="2" />
              </div>
            </div>
            <div className="card-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
              <button type="button" className="btn btn-ghost" onClick={() => navigate('/suppliers')}>Cancel</button>
              <button type="submit" className="btn btn-primary">Update Supplier</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

export default EditSupplierPage
