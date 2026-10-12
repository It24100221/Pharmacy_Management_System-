import React, { useEffect, useId, useState } from 'react'
import { productService } from '../services/apiService.js'
import { useProductImages } from '../context/ProductImagesContext.jsx'
import CatalogueProductImage from './CatalogueProductImage.jsx'

export default function ProductImageManager({ productCode, medicineId, name }) {
  const { products, refresh } = useProductImages()
  const product = products.find(item => productCode ? item.productCode === productCode : item.medicineId === Number(medicineId))
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [imageUrl, setImageUrl] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [license, setLicense] = useState('')
  const [rights, setRights] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const prefix = useId()
  useEffect(() => {
    if (!file) { setPreview(null); return }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])
  const chooseFile = event => {
    const selected = event.target.files?.[0]
    setMessage('')
    if (selected && (!['image/jpeg', 'image/png', 'image/webp'].includes(selected.type) || selected.size === 0 || selected.size > 5 * 1024 * 1024)) {
      setMessage('Choose a non-empty JPEG, PNG or WebP image up to 5 MB.')
      setFile(null)
      event.target.value = ''
      return
    }
    setFile(selected || null)
  }
  const save = async () => {
    if (!product || busy) return
    if (!rights) { setMessage('Confirm that you have permission to use this image.'); return }
    if (!file && !imageUrl) { setMessage('Choose an image file or enter an HTTPS image URL.'); return }
    const metadata = { source_url: sourceUrl, license, alt_text: name || product.name, rights_confirmed: rights }
    setBusy(true); setMessage('')
    try {
      if (file) await productService.uploadImage(product.productId, file, metadata)
      else await productService.setImageUrl(product.productId, { ...metadata, image_url: imageUrl })
      await refresh(); setFile(null); setImageUrl(''); setMessage('Product image saved.')
    } catch (error) { setMessage(error.response?.data?.message || 'Unable to save product image.') }
    finally { setBusy(false) }
  }
  const remove = async () => {
    if (!product || busy || !window.confirm(`Remove the image for ${product.name}?`)) return
    setBusy(true)
    try { await productService.removeImage(product.productId); await refresh(); setMessage('Product image removed.'); setFile(null) }
    catch (error) { setMessage(error.response?.data?.message || 'Unable to remove image.') }
    finally { setBusy(false) }
  }
  return <section className="card product-image-manager" aria-label="Product image management">
    <div className="card-header"><h2 className="card-header-title">Product image</h2></div>
    <div className="card-body">
      <CatalogueProductImage key={`${product?.image}:${preview}`} product={{ ...(product || { name: name || 'New medicine', categoryCode: 'MEDICINE' }), image: preview || product?.image }} />
      {!product ? <p>Save the medicine first, then open Edit Medicine to attach an image to its permanent Product ID.</p> : <>
        <p>{product.productCode} · {product.name}</p>
        <label htmlFor={`${prefix}-file`}>Upload image (up to 5 MB)</label>
        <input id={`${prefix}-file`} type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseFile} disabled={busy} />
        <label htmlFor={`${prefix}-url`}>Or use an authorized HTTPS image URL</label>
        <input id={`${prefix}-url`} className="form-control" type="url" value={imageUrl} onChange={e => setImageUrl(e.target.value)} disabled={busy || Boolean(file)} placeholder="https://…" />
        <label htmlFor={`${prefix}-source`}>Source page URL (optional)</label>
        <input id={`${prefix}-source`} className="form-control" type="url" value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} disabled={busy} />
        <label htmlFor={`${prefix}-license`}>License or permission (optional)</label>
        <input id={`${prefix}-license`} className="form-control" value={license} onChange={e => setLicense(e.target.value)} maxLength={500} disabled={busy} />
        <label htmlFor={`${prefix}-rights`}><input id={`${prefix}-rights`} type="checkbox" checked={rights} onChange={e => setRights(e.target.checked)} disabled={busy} /> I have permission to use this image and have verified the product match.</label>
        <div className="product-image-actions"><button type="button" className="btn btn-primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : product.image ? 'Replace image' : 'Save image'}</button>
          {product.image && <button type="button" className="btn btn-ghost" disabled={busy} onClick={remove}>Remove image</button>}</div>
      </>}
      {message && <p role="status">{message}</p>}
    </div>
  </section>
}
