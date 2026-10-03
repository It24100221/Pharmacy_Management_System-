import React, { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Upload } from 'lucide-react'
import CustomerNavbar from '../components/CustomerNavbar.jsx'
import { orderService } from '../services/apiService.js'
import { formatCurrency as formatLKR } from '../utils/currency.js'

export default function OrderDetails() {
  const { id } = useParams(); const [order, setOrder] = useState(null); const [error, setError] = useState('')
  useEffect(() => { orderService.getById(id).then(response => setOrder(response.data)).catch(requestError => setError(requestError.response?.data?.message || 'Unable to load order.')) }, [id])
  return <div className="customer-workspace"><CustomerNavbar /><main className="customer-form-page"><Link className="customer-back-link" to="/my-orders"><ArrowLeft size={16} /> My orders</Link>{error && <p className="public-auth-error">{error}</p>}{order && <><div className="customer-form-heading"><p className="public-kicker">Order #{order.order_id}</p><h1>{order.status.replaceAll('_', ' ')}</h1><p>Created {new Date(order.created_at).toLocaleString()}</p></div><section className="workflow-panel">{order.items.map(item => <div className="workflow-item" key={item.order_item_id}><div><strong>{item.product_name}</strong><small>{item.product_code} · Quantity {item.quantity}</small></div><strong>{formatLKR(item.line_total)}</strong></div>)}<div className="workflow-total"><span>Order total</span><strong>{formatLKR(order.subtotal)}</strong></div>{order.rejection_reason && <p className="public-auth-error">Reason: {order.rejection_reason}</p>}{order.status === 'PRESCRIPTION_REQUIRED' && <Link className="customer-primary-action" to={`/upload-prescription?orderId=${order.order_id}`}><Upload size={16} /> Upload prescription</Link>}{order.sale_id && <p>Sale receipt: <strong>REC-{String(order.sale_id).padStart(6, '0')}</strong></p>}</section></>}</main></div>
}
