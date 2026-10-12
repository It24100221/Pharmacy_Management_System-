import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3, ClipboardCheck, FileText, Package, ShieldCheck, ShoppingCart, Truck, Users } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { formatLKR } from '../data/mockMedicines.js'
import StaffNavbar from '../components/StaffNavbar.jsx'
import InventorySupplyPanel from '../components/InventorySupplyPanel.jsx'
import { orderService, prescriptionService } from '../services/apiService.js'

const configs = {
  ADMIN: {
    title: 'Admin dashboard',
    intro: 'Oversee implemented pharmacy operations and access controls.',
    cards: [['Inventory', 'Medicine records', Package, '/medicines'], ['Sales', 'Billing workspace', ShoppingCart, '/sales'], ['Prescriptions', 'Customer care', ClipboardCheck, '/prescriptions/create']],
    actions: [
      ['Open inventory', '/medicines'],
      ['Open sales', '/sales'],
      ['Open prescriptions', '/prescriptions/create'],
      ['Supplier management', '/suppliers'],
      ['Purchasing management', '/supplier-purchasing'],
    ],
  },
  INVENTORY: { title: 'Inventory management', intro: 'Keep medicine details, stock, categories, and expiry dates under control.', cards: [['Medicines', 'Catalogue items', Package, '/medicines'], ['Low stock', 'Restock alerts', BarChart3, '/medicines/low-stock'], ['Expiry dates', 'Items to review', FileText, '/medicines/expiry']], actions: [['Add medicine', '/medicines/add'], ['Update stock', '/purchases'], ['Manage categories', '/medicines']] },
  SALES: { title: 'Sales and billing', intro: 'Turn customer orders into accurate bills, payments, and invoices.', cards: [['Orders', 'Ready for billing', ShoppingCart, '/billing-orders'], ['Sales history', 'Completed records', BarChart3, '/sales-history'], ['Invoices', 'Receipts and bills', FileText, '/invoice-history']] },
  PHARMACIST: { title: 'Prescription handling', intro: 'Verify prescriptions and support customer care.', cards: [['Requests', 'Pending prescription orders', ClipboardCheck, '/prescription-orders'], ['Customer care', 'Customer records', Users, '/customers']], actions: [['Review prescriptions', '/prescription-orders'], ['Open customers', '/customers']] },
  SUPPLIER: { title: 'Supplier management', intro: 'Review supplier records and replenishment requests available to your role.', cards: [['Suppliers', 'Current partners', Truck, '/suppliers'], ['Supplier directory', 'Contact records', FileText, '/suppliers'], ['Request history', 'Replenishment activity', Package, '/supplier-dashboard']] },
}

export default function RoleDashboard({ role }) {
  const { medicines, suppliers, customers, sales } = useApp(); const { session } = useAuth(); const config = configs[role]; const [requestCount, setRequestCount] = useState(0)
  useEffect(() => { if (role !== 'PHARMACIST') return undefined; let active = true; Promise.all([orderService.getPendingReview(), prescriptionService.getUploadReviewQueue()]).then(([orders, uploads]) => { if (active) setRequestCount((orders.data?.orders || []).length + (uploads.data?.uploads || []).filter(upload => !upload.order_id).length) }).catch(() => {}); return () => { active = false } }, [role])
  const values = role === 'INVENTORY' ? [medicines.length, medicines.filter(m => m.stockStatus !== 'in_stock').length, medicines.filter(m => m.expiryStatus !== 'valid').length] : role === 'SUPPLIER' ? [suppliers.length, suppliers.length, 'Read only'] : role === 'SALES' ? [customers.length, sales.length, formatLKR(sales.reduce((sum, sale) => sum + Number(sale.total || sale.finalAmount || 0), 0))] : role === 'PHARMACIST' ? [requestCount, customers.length] : [medicines.length, sales.length, 'Protected']
  return <div className="staff-workspace"><StaffNavbar /><main className="role-dashboard"><section className="role-heading"><div><p className="public-kicker">{role} workspace</p><div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-4)', alignItems: 'center', flexWrap: 'wrap' }}><h1>{config.title}</h1>{role === 'SALES' && <Link className="btn btn-primary" to="/sales">+ New Sale</Link>}</div><p>Welcome back, {session?.name || session?.username}. {config.intro}</p></div><span className="role-pill">{role}</span></section><section className="role-card-grid">{config.cards.map(([label, description, Icon, path], index) => <Link to={path} key={label}><span><Icon size={19} /></span><strong>{values[index]}</strong><h2>{label}</h2><small>{description}</small></Link>)}</section>{config.actions && <section className="role-actions"><div><p className="public-kicker">Quick actions</p><h2>Keep the day moving</h2></div><div>{config.actions.map(([label, path], index) => <Link to={path} key={label}><b>0{index + 1}</b>{label}<span>↗</span></Link>)}</div></section>}{role === 'INVENTORY' && <InventorySupplyPanel />}<section className="role-security"><ShieldCheck size={20} /><div><strong>Protected staff workspace</strong><p>Your role controls which operational tools and records are available.</p></div></section></main></div>
}
