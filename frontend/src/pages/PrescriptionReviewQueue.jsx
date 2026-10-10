import React, { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ClipboardCheck, Download, RefreshCw } from 'lucide-react'
import { orderService, prescriptionService } from '../services/apiService.js'
import { formatCurrency } from '../utils/currency.js'

const supportedTypes = new Set(['application/pdf', 'image/jpeg', 'image/png'])

export default function PrescriptionReviewQueue() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState([])
  const [uploads, setUploads] = useState([])
  const [selected, setSelected] = useState(null)
  const [fileUrl, setFileUrl] = useState('')
  const [fileType, setFileType] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const [orderResponse, uploadResponse] = await Promise.all([orderService.getPendingReview(), prescriptionService.getUploadReviewQueue()])
      setOrders(orderResponse.data?.orders || [])
      setUploads((uploadResponse.data?.uploads || []).filter(upload => !upload.order_id))
      setError('')
    } catch (requestError) { setError(requestError.response?.data?.message || 'Unable to load prescription requests.') }
  }, [])
  useEffect(() => { void load() }, [load])
  useEffect(() => () => { if (fileUrl) URL.revokeObjectURL(fileUrl) }, [fileUrl])

  const open = async (kind, id) => {
    setError('')
    try {
      const record = kind === 'order' ? (await orderService.getById(id)).data : uploads.find(upload => upload.prescription_id === id)
      if (!record) throw new Error('Prescription request was not found.')
      const blob = await prescriptionService.getFile(record.prescription_id)
      const type = String(blob.type || '').toLowerCase()
      if (!supportedTypes.has(type)) throw new Error('Unsupported prescription file format.')
      if (fileUrl) URL.revokeObjectURL(fileUrl)
      setFileType(type); setFileUrl(URL.createObjectURL(blob)); setSelected({ kind, ...record }); setReason('')
    } catch (requestError) { setError(requestError.response?.data?.message || requestError.message || 'Unable to open prescription request.') }
  }
  const review = async decision => {
    setBusy(true); setError('')
    try {
      if (selected.kind === 'order') await orderService.review(selected.order_id, decision === 'APPROVED' ? 'APPROVE' : 'REJECT', reason)
      else await prescriptionService.reviewUpload(selected.prescription_id, decision, reason)
      if (selected.kind === 'upload' && decision === 'APPROVED') {
        navigate('/prescriptions/create', { state: { customerId: selected.customer_id, uploadId: selected.prescription_id } })
      }
      setSelected(null); setFileType(''); if (fileUrl) URL.revokeObjectURL(fileUrl); setFileUrl(''); setReason(''); await load()
    } catch (requestError) { setError(requestError.response?.data?.message || 'Review could not be saved.') }
    finally { setBusy(false) }
  }

  return <div className="content-container workflow-page">
    <div className="workflow-heading"><div><p className="public-kicker">Pharmacist workflow</p><h1>Review prescriptions</h1><p>Customer uploads and order-linked prescriptions awaiting review.</p></div><button className="btn btn-secondary" onClick={load}><RefreshCw size={16} /> Refresh</button></div>
    {error && <p className="public-auth-error" role="alert">{error}</p>}
    <div className="workflow-grid"><section className="workflow-panel"><h2>Requests ({orders.length + uploads.length})</h2>
      {orders.map(order => <button className={`workflow-order-row ${selected?.order_id === order.order_id ? 'active' : ''}`} key={`order-${order.order_id}`} onClick={() => open('order', order.order_id)}><ClipboardCheck size={18} /><span><strong>Order #{order.order_id}</strong><small>{order.customer_name} · Upload #{order.prescription_id} · {new Date(order.prescription_uploaded_at || order.created_at).toLocaleString()}</small></span><b>Pending review</b></button>)}
      {uploads.map(upload => <button className={`workflow-order-row ${selected?.kind === 'upload' && selected.prescription_id === upload.prescription_id ? 'active' : ''}`} key={`upload-${upload.prescription_id}`} onClick={() => open('upload', upload.prescription_id)}><ClipboardCheck size={18} /><span><strong>Upload #{upload.prescription_id}</strong><small>{upload.customer_name} · {new Date(upload.uploaded_date).toLocaleString()}</small></span><b>{upload.status}</b></button>)}
      {!orders.length && !uploads.length && <div className="customer-record-empty">No prescriptions are waiting for review.</div>}
    </section>{selected && <section className="workflow-panel"><h2>{selected.kind === 'order' ? `Order #${selected.order_id}` : `Upload #${selected.prescription_id}`}</h2><p>{selected.customer_name} · {selected.status?.replaceAll('_', ' ')}</p>
      {fileUrl && fileType === 'application/pdf' && <iframe className="prescription-preview prescription-pdf-preview" src={fileUrl} title={`Prescription ${selected.prescription_id}`} />}
      {fileUrl && fileType.startsWith('image/') && <img className="prescription-preview" src={fileUrl} alt={`Prescription ${selected.prescription_id}`} />}
      {fileUrl && <a className="btn btn-secondary" href={fileUrl} download={`prescription-${selected.prescription_id}`}><Download size={16} /> Download document</a>}
      {selected.kind === 'order' ? selected.items.map(item => <div className="workflow-item" key={item.order_item_id}><div><strong>{item.product_name}</strong><small>{item.product_code} · Requested {item.quantity}</small></div><div><strong>{formatCurrency(item.current_unit_price)}</strong><small>{item.availability} · Stock {item.current_stock}</small></div></div>) : <p>Approve the document, then <Link to="/prescriptions/create" state={{ customerId: selected.customer_id, uploadId: selected.prescription_id }}>confirm medicines and quantities</Link> before billing. The uploaded image alone is never billed.</p>}
      <label className="workflow-reason">Rejection reason<textarea value={reason} onChange={event => setReason(event.target.value)} rows="3" /></label><div className="workflow-actions"><button disabled={busy} className="btn btn-primary" onClick={() => review('APPROVED')}>{selected.kind === 'order' ? 'Approve for billing' : 'Approve document'}</button><button disabled={busy || !reason.trim()} className="btn btn-danger" onClick={() => review('REJECTED')}>Reject</button></div>
    </section>}</div>
  </div>
}
