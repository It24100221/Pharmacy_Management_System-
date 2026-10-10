const asyncHandler = require('../utils/asyncHandler')
const ApiError = require('../middleware/errorHandler')
const productRepository = require('../repositories/productRepository')
const { parsePagination, parseSearch } = require('../utils/requestValidation')
const productImageStorage = require('../services/productImageStorage')
const { parsePositiveInteger } = require('../utils/requestValidation')

const allowedAvailability = new Set(['AVAILABLE', 'LOW_STOCK', 'OUT_OF_STOCK', 'EXPIRED'])

const toPublicProduct = product => ({
  product_id: product.product_id,
  product_code: product.product_code,
  name: product.product_name,
  description: product.product_description,
  category_code: product.category_code,
  category: product.category_name,
  price: Number(product.unit_price),
  stock_quantity: Number(product.stock_quantity),
  availability: product.availability,
  expiry_date: product.expiry_date,
  prescription_required: Boolean(product.prescription_required),
  image_url: product.image_path ? `/api/products/${product.product_code}/image` : null,
  has_image: Boolean(product.image_path),
})

function catalogueFilters(query) {
  const search = parseSearch(query.search) || ''
  if (query.category !== undefined && typeof query.category !== 'string') throw new ApiError('Category filter is invalid', 400)
  if (query.availability !== undefined && typeof query.availability !== 'string') throw new ApiError('Availability filter is invalid', 400)
  const category = String(query.category || '').trim()
  const availability = String(query.availability || '').trim().toUpperCase()
  const { page, limit, pagination } = parsePagination(query, { defaultLimit: 24, maxLimit: 100 })
  if (category.length > 120) throw new ApiError('Category filter is invalid', 400)
  if (availability && !allowedAvailability.has(availability)) throw new ApiError('Availability filter is invalid', 400)
  return {
    search: search || undefined,
    category: category || undefined,
    availability: availability || undefined,
    page,
    limit,
    pagination,
  }
}

const getProducts = asyncHandler(async (req, res) => {
  const filters = catalogueFilters(req.query)
  const [products, total, categories] = await Promise.all([
    productRepository.findAll(filters),
    productRepository.getCount(filters),
    productRepository.findCategories(),
  ])
  res.json({
    success: true,
    data: {
      products: products.map(toPublicProduct),
      categories,
      pagination: {
        current_page: filters.page,
        per_page: filters.pagination ? filters.limit : total,
        total_items: total,
        total_pages: filters.pagination ? Math.ceil(total / filters.limit) : 1,
      },
    },
  })
})

const getProductByCode = asyncHandler(async (req, res) => {
  const productCode = String(req.params.productCode || '').trim().toUpperCase()
  if (!/^P\d{10}$/.test(productCode)) throw new ApiError('Invalid product code', 400)
  const product = await productRepository.findByCode(productCode)
  if (!product) throw new ApiError('Product not found', 404)
  res.json({ success: true, data: toPublicProduct(product) })
})

const getProductImage = asyncHandler(async (req, res) => {
  const productCode = String(req.params.productCode || '').trim().toUpperCase()
  if (!/^P\d{10}$/.test(productCode)) throw new ApiError('Invalid product code', 400)
  const product = await productRepository.findByCode(productCode)
  if (!product?.image_path || !product.image_mime_type) throw new ApiError('Product image not found', 404)
  const file = await productImageStorage.readFile(product.image_path)
  res.set({ 'Content-Type': product.image_mime_type, 'Content-Length': String(file.length), 'Content-Disposition': 'inline', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'public, max-age=300' })
  res.send(file)
})

const uploadProductImage = asyncHandler(async (req, res) => {
  const productId = parsePositiveInteger(req.params.productId, 'product ID')
  const metadata = productImageStorage.validateAndDescribe(req.productImage)
  await productImageStorage.saveFile(req.productImage.buffer, metadata)
  try {
    const product = await productRepository.updateImage(productId, metadata)
    if (!product) throw new ApiError('Product not found', 404)
    res.status(201).json({ success: true, message: 'Product image saved', data: toPublicProduct(product) })
  } catch (error) {
    await productImageStorage.deleteFile(metadata.storagePath).catch(() => {})
    throw error
  }
})

module.exports = { catalogueFilters, getProductByCode, getProductImage, getProducts, toPublicProduct, uploadProductImage }
