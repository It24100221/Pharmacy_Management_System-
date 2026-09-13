import React, { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Search, Plus, Pencil, Building2, Package, ArrowRight } from '../../components/common/Icons.jsx'
import { useApp } from '../../context/AppContext.jsx'

const SupplierListPage = () => {
  const { suppliers } = useApp()
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search) return suppliers
    const q = search.toLowerCase()
    return suppliers.filter(s =>
      s.company_name.toLowerCase().includes(q) || s.contact_person?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q)
    )
  }, [suppliers, search])

  return (
    <div className="animate-fade-in">
      <div className="page-header-section">
        <div className="page-header-row">
          <div className="page-header-left">
            <div className="page-header-breadcrumb">
              <Link to="/">Home</Link><span className="sep">/</span><span>Suppliers</span>
            </div>
            <h1>Suppliers</h1>
            <p>Manage medicine supplier information and contacts.</p>
          </div>
          <div className="page-header-actions">
            <Link to="/purchases" className="btn btn-secondary">
              <Package size={18} /> Receive Stock <ArrowRight size={16} />
            </Link>
            <Link to="/suppliers/add" className="btn btn-primary">
              <Plus size={18} /> Add Supplier
            </Link>
          </div>
        </div>
      </div>

      <div className="content-container" style={{ paddingTop: 'var(--space-6)' }}>
        <div style={{ marginBottom: 'var(--space-5)' }}>
          <div className="search-input-wrapper" style={{ maxWidth: '500px' }}>
            <span className="search-icon"><Search size={18} /></span>
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search suppliers by name, contact person, or email..." className="form-control" />
          </div>
        </div>

        {filtered.length > 0 ? (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th>Contact Person</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Address</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(supplier => (
                  <tr key={supplier.id}>
                    <td><span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{supplier.company_name}</span></td>
                    <td style={{ color: 'var(--text-secondary)' }}>{supplier.contact_person || '-'}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{supplier.phone || '-'}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{supplier.email || '-'}</td>
                    <td><small style={{ color: 'var(--text-muted)' }}>{supplier.address ? (supplier.address.length > 40 ? supplier.address.substring(0, 40) + '...' : supplier.address) : '-'}</small></td>
                    <td style={{ textAlign: 'center' }}>
                      <Link to={`/suppliers/edit/${supplier.id}`} className="btn btn-ghost btn-sm"><Pencil size={16} /> Edit</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon"><Building2 size={36} /></div>
            <h3 className="empty-state-title">No suppliers found</h3>
            <p className="empty-state-description">{search ? 'No suppliers match your search.' : 'Add a supplier before recording a medicine purchase.'}</p>
            {!search && <Link to="/suppliers/add" className="btn btn-primary"><Plus size={18} /> Add First Supplier</Link>}
          </div>
        )}
      </div>
    </div>
  )
}

export default SupplierListPage
