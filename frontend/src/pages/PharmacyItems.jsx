import React, { useEffect, useState } from 'react'
import { Filter, ImageOff, Search } from 'lucide-react'
import { formatLKR } from '../data/mockMedicines.js'
import { productService } from '../services/apiService.js'
import { normalizeCatalogProduct } from '../utils/normalization.js'

const availabilityLabel = product => {
  if (product.availability === 'AVAILABLE') return `${product.stockQuantity} available`
  if (product.availability === 'LOW_STOCK') return `Low stock · ${product.stockQuantity} remaining`
  if (product.availability === 'EXPIRED') return 'Unavailable · expired'
  return 'Out of stock'
}

const PharmacyItems = () => {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')

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
      </section>
      <section className="catalog-toolbar">
        <label><Search size={17} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search name or Product ID" /></label>
        <label><Filter size={17} /><select value={category} onChange={event => setCategory(event.target.value)}><option value="">All categories</option>{categories.map(item => <option key={item.category_code} value={item.category_code}>{item.category_name}</option>)}</select></label>
      </section>
      <div className="public-product-grid">
        {loadError && <div className="public-empty">{loadError}</div>}
        {loading && !loadError && <div className="public-empty">Loading products...</div>}
        {!loading && products.map(product => <article className="public-product-card" key={product.productCode}>
          <div className="public-product-image">{product.image ? <img src={product.image} alt={product.name} /> : <ImageOff size={28} />}</div>
          <span>{product.category}</span>
          <h2>{product.name}</h2>
          <p><strong>{product.productCode}</strong>{product.description ? ` · ${product.description}` : ''}</p>
          <div className="public-product-bottom"><strong>{formatLKR(product.price)}</strong><small>{availabilityLabel(product)}</small></div>
          <button type="button" disabled>Cart available in B2</button>
        </article>)}
        {!loading && !loadError && !products.length && <div className="public-empty">No products match your search.</div>}
      </div>
    </div>
  )
}

export default PharmacyItems
