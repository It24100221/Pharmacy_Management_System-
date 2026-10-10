const { pool } = require('../config/database');

const selectCatalogueFields = `
  SELECT
    pc.product_id,
    pc.product_code,
    pc.product_name,
    pc.product_description,
    pc.category_code,
    pc.category_name,
    pc.unit_price,
    pc.stock_quantity,
    pc.min_stock_level,
    pc.availability,
    pc.expiry_date,
    pc.prescription_required,
    pc.image_path,
    pc.image_mime_type
  FROM dbo.v_product_catalog pc
`;

function buildFilters(filters) {
  let where = ' WHERE pc.is_active = 1';
  const params = [];

  if (filters.search) {
    where += ` AND (
      pc.product_code LIKE ?
      OR pc.product_name LIKE ?
      OR pc.product_description LIKE ?
      OR pc.generic_name LIKE ?
    )`;
    const term = `%${filters.search}%`;
    params.push(term, term, term, term);
  }
  if (filters.category) {
    where += ' AND (pc.category_code = ? OR pc.category_name = ?)';
    params.push(filters.category.toUpperCase(), filters.category);
  }
  if (filters.availability) {
    where += ' AND pc.availability = ?';
    params.push(filters.availability.toUpperCase());
  }
  return { where, params };
}

class ProductRepository {
  async findAll(filters = {}) {
    const { where, params } = buildFilters(filters);
    let query = `${selectCatalogueFields}${where} ORDER BY pc.product_name, pc.product_id`;
    if (filters.pagination !== false) {
      query += ' LIMIT ? OFFSET ?';
      params.push(filters.limit, (filters.page - 1) * filters.limit);
    }
    const [rows] = await pool.execute(query, params);
    return rows;
  }

  async getCount(filters = {}) {
    const { where, params } = buildFilters(filters);
    const [rows] = await pool.execute(
      `SELECT COUNT(*) AS total FROM dbo.v_product_catalog pc${where}`,
      params
    );
    return rows[0].total;
  }

  async findByCode(productCode) {
    const [rows] = await pool.execute(
      `${selectCatalogueFields} WHERE pc.is_active = 1 AND pc.product_code = ?`,
      [productCode]
    );
    return rows[0] || null;
  }

  async updateImage(productId, metadata) {
    await pool.execute(`
      UPDATE products SET image_original_filename = ?, image_stored_filename = ?, image_path = ?, image_mime_type = ?, image_file_size = ?, updated_at = SYSDATETIME()
      WHERE product_id = ?
    `, [metadata.originalFilename, metadata.storedFilename, metadata.storagePath, metadata.mimeType, metadata.fileSize, productId]);
    const [rows] = await pool.execute(`${selectCatalogueFields} WHERE pc.product_id = ?`, [productId]);
    return rows[0] || null;
  }

  async findCategories() {
    const [rows] = await pool.execute(`
      SELECT category_code, category_name
      FROM dbo.categories
      WHERE is_active = 1
      ORDER BY category_id
    `);
    return rows;
  }
}

module.exports = new ProductRepository();
module.exports.buildFilters = buildFilters;
