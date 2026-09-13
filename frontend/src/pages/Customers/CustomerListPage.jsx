import React, { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Search, Plus, Pencil, Eye, Users } from '../../components/common/Icons.jsx'
import { useApp } from '../../context/AppContext.jsx'

const CustomerListPage = () => {
  const { customers } = useApp()
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search) return customers
    const q = search.toLowerCase()
    return customers.filter(c => `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.phone?.includes(q))
  }, [customers, search])

  return (
    <div className="animate-fade-in">
      <div className="page-header-section">
        <div className="page-header-row">
          <div className="page-header-left">
            <div className="page-header-breadcrumb">
              <Link to="/">Home</Link><span className="sep">/</span><span>Customers</span>
            </div>
            <h1>Customers</h1>
            <p>Manage customer details for prescription processing.</p>
          </div>
          <div className="page-header-actions">
            <Link to="/prescriptions/create" className="btn btn-secondary">Create Prescription</Link>
            <Link to="/customers/add" className="btn btn-primary"><Plus size={18} /> Add Customer</Link>
          </div>
        </div>
      </div>

      <div className="content-container" style={{ paddingTop: 'var(--space-6)' }}>
        <div style={{ marginBottom: 'var(--space-5)' }}>
          <div className="search-input-wrapper" style={{ maxWidth: '500px' }}>
            <span className="search-icon"><Search size={18} /></span>
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customers by name, email, or phone..." className="form-control" />
          </div>
        </div>

        {filtered.length > 0 ? (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr><th>Customer</th><th>Phone</th><th>Email</th><th>Address</th><th style={{ textAlign: 'center' }}>Actions</th></tr>
              </thead>
              <tbody>
                {filtered.map(customer => (
                  <tr key={customer.id}>
                    <td><span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{customer.first_name} {customer.last_name}</span></td>
                    <td style={{ color: 'var(--text-secondary)' }}>{customer.phone || '-'}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{customer.email || '-'}</td>
                    <td><small style={{ color: 'var(--text-muted)' }}>{customer.address ? (customer.address.length > 35 ? customer.address.substring(0, 35) + '...' : customer.address) : '-'}</small></td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 'var(--space-1)', justifyContent: 'center' }}>
                        <Link to={`/customers/${customer.id}`} className="btn btn-ghost btn-sm" title="View Details"><Eye size={16} /></Link>
                        <Link to={`/customers/edit/${customer.id}`} className="btn btn-ghost btn-sm" title="Edit"><Pencil size={16} /></Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon"><Users size={36} /></div>
            <h3 className="empty-state-title">No customers found</h3>
            <p className="empty-state-description">{search ? 'No customers match your search.' : 'Add a customer before creating prescriptions.'}</p>
            {!search && <Link to="/customers/add" className="btn btn-primary"><Plus size={18} /> Add First Customer</Link>}
          </div>
        )}
      </div>
    </div>
  )
}

export default CustomerListPage
