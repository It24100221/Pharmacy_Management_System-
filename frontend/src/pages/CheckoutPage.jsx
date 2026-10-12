import ProductThumbnail from '../components/ProductThumbnail.jsx'
import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, FileCheck2, ShoppingCart, Trash2 } from 'lucide-react'
import CustomerNavbar from '../components/CustomerNavbar.jsx'
import { useCart } from '../context/CartContext.jsx'
import { formatCurrency as formatLKR } from '../utils/currency.js'

export default function CheckoutPage() {
  const { cart, total, loading, error, updateQuantity, removeItem, checkout } = useCart()
  const [checkoutError, setCheckoutError] = useState('')
  const navigate = useNavigate()
  const placeOrder = async () => {
    setCheckoutError('')
    try {
      const order = await checkout()
      navigate(order.status === 'PRESCRIPTION_REQUIRED' ? `/upload-prescription?orderId=${order.order_id}` : `/orders/${order.order_id}`)
    } catch (requestError) { setCheckoutError(requestError.response?.data?.message || 'Unable to create order.') }
  }
  return <div className="customer-workspace"><CustomerNavbar /><div className="customer-checkout-top"><Link to="/pharmacy-items"><ArrowLeft size={15} /> Continue shopping</Link><h1>Your cart</h1></div><main className="customer-checkout"><section className="checkout-items"><div className="checkout-section-head"><div><p className="public-kicker">Database-backed cart</p><h2>{cart.length} product{cart.length === 1 ? '' : 's'}</h2></div><ShoppingCart size={22} /></div>{!cart.length && <div className="customer-record-empty">Your cart is empty. <Link to="/pharmacy-items">Browse products</Link></div>}{cart.map(item => <article className="checkout-item" key={item.product_id}><div><ProductThumbnail productCode={item.product_code} name={item.product_name} /><strong>{item.product_name}</strong><small>{item.product_code} · {formatLKR(item.unit_price)} each{item.prescription_required ? ' · Prescription required' : ''}</small></div><div className="checkout-item-controls"><button onClick={() => updateQuantity(item.product_id, item.quantity - 1)}>-</button><b>{item.quantity}</b><button onClick={() => updateQuantity(item.product_id, item.quantity + 1)}>+</button><strong>{formatLKR(item.line_total)}</strong><button className="checkout-remove" onClick={() => removeItem(item.product_id)} title="Remove"><Trash2 size={16} /></button></div></article>)}</section><aside className="checkout-summary"><p className="public-kicker">Order summary</p><h2>Checkout</h2><div><span>Items</span><strong>{cart.reduce((sum, item) => sum + Number(item.quantity), 0)}</strong></div><div className="checkout-total"><span>Total</span><strong>{formatLKR(total)}</strong></div>{cart.some(item => item.prescription_required) && <div className="prescription-upload"><FileCheck2 size={20} /><p>A prescription upload will be required after the order is created.</p></div>}{(error || checkoutError) && <p className="public-auth-error">{checkoutError || error}</p>}<button disabled={!cart.length || loading} onClick={placeOrder}>{loading ? 'Working...' : 'Create order'}</button><small>Prices and stock are validated again by the server. Checkout creates an order, not a sale.</small></aside></main></div>
}
