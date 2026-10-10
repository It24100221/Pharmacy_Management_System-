import React, { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Package } from '../../components/common/Icons.jsx'
import { purchaseOrderService } from '../../services/apiService.js'
import { useApp } from '../../context/AppContext.jsx'

const PurchaseOrderDetailsPage = () => {
  const { id } = useParams(); const { showToast } = useApp(); const [order, setOrder] = useState(null)
  useEffect(() => { purchaseOrderService.getById(id).then(result => setOrder(result.data)).catch(error => showToast(error.response?.data?.message || 'Unable to load order', 'error')) }, [id])
  if (!order) return <div className="content-container" style={{ paddingTop: 'var(--space-8)' }}>Loading purchase order…</div>
  return <div className="animate-fade-in"><div className="page-header-section"><div className="page-header-row"><div className="page-header-left"><div className="page-header-breadcrumb"><Link to="/purchase-orders">Purchase orders</Link><span className="sep">/</span><span>{order.purchase_order_number}</span></div><h1>{order.purchase_order_number}</h1><p>{order.supplier_name} · {order.status}</p></div><div className="page-header-actions"><Link to="/purchase-orders" className="btn btn-ghost"><ArrowLeft size={17} /> Back</Link></div></div></div><div className="content-container" style={{ paddingTop: 'var(--space-6)' }}><div className="card"><div className="card-header"><span className="card-header-title"><Package size={18} /> Ordered medicines</span></div><div className="table-container"><table className="table"><thead><tr><th>Medicine</th><th>Ordered</th><th>Received</th><th>Outstanding</th><th>Unit cost</th></tr></thead><tbody>{order.items?.map(item => <tr key={item.purchase_order_item_id}><td>{item.medicine_name}</td><td>{item.ordered_quantity}</td><td>{item.received_quantity}</td><td>{Number(item.ordered_quantity) - Number(item.received_quantity)}</td><td>{item.unit_cost}</td></tr>)}</tbody></table></div></div></div></div>
}
export default PurchaseOrderDetailsPage
