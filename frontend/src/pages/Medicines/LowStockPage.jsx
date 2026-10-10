import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle } from '../../components/common/Icons.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { reorderService } from '../../services/apiService.js'

const LowStockPage = () => {
  const { medicines, suppliers, showToast } = useApp()
  const [requestMedicine, setRequestMedicine] = useState(null)
  const [supplierId, setSupplierId] = useState('')
  const [requestedQuantity, setRequestedQuantity] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const uniqueMedicines = useMemo(() => Array.from(new Map(medicines.map(medicine => [medicine.id, medicine])).values()), [medicines])
  const lowStockMeds = useMemo(() =>
    uniqueMedicines.filter(m => m.stockStatus === 'low_stock').sort((a, b) => a.quantity - b.quantity),
    [uniqueMedicines]
  )

  const outOfStockMeds = useMemo(() =>
    uniqueMedicines.filter(m => m.stockStatus === 'out_of_stock').sort((a, b) => a.quantity - b.quantity),
    [uniqueMedicines]
  )
  const openRequest = medicine => { setRequestMedicine(medicine); setSupplierId(String(medicine.preferred_supplier_id || '')); setRequestedQuantity(String(Math.max(medicine.min_stock_level * 2 - medicine.quantity, 1))); setNotes('') }
  const submitRequest = async event => { event.preventDefault(); if (!requestMedicine) return; setSaving(true); try { await reorderService.create({ medicine_id: requestMedicine.id, requested_quantity: Number(requestedQuantity), supplier_id: supplierId ? Number(supplierId) : null, notes }); showToast('Stock request saved', 'success'); setRequestMedicine(null) } catch (error) { showToast(error.response?.data?.message || 'Stock request could not be saved', 'error') } finally { setSaving(false) } }
  const requestButton = medicine => <button className="btn btn-secondary btn-sm" onClick={() => openRequest(medicine)}>Request Stock</button>

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
                      <td style={{ fontWeight: 600 }}>{m.name}<small style={{ display: 'block', color: 'var(--text-muted)', fontWeight: 400 }}>{m.productCode || m.medicine_number || `Medicine ID ${m.id}`}</small></td>
                      <td style={{ color: 'var(--text-secondary)' }}>{m.category}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--danger)' }}>{m.quantity}</td>
                      <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{m.minStockLevel}</td>
                      <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--danger)' }}>-{m.minStockLevel}</td>
                      <td style={{ textAlign: 'center' }}><span className="badge badge-out-of-stock">OUT OF STOCK</span></td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'center', flexWrap: 'wrap' }}><Link to="/purchases" className="btn btn-primary btn-sm">Receive Stock</Link>{requestButton(m)}</div>
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
                      <td style={{ fontWeight: 600 }}>{m.name}<small style={{ display: 'block', color: 'var(--text-muted)', fontWeight: 400 }}>{m.productCode || m.medicine_number || `Medicine ID ${m.id}`}</small></td>
                      <td style={{ color: 'var(--text-secondary)' }}>{m.category}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--warning)' }}>{m.quantity}</td>
                      <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{m.minStockLevel}</td>
                      <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--warning)' }}>{Math.max(0, m.minStockLevel - m.quantity)}</td>
                      <td style={{ textAlign: 'center' }}><span className="badge badge-low-stock">LOW STOCK</span></td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'center', flexWrap: 'wrap' }}><Link to="/purchases" className="btn btn-secondary btn-sm">Receive Stock</Link>{requestButton(m)}</div>
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
      {requestMedicine && <div className="modal-backdrop" role="presentation" onClick={() => !saving && setRequestMedicine(null)}><form className="modal-card" onSubmit={submitRequest} onClick={event => event.stopPropagation()}><h2>Request stock</h2><p><strong>{requestMedicine.name}</strong> · Product ID {requestMedicine.productCode || requestMedicine.id}</p><p>Current eligible stock: {requestMedicine.quantity} · Minimum level: {requestMedicine.minStockLevel}</p><label className="form-label">Supplier<select className="form-control" value={supplierId} onChange={event => setSupplierId(event.target.value)}><option value="">No preferred supplier</option>{suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.company_name}</option>)}</select></label><label className="form-label">Requested quantity<input className="form-control" type="number" min="1" value={requestedQuantity} onChange={event => setRequestedQuantity(event.target.value)} required /></label><label className="form-label">Notes<textarea className="form-control" rows="3" value={notes} onChange={event => setNotes(event.target.value)} /></label><div className="workflow-actions"><button type="button" className="btn btn-secondary" onClick={() => setRequestMedicine(null)}>Cancel</button><button className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Submit request'}</button></div></form></div>}
    </div>
  )
}

export default LowStockPage
