import React from 'react'
import CatalogueProductImage from './CatalogueProductImage.jsx'

const day = value => value ? String(value).slice(0, 10) : 'Not specified'
export default function SupplyRequestDetails({ request }) {
  return <section className="supply-request-details">
    <div className="supply-request-photo"><CatalogueProductImage key={request.image_url || 'missing'} product={{ name: request.medicine_name, image: request.image_url, imageAlt: request.image_alt_text }} /></div>
    <div><h3>{request.medicine_name}</h3><dl className="supply-detail-grid">
      <div><dt>Request</dt><dd>{request.request_number}</dd></div>
      <div><dt>Medicine code</dt><dd>{request.product_code || request.medicine_number}</dd></div>
      <div><dt>Supplier</dt><dd>{request.supplier_name || 'Unassigned'}</dd></div>
      <div><dt>Current available stock</dt><dd>{request.available_quantity}</dd></div>
      <div><dt>Minimum stock</dt><dd>{request.min_stock_level}</dd></div>
      <div><dt>Requested quantity</dt><dd>{request.requested_quantity}</dd></div>
      <div><dt>Created</dt><dd>{day(request.created_at)}</dd></div>
      <div><dt>Requested delivery</dt><dd>{day(request.requested_delivery_date)}</dd></div>
      <div><dt>Priority</dt><dd>{request.priority}</dd></div>
      <div><dt>Request status</dt><dd>{request.status === 'OPEN' && !request.response_status ? 'Pending Supplier Confirmation' : request.status}</dd></div>
      <div><dt>Supplier response</dt><dd>{request.response_status || 'Awaiting response'}</dd></div>
      <div><dt>Purchase order</dt><dd>{request.purchase_order_number ? `${request.purchase_order_number} · ${request.purchase_order_status}` : 'Not yet ordered'}</dd></div>
      {request.response_status && <><div><dt>Supplier available quantity</dt><dd>{request.supplier_available_quantity}</dd></div><div><dt>Estimated delivery</dt><dd>{day(request.estimated_delivery_date)}</dd></div><div><dt>Quoted unit price</dt><dd>{request.unit_purchase_price ?? 'Not quoted'}</dd></div><div><dt>Approval</dt><dd>{request.approval_status}</dd></div></>}
    </dl>{request.notes && <p>{request.notes}</p>}{request.supplier_message && <p><strong>Supplier message:</strong> {request.supplier_message}</p>}</div>
  </section>
}
