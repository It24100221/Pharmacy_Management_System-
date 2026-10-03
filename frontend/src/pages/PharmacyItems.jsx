import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Filter, ImageOff, Plus, Search, ShoppingCart } from 'lucide-react'
import { useCart } from '../context/CartContext.jsx'
import { formatLKR } from '../data/mockMedicines.js'
import { productService } from '../services/apiService.js'

const categories = ['All categories', 'Prescription Medicines', 'OTC Medicines', 'Vitamins', 'Pain Relief Medicines', 'Face Creams and Beauty Products', 'Baby Items', 'Medical Tools', 'Front Store Categories', 'Personal Care Products']
const categoryLabel = category => ({ Antibiotics: 'Prescription Medicines', Analgesics: 'Pain Relief Medicines', Cardiovascular: 'Prescription Medicines', Gastrointestinal: 'Prescription Medicines', Respiratory: 'OTC Medicines' }[category] || category || 'OTC Medicines')
const PharmacyItems = () => {
  const [medicines, setMedicines] = useState([])
  const [loadError, setLoadError] = useState('')
  const { addItem, cart } = useCart()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState(categories[0])
  useEffect(() => {
    let active = true
    productService.getAll()
      .then(response => {
        if (!active) return
        setMedicines((response.data?.products || []).map(product => ({
          id: Number(product.product_id),
          name: product.product_name,
          category: product.category,
          quantity: Number(product.quantity),
          unitPrice: Number(product.price),
          image: product.image,
        })))
      })
      .catch(() => active && setLoadError('The public catalogue is temporarily unavailable.'))
    return () => { active = false }
  }, [])
  const products = useMemo(() => medicines.filter(medicine => {
    const label = categoryLabel(medicine.category)
    const text = `${medicine.name} ${medicine.genericName || ''} ${label}`.toLowerCase()
    return (!search || text.includes(search.toLowerCase())) && (category === categories[0] || label === category)
  }), [medicines, search, category])

  return (
    <div className="public-page">
      <section className="public-page-heading"><div><p className="public-kicker">Senevirathna catalogue</p><h1>Pharmacy items</h1><p>Find medicines and everyday care products by category.</p></div><Link className="public-cart-link" to="/customer/checkout"><ShoppingCart size={18} /> Cart <b>{cart.length}</b></Link></section>
      <section className="catalog-toolbar"><label><Search size={17} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search products" /></label><label><Filter size={17} /><select value={category} onChange={event => setCategory(event.target.value)}>{categories.map(item => <option key={item}>{item}</option>)}</select></label></section>
      <div className="public-product-grid">
        {loadError && <div className="public-empty">{loadError}</div>}
        {products.map(medicine => <article className="public-product-card" key={medicine.id}><div className="public-product-image">{medicine.image ? <img src={medicine.image} alt={medicine.name} /> : <ImageOff size={28} />}</div><span>{categoryLabel(medicine.category)}</span><h2>{medicine.name}</h2><p>{medicine.genericName || 'Pharmacy essential'}</p><div className="public-product-bottom"><strong>{formatLKR(medicine.unitPrice)}</strong><small>{medicine.quantity} available</small></div><button type="button" disabled={!medicine.quantity} onClick={() => addItem(medicine)}><Plus size={16} /> Add to cart</button></article>)}
        {!loadError && !products.length && <div className="public-empty">No products match your search.</div>}
      </div>
    </div>
  )
}
export default PharmacyItems
