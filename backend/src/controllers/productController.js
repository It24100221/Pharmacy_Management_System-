const asyncHandler = require('../utils/asyncHandler')
const { pool } = require('../config/database')

const getProducts = asyncHandler(async (req, res) => {
  const [products] = await pool.execute(`
    SELECT id AS product_id, category, name AS product_name, unit_price AS price,
      quantity, CAST(NULL AS NVARCHAR(500)) AS image
    FROM medicines
    ORDER BY name
  `)
  res.json({ success: true, data: { products } })
})

module.exports = { getProducts }