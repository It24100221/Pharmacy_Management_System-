import React from 'react'
import { Link } from 'react-router-dom'
import { History, PackageCheck, Truck, UserRound } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import StaffNavbar from '../components/StaffNavbar.jsx'

const supplierCards = [
	['Supplier Profile', 'View and update your supplier details.', UserRound, '/suppliers'],
	['Supplier Directory', 'Review the current supplier directory.', Truck, '/suppliers'],
	['Contact Records', 'Review available supplier contact information.', History, '/suppliers'],
	['Authorized Access', 'Use the read-only supplier workspace.', PackageCheck, '/suppliers'],
]

const SupplierDashboard = () => {
	const { suppliers } = useApp()
	const { session } = useAuth()
	return <div className="staff-workspace"><StaffNavbar /><main className="role-dashboard"><section className="role-heading"><div><p className="public-kicker">SUPPLIER WORKSPACE</p><h1>Senevirathna Pharmacy Supplier Dashboard</h1><p>Welcome back, {session?.name || session?.username}. Review the supplier information available to your role.</p></div><span className="role-pill">SUPPLIER</span></section><section className="role-card-grid supplier-card-grid">{supplierCards.map(([title, description, Icon, path]) => <Link to={path} key={title}><span><Icon size={19} /></span><h2>{title}</h2><small>{description}</small></Link>)}</section><section className="role-security"><PackageCheck size={20} /><div><strong>{suppliers.length} supplier records available</strong><p>Inventory mutations and purchase receiving remain restricted to inventory staff.</p></div></section></main></div>
}

export default SupplierDashboard
