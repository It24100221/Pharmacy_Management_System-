const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const catalogRepository = require('../repositories/catalogRepository');
const ApiError = require('../middleware/errorHandler');

const TYPES = Object.freeze(['Medicine', 'Baby Items', 'Lab Items', 'Medical Accessories']);

router.get('/categories', (_req, res) => res.json({ success: true, data: TYPES }));

router.get('/', asyncHandler(async (req, res) => {
  const type = String(req.query.type || '').trim();
  const search = String(req.query.search || '').trim();
  if (type && !TYPES.includes(type)) throw new ApiError('Invalid product type', 400);
  if (search.length > 100) throw new ApiError('Search is too long', 400);
  const page = req.query.page === undefined ? 1 : Number(req.query.page);
  const limit = req.query.limit === undefined ? 24 : Number(req.query.limit);
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100 || (page - 1) * limit > 2147483647) {
    throw new ApiError('Invalid pagination', 400);
  }
  const result = await catalogRepository.findPublic({ type, search, page, limit });
  res.json({ success: true, data: { products: result.products, categories: TYPES,
    pagination: { current_page: page, per_page: limit, total_items: result.total,
      total_pages: Math.ceil(result.total / limit) } } });
}));

module.exports = router;
