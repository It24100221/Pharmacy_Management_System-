import React from 'react'
import { Link } from 'react-router-dom'
import { ClipboardList, History, PackageCheck, Truck, UserRound } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import StaffNavbar from '../components/StaffNavbar.jsx'

const supplierCards = [
	['Supplier Profile', 'View and update your supplier details.', UserRound, '/suppliers'],
	['Medicine Supply Management', 'Review supplied medicines and update supply information.', Truck, '/medicines'],
	['Purchase Orders', 'View pharmacy requests and update order status.', ClipboardList, '/purchases'],
	['Supply History', 'Review previous supplies, quantities, and dates.', History, '/purchases'],
	['Inventory Connection', 'Confirm deliveries and increase pharmacy inventory.', PackageCheck, '/purchases'],
]

const SupplierDashboard = () => {
	const { suppliers, medicines } = useApp()
	const { session } = useAuth()
	return <div className="staff-workspace"><StaffNavbar /><main className="role-dashboard"><section className="role-heading"><div><p className="public-kicker">SUPPLIER WORKSPACE</p><h1>Senevirathna Pharmacy Supplier Dashboard</h1><p>Welcome back, {session?.name || session?.username}. Coordinate supplies and keep deliveries connected to inventory.</p></div><span className="role-pill">SUPPLIER</span></section><section className="role-card-grid supplier-card-grid">{supplierCards.map(([title, description, Icon, path]) => <Link to={path} key={title}><span><Icon size={19} /></span><h2>{title}</h2><small>{description}</small></Link>)}</section><section className="role-actions"><div><p className="public-kicker">Inventory connection</p><h2>Confirm a delivery</h2><p className="supplier-action-copy">Record a received purchase to increase medicine quantities in the existing inventory workflow.</p></div><Link className="supplier-delivery-action" to="/purchases">Open receiving workflow <span>↗</span></Link></section><section className="role-security"><PackageCheck size={20} /><div><strong>{suppliers.length} supplier records · {medicines.length} medicines connected</strong><p>Purchase records and confirmed deliveries remain connected to the pharmacy inventory.</p></div></section></main></div>
}

export default SupplierDashboard
