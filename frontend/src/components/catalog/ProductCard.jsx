import React, { useEffect, useState } from 'react'

export const FALLBACK = '/images/product-placeholder.svg'
export const formatPrice = price => new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' }).format(Number(price))
export const availabilityLabel = { in_stock: 'Available', low_stock: 'Low Stock', out_of_stock: 'Out of Stock' }

export default function ProductCard({ product }) {
  const [image, setImage] = useState(product.image_url || FALLBACK)
  useEffect(() => setImage(product.image_url || FALLBACK), [product.image_url])
  return <article className="catalog-card">
    <div className="catalog-image"><img src={image} alt={product.name} loading="lazy" onError={() => setImage(FALLBACK)} /></div>
    <div className="catalog-card-body">
      <p className="catalog-type">{product.product_type}{product.category ? ` · ${product.category}` : ''}</p>
      <h2>{product.name}</h2>
      <p className="catalog-code">Product ID: <strong>{product.product_code}</strong></p>
      {product.description && <p className="catalog-description">{product.description}</p>}
      <div className="catalog-card-bottom"><strong className="catalog-price">{formatPrice(product.unit_price)}</strong>
        <span className={`catalog-availability ${product.availability}`}>{availabilityLabel[product.availability] || 'Availability unknown'}</span></div>
      {Boolean(product.requires_prescription) && <p className="catalog-prescription">Prescription Required</p>}
    </div>
  </article>
}
