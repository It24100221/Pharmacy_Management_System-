import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, PackageCheck } from 'lucide-react'
import CustomerNavbar from '../components/CustomerNavbar.jsx'
import { orderService } from '../services/apiService.js'
import { formatCurrency as formatLKR } from '../utils/currency.js'

export default function MyOrders() {
  const [orders, setOrders] = useState([]); const [error, setError] = useState(''); const [loading, setLoading] = useState(true)
  useEffect(() => { orderService.getMine().then(response => setOrders(response.data?.orders || [])).catch(requestError => setError(requestError.response?.data?.message || 'Unable to load orders.')).finally(() => setLoading(false)) }, [])
  return <div className="customer-workspace"><CustomerNavbar /><main className="customer-form-page"><Link className="customer-back-link" to="/customer/dashboard"><ArrowLeft size={16} /> Back to dashboard</Link><div className="customer-form-heading"><p className="public-kicker">Order tracking</p><h1>My orders</h1><p>Follow prescription review, billing, and completion from one durable history.</p></div>{loading && <div className="customer-record-empty">Loading orders...</div>}{error && <p className="public-auth-error">{error}</p>}<div className="customer-prescription-list">{orders.map(order => <article key={order.order_id}><span className="customer-prescription-icon"><PackageCheck size={20} /></span><div><Link to={`/orders/${order.order_id}`}><strong>Order #{order.order_id}</strong></Link><p>{formatLKR(order.subtotal)} · {new Date(order.created_at).toLocaleString()}</p></div><b className={`prescription-status status-${order.status.toLowerCase().replaceAll('_', '-')}`}>{order.status.replaceAll('_', ' ')}</b></article>)}{!loading && !error && !orders.length && <div className="customer-record-empty">No orders yet. <Link to="/pharmacy-items">Browse products</Link></div>}</div></main></div>
}
