import React, { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { notificationService, purchaseOrderService, reorderService } from '../services/apiService.js'
import { useApp } from '../context/AppContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import StaffNavbar from '../components/StaffNavbar.jsx'
import SupplyRequestDetails from '../components/SupplyRequestDetails.jsx'

const today = () => { const date = new Date(); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10) }
export default function SupplierDashboard() {
  const { showToast } = useApp()
  const { session } = useAuth()
  const location = useLocation()
  const [requests, setRequests] = useState([])
  const [orders, setOrders] = useState([])
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ response_status: 'AVAILABLE', available_quantity: '', estimated_delivery_date: '', unit_purchase_price: '', supplier_message: '' })
  const load = async () => { try { const [req, po] = await Promise.all([reorderService.getAll(), purchaseOrderService.getAll()]); setRequests(req.data.requests); setOrders(po.data.purchase_orders); setError('') } catch (e) { setError(e.response?.data?.message || 'Unable to load supply requests') } finally { setLoading(false) } }
  useEffect(() => { load(); const timer = window.setInterval(load, 30000); return () => window.clearInterval(timer) }, [session?.supplierId])
  const view = async id => {
    try {
      const request = (await reorderService.getById(id)).data; setDetail(request)
      setForm({ response_status: 'AVAILABLE', available_quantity: String(request.requested_quantity), estimated_delivery_date: '', unit_purchase_price: '', supplier_message: '' })
      const notifications = (await notificationService.getAll({ limit: 100 })).data.notifications
      await Promise.all(notifications.filter(item => !item.read_at && ((item.entity_type === 'REORDER_REQUEST' && item.entity_id === request.reorder_request_id) || (item.entity_type === 'PURCHASE_ORDER' && item.entity_id === request.purchase_order_id))).map(item => notificationService.markRead(item.notification_id)))
      window.dispatchEvent(new Event('pharmacy:notifications-updated'))
    } catch (e) { setError(e.response?.data?.message || 'Unable to open supply request') }
  }
  useEffect(() => {
    const query = new URLSearchParams(location.search); const id = query.get('request')
    if (id && !loading) view(id)
    else if (query.get('order') && !loading) { const request = requests.find(item => String(item.purchase_order_id) === query.get('order')); if (request) view(request.reorder_request_id) }
  }, [location.search, loading])
  const submit = async event => {
    event.preventDefault(); if (busy) return; setBusy(true); setError('')
    try { const result = await reorderService.respond(detail.reorder_request_id, { ...form, available_quantity: Number(form.available_quantity), unit_purchase_price: form.unit_purchase_price === '' ? null : Number(form.unit_purchase_price), estimated_delivery_date: form.estimated_delivery_date || null }); await load(); setDetail(result.data); showToast('Supplier response saved', 'success'); window.dispatchEvent(new Event('pharmacy:notifications-updated')) }
    catch (e) { setError(e.response?.data?.message || 'Unable to save supplier response') } finally { setBusy(false) }
  }
  const status = value => setForm(current => ({ ...current, response_status: value, available_quantity: value === 'UNAVAILABLE' ? '0' : String(detail.requested_quantity), estimated_delivery_date: value === 'UNAVAILABLE' ? '' : current.estimated_delivery_date }))
  const confirm = async order => { if (busy) return; setBusy(true); try { await purchaseOrderService.updateStatus(order.purchase_order_id, 'CONFIRMED'); await load(); showToast('Purchase order confirmed', 'success'); if (detail?.purchase_order_id === order.purchase_order_id) await view(detail.reorder_request_id) } catch (e) { setError(e.response?.data?.message || 'Unable to confirm order') } finally { setBusy(false) } }
  const pending = requests.filter(request => request.status === 'OPEN' && !request.response_status).length
  return <div className="staff-workspace"><StaffNavbar /><main className="role-dashboard"><section className="role-heading"><div><p className="public-kicker">Supplier workspace</p><h1>Supplier dashboard</h1><p>Welcome back, {session?.name || session?.username}. Review requests and purchase orders assigned to your company.</p></div><span className="role-pill">SUPPLIER</span></section>
    <section className="role-card-grid"><Link to="/suppliers"><h2>Supplier profile</h2><small>View your linked company</small></Link><article className="workflow-panel"><strong>{pending}</strong><h2>Pending requests</h2></article><article className="workflow-panel"><strong>{orders.filter(order => !['RECEIVED', 'CANCELLED'].includes(order.status)).length}</strong><h2>Active purchase orders</h2></article></section>
    <section className="workflow-panel supplier-supply-panel"><div className="supply-section-heading"><h2>Incoming Medicine Supply Requests</h2><button className="btn btn-secondary" type="button" disabled={loading || busy} onClick={load}>Refresh</button></div>{error && <p className="public-auth-error" role="alert">{error}</p>}
      {loading ? <p>Loading supply requests…</p> : <div className="table-container"><table className="table"><thead><tr><th>Request / medicine</th><th>Available / minimum</th><th>Requested</th><th>Delivery / priority</th><th>Status</th><th>Actions</th></tr></thead><tbody>{requests.length ? requests.map(request => <tr key={request.reorder_request_id}><td>{request.request_number}<strong className="supply-code">{request.medicine_name}</strong><small className="supply-code">{request.product_code || request.medicine_number}</small></td><td>{request.available_quantity} / {request.min_stock_level}</td><td>{request.requested_quantity}<small className="supply-code">{String(request.created_at).slice(0, 10)}</small></td><td>{request.requested_delivery_date ? String(request.requested_delivery_date).slice(0, 10) : 'Not specified'}<small className="supply-code">{request.priority}</small></td><td>{request.status === 'OPEN' && !request.response_status ? 'Pending Supplier Confirmation' : request.status}<small className="supply-code">{request.response_status}</small><small className="supply-code">{request.purchase_order_status}</small></td><td><button type="button" className="btn btn-secondary btn-sm" onClick={() => view(request.reorder_request_id)}>View Details</button></td></tr>) : <tr><td colSpan="6">No supply requests assigned to your company yet.</td></tr>}</tbody></table></div>}
      {detail && <div className="supply-inline-form"><SupplyRequestDetails request={detail} /><button type="button" className="btn btn-secondary" onClick={() => setDetail(null)}>Close details</button>{detail.status === 'OPEN' && !detail.response_status && <form onSubmit={submit}><fieldset disabled={busy}><div className="workflow-actions supply-response-actions"><button type="button" className="btn btn-secondary" onClick={() => status('AVAILABLE')}>Confirm Availability</button><button type="button" className="btn btn-secondary" onClick={() => status('PARTIALLY_AVAILABLE')}>Partially Available</button><button type="button" className="btn btn-secondary" onClick={() => status('UNAVAILABLE')}>Unable to Supply</button></div><div className="supply-form-grid"><label>Response status<select className="form-control" value={form.response_status} onChange={e => status(e.target.value)}><option value="AVAILABLE">AVAILABLE</option><option value="PARTIALLY_AVAILABLE">PARTIALLY_AVAILABLE</option><option value="UNAVAILABLE">UNAVAILABLE</option></select></label><label>Available quantity<input className="form-control" type="number" min={form.response_status === 'UNAVAILABLE' ? '0' : '1'} step="1" required value={form.available_quantity} onChange={e => setForm({ ...form, available_quantity: e.target.value })} /></label><label>Estimated delivery date<input className="form-control" type="date" min={today()} required={form.response_status !== 'UNAVAILABLE'} value={form.estimated_delivery_date} onChange={e => setForm({ ...form, estimated_delivery_date: e.target.value })} /></label><label>Unit purchase price (optional)<input className="form-control" type="number" min="0" step="0.01" value={form.unit_purchase_price} onChange={e => setForm({ ...form, unit_purchase_price: e.target.value })} /></label><label>Supplier message<textarea className="form-control" rows="3" maxLength="1000" value={form.supplier_message} onChange={e => setForm({ ...form, supplier_message: e.target.value })} /></label><button type="submit" className="btn btn-primary">{busy ? 'Saving…' : 'Submit availability / quotation'}</button></div></fieldset></form>}</div>}
    </section><section className="workflow-panel supply-orders"><h2>Purchase orders and delivery history</h2>{orders.length ? <div className="table-container"><table className="table"><thead><tr><th>Order</th><th>Status</th><th>Expected delivery</th><th>Action</th></tr></thead><tbody>{orders.map(order => <tr key={order.purchase_order_id}><td>{order.purchase_order_number}</td><td>{order.status}</td><td>{order.expected_date ? String(order.expected_date).slice(0, 10) : 'Not specified'}</td><td>{order.status === 'SENT' && <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => confirm(order)}>Confirm order</button>}</td></tr>)}</tbody></table></div> : <p>No purchase orders assigned to your company yet.</p>}</section>
  </main></div>
}
