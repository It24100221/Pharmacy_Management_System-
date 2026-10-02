import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext.jsx'

const TYPES = ['Medicine', 'Baby Items', 'Lab Items', 'Medical Accessories']
const empty = { productCode: '', productType: 'Medicine', name: '', genericName: '', category: '', batchNumber: '',
  manufacturer: '', description: '', unitPrice: '', quantity: '', minStockLevel: '10', expiryDate: '', imageUrl: '',
  requiresPrescription: true, isActive: true }

export default function ProductEditor({ id }) {
  const navigate = useNavigate()
  const { medicines, loading, addMedicine, updateMedicine } = useApp()
  const product = id ? medicines.find(item => item.id === id) : null
  const [form, setForm] = useState(empty)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  useEffect(() => {
    if (!product) return
    setForm({ productCode: product.product_code || '', productType: product.product_type || 'Medicine',
      name: product.name || '', genericName: product.genericName || '', category: product.category || '',
      batchNumber: product.batchNumber || '', manufacturer: product.manufacturer || '', description: product.description || '',
      unitPrice: product.unitPrice ?? '', quantity: product.quantity ?? '', minStockLevel: product.minStockLevel ?? 10,
      expiryDate: product.expiryDate ? String(product.expiryDate).slice(0, 10) : '', imageUrl: product.image_url || '',
      requiresPrescription: Boolean(product.requires_prescription), isActive: Boolean(product.is_active) })
  }, [product])
  if (id && !product) return <div className="content-container auth-state">{loading ? 'Loading product…' : 'Product not found in inventory.'}</div>

  const change = event => {
    const { name, type, checked, value } = event.target
    setForm(prev => name === 'productType'
      ? { ...prev, productType: value, requiresPrescription: value === 'Medicine' }
      : { ...prev, [name]: type === 'checkbox' ? checked : value })
    setErrors(prev => ({ ...prev, [name]: '' }))
  }
  const validate = () => {
    const next = {}
    if (!id && !/^[A-Z0-9-]{2,32}$/.test(form.productCode)) next.productCode = 'Use 2–32 uppercase letters, numbers or hyphens.'
    if (!form.name.trim()) next.name = 'Product name is required.'
    if (form.unitPrice === '' || !Number.isFinite(Number(form.unitPrice)) || Number(form.unitPrice) < 0) next.unitPrice = 'Enter a valid price.'
    if (form.quantity === '' || !Number.isInteger(Number(form.quantity)) || Number(form.quantity) < 0) next.quantity = 'Enter a valid quantity.'
    if (form.productType === 'Medicine' && !form.expiryDate) next.expiryDate = 'Medicine expiry date is required.'
    setErrors(next)
    return Object.keys(next).length === 0
  }
  const submit = async event => {
    event.preventDefault()
    if (!validate()) return
    setSubmitting(true)
    const payload = { product_type: form.productType, name: form.name.trim(), generic_name: form.genericName,
      category: form.category, batch_number: form.batchNumber, manufacturer: form.manufacturer, description: form.description,
      unit_price: Number(form.unitPrice), quantity: Number(form.quantity), min_stock_level: form.minStockLevel === '' ? 10 : Number(form.minStockLevel),
      expiry_date: form.expiryDate || null, image_url: form.imageUrl, requires_prescription: form.requiresPrescription,
      is_active: form.isActive }
    if (!id) payload.product_code = form.productCode
    const result = id ? await updateMedicine(id, payload) : await addMedicine(payload)
    setSubmitting(false)
    if (result.success) navigate('/medicines')
  }
  const input = (label, name, props = {}) => <label className="form-group" key={name}><span className="form-label">{label}</span>
    <input className={`form-control ${errors[name] ? 'is-invalid' : ''}`} name={name} value={form[name]} onChange={change} {...props} />
    {errors[name] && <span className="form-error">{errors[name]}</span>}</label>
  return <div className="content-container product-editor">
    <div className="page-header-section"><div className="page-header-breadcrumb"><Link to="/medicines">Inventory</Link><span className="sep">/</span>{id ? 'Edit Product' : 'Add Product'}</div>
      <h1>{id ? 'Edit Product' : 'Add Product'}</h1><p>Manage the product information shown in the public catalog.</p></div>
    <form className="card" onSubmit={submit}><div className="card-body">
      <div className="form-row">
        {input('Permanent Product ID', 'productCode', { required: true, maxLength: 32, readOnly: Boolean(id), placeholder: 'e.g. P008' })}
        <label className="form-group"><span className="form-label">Main category</span><select className="form-control" name="productType" value={form.productType} onChange={change}>{TYPES.map(type => <option key={type}>{type}</option>)}</select></label>
      </div>
      <p className="product-code-help">Assign a shared Product ID once. It cannot be changed after creation.</p>
      <div className="form-row">{input('Product name', 'name', { required: true })}{input('Subcategory', 'category', { placeholder: 'e.g. Pain Relief' })}</div>
      <div className="form-row">{input('Generic name', 'genericName')}{input('Manufacturer', 'manufacturer')}</div>
      <div className="form-row">{input('Batch number', 'batchNumber')}{input('Expiry date', 'expiryDate', { type: 'date', required: form.productType === 'Medicine' })}</div>
      <div className="form-row">{input('Unit price (LKR)', 'unitPrice', { type: 'number', min: 0, step: '0.01', required: true })}{input('Quantity', 'quantity', { type: 'number', min: 0, step: 1, required: true })}</div>
      <div className="form-row">{input('Minimum stock level', 'minStockLevel', { type: 'number', min: 0, step: 1 })}{input('Image URL', 'imageUrl', { placeholder: 'https://… or /images/…' })}</div>
      <label className="form-group"><span className="form-label">Description</span><textarea className="form-control" name="description" value={form.description} onChange={change} rows="3" /></label>
      <div className="product-editor-flags"><label><input type="checkbox" name="requiresPrescription" checked={form.requiresPrescription} onChange={change} /> Prescription required</label>
        <label><input type="checkbox" name="isActive" checked={form.isActive} onChange={change} /> Show in public catalog</label></div>
      <div className="product-editor-actions"><Link className="btn btn-ghost" to="/medicines">Cancel</Link><button className="btn btn-primary" type="submit" disabled={submitting}>{submitting ? 'Saving…' : 'Save Product'}</button></div>
    </div></form>
  </div>
}
