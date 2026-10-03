const asyncHandler = require('../utils/asyncHandler')
const ApiError = require('../middleware/errorHandler')
const productRepository = require('../repositories/productRepository')

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
  image_url: null,
  has_image: Boolean(product.image_path),
})

function catalogueFilters(query) {
  const search = String(query.search || '').trim()
  const category = String(query.category || '').trim()
  const availability = String(query.availability || '').trim().toUpperCase()
  const page = Number.parseInt(query.page, 10) || 1
  const limit = Number.parseInt(query.limit, 10) || 24
  if (search.length > 100) throw new ApiError('Search must not exceed 100 characters', 400)
  if (category.length > 120) throw new ApiError('Category filter is invalid', 400)
  if (availability && !allowedAvailability.has(availability)) throw new ApiError('Availability filter is invalid', 400)
  if (page < 1 || limit < 1 || limit > 100) throw new ApiError('Invalid catalogue pagination', 400)
  return {
    search: search || undefined,
    category: category || undefined,
    availability: availability || undefined,
    page,
    limit,
    pagination: query.pagination !== 'false',
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

module.exports = { catalogueFilters, getProductByCode, getProducts, toPublicProduct }
