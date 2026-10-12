// Verify the actual SQL Server image columns, then roll back every write.
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') })
const { pool, closePool } = require('../config/database')

async function run() {
  const [before] = await pool.execute('SELECT * FROM dbo.products ORDER BY product_id')
  assert.ok(before.length > 0)
  const product = before[0]
  const [medicineBefore] = await pool.execute('SELECT id,name,manufacturer,generic_name,quantity,unit_price,expiry_date FROM dbo.medicines ORDER BY id')
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    await connection.execute(`UPDATE dbo.products SET image_original_filename=NULL,image_stored_filename=NULL,
      image_path=NULL,image_mime_type=NULL,image_file_size=NULL,image_external_url=?, image_source_url=?, image_license=?, image_alt_text=? WHERE product_id=?`,
      ['https://example.com/sql-verification.webp', 'https://example.com/source', 'Verification fixture only', 'SQL verification fixture', product.product_id])
    const [rows] = await connection.execute('SELECT image_external_url,image_source_url,image_license,image_alt_text FROM dbo.products WHERE product_id=?', [product.product_id])
    assert.deepEqual(rows[0], { image_external_url: 'https://example.com/sql-verification.webp', image_source_url: 'https://example.com/source', image_license: 'Verification fixture only', image_alt_text: 'SQL verification fixture' })
    await connection.execute(`UPDATE dbo.products SET image_external_url=NULL, image_original_filename=?,
      image_stored_filename=?, image_path=?, image_mime_type=?, image_file_size=? WHERE product_id=?`,
      ['fixture.webp', '00000000-0000-4000-8000-000000000001.webp', 'products/00000000-0000-4000-8000-000000000001.webp', 'image/webp', 42, product.product_id])
    const [local] = await connection.execute('SELECT image_path,image_mime_type,image_file_size FROM dbo.products WHERE product_id=?', [product.product_id])
    assert.deepEqual({ ...local[0], image_file_size: Number(local[0].image_file_size) }, { image_path: 'products/00000000-0000-4000-8000-000000000001.webp', image_mime_type: 'image/webp', image_file_size: 42 })
  } finally {
    await connection.rollback()
    connection.release()
  }
  const [after] = await pool.execute('SELECT * FROM dbo.products ORDER BY product_id')
  assert.deepEqual(after, before)
  const [medicines] = await pool.execute('SELECT id,name,manufacturer,generic_name,quantity,unit_price,expiry_date FROM dbo.medicines ORDER BY id')
  assert.deepEqual(medicines, medicineBefore)
  let implementationBaselineVerified = false
  try {
    const baseline = JSON.parse(await fs.readFile(path.resolve(__dirname, '../../.local/product-image-stock-baseline.json'), 'utf8'))
    assert.equal(JSON.stringify(medicines), JSON.stringify(baseline))
    implementationBaselineVerified = true
  } catch (error) { if (error.code !== 'ENOENT') throw error }
  console.log(JSON.stringify({ products: after.length, imageMetadataRoundTrip: true, webpMetadataRoundTrip: true, transactionRolledBack: true, allProductColumnsUnchanged: true, medicineIdentityStockPriceExpiryUnchanged: true, implementationBaselineVerified }))
}

run().catch(error => { console.error(error.message); process.exitCode = 1 }).finally(closePool)
