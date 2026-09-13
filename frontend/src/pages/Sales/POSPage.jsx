import React, { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useApp } from '../../context/AppContext.jsx'
import { formatLKR } from '../../data/mockMedicines.js'
import { Search, ShoppingCart, Trash2, Check } from '../../components/common/Icons.jsx'
import { getSaleValidationError, isMedicineSellable } from '../../utils/sales.js'

const POSPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { medicines, createSale, showToast } = useApp()
  const [searchTerm, setSearchTerm] = useState('')
  const [cart, setCart] = useState([])
  const [discount, setDiscount] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState('Cash')
  const [notes, setNotes] = useState('')
  const [prescriptionInfo, setPrescriptionInfo] = useState(null)
  const prescriptionHandoffHandled = useRef(false)

  useEffect(() => {
    const handoff = location.state
    if (handoff?.prescriptionItems && !prescriptionHandoffHandled.current) {
      prescriptionHandoffHandled.current = true
      setCart(handoff.prescriptionItems.map(item => ({
        medicineId: item.medicineId, medicineName: item.medicineName,
        batchNumber: item.batchNumber, quantity: item.quantity,
        unitPrice: item.unitPrice, lineTotal: item.lineTotal,
      })))
      if (handoff.prescriptionCustomer) setPrescriptionInfo(handoff.prescriptionCustomer)
      showToast('Items loaded from prescription', 'success')
      navigate(location.pathname, { replace: true, state: null })
    }
  }, [location.pathname, location.state, navigate, showToast])

  const searchResults = useMemo(() => {
    if (searchTerm.length < 2) return []
    const q = searchTerm.toLowerCase()
    return medicines.filter(m =>
      m.name.toLowerCase().includes(q) || m.genericName?.toLowerCase().includes(q) || m.batchNumber?.toLowerCase().includes(q)
    ).filter(isMedicineSellable).slice(0, 8)
  }, [medicines, searchTerm])

  const addToCart = (medicine) => {
    const existing = cart.find(i => i.medicineId === medicine.id)
    if (existing) {
      if (existing.quantity >= medicine.quantity) { showToast(`Only ${medicine.quantity} units available`, 'warning'); return }
      setCart(cart.map(i => i.medicineId === medicine.id ? { ...i, quantity: i.quantity + 1, lineTotal: (i.quantity + 1) * i.unitPrice } : i))
    } else {
      setCart([...cart, { medicineId: medicine.id, medicineName: medicine.name, batchNumber: medicine.batchNumber, quantity: 1, unitPrice: medicine.unitPrice, lineTotal: medicine.unitPrice }])
    }
    setSearchTerm('')
  }

  const updateQuantity = (medicineId, qty) => {
    if (qty < 1) { setCart(cart.filter(i => i.medicineId !== medicineId)); return }
    const medicine = medicines.find(m => m.id === medicineId)
    if (medicine && qty > medicine.quantity) { showToast(`Only ${medicine.quantity} units available in stock`, 'warning'); return }
    setCart(cart.map(i => i.medicineId === medicineId ? { ...i, quantity: qty, lineTotal: qty * i.unitPrice } : i))
  }

  const removeFromCart = (medicineId) => setCart(cart.filter(i => i.medicineId !== medicineId))
  const subtotal = cart.reduce((sum, i) => sum + i.lineTotal, 0)
  const discountAmount = parseFloat(discount) || 0
  const grandTotal = Math.max(0, subtotal - discountAmount)

  const handleCompleteSale = async () => {
    const validationError = getSaleValidationError(cart, discountAmount)
    if (validationError) { showToast(validationError, 'error'); return }
    const saleData = {
      customer_id: prescriptionInfo?.id || null,
      customer_name: prescriptionInfo?.name || 'Walk-in Customer',
      sale_date: new Date().toISOString(),
      items: cart.map(i => ({ medicine_id: i.medicineId, medicine_name: i.medicineName, batch_number: i.batchNumber, quantity: i.quantity, unit_price: i.unitPrice, line_total: i.lineTotal })),
      subtotal, discount: discountAmount, total: grandTotal, payment_method: paymentMethod, notes,
    }
    const result = await createSale(saleData)
    if (result.success) navigate(`/sales/receipt/${result.data.id}`)
  }

  return (
    <div className="animate-fade-in">
      {/* Minimal POS Header */}
      <div style={{ padding: 'var(--space-4) var(--space-8)', borderBottom: '1px solid var(--border)', maxWidth: 'var(--content-max-width)', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)' }}>New Sale</h1>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>Search medicines and complete customer sales.</p>
          </div>
          {cart.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-4)', background: 'var(--primary-subtle)', borderRadius: 'var(--radius-full)', fontSize: 'var(--font-size-sm)', color: 'var(--primary-bright)', fontWeight: 'var(--font-weight-bold)' }}>
              <ShoppingCart size={16} /> {cart.length} item{cart.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>

      <div className="content-container" style={{ paddingTop: 'var(--space-5)' }}>
        {prescriptionInfo && (
          <div className="alert alert-info" style={{ marginBottom: 'var(--space-4)' }}>
            <Check size={20} />
            <div><strong>Items loaded from prescription</strong> for {prescriptionInfo.name || 'Customer'}</div>
          </div>
        )}

        <div className="pos-layout">
          <div className="pos-left">
            {/* Search */}
            <div className="pos-search-card">
              <div className="pos-search-header">
                <div className="pos-search-title"><Search size={16} /> Search Medicines</div>
                <div className="search-input-wrapper" style={{ flex: 1, maxWidth: '400px' }}>
                  <span className="search-icon"><Search size={18} /></span>
                  <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by name, generic name, or batch..." className="form-control" autoFocus />
                </div>
              </div>
              <div className="pos-search-results">
                {searchResults.length > 0 ? (
                  searchResults.map(m => (
                    <div key={m.id} className="pos-search-item" onClick={() => addToCart(m)}>
                      <div className="pos-search-item-info">
                        <div className="pos-search-item-name">{m.name}</div>
                        <div className="pos-search-item-generic">{m.genericName}</div>
                        <div className="pos-search-item-meta">Stock: {m.quantity} | {m.batchNumber}</div>
                      </div>
                      <div className="pos-search-item-price">
                        <span className="price">{formatLKR(m.unitPrice)}</span>
                        <span className="unit">per unit</span>
                      </div>
                    </div>
                  ))
                ) : searchTerm.length >= 2 ? (
                  <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>No medicines found</div>
                ) : (
                  <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>Type to search medicines...</div>
                )}
              </div>
            </div>

            {/* Cart */}
            <div className="cart-card">
              <div className="cart-header">
                <span className="cart-title"><ShoppingCart size={18} /> Cart {cart.length > 0 && <span className="section-badge">{cart.length}</span>}</span>
                {cart.length > 0 && <button className="btn btn-ghost btn-sm" onClick={() => { setCart([]); setPrescriptionInfo(null); }}>Clear</button>}
              </div>
              {cart.length > 0 ? (
                <div className="cart-items">
                  {cart.map(item => (
                    <div key={item.medicineId} className="cart-item">
                      <div className="cart-item-info">
                        <div className="cart-item-name">{item.medicineName}</div>
                        <div className="cart-item-meta">{item.batchNumber} | {formatLKR(item.unitPrice)}/unit</div>
                      </div>
                      <div className="cart-item-controls">
                        <div className="qty-control">
                          <button className="qty-btn" onClick={() => updateQuantity(item.medicineId, item.quantity - 1)} disabled={item.quantity <= 1}>-</button>
                          <span className="qty-value">{item.quantity}</span>
                          <button className="qty-btn" onClick={() => updateQuantity(item.medicineId, item.quantity + 1)}>+</button>
                        </div>
                        <div className="cart-item-total">{formatLKR(item.lineTotal)}</div>
                        <button className="cart-item-remove" onClick={() => removeFromCart(item.medicineId)} aria-label="Remove item"><Trash2 size={16} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
                  <ShoppingCart size={32} style={{ margin: '0 auto var(--space-3)', opacity: 0.3 }} />
                  <p>No medicines added to this sale.</p>
                  <p>Search for medicines and add them to the cart.</p>
                </div>
              )}
            </div>
          </div>

          <div className="pos-right">
            <div className="billing-card">
              <div className="billing-header">
                <span className="billing-title"><Check size={18} /> Billing Summary</span>
              </div>
              <div className="billing-body">
                <div className="billing-row"><span className="billing-row-label">Items</span><span className="billing-row-value">{cart.reduce((sum, i) => sum + i.quantity, 0)} units</span></div>
                <div className="billing-row"><span className="billing-row-label">Subtotal</span><span className="billing-row-value">{formatLKR(subtotal)}</span></div>
                <div className="billing-divider" />
                <div className="form-group">
                  <label className="form-label">Discount (LKR)</label>
                  <input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} min="0" step="0.01" placeholder="0.00" className="form-control" />
                </div>
                <div className="billing-row-total">
                  <span className="billing-row-label">Grand Total</span>
                  <span className="billing-row-value">{formatLKR(grandTotal)}</span>
                </div>
                <div className="form-group" style={{ marginTop: 'var(--space-4)' }}>
                  <label className="form-label">Payment Method</label>
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="form-control">
                    <option value="Cash">Cash</option>
                    <option value="Card">Card</option>
                    <option value="Online">Bank Transfer / Online</option>
                  </select>
                </div>
                <div className="billing-actions">
                  <button className="btn btn-primary btn-xl" style={{ width: '100%' }} onClick={handleCompleteSale} disabled={cart.length === 0}>
                    <Check size={20} /> Complete Sale
                  </button>
                </div>
                <div className="billing-note">Stock will be reduced after sale completion.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default POSPage
