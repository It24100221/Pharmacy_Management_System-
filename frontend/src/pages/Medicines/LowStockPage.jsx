import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle } from '../../components/common/Icons.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { canManageSuppliers } from '../../config/authorization.js'
import { reorderService } from '../../services/apiService.js'
import ProductThumbnail from '../../components/ProductThumbnail.jsx'

const LowStockPage = () => {
  const { medicines, suppliers, showToast } = useApp()
  const { session } = useAuth()
  const canRequestStock = canManageSuppliers(session?.role)
  const dialogRef = useRef(null)
  const quantityRef = useRef(null)
  const savingRef = useRef(false)
  const [requestMedicine, setRequestMedicine] = useState(null)
  const [supplierId, setSupplierId] = useState('')
  const [requestedQuantity, setRequestedQuantity] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [requestError, setRequestError] = useState('')

  useEffect(() => {
    if (!requestMedicine) return
    const dialog = dialogRef.current
    const previousFocus = document.activeElement
    const cancel = event => {
      event.preventDefault()
      if (!savingRef.current) setRequestMedicine(null)
    }
    dialog.addEventListener('cancel', cancel)
    dialog.showModal()
    quantityRef.current.focus()
    return () => {
      dialog.removeEventListener('cancel', cancel)
      dialog.close()
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [requestMedicine])

  const uniqueMedicines = useMemo(() => Array.from(new Map(medicines.map(medicine => [medicine.id, medicine])).values()), [medicines])
  const lowStockMeds = useMemo(() =>
    uniqueMedicines.map(m => ({ ...m, quantity: m.availableQuantity })).filter(m => m.stockStatus === 'low_stock').sort((a, b) => a.quantity - b.quantity),
    [uniqueMedicines]
  )

  const outOfStockMeds = useMemo(() =>
    uniqueMedicines.map(m => ({ ...m, quantity: m.availableQuantity })).filter(m => m.stockStatus === 'out_of_stock').sort((a, b) => a.quantity - b.quantity),
    [uniqueMedicines]
  )
  const openRequest = medicine => {
    setRequestMedicine(medicine)
    setSupplierId(String(medicine.preferred_supplier_id || ''))
    setRequestedQuantity(String(Math.max((medicine.reorderTarget ?? medicine.minStockLevel * 2) - medicine.quantity, 1)))
    setNotes('')
    setRequestError('')
  }
  const submitRequest = async event => {
    event.preventDefault()
    if (!requestMedicine || savingRef.current || !canRequestStock) return
    const quantity = Number(requestedQuantity)
    if (!Number.isSafeInteger(quantity) || quantity < 1) {
      setRequestError('Enter a whole number of units greater than zero.')
      return
    }
    savingRef.current = true
    setSaving(true)
    setRequestError('')
    try {
      const result = await reorderService.create({ medicine_id: requestMedicine.id, requested_quantity: quantity, supplier_id: supplierId ? Number(supplierId) : null, notes })
      showToast(result.message || 'Stock request saved', 'success')
      setRequestMedicine(null)
    } catch (error) {
      const message = error.response?.data?.message || 'Stock request could not be saved. Please try again.'
      setRequestError(message)
      showToast(message, 'error')
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }
  const stockActions = medicine => canRequestStock ? (
    <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'center', flexWrap: 'wrap' }}>
      <Link to="/purchases" className="btn btn-secondary btn-sm">Receive Stock</Link>
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => openRequest(medicine)}>Request Stock</button>
    </div>
  ) : <span style={{ color: 'var(--text-muted)' }}>Contact inventory staff</span>

  return (
    <div className="animate-fade-in">
      <div className="page-header-section">
        <div className="page-header-row">
          <div className="page-header-left">
            <div className="page-header-breadcrumb">
              <Link to="/">Home</Link><span className="sep">/</span>
              <Link to="/medicines">Inventory</Link><span className="sep">/</span>
              <span>Low Stock</span>
            </div>
            <h1>Low Stock Medicines</h1>
            <p>Medicines requiring replenishment attention.</p>
          </div>
        </div>
      </div>

      <div className="content-container" style={{ paddingTop: 'var(--space-6)' }}>
        {/* Summary */}
        <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-6)', flexWrap: 'wrap' }}>
          <div style={{ padding: 'var(--space-3) var(--space-5)', background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <AlertTriangle size={18} style={{ color: 'var(--warning)' }} />
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--warning)' }}><strong>{lowStockMeds.length}</strong> Low Stock</span>
          </div>
          <div style={{ padding: 'var(--space-3) var(--space-5)', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <AlertTriangle size={18} style={{ color: 'var(--danger)' }} />
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--danger)' }}><strong>{outOfStockMeds.length}</strong> Out of Stock</span>
          </div>
          <div style={{ padding: 'var(--space-3) var(--space-5)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <AlertTriangle size={18} style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}><strong>{lowStockMeds.length + outOfStockMeds.length}</strong> Total Requiring Attention</span>
          </div>
        </div>

        {outOfStockMeds.length > 0 && (
          <>
            <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--space-3)', color: 'var(--danger)' }}>
              Out of Stock
            </h3>
            <div className="table-container" style={{ marginBottom: 'var(--space-6)' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Medicine</th>
                    <th>Category</th>
                    <th style={{ textAlign: 'center' }}>Current Stock</th>
                    <th style={{ textAlign: 'center' }}>Min Level</th>
                    <th style={{ textAlign: 'center' }}>Difference</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                    <th style={{ textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {outOfStockMeds.map(m => (
                    <tr key={m.id}>
                      <td style={{ fontWeight: 600 }}><ProductThumbnail productCode={m.productCode} medicineId={m.id} name={m.name} />{m.name}<small style={{ display: 'block', color: 'var(--text-muted)', fontWeight: 400 }}>{m.productCode || m.medicine_number || `Medicine ID ${m.id}`}</small></td>
                      <td style={{ color: 'var(--text-secondary)' }}>{m.category}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--danger)' }}>{m.quantity}</td>
                      <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{m.minStockLevel}</td>
                      <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--danger)' }}>-{m.minStockLevel}</td>
                      <td style={{ textAlign: 'center' }}><span className="badge badge-out-of-stock">OUT OF STOCK</span></td>
                      <td style={{ textAlign: 'center' }}>
                        {stockActions(m)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {lowStockMeds.length > 0 && (
          <>
            <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-bold)', marginBottom: 'var(--space-3)', color: 'var(--warning)' }}>
              Low Stock
            </h3>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Medicine</th>
                    <th>Category</th>
                    <th style={{ textAlign: 'center' }}>Current Stock</th>
                    <th style={{ textAlign: 'center' }}>Min Level</th>
                    <th style={{ textAlign: 'center' }}>Difference</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                    <th style={{ textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStockMeds.map(m => (
                    <tr key={m.id}>
                      <td style={{ fontWeight: 600 }}><ProductThumbnail productCode={m.productCode} medicineId={m.id} name={m.name} />{m.name}<small style={{ display: 'block', color: 'var(--text-muted)', fontWeight: 400 }}>{m.productCode || m.medicine_number || `Medicine ID ${m.id}`}</small></td>
                      <td style={{ color: 'var(--text-secondary)' }}>{m.category}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--warning)' }}>{m.quantity}</td>
                      <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{m.minStockLevel}</td>
                      <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--warning)' }}>{Math.max(0, m.minStockLevel - m.quantity)}</td>
                      <td style={{ textAlign: 'center' }}><span className="badge badge-low-stock">LOW STOCK</span></td>
                      <td style={{ textAlign: 'center' }}>
                        {stockActions(m)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {lowStockMeds.length === 0 && outOfStockMeds.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon"><AlertTriangle size={36} /></div>
            <h3 className="empty-state-title">All medicines are well stocked</h3>
            <p className="empty-state-description">No medicines are currently at or below their minimum stock level.</p>
            <Link to="/medicines" className="btn btn-secondary">View Inventory</Link>
          </div>
        )}
      </div>
      {requestMedicine && (
        <dialog
          ref={dialogRef}
          className="stock-request-dialog"
          aria-labelledby="stock-request-title"
          aria-describedby="stock-request-description"
          closedby={saving ? 'none' : 'closerequest'}
          onKeyDown={event => { if (event.key === 'Escape' && savingRef.current) event.preventDefault() }}
          onClick={event => { if (event.target === event.currentTarget && !saving) setRequestMedicine(null) }}
        >
          <form onSubmit={submitRequest} aria-busy={saving}>
            <h2 id="stock-request-title">Request stock</h2>
            <p id="stock-request-description"><strong>{requestMedicine.name}</strong> · Product ID {requestMedicine.productCode || requestMedicine.id}</p>
            <p>Current eligible stock: {requestMedicine.quantity} · Minimum level: {requestMedicine.minStockLevel}</p>
            {requestError && <p className="stock-request-error" role="alert">{requestError}</p>}
            <p><Link to="/supplier-purchasing">Configure supplier assignments and reorder targets</Link></p>
            <fieldset disabled={saving}>
              <div className="form-group">
                <label className="form-label" htmlFor="stock-request-supplier">Supplier</label>
                <select id="stock-request-supplier" className="form-control" value={supplierId} onChange={event => setSupplierId(event.target.value)}>
                  <option value="">No preferred supplier</option>
                  {suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.company_name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="stock-request-quantity">Requested quantity</label>
                <input ref={quantityRef} id="stock-request-quantity" className="form-control" type="number" min="1" step="1" value={requestedQuantity} onChange={event => setRequestedQuantity(event.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="stock-request-notes">Notes</label>
                <textarea id="stock-request-notes" className="form-control" rows="3" maxLength="1000" value={notes} onChange={event => setNotes(event.target.value)} />
              </div>
              <div className="workflow-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setRequestMedicine(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{saving ? 'Saving...' : 'Submit request'}</button>
              </div>
            </fieldset>
          </form>
        </dialog>
      )}
    </div>
  )
}

export default LowStockPage
