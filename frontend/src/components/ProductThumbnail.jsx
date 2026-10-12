import React from 'react'
import { useProductImages } from '../context/ProductImagesContext.jsx'
import CatalogueProductImage from './CatalogueProductImage.jsx'

export default function ProductThumbnail({ productCode, medicineId, name = 'Pharmacy product' }) {
  const { products } = useProductImages()
  const product = products.find(item => productCode ? item.productCode === productCode : medicineId != null && item.medicineId === Number(medicineId))
    || { productCode, name, image: null, categoryCode: 'MEDICINE' }
  return <div className="product-thumbnail"><CatalogueProductImage key={`${product.productCode}:${product.image}`} product={product} /></div>
}
