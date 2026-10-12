import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { salesService } from '../../services/apiService.js'
import { formatCurrency } from '../../utils/currency.js'

export default function SalesHistoryPage() {
  const [sales, setSales] = useState([]); const [error, setError] = useState('')
  const load = () => salesService.getAll({ pagination: 'false' }).then(response => setSales(response.data?.sales || [])).catch(requestError => setError(requestError.response?.data?.message || 'Unable to load sales history.'))
  useEffect(() => { load() }, [])
  return <div className="content-container workflow-page"><div className="workflow-heading"><div><p className="public-kicker">Sales & billing</p><h1>Sales history</h1><p>Completed sales retrieved from SQL Server.</p></div><button className="btn btn-secondary" onClick={load}><RefreshCw size={16} /> Refresh</button></div>{error && <p className="public-auth-error">{error}</p>}<div className="workflow-panel table-container"><table className="table"><thead><tr><th>Sale</th><th>Date</th><th>Customer</th><th>Total</th><th>Payment</th><th>Status</th><th>Actions</th></tr></thead><tbody>{sales.map(sale => <tr key={sale.id}><td>#{sale.id}</td><td>{new Date(sale.sale_date || sale.created_at).toLocaleString()}</td><td>{sale.customer_name || 'Walk-in Customer'}</td><td>{formatCurrency(sale.final_amount || sale.total_amount || sale.total)}</td><td>{sale.payment_method}</td><td>{sale.payment_status || sale.status || 'COMPLETED'}</td><td><Link className="btn btn-ghost btn-sm" to={`/sales/receipt/${sale.id}`}>Receipt</Link></td></tr>)}</tbody></table>{!sales.length && <p className="customer-record-empty">No completed sales found.</p>}</div></div>
}
