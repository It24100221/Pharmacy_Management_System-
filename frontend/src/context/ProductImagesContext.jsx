import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { productService } from '../services/apiService.js'
import { normalizeCatalogProduct } from '../utils/normalization.js'

const ProductImagesContext = createContext({ products: [], refresh: async () => {} })

export function ProductImagesProvider({ children }) {
  const [products, setProducts] = useState([])
  const refresh = useCallback(async () => {
    const rows = []
    let page = 1
    let pages = 1
    do {
      const response = await productService.getAll({ page, limit: 100 })
      rows.push(...(response.data?.products || []).map(item => ({ ...normalizeCatalogProduct(item), medicineId: Number(item.medicine_id) })))
      pages = response.data?.pagination?.total_pages || 1
      page += 1
    } while (page <= pages)
    setProducts(rows)
  }, [])
  useEffect(() => { refresh().catch(() => setProducts([])) }, [refresh])
  return <ProductImagesContext.Provider value={{ products, refresh }}>{children}</ProductImagesContext.Provider>
}

export const useProductImages = () => useContext(ProductImagesContext)
