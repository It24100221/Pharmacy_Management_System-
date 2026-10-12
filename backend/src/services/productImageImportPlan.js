const fs = require('node:fs/promises')
const path = require('node:path')
const crypto = require('node:crypto')
const storage = require('./productImageStorage')
const { exactMatch, identityFields } = require('./productImageMatching')
const { validateImageMetadata } = require('./productImageMetadata')

const sha256 = buffer => crypto.createHash('sha256').update(buffer).digest('hex')

function reviewTemplate(products) {
  return {
    policy: 'Confirm exact identity and usage permission, provide a local file, then preview before requesting bulk approval.',
    approved: products.filter(product => product.is_active && !product.image_path && !product.image_external_url).map(product => ({
      productId: product.product_id, productCode: product.product_code, name: product.product_name,
      genericName: product.generic_name || '', manufacturer: product.manufacturer || '',
      ...identityFields(product.product_name), filename: '', mimeType: '', sourceUrl: '', license: '',
      verified: false, rightsConfirmed: false,
    })),
    review: {},
  }
}

async function buildImportPlan(products, candidates, assetRoot) {
  if (!Array.isArray(candidates)) throw new Error('Approved candidates must be an array')
  const updates = [], rejected = []
  const counts = new Map()
  for (const candidate of candidates) counts.set(Number(candidate?.productId), (counts.get(Number(candidate?.productId)) || 0) + 1)
  for (const candidate of candidates) {
    const productId = Number(candidate?.productId)
    try {
      if (!Number.isSafeInteger(productId) || productId < 1) throw new Error('Invalid permanent Product ID')
      if (counts.get(productId) !== 1) throw new Error('Duplicate Product ID in review; no assignment is proposed')
      const product = products.find(item => item.product_id === productId)
      if (!product || !product.is_active) throw new Error('Product is missing or inactive')
      if (product.image_path || product.image_external_url) throw new Error('Existing image preserved')
      if (!exactMatch(product, candidate)) throw new Error('Exact identity or usage permission has not been verified')
      const filename = candidate.filename
      if (typeof filename !== 'string' || !filename || filename !== path.basename(filename) || /[/\\:]/.test(filename)) throw new Error('Use a filename directly inside the approved asset directory')
      const assetPath = path.join(assetRoot, filename)
      const stat = await fs.lstat(assetPath)
      if (!stat.isFile()) throw new Error('Candidate must be a regular local image file')
      if (!stat.size || stat.size > storage.MAX_IMAGE_BYTES) throw new Error('Candidate image must be non-empty and no larger than 5 MB')
      const buffer = await fs.readFile(assetPath)
      const file = storage.validateAndDescribe({ buffer, size: buffer.length, originalName: filename, declaredMimeType: candidate.mimeType })
      const metadata = validateImageMetadata({ rights_confirmed: candidate.rightsConfirmed, source_url: candidate.sourceUrl, license: candidate.license, alt_text: product.product_name })
      const digest = sha256(buffer)
      if (candidate.sha256 && candidate.sha256 !== digest) throw new Error('Image bytes changed since review')
      updates.push({ productId, productCode: product.product_code, name: product.product_name,
        manufacturer: product.manufacturer, genericName: product.generic_name, ...identityFields(product.product_name),
        filename, mimeType: file.mimeType, fileSize: file.fileSize, sha256: digest,
        sourceUrl: metadata.sourceUrl, license: metadata.license, altText: metadata.altText,
        previousImage: null,
      })
    } catch (error) {
      rejected.push({ productId: Number.isFinite(productId) ? productId : null, reason: error.code === 'ENOENT' ? 'Reviewed local image file is missing' : error.message })
    }
  }
  updates.sort((a, b) => a.productId - b.productId)
  rejected.sort((a, b) => (a.productId || 0) - (b.productId || 0))
  return { updates, rejected, planSha256: sha256(JSON.stringify({ updates, rejected })) }
}

module.exports = { buildImportPlan, reviewTemplate, sha256 }
