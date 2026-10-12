// Offline review/import only. Normal application requests never research the web.
const fs = require('fs/promises')
const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') })
const { pool, closePool } = require('../config/database')
const storage = require('../services/productImageStorage')
const { validateImageMetadata } = require('../services/productImageMetadata')
const review = require('../../data/productImageReview.json')
const { exactMatch } = require('../services/productImageMatching')
const { buildImportPlan, reviewTemplate, sha256 } = require('../services/productImageImportPlan')

async function run() {
  const [products] = await pool.execute(`SELECT pc.*, m.manufacturer,
    p.image_source_url, p.image_license, p.image_external_url FROM dbo.v_product_catalog pc
    INNER JOIN dbo.products p ON p.product_id=pc.product_id
    LEFT JOIN dbo.medicines m ON m.id=p.medicine_id ORDER BY pc.product_id`)
  if (process.argv.includes('--prepare-review')) {
    await fs.writeFile(path.resolve(__dirname, '../../data/productImageReviewTemplate.json'), JSON.stringify(reviewTemplate(products), null, 2) + '\n')
    console.log('Review template created from actual SQL Product IDs. No database writes performed.')
  }
  const root = path.resolve(__dirname, '../../assets/products')
  const plan = await buildImportPlan(products, review.approved, root)
  await fs.writeFile(path.resolve(__dirname, '../../../PRODUCT_IMAGE_IMPORT_PREVIEW.json'), JSON.stringify({
    generatedAt: new Date().toISOString(), databaseWrites: 0, approvalRequired: true, ...plan,
  }, null, 2) + '\n')
  const rows = products.map(product => {
    return {
      productId: product.product_id, productCode: product.product_code, medicineId: product.medicine_id,
      name: product.product_name, genericName: product.generic_name, manufacturer: product.manufacturer,
      category: product.category_code, active: product.is_active, existingImage: product.image_external_url || product.image_path,
      strength: product.product_name.match(/\b\d+(?:\.\d+)?\s*mg\b/i)?.[0] || null,
      form: product.product_name.match(/\b(tablets|capsules|syrup|gel|cream|injection)\b/i)?.[0] || null,
      packSize: product.product_name.match(/\(([^)]+)\)/)?.[1] || null,
      status: product.image_path || product.image_external_url ? 'EXISTING IMAGE / PRESERVED' : plan.updates.some(item => item.productId === product.product_id) ? 'MATCH VERIFIED / AWAITING IMPORT APPROVAL' : 'NO SAFE MATCH / FALLBACK',
      reason: plan.rejected.find(item => item.productId === product.product_id)?.reason || review.review[product.product_id] || 'No authorized exact product image has been reviewed.',
    }
  })
  const report = { generatedAt: new Date().toISOString(), summary: { total: rows.length, existingImages: rows.filter(r => r.existingImage).length, approvedMatches: rows.filter(r => r.status.startsWith('MATCH VERIFIED')).length }, products: rows }
  await fs.writeFile(path.resolve(__dirname, '../../../PRODUCT_IMAGE_MATCHING_REPORT.json'), JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify({ ...report.summary, proposedUpdates: plan.updates.length, rejectedCandidates: plan.rejected.length, planSha256: plan.planSha256 }))
  if (!process.argv.includes('--import-approved')) return
  if (!process.argv.includes('--bulk-update-approved')) throw new Error('Obtain approval for the reviewed bulk mapping before using --bulk-update-approved')
  const approvedDigest = process.argv.find(arg => arg.startsWith('--approved-plan-sha256='))?.split('=')[1]
  if (approvedDigest !== plan.planSha256) throw new Error('Supply the SHA-256 of the preview actually approved; the current plan differs or approval is missing')
  if (plan.rejected.length) throw new Error('Resolve all rejected candidates before applying the approved plan')
  const selected = products.filter(product => plan.updates.some(item => item.productId === product.product_id))
  if (!selected.length) { console.log('No exact approved matches; no database writes performed.'); return }
  const created = []
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    for (const product of selected) {
      const candidate = review.approved.find(item => item.productId === product.product_id)
      const [current] = await connection.execute(`SELECT p.product_id, p.product_code,
        CASE WHEN p.medicine_id IS NOT NULL THEN m.name ELSE p.standalone_name END AS product_name,
        p.image_path, p.image_external_url, m.generic_name, m.manufacturer FROM dbo.products p WITH (UPDLOCK, HOLDLOCK)
        LEFT JOIN dbo.medicines m WITH (UPDLOCK, HOLDLOCK) ON m.id=p.medicine_id WHERE p.product_id=? AND p.is_active=1`, [product.product_id])
      if (!current[0] || current[0].image_path || current[0].image_external_url || !exactMatch(current[0], candidate)) throw new Error('Product identity or image changed during review; import rolled back')
      const filename = path.basename(candidate.filename)
      if (filename !== candidate.filename) throw new Error('Candidate asset filename is invalid')
      const buffer = await fs.readFile(path.join(root, filename))
      if (sha256(buffer) !== plan.updates.find(item => item.productId === product.product_id).sha256) throw new Error('Image bytes changed after preview; import rolled back')
      const metadata = { ...storage.validateAndDescribe({ buffer, size: buffer.length, originalName: filename, declaredMimeType: candidate.mimeType }), ...validateImageMetadata({ rights_confirmed: true, source_url: candidate.sourceUrl, license: candidate.license, alt_text: product.product_name }) }
      await storage.saveFile(buffer, metadata); created.push(metadata.storagePath)
      const [updated] = await connection.execute(`UPDATE dbo.products SET image_path=?, image_original_filename=?, image_stored_filename=?, image_mime_type=?, image_file_size=?, image_source_url=?, image_license=?, image_alt_text=?, updated_at=SYSDATETIME()
        OUTPUT INSERTED.product_id WHERE product_id=? AND image_path IS NULL AND image_external_url IS NULL`, [metadata.storagePath, metadata.originalFilename, metadata.storedFilename, metadata.mimeType, metadata.fileSize, metadata.sourceUrl, metadata.license, metadata.altText, product.product_id])
      if (!updated.length) throw new Error('An image was assigned concurrently; import rolled back to preserve it')
    }
    await connection.commit()
    console.log(`Imported ${selected.length} approved exact images. Previous metadata was empty; rollback can clear only these product IDs.`)
  } catch (error) {
    await connection.rollback()
    for (const file of created) await storage.deleteFile(file).catch(() => {})
    throw error
  } finally { connection.release() }
}

if (require.main === module) run().catch(error => { console.error(error.message); process.exitCode = 1 }).finally(closePool)
module.exports = { exactMatch }
