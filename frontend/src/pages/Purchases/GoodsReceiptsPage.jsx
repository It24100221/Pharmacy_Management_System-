import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Package } from '../../components/common/Icons.jsx'
import { goodsReceiptService, purchaseOrderService } from '../../services/apiService.js'
import { useApp } from '../../context/AppContext.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { medicineService } from '../../services/apiService.js'
import { normalizeMedicine } from '../../utils/normalization.js'

const GoodsReceiptsPage = () => {
  const { showToast, dispatch } = useApp(); const { session } = useAuth(); const savingRef = useRef(false); const [orders, setOrders] = useState([]); const [order, setOrder] = useState(null); const [selected, setSelected] = useState(''); const [rows, setRows] = useState([]); const [busy, setBusy] = useState(false)
  useEffect(() => { purchaseOrderService.getAll().then(result => setOrders((result.data?.purchase_orders || []).filter(item => ['CONFIRMED', 'PARTIALLY_RECEIVED'].includes(item.status)))).catch(error => showToast(error.response?.data?.message || 'Unable to load orders', 'error')) }, [])
  const selectOrder = async id => { setSelected(id); if (!id) return setOrder(null); try { const result = await purchaseOrderService.getById(id); setOrder(result.data); setRows((result.data.items || []).filter(item => Number(item.received_quantity) < Number(item.ordered_quantity)).map(item => ({ purchase_order_item_id: item.purchase_order_item_id, medicine_name: item.medicine_name, outstanding: Number(item.ordered_quantity) - Number(item.received_quantity), quantity_received: '', batch_number: '', expiry_date: '', unit_cost: item.unit_cost }))) } catch (error) { showToast(error.response?.data?.message || 'Unable to load order details', 'error') } }
  const update = (id, patch) => setRows(rows.map(row => row.purchase_order_item_id === id ? { ...row, ...patch } : row))
  const submit = async event => {
    event.preventDefault()
    if (savingRef.current) return
    const items = rows.filter(row => Number(row.quantity_received) > 0)
    if (!selected || !items.length || items.some(row => !row.batch_number || !row.expiry_date || !Number.isSafeInteger(Number(row.quantity_received)) || Number(row.quantity_received) > row.outstanding)) return showToast('Enter valid quantities, batches and expiry dates within outstanding amounts', 'error')
    const payload = { purchase_order_id: Number(selected), items: items.map(row => ({ purchase_order_item_id: row.purchase_order_item_id, quantity_received: Number(row.quantity_received), batch_number: row.batch_number, expiry_date: row.expiry_date, unit_cost: Number(row.unit_cost) })) }
    const storageKey = 'pharmacy_goods_receipt_attempt:' + session.userId + ':' + selected
    const fingerprint = JSON.stringify(payload)
    let attempt
    try { attempt = JSON.parse(sessionStorage.getItem(storageKey)) } catch {}
    if (!attempt || attempt.fingerprint !== fingerprint) attempt = { fingerprint, idempotencyKey: 'grn:' + crypto.randomUUID() }
    sessionStorage.setItem(storageKey, JSON.stringify(attempt))
    savingRef.current = true; setBusy(true)
    try {
      await goodsReceiptService.create({ ...payload, idempotency_key: attempt.idempotencyKey })
      sessionStorage.removeItem(storageKey)
      showToast('Goods receipt posted and stock updated', 'success')
      await selectOrder(selected)
      const medicines = (await medicineService.getAll({ pagination: 'false' })).data.medicines
      dispatch({ type: 'SET_MEDICINES', payload: medicines.map(normalizeMedicine) })
      window.dispatchEvent(new Event('pharmacy:notifications-updated'))
    } catch (error) { showToast(error.response?.data?.message || 'Unable to post goods receipt', 'error') }
    finally { savingRef.current = false; setBusy(false) }
  }

  return <div className="animate-fade-in"><div className="page-header-section"><div className="page-header-row"><div className="page-header-left"><div className="page-header-breadcrumb"><Link to="/purchase-orders">Purchase orders</Link><span className="sep">/</span><span>Goods receipts</span></div><h1>Goods receipts</h1><p>Receive deliveries in partial quantities; inventory changes only here.</p></div></div></div><div className="content-container" style={{ paddingTop: 'var(--space-6)' }}><div className="card"><div className="card-header"><span className="card-header-title"><Package size={18} /> Select eligible order</span></div><div className="card-body"><select className="form-control" value={selected} onChange={e => selectOrder(e.target.value)}><option value="">Select confirmed order</option>{orders.map(item => <option key={item.purchase_order_id} value={item.purchase_order_id}>{item.purchase_order_number} · {item.supplier_name} · {item.status}</option>)}</select></div></div>{order && <form className="card" onSubmit={submit} style={{ marginTop: 'var(--space-5)' }}><div className="card-header"><span className="card-header-title"><Package size={18} /> {order.purchase_order_number} outstanding items</span></div><div className="table-container"><table className="table"><thead><tr><th>Medicine</th><th>Outstanding</th><th>Receive now</th><th>Batch</th><th>Expiry</th></tr></thead><tbody>{rows.length ? rows.map(row => <tr key={row.purchase_order_item_id}><td>{row.medicine_name}</td><td>{row.outstanding}</td><td><input className="form-control" type="number" min="0" max={row.outstanding} step="1" value={row.quantity_received} onChange={e => update(row.purchase_order_item_id, { quantity_received: e.target.value })} /></td><td><input className="form-control" value={row.batch_number} onChange={e => update(row.purchase_order_item_id, { batch_number: e.target.value })} placeholder="Batch" /></td><td><input className="form-control" type="date" min={new Date().toISOString().slice(0, 10)} value={row.expiry_date} onChange={e => update(row.purchase_order_item_id, { expiry_date: e.target.value })} /></td></tr>) : <tr><td colSpan="5">This order is fully received.</td></tr>}</tbody></table></div>{rows.length > 0 && <div className="card-body"><button className="btn btn-primary" disabled={busy}><Check size={17} /> {busy ? 'Posting…' : 'Post goods receipt'}</button><p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-2)' }}>Repeated submissions use an idempotency key and cannot post the same receipt twice.</p></div>}</form>}</div></div>
}
export default GoodsReceiptsPage
