import React, { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../../services/api.js'
import ProductCard from '../../components/catalog/ProductCard.jsx'

export default function PublicItemsPage() {
  const [params, setParams] = useSearchParams()
  const type = params.get('type') || ''
  const search = params.get('search') || ''
  const page = Number(params.get('page')) || 1
  const [draft, setDraft] = useState(search)
  const [retry, setRetry] = useState(0)
  const [state, setState] = useState({ products: [], categories: [], pagination: null, loading: true, error: '' })

  useEffect(() => setDraft(search), [search])
  useEffect(() => {
    const controller = new AbortController()
    setState(prev => ({ ...prev, loading: true, error: '' }))
    api.get('/catalog', { params: { type: type || undefined, search: search || undefined, page }, signal: controller.signal })
      .then(({ data }) => setState({ ...data.data, loading: false, error: '' }))
      .catch(error => { if (error.code !== 'ERR_CANCELED') setState(prev => ({ ...prev, loading: false, error: 'We could not load pharmacy items. Please try again.' })) })
    return () => controller.abort()
  }, [type, search, page, retry])

  const update = (changes) => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(changes)) value ? next.set(key, value) : next.delete(key)
    next.delete('page')
    setParams(next)
  }

  return <div className="pharmacy-container public-page catalog-page">
    <span className="pharmacy-eyebrow">OUR PHARMACY ITEMS</span><h1>Find what you need.</h1>
    <p className="public-page-lead">Browse our products by category or search by name, Product ID or subcategory. Prices and availability come from the pharmacy catalog.</p>
    <form className="catalog-controls" onSubmit={event => { event.preventDefault(); update({ search: draft.trim() }) }}>
      <label className="catalog-search">Search items<input type="search" value={draft} onChange={event => setDraft(event.target.value)} placeholder="Name or Product ID" maxLength="100" /></label>
      <button type="submit" className="pharmacy-button">Search</button>
      <label className="catalog-filter">Category<select value={type} onChange={event => update({ type: event.target.value })}>
        <option value="">All categories</option>{state.categories.map(category => <option key={category} value={category}>{category}</option>)}
      </select></label>
    </form>
    {state.loading ? <p className="catalog-state" role="status">Loading pharmacy items…</p>
      : state.error ? <div className="catalog-state" role="alert"><p>{state.error}</p><button type="button" onClick={() => setRetry(value => value + 1)}>Try again</button></div>
      : state.products.length === 0 ? <div className="catalog-state"><h2>No items found</h2><p>Try a different search or category.</p></div>
      : <><p className="catalog-result-count">{state.pagination?.total_items} item{state.pagination?.total_items === 1 ? '' : 's'} found</p>
        <div className="catalog-grid">{state.products.map(product => <ProductCard key={product.product_code} product={product} />)}</div>
        {state.pagination?.total_pages > 1 && <nav className="catalog-pages" aria-label="Catalog pages">
          <button type="button" disabled={page <= 1} onClick={() => setParams(prev => { const next = new URLSearchParams(prev); next.set('page', String(page - 1)); return next })}>Previous</button>
          <span>Page {page} of {state.pagination.total_pages}</span>
          <button type="button" disabled={page >= state.pagination.total_pages} onClick={() => setParams(prev => { const next = new URLSearchParams(prev); next.set('page', String(page + 1)); return next })}>Next</button>
        </nav>}</>}
  </div>
}
