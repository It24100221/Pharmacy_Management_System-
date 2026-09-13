import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useApp } from '../../context/AppContext.jsx'
import { formatLKR } from '../../data/mockMedicines.js'
import { Package, Search, Trash2, Check, ArrowLeft } from '../../components/common/Icons.jsx'

const CreatePurchasePage = () => {
  const navigate = useNavigate()
  const { suppliers, medicines, receiveStock, showToast } = useApp()
  const [selectedSupplier, setSelectedSupplier] = useState('')
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState([])
  const [searchMedicine, setSearchMedicine] = useState('')
  const [showSuccess, setShowSuccess] = useState(false)

  const filteredMedicines = searchMedicine.length >= 2
    ? medicines.filter(m => m.name.toLowerCase().includes(searchMedicine.toLowerCase()) || m.genericName?.toLowerCase().includes(searchMedicine.toLowerCase())).slice(0, 8)
    : []

  const addItem = (medicine) => {
    const existing = items.find(i => i.medicineId === medicine.id)
    if (existing) {
      setItems(items.map(i => i.medicineId === medicine.id ? { ...i, quantity: i.quantity + 1, totalCost: (i.quantity + 1) * i.unitCost } : i))
    } else {
      setItems([...items, { medicineId: medicine.id, medicineName: medicine.name, batchNumber: medicine.batchNumber, quantity: 1, unitCost: medicine.unitPrice, totalCost: medicine.unitPrice }])
    }
    setSearchMedicine('')
  }

  const updateQuantity = (medicineId, qty) => {
    if (qty < 1) { setItems(items.filter(i => i.medicineId !== medicineId)); return }
    setItems(items.map(i => i.medicineId === medicineId ? { ...i, quantity: qty, totalCost: qty * i.unitCost } : i))
  }

  const totalAmount = items.reduce((sum, item) => sum + item.totalCost, 0)
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0)

  const handleSubmit = async () => {
    if (!selectedSupplier) { showToast('Please select a supplier', 'error'); return }
    if (items.length === 0) { showToast('Please add at least one medicine', 'error'); return }
    const purchaseData = {
      supplier_id: parseInt(selectedSupplier),
      purchase_date: purchaseDate,
      notes,
      total_amount: totalAmount,
      items: items.map(i => ({ medicine_id: i.medicineId, quantity: i.quantity, unit_cost: i.unitCost, total_cost: i.totalCost })),
    }
    const result = await receiveStock(purchaseData)
    if (result.success) {
      setShowSuccess(true)
      setTimeout(() => navigate('/medicines'), 2000)
    }
  }

  if (showSuccess) {
    return (
      <div style={{ animation: 'fadeIn 0.4s ease', textAlign: 'center', padding: 'var(--space-16)' }}>
        <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-6)', border: '2px solid var(--success)' }}>
          <Check size={40} color="var(--success)" />
        </div>
        <h2 style={{ color: 'var(--text-primary)', marginBottom: 'var(--space-3)' }}>Stock Received Successfully!</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-6)' }}>{totalQuantity} units have been added to inventory.</p>
        <button className="btn btn-primary" onClick={() => navigate('/medicines')}>View Inventory</button>
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header-section">
        <div className="page-header-row">
          <div className="page-header-left">
            <div className="page-header-breadcrumb">
              <Link to="/">Home</Link><span className="sep">/</span>
              <Link to="/suppliers">Suppliers</Link><span className="sep">/</span>
              <span>Receive Stock</span>
            </div>
            <h1>Receive Medicine Stock</h1>
            <p>Record received medicines and update inventory levels.</p>
          </div>
          <div className="page-header-actions">
            <button className="btn btn-ghost" onClick={() => navigate('/suppliers')}>
              <ArrowLeft size={18} /> Back
            </button>
          </div>
        </div>
      </div>

      <div className="content-container" style={{ paddingTop: 'var(--space-6)' }}>
        <div className="pharmacy-workflow-layout">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div className="card">
              <div className="card-header"><span className="card-header-title"><Package size={18} /> Purchase Information</span></div>
              <div className="card-body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Supplier <span className="required">*</span></label>
                    <select value={selectedSupplier} onChange={(e) => setSelectedSupplier(e.target.value)} className="form-control">
                      <option value="">-- Select Supplier --</option>
                      {suppliers.map(s => <option key={s.id} value={s.id}>{s.company_name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Purchase Date</label>
                    <input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} className="form-control" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional purchase notes..." className="form-control" rows="2" />
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header"><span className="card-header-title"><Search size={18} /> Add Medicines</span></div>
              <div className="card-body">
                <div className="search-input-wrapper">
                  <span className="search-icon"><Search size={18} /></span>
                  <input type="text" value={searchMedicine} onChange={(e) => setSearchMedicine(e.target.value)} placeholder="Search medicines by name..." className="form-control" />
                </div>
                {filteredMedicines.length > 0 && (
                  <div style={{ marginTop: 'var(--space-3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', maxHeight: '280px', overflowY: 'auto' }}>
                    {filteredMedicines.map(m => (
                      <div key={m.id} onClick={() => addItem(m)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer', transition: 'background 0.15s' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-elevated)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--font-size-sm)' }}>{m.name}</div>
                          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Stock: {m.quantity} | {m.batchNumber}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}><div style={{ fontWeight: 600, color: 'var(--primary-bright)' }}>{formatLKR(m.unitPrice)}</div></div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="pharmacy-workflow-aside">
            <div className="card">
              <div className="card-header">
                <span className="card-header-title"><Package size={18} /> Purchase Items {items.length > 0 && <span className="section-badge">{items.length}</span>}</span>
                {items.length > 0 && <button className="btn btn-ghost btn-sm" onClick={() => setItems([])}>Clear All</button>}
              </div>
              {items.length > 0 ? (
                <div>
                  <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    {items.map(item => (
                      <div key={item.medicineId} style={{ display: 'flex', alignItems: 'center', padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--border-subtle)', gap: 'var(--space-3)' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--font-size-sm)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.medicineName}</div>
                          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{item.batchNumber}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                          <div className="qty-control">
                            <button className="qty-btn" onClick={() => updateQuantity(item.medicineId, item.quantity - 1)} disabled={item.quantity <= 1}>-</button>
                            <span className="qty-value">{item.quantity}</span>
                            <button className="qty-btn" onClick={() => updateQuantity(item.medicineId, item.quantity + 1)}>+</button>
                          </div>
                          <button className="cart-item-remove" onClick={() => setItems(items.filter(i => i.medicineId !== item.medicineId))} aria-label="Remove item"><Trash2 size={16} /></button>
                        </div>
                        <div style={{ width: '90px', textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--font-size-sm)' }}>{formatLKR(item.totalCost)}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ padding: 'var(--space-4) var(--space-5)', borderTop: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)', fontSize: 'var(--font-size-sm)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Total Quantity</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{totalQuantity} units</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-4)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--border)', fontSize: 'var(--font-size-lg)' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Total Cost</span>
                      <span style={{ fontWeight: 700, color: 'var(--primary-bright)' }}>{formatLKR(totalAmount)}</span>
                    </div>
                    <button className="btn btn-primary btn-lg" style={{ width: '100%' }} onClick={handleSubmit}><Check size={18} /> Confirm & Receive Stock</button>
                    <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', textAlign: 'center', marginTop: 'var(--space-3)' }}>This will increase medicine stock levels in inventory.</p>
                  </div>
                </div>
              ) : (
                <div className="empty-state" style={{ padding: 'var(--space-8)' }}>
                  <div className="empty-state-icon" style={{ width: '60px', height: '60px' }}><Package size={28} /></div>
                  <h3 className="empty-state-title" style={{ fontSize: 'var(--font-size-base)' }}>No items added</h3>
                  <p className="empty-state-description" style={{ fontSize: 'var(--font-size-sm)' }}>Search for medicines and add them to this purchase.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CreatePurchasePage
