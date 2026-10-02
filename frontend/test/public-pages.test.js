import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import fs from 'node:fs'
import Module from 'node:module'
import { fileURLToPath } from 'node:url'
import { transformSync } from 'esbuild'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function loadJsx(relativePath) {
  const filename = path.join(root, relativePath)
  const built = transformSync(fs.readFileSync(filename, 'utf8'), { loader: 'jsx', format: 'cjs' }).code
  const loaded = new Module(filename)
  loaded.filename = filename
  loaded.paths = Module._nodeModulePaths(path.dirname(filename))
  loaded._compile(built, filename)
  return loaded.exports.default
}

test('public home has customer hero and working catalog/About routes without staff actions', () => {
  const Home = loadJsx('src/pages/Dashboard/Dashboard.jsx')
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Home)))
  assert.match(html, /Better Care\./)
  assert.match(html, /Smarter Pharmacy\./)
  assert.match(html, /href="\/pharmacy-items"[^>]*>Explore Pharmacy Items/)
  assert.match(html, /href="\/about"[^>]*>Learn More/)
  assert.doesNotMatch(html, /\/sales|\/purchases|\/prescriptions\/create/)
})

test('About and Services provide public content and catalog links', () => {
  for (const file of ['src/pages/Public/AboutPage.jsx', 'src/pages/Public/ServicesPage.jsx']) {
    const Page = loadJsx(file)
    const html = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Page)))
    assert.match(html, /href="\/pharmacy-items"/)
    assert.doesNotMatch(html, /inventory-dashboard|sales-dashboard/)
  }
})

test('product card renders server price, business ID, availability, prescription badge and fallback image', () => {
  const ProductCard = loadJsx('src/components/catalog/ProductCard.jsx')
  const product = { product_code: 'P001', name: 'Paracetamol', product_type: 'Medicine', category: 'Pain Relief',
    unit_price: 25, image_url: null, requires_prescription: 1, availability: 'low_stock' }
  const html = renderToStaticMarkup(React.createElement(ProductCard, { product }))
  assert.match(html, /src="\/images\/product-placeholder.svg"/)
  assert.match(html, /Product ID: <strong>P001<\/strong>/)
  assert.match(html, /LKR.{0,3}25\.00/)
  assert.match(html, /Low Stock/)
  assert.match(html, /Prescription Required/)
  const ordinary = renderToStaticMarkup(React.createElement(ProductCard, { product: { ...product, image_url: '/images/baby.png',
    product_code: 'B001', product_type: 'Baby Items', requires_prescription: 0, availability: 'out_of_stock' } }))
  assert.match(ordinary, /src="\/images\/baby.png"/)
  assert.match(ordinary, /Out of Stock/)
  assert.doesNotMatch(ordinary, /Prescription Required/)
})
