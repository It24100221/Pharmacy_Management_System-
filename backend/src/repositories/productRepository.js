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
    ,p.medicine_id, m.generic_name, m.manufacturer,
    p.image_source_url, p.image_license, p.image_alt_text, p.image_external_url, p.updated_at AS image_updated_at
  FROM dbo.v_product_catalog pc
  INNER JOIN dbo.products p ON p.product_id = pc.product_id
  LEFT JOIN dbo.medicines m ON m.id = p.medicine_id
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
      UPDATE products SET image_original_filename = ?, image_stored_filename = ?, image_path = ?, image_mime_type = ?, image_file_size = ?, image_source_url = ?, image_license = ?, image_alt_text = ?, image_external_url = ?, updated_at = SYSDATETIME()
      WHERE product_id = ?
    `, [metadata.originalFilename ?? null, metadata.storedFilename ?? null, metadata.storagePath ?? null, metadata.mimeType ?? null, metadata.fileSize ?? null, metadata.sourceUrl ?? null, metadata.license ?? null, metadata.altText ?? null, metadata.externalUrl ?? null, productId]);
    const [rows] = await pool.execute(`${selectCatalogueFields} WHERE pc.product_id = ?`, [productId]);
    return rows[0] || null;
  }

  async findById(productId) {
    const [rows] = await pool.execute(`${selectCatalogueFields} WHERE pc.is_active = 1 AND pc.product_id = ?`, [productId]);
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
