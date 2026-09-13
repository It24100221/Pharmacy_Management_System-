import React, { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Search, Plus, Pencil, AlertTriangle, AlertCircle, CheckCircle, Pill } from '../../components/common/Icons.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { formatLKR } from '../../data/mockMedicines.js'

const MedicineListPage = () => {
  const { medicines } = useApp()
  const [search, setSearch] = useState('')
  const [stockStatus, setStockStatus] = useState('')
  const [expiryStatus, setExpiryStatus] = useState('')

  const filteredMedicines = useMemo(() => {
    return medicines.filter((m) => {
      if (search) {
        const q = search.toLowerCase()
        if (
          !m.name.toLowerCase().includes(q) &&
          !m.genericName.toLowerCase().includes(q) &&
          !m.category.toLowerCase().includes(q) &&
          !m.batchNumber.toLowerCase().includes(q)
        ) return false
      }
      if (stockStatus && m.stockStatus !== stockStatus) return false
      if (expiryStatus && m.expiryStatus !== expiryStatus) return false
      return true
    })
  }, [medicines, search, stockStatus, expiryStatus])

  const renderStockBadge = (status) => {
    switch (status) {
      case 'in_stock': return <span className="badge badge-in-stock"><CheckCircle size={12} /> IN STOCK</span>
      case 'low_stock': return <span className="badge badge-low-stock"><AlertTriangle size={12} /> LOW STOCK</span>
      case 'out_of_stock': return <span className="badge badge-out-of-stock"><AlertCircle size={12} /> OUT OF STOCK</span>
      default: return <span className="badge badge-neutral">UNKNOWN</span>
    }
  }

  const renderExpiryBadge = (status, expiryDate) => {
    const daysLeft = Math.ceil((new Date(expiryDate) - new Date()) / (1000 * 60 * 60 * 24))
    switch (status) {
      case 'valid': return <span className="badge badge-valid"><CheckCircle size={12} /> VALID</span>
      case 'near_expiry': return <span className="badge badge-near-expiry"><AlertTriangle size={12} /> {daysLeft}d left</span>
      case 'expired': return <span className="badge badge-expired"><AlertCircle size={12} /> EXPIRED</span>
      default: return <span className="badge badge-neutral">UNKNOWN</span>
    }
  }

  return (
    <div className="animate-fade-in">
      {/* COMPACT PAGE HEADER */}
      <div className="page-header-section">
        <div className="page-header-row">
          <div className="page-header-left">
            <div className="page-header-breadcrumb">
              <Link to="/">Home</Link><span className="sep">/</span><span>Inventory</span>
            </div>
            <h1>Medicine & Inventory</h1>
            <p>Manage medicine details, current stock and expiry status.</p>
          </div>
          <div className="page-header-actions">
            <Link to="/medicines/add" className="btn btn-primary">
              <Plus size={18} /> Add Medicine
            </Link>
          </div>
        </div>
      </div>

      <div className="content-container" style={{ paddingTop: 'var(--space-6)' }}>
        {/* SUMMARY ROW */}
        <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-5)', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
            <Pill size={16} style={{ color: 'var(--primary-bright)' }} />
            <span><strong style={{ color: 'var(--text-primary)' }}>{medicines.length}</strong> Total</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
            <AlertTriangle size={16} style={{ color: 'var(--warning)' }} />
            <span><strong style={{ color: 'var(--warning)' }}>{medicines.filter(m => m.stockStatus === 'low_stock').length}</strong> Low Stock</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
            <AlertCircle size={16} style={{ color: 'var(--danger)' }} />
            <span><strong style={{ color: 'var(--danger)' }}>{medicines.filter(m => m.stockStatus === 'out_of_stock').length}</strong> Out of Stock</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
            <AlertTriangle size={16} style={{ color: 'var(--warning)' }} />
            <span><strong style={{ color: 'var(--warning)' }}>{medicines.filter(m => m.expiryStatus === 'near_expiry' || m.expiryStatus === 'expired').length}</strong> Near Expiry</span>
          </div>
        </div>

        {/* Search and Filters */}
        <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-5)', flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="search-input-wrapper" style={{ flex: 1, minWidth: '200px' }}>
            <span className="search-icon"><Search size={18} /></span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, generic name, category, or batch..."
              className="form-control"
            />
          </div>
          <select value={stockStatus} onChange={(e) => setStockStatus(e.target.value)}
            className="form-control" style={{ width: 'auto', minWidth: '150px' }}>
            <option value="">All Stock Status</option>
            <option value="in_stock">In Stock</option>
            <option value="low_stock">Low Stock</option>
            <option value="out_of_stock">Out of Stock</option>
          </select>
          <select value={expiryStatus} onChange={(e) => setExpiryStatus(e.target.value)}
            className="form-control" style={{ width: 'auto', minWidth: '150px' }}>
            <option value="">All Expiry Status</option>
            <option value="valid">Valid</option>
            <option value="near_expiry">Near Expiry</option>
            <option value="expired">Expired</option>
          </select>
        </div>

        {/* Medicine Table */}
        {filteredMedicines.length > 0 ? (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Medicine</th>
                  <th>Generic Name</th>
                  <th>Category</th>
                  <th>Batch</th>
                  <th style={{ textAlign: 'right' }}>Unit Price</th>
                  <th style={{ textAlign: 'center' }}>Stock</th>
                  <th style={{ textAlign: 'center' }}>Reorder</th>
                  <th>Expiry</th>
                  <th style={{ textAlign: 'center' }}>Stock Status</th>
                  <th style={{ textAlign: 'center' }}>Expiry Status</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMedicines.map((medicine) => (
                  <tr key={medicine.id}>
                    <td><span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{medicine.name}</span></td>
                    <td style={{ color: 'var(--text-secondary)' }}>{medicine.genericName}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{medicine.category}</td>
                    <td>
                      <code style={{
                        background: 'var(--surface-elevated)', padding: '2px 8px',
                        borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-xs)',
                        color: 'var(--text-secondary)', border: '1px solid var(--border)'
                      }}>{medicine.batchNumber}</code>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {formatLKR(medicine.unitPrice)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{
                        fontWeight: 700,
                        color: medicine.quantity === 0 ? 'var(--danger)' :
                               medicine.stockStatus === 'low_stock' ? 'var(--warning)' : 'var(--text-primary)'
                      }}>
                        {medicine.quantity}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{medicine.minStockLevel}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{medicine.expiryDate}</td>
                    <td style={{ textAlign: 'center' }}>{renderStockBadge(medicine.stockStatus)}</td>
                    <td style={{ textAlign: 'center' }}>{renderExpiryBadge(medicine.expiryStatus, medicine.expiryDate)}</td>
                    <td style={{ textAlign: 'center' }}>
                      <Link to={`/medicines/edit/${medicine.id}`} className="btn btn-ghost btn-sm" title="Edit Medicine">
                        <Pencil size={16} /> Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon"><Pill size={36} /></div>
            <h3 className="empty-state-title">No medicines found</h3>
            <p className="empty-state-description">
              {search || stockStatus || expiryStatus
                ? 'No medicines match your filters. Try adjusting your search criteria.'
                : 'No medicines have been added yet. Add your first medicine to get started.'}
            </p>
            {!search && !stockStatus && !expiryStatus && (
              <Link to="/medicines/add" className="btn btn-primary">
                <Plus size={18} /> Add First Medicine
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default MedicineListPage
