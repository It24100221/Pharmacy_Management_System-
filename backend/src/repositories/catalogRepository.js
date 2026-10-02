const { pool } = require('../config/database');

function escapedLike(term) {
  return `%${term.replace(/\[/g, '[[]').replace(/%/g, '[%]').replace(/_/g, '[_]')}%`;
}

class CatalogRepository {
  async findPublic({ type, search, page, limit }) {
    let where = 'm.is_active = 1';
    const params = [];
    if (type) { where += ' AND m.product_type = ?'; params.push(type); }
    if (search) {
      where += ' AND (m.name LIKE ? OR m.product_code LIKE ? OR m.category LIKE ?)';
      const pattern = escapedLike(search);
      params.push(pattern, pattern, pattern);
    }
    const [countRows] = await pool.execute(`SELECT COUNT(*) AS total FROM medicines m WHERE ${where}`, params);
    const [products] = await pool.execute(`
      SELECT m.product_code, m.name, m.description, m.product_type, m.category,
        m.unit_price, m.image_url, m.requires_prescription,
        CASE WHEN m.quantity <= 0 OR (m.expiry_date IS NOT NULL AND m.expiry_date < CAST(GETDATE() AS DATE))
          THEN 'out_of_stock' WHEN m.quantity <= m.min_stock_level THEN 'low_stock'
          ELSE 'in_stock' END AS availability
      FROM medicines m WHERE ${where}
      ORDER BY m.name ASC, m.id ASC
      OFFSET ? ROWS FETCH NEXT ? ROWS ONLY`, [...params, (page - 1) * limit, limit]);
    return { products, total: Number(countRows[0]?.total || 0) };
  }
}

module.exports = new CatalogRepository();
