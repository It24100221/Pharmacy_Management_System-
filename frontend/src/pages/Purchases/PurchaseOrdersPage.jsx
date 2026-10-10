import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, Check, Package, Plus } from '../../components/common/Icons.jsx'
import { purchaseOrderService } from '../../services/apiService.js'
import { useApp } from '../../context/AppContext.jsx'

const PurchaseOrdersPage = () => {
  const { suppliers, medicines, showToast } = useApp()
  const [orders, setOrders] = useState([])
  const [form, setForm] = useState({ supplier_id: '', medicine_id: '', quantity: 1, unit_cost: '' })
  const [busy, setBusy] = useState(false)
  const load = async () => { try { const result = await purchaseOrderService.getAll(); setOrders(result.data?.purchase_orders || []) } catch (error) { showToast(error.response?.data?.message || 'Unable to load purchase orders', 'error') } }
  useEffect(() => { load() }, [])
  const create = async event => {
    event.preventDefault()
    if (!form.supplier_id || !form.medicine_id || Number(form.quantity) <= 0 || Number(form.unit_cost) < 0) return showToast('Complete supplier, medicine, quantity and unit cost', 'error')
    setBusy(true)
    try { await purchaseOrderService.create({ supplier_id: Number(form.supplier_id), items: [{ medicine_id: Number(form.medicine_id), quantity: Number(form.quantity), unit_cost: Number(form.unit_cost) }], idempotency_key: `po:${crypto.randomUUID()}` }); showToast('Purchase order created', 'success'); setForm({ ...form, quantity: 1, unit_cost: '' }); await load() } catch (error) { showToast(error.response?.data?.message || 'Unable to create purchase order', 'error') } finally { setBusy(false) }
  }
  const transition = async (id, status) => { try { await purchaseOrderService.updateStatus(id, status); await load(); showToast(`Order ${status.toLowerCase()}`, 'success') } catch (error) { showToast(error.response?.data?.message || 'Invalid purchase-order transition', 'error') } }
  return <div className="animate-fade-in"><div className="page-header-section"><div className="page-header-row"><div className="page-header-left"><div className="page-header-breadcrumb"><Link to="/suppliers">Suppliers</Link><span className="sep">/</span><span>Purchase orders</span></div><h1>Purchase orders</h1><p>Plan supplier replenishment without changing inventory until goods are received.</p></div><div className="page-header-actions"><Link to="/purchases" className="btn btn-secondary"><Package size={17} /> Receive stock</Link></div></div></div>
    <div className="content-container" style={{ paddingTop: 'var(--space-6)' }}>
      <form className="card" onSubmit={create} style={{ marginBottom: 'var(--space-5)' }}><div className="card-header"><span className="card-header-title"><Plus size={18} /> New draft order</span></div><div className="card-body"><div className="form-row"><select className="form-control" value={form.supplier_id} onChange={e => setForm({ ...form, supplier_id: e.target.value })}><option value="">Select supplier</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.company_name}</option>)}</select><select className="form-control" value={form.medicine_id} onChange={e => setForm({ ...form, medicine_id: e.target.value })}><option value="">Select medicine</option>{medicines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select><input className="form-control" type="number" min="1" step="1" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} placeholder="Quantity" /><input className="form-control" type="number" min="0" step="0.01" value={form.unit_cost} onChange={e => setForm({ ...form, unit_cost: e.target.value })} placeholder="Unit cost" /><button className="btn btn-primary" disabled={busy}><Plus size={16} /> Create</button></div></div></form>
      <div className="card"><div className="card-header"><span className="card-header-title"><Activity size={18} /> Orders</span></div><div className="table-container"><table className="table"><thead><tr><th>Order</th><th>Supplier</th><th>Status</th><th>Expected</th><th>Items</th><th>Actions</th></tr></thead><tbody>{orders.length ? orders.map(order => <tr key={order.purchase_order_id}><td>{order.purchase_order_number}</td><td>{order.supplier_name}</td><td><span className="badge badge-neutral">{order.status}</span></td><td>{order.expected_date ? String(order.expected_date).slice(0, 10) : '—'}</td><td><Link to={`/purchase-orders/${order.purchase_order_id}`}>View details</Link></td><td><div style={{ display: 'flex', gap: 'var(--space-1)' }}>{order.status === 'DRAFT' && <button className="btn btn-ghost btn-sm" onClick={() => transition(order.purchase_order_id, 'SENT')}>Send</button>}{order.status === 'SENT' && <button className="btn btn-ghost btn-sm" onClick={() => transition(order.purchase_order_id, 'CONFIRMED')}>Approve</button>}{['CONFIRMED', 'PARTIALLY_RECEIVED'].includes(order.status) && <Link className="btn btn-ghost btn-sm" to="/goods-receipts"><Check size={15} /> Receive</Link>}{['DRAFT', 'SENT'].includes(order.status) && <button className="btn btn-ghost btn-sm" onClick={() => transition(order.purchase_order_id, 'CANCELLED')}>Cancel</button>}</div></td></tr>) : <tr><td colSpan="6">No purchase orders yet.</td></tr>}</tbody></table></div></div>
    </div></div>
}
export default PurchaseOrdersPage
