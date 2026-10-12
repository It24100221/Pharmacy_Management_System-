import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { billingService } from '../../services/apiService.js'
import { formatCurrency } from '../../utils/currency.js'

export default function InvoiceHistoryPage() {
  const [invoices, setInvoices] = useState([]); const [error, setError] = useState('')
  const load = () => billingService.getInvoices().then(response => setInvoices(response.data?.invoices || [])).catch(requestError => setError(requestError.response?.data?.message || 'Unable to load invoice history.'))
  useEffect(() => { load() }, [])
  return <div className="content-container workflow-page"><div className="workflow-heading"><div><p className="public-kicker">Sales & billing</p><h1>Invoice history</h1><p>Customer invoices, paid amounts, balances, and receipts.</p></div><button className="btn btn-secondary" onClick={load}><RefreshCw size={16} /> Refresh</button></div>{error && <p className="public-auth-error">{error}</p>}<div className="workflow-panel table-container"><table className="table"><thead><tr><th>Invoice</th><th>Sale</th><th>Customer</th><th>Total</th><th>Paid</th><th>Outstanding</th><th>Status</th><th>Receipt</th></tr></thead><tbody>{invoices.map(invoice => <tr key={invoice.customer_invoice_id}><td>#{invoice.customer_invoice_id}</td><td>#{invoice.sale_id}</td><td>{invoice.customer_name || 'Walk-in Customer'}</td><td>{formatCurrency(invoice.total_amount)}</td><td>{formatCurrency(invoice.paid_amount)}</td><td>{formatCurrency(invoice.outstanding_amount)}</td><td>{invoice.status}</td><td><Link className="btn btn-ghost btn-sm" to={`/sales/receipt/${invoice.sale_id}`}>View receipt</Link></td></tr>)}</tbody></table>{!invoices.length && <p className="customer-record-empty">No invoices found.</p>}</div></div>
}
