import React, { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Activity, ArrowLeft, Check, Package, Plus } from '../../components/common/Icons.jsx'
import { medicineService } from '../../services/apiService.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useApp } from '../../context/AppContext.jsx'

const MedicineBatchesPage = () => {
  const { id } = useParams()
  const { session } = useAuth()
  const { showToast } = useApp()
  const canManage = ['ADMIN', 'INVENTORY'].includes(session?.role)
  const [medicine, setMedicine] = useState(null)
  const [batches, setBatches] = useState([])
  const [movements, setMovements] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ batch_number: '', expiry_date: '', unit_cost: '' })
  const [adjustment, setAdjustment] = useState({ batch_id: '', quantity_delta: '', reason: '' })
  const [busy, setBusy] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [medicineResult, batchResult, movementResult] = await Promise.all([
        medicineService.getById(id), medicineService.getBatches(id), medicineService.getMovements(id),
      ])
      setMedicine(medicineResult.data)
      setBatches(batchResult.data?.batches || [])
      setMovements(movementResult.data?.movements || [])
    } catch (error) {
      showToast(error.response?.data?.message || 'Unable to load batch inventory', 'error')
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [id])

  const submitBatch = async event => {
    event.preventDefault()
    if (!form.batch_number || !form.expiry_date) return showToast('Batch number and expiry date are required', 'error')
    setBusy(true)
    try {
      await medicineService.createBatch(id, { ...form, unit_cost: form.unit_cost || undefined })
      setForm({ batch_number: '', expiry_date: '', unit_cost: '' })
      showToast('Batch added', 'success')
      await load()
    } catch (error) { showToast(error.response?.data?.message || 'Unable to add batch', 'error') }
    finally { setBusy(false) }
  }

  const submitAdjustment = async event => {
    event.preventDefault()
    const delta = Number(adjustment.quantity_delta)
    if (!Number.isSafeInteger(delta) || delta === 0 || !adjustment.reason.trim()) return showToast('Enter a non-zero whole quantity and a reason', 'error')
    setBusy(true)
    try {
      await medicineService.adjustStock(id, {
        batch_id: adjustment.batch_id || undefined,
        quantity_delta: delta,
        reason: adjustment.reason.trim(),
        idempotency_key: `adjustment:${crypto.randomUUID()}`,
      })
      setAdjustment({ batch_id: '', quantity_delta: '', reason: '' })
      showToast('Stock adjusted', 'success')
      await load()
    } catch (error) { showToast(error.response?.data?.message || 'Unable to adjust stock', 'error') }
    finally { setBusy(false) }
  }

  const knownBatchQuantity = useMemo(() => batches.reduce((sum, batch) => sum + Number(batch.quantity_available || 0), 0), [batches])

  if (loading && !medicine) return <div className="content-container" style={{ paddingTop: 'var(--space-8)' }}>Loading inventory…</div>

  return <div className="animate-fade-in">
    <div className="page-header-section"><div className="page-header-row"><div className="page-header-left">
      <div className="page-header-breadcrumb"><Link to="/medicines">Inventory</Link><span className="sep">/</span><span>Batch inventory</span></div>
      <h1>{medicine?.name || 'Medicine'} batches</h1><p>FEFO-eligible lots, legacy stock reconciliation, and movement history.</p>
    </div><div className="page-header-actions"><Link to="/medicines" className="btn btn-ghost"><ArrowLeft size={18} /> Back</Link></div></div></div>
    <div className="content-container" style={{ paddingTop: 'var(--space-6)' }}>
      <div className="card" style={{ marginBottom: 'var(--space-5)' }}><div className="card-body" style={{ display: 'flex', gap: 'var(--space-6)', flexWrap: 'wrap' }}>
        <span><strong>Aggregate stock:</strong> {medicine?.quantity ?? 0}</span><span><strong>Known batch stock:</strong> {knownBatchQuantity}</span><span><strong>Legacy/unallocated:</strong> {Math.max(0, Number(medicine?.quantity || 0) - knownBatchQuantity)}</span>
      </div></div>

      {canManage && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-5)', marginBottom: 'var(--space-5)' }}>
        <form className="card" onSubmit={submitBatch}><div className="card-header"><span className="card-header-title"><Plus size={18} /> Add empty batch</span></div><div className="card-body">
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>Use receiving to add stock. This only registers a valid lot with zero quantity.</p>
          <input className="form-control" placeholder="Batch number" value={form.batch_number} onChange={e => setForm({ ...form, batch_number: e.target.value })} />
          <input className="form-control" type="date" min={new Date().toISOString().slice(0, 10)} value={form.expiry_date} onChange={e => setForm({ ...form, expiry_date: e.target.value })} style={{ marginTop: 'var(--space-2)' }} />
          <input className="form-control" type="number" min="0" step="0.01" placeholder="Unit cost (optional)" value={form.unit_cost} onChange={e => setForm({ ...form, unit_cost: e.target.value })} style={{ marginTop: 'var(--space-2)' }} />
          <button className="btn btn-secondary" disabled={busy} style={{ marginTop: 'var(--space-3)' }}><Plus size={16} /> Add batch</button>
        </div></form>
        <form className="card" onSubmit={submitAdjustment}><div className="card-header"><span className="card-header-title"><Activity size={18} /> Controlled adjustment</span></div><div className="card-body">
          <select className="form-control" value={adjustment.batch_id} onChange={e => setAdjustment({ ...adjustment, batch_id: e.target.value })}><option value="">Legacy / unallocated stock</option>{batches.map(batch => <option key={batch.batch_id} value={batch.batch_id}>{batch.batch_number} · {batch.quantity_available} units</option>)}</select>
          <input className="form-control" type="number" step="1" placeholder="Quantity delta (+/-)" value={adjustment.quantity_delta} onChange={e => setAdjustment({ ...adjustment, quantity_delta: e.target.value })} style={{ marginTop: 'var(--space-2)' }} />
          <input className="form-control" placeholder="Reason" value={adjustment.reason} onChange={e => setAdjustment({ ...adjustment, reason: e.target.value })} style={{ marginTop: 'var(--space-2)' }} />
          <button className="btn btn-primary" disabled={busy} style={{ marginTop: 'var(--space-3)' }}><Check size={16} /> Apply adjustment</button>
        </div></form>
      </div>}

      <div className="card" style={{ marginBottom: 'var(--space-5)' }}><div className="card-header"><span className="card-header-title"><Package size={18} /> Batches</span></div><div className="table-container"><table className="table"><thead><tr><th>Batch</th><th>Expiry</th><th style={{ textAlign: 'right' }}>Available</th><th>Status</th><th>Unit cost</th></tr></thead><tbody>{batches.length ? batches.map(batch => <tr key={batch.batch_id}><td>{batch.batch_number}</td><td>{String(batch.expiry_date).slice(0, 10)}</td><td style={{ textAlign: 'right' }}>{batch.quantity_available}</td><td>{Number(batch.is_expired) ? 'Expired' : Number(batch.is_active) === 1 ? 'Active' : 'Inactive'}</td><td>{batch.unit_cost ?? '—'}</td></tr>) : <tr><td colSpan="5">No batch records yet. Legacy aggregate stock remains explicitly unallocated.</td></tr>}</tbody></table></div></div>
      <div className="card"><div className="card-header"><span className="card-header-title"><Activity size={18} /> Movement history</span></div><div className="table-container"><table className="table"><thead><tr><th>When</th><th>Type</th><th>Batch</th><th style={{ textAlign: 'right' }}>Delta</th><th style={{ textAlign: 'right' }}>Balance</th><th>Notes</th></tr></thead><tbody>{movements.length ? movements.map(movement => <tr key={movement.movement_id}><td>{String(movement.created_at).replace('T', ' ').slice(0, 19)}</td><td>{movement.movement_type}</td><td>{movement.batch_id || 'Legacy'}</td><td style={{ textAlign: 'right' }}>{movement.quantity_delta > 0 ? `+${movement.quantity_delta}` : movement.quantity_delta}</td><td style={{ textAlign: 'right' }}>{movement.balance_after}</td><td>{movement.notes || '—'}</td></tr>) : <tr><td colSpan="6">No movement history recorded.</td></tr>}</tbody></table></div></div>
    </div>
  </div>
}

export default MedicineBatchesPage
