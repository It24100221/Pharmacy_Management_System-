import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useApp } from '../../context/AppContext.jsx'
import { ArrowLeft } from '../../components/common/Icons.jsx'

const AddCustomerPage = () => {
  const navigate = useNavigate()
  const { addCustomer } = useApp()
  const [form, setForm] = useState({ first_name: '', last_name: '', phone: '', email: '', address: '', date_of_birth: '' })
  const [errors, setErrors] = useState({})

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }))
  }

  const validate = () => {
    const errs = {}
    if (!form.first_name.trim()) errs.first_name = 'First name is required'
    if (!form.last_name.trim()) errs.last_name = 'Last name is required'
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Invalid email format'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    const result = await addCustomer(form)
    if (result.success) navigate('/customers')
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header-section">
        <div className="page-header-row">
          <div className="page-header-left">
            <div className="page-header-breadcrumb">
              <Link to="/">Home</Link><span className="sep">/</span>
              <Link to="/customers">Customers</Link><span className="sep">/</span>
              <span>Add Customer</span>
            </div>
            <h1>Add Customer</h1>
            <p>Register a new customer for prescription processing.</p>
          </div>
          <div className="page-header-actions">
            <button className="btn btn-ghost" onClick={() => navigate('/customers')}>
              <ArrowLeft size={18} /> Back
            </button>
          </div>
        </div>
      </div>

      <div className="content-container" style={{ paddingTop: 'var(--space-6)', maxWidth: '700px' }}>
        <form onSubmit={handleSubmit}>
          <div className="card">
            <div className="card-header"><span className="card-header-title">Customer Information</span></div>
            <div className="card-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="add-customer-first-name">First Name <span className="required">*</span></label>
                  <input id="add-customer-first-name" type="text" name="first_name" value={form.first_name} onChange={handleChange}
                    className={`form-control ${errors.first_name ? 'is-invalid' : ''}`} placeholder="e.g. Kamal" aria-invalid={Boolean(errors.first_name)} aria-describedby={errors.first_name ? 'add-customer-first-name-error' : undefined} />
                  {errors.first_name && <div id="add-customer-first-name-error" className="form-error" role="alert">{errors.first_name}</div>}
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="add-customer-last-name">Last Name <span className="required">*</span></label>
                  <input id="add-customer-last-name" type="text" name="last_name" value={form.last_name} onChange={handleChange}
                    className={`form-control ${errors.last_name ? 'is-invalid' : ''}`} placeholder="e.g. Perera" aria-invalid={Boolean(errors.last_name)} aria-describedby={errors.last_name ? 'add-customer-last-name-error' : undefined} />
                  {errors.last_name && <div id="add-customer-last-name-error" className="form-error" role="alert">{errors.last_name}</div>}
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="add-customer-phone">Phone</label>
                  <input id="add-customer-phone" type="text" name="phone" value={form.phone} onChange={handleChange} className="form-control" placeholder="e.g. 077-1234567" />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="add-customer-email">Email</label>
                  <input id="add-customer-email" type="email" name="email" value={form.email} onChange={handleChange}
                    className={`form-control ${errors.email ? 'is-invalid' : ''}`} placeholder="e.g. kamal@gmail.com" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'add-customer-email-error' : undefined} />
                  {errors.email && <div id="add-customer-email-error" className="form-error" role="alert">{errors.email}</div>}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="add-customer-address">Address</label>
                <textarea id="add-customer-address" name="address" value={form.address} onChange={handleChange} className="form-control" rows="2" placeholder="Customer address..." />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="add-customer-dob">Date of Birth</label>
                <input id="add-customer-dob" type="date" name="date_of_birth" value={form.date_of_birth} onChange={handleChange} className="form-control" />
              </div>
            </div>
            <div className="card-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
              <button type="button" className="btn btn-ghost" onClick={() => navigate('/customers')}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save Customer</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AddCustomerPage
