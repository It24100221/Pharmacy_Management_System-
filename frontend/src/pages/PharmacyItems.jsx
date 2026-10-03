import React, { useEffect, useState } from 'react'
import { Filter, ImageOff, Search, ShoppingCart } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { formatLKR } from '../data/mockMedicines.js'
import { productService } from '../services/apiService.js'
import { normalizeCatalogProduct } from '../utils/normalization.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useCart } from '../context/CartContext.jsx'

const availabilityLabel = product => {
  if (product.availability === 'AVAILABLE') return `${product.stockQuantity} available`
  if (product.availability === 'LOW_STOCK') return `Low stock · ${product.stockQuantity} remaining`
  if (product.availability === 'EXPIRED') return 'Unavailable · expired'
  return 'Out of stock'
}

const PharmacyItems = () => {
  const { session } = useAuth()
  const { addItem, itemCount } = useCart()
  const navigate = useNavigate()
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [actionError, setActionError] = useState('')
  const addProduct = async product => {
    if (session?.role !== 'CUSTOMER') return navigate('/customer-login', { state: { from: { pathname: '/pharmacy-items' } } })
    setActionError('')
    try { await addItem(product) } catch (error) { setActionError(error.response?.data?.message || 'Unable to add this product.') }
  }

  useEffect(() => {
    let active = true
    const timer = setTimeout(() => {
      setLoading(true)
      setLoadError('')
      productService.getAll({ search: search || undefined, category: category || undefined, limit: 100 })
        .then(response => {
          if (!active) return
          setProducts((response.data?.products || []).map(normalizeCatalogProduct))
          setCategories(response.data?.categories || [])
        })
        .catch(() => active && setLoadError('The public catalogue is temporarily unavailable.'))
        .finally(() => active && setLoading(false))
    }, 200)
    return () => { active = false; clearTimeout(timer) }
  }, [category, search])

  return (
    <div className="public-page">
      <section className="public-page-heading">
        <div><p className="public-kicker">Senevirathna catalogue</p><h1>Pharmacy items</h1><p>Browse the live pharmacy catalogue by permanent Product ID.</p></div>
        {session?.role === 'CUSTOMER' && <Link className="public-cart-link" to="/customer/checkout"><ShoppingCart size={16} /> Cart <b>{itemCount}</b></Link>}
      </section>
      <section className="catalog-toolbar">
        <label><Search size={17} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search name or Product ID" /></label>
        <label><Filter size={17} /><select value={category} onChange={event => setCategory(event.target.value)}><option value="">All categories</option>{categories.map(item => <option key={item.category_code} value={item.category_code}>{item.category_name}</option>)}</select></label>
      </section>
      <div className="public-product-grid">
        {actionError && <div className="public-auth-error public-empty">{actionError}</div>}
        {loadError && <div className="public-empty">{loadError}</div>}
        {loading && !loadError && <div className="public-empty">Loading products...</div>}
        {!loading && products.map(product => <article className="public-product-card" key={product.productCode}>
          <div className="public-product-image">{product.image ? <img src={product.image} alt={product.name} /> : <ImageOff size={28} />}</div>
          <span>{product.category}{product.prescriptionRequired ? ' · Prescription required' : ''}</span>
          <h2>{product.name}</h2>
          <p><strong>{product.productCode}</strong>{product.description ? ` · ${product.description}` : ''}</p>
          <div className="public-product-bottom"><strong>{formatLKR(product.price)}</strong><small>{availabilityLabel(product)}</small></div>
          <button type="button" disabled={!['AVAILABLE', 'LOW_STOCK'].includes(product.availability)} onClick={() => addProduct(product)}><ShoppingCart size={14} /> {session?.role === 'CUSTOMER' ? 'Add to cart' : 'Sign in to order'}</button>
        </article>)}
        {!loading && !loadError && !products.length && <div className="public-empty">No products match your search.</div>}
      </div>
    </div>
  )
}

export default PharmacyItems
