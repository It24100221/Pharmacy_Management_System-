const normalize = value => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase()
const identityFields = name => ({
  strength: name.match(/\b\d+(?:\.\d+)?\s*mg\b/i)?.[0] || '',
  form: name.match(/\b(tablets|capsules|syrup|gel|cream|injection)\b/i)?.[0] || '',
  packSize: name.match(/\(([^)]+)\)/)?.[1] || '',
})

function exactMatch(product, candidate) {
  if (!candidate || candidate.verified !== true || candidate.rightsConfirmed !== true || !candidate.sourceUrl || !candidate.license) return false
  const identity = identityFields(product.product_name)
  return Number(candidate.productId) === product.product_id && candidate.productCode === product.product_code &&
    normalize(candidate.name) === normalize(product.product_name) &&
    Boolean(normalize(candidate.manufacturer)) && normalize(candidate.manufacturer) === normalize(product.manufacturer) &&
    Boolean(normalize(candidate.genericName)) && normalize(candidate.genericName) === normalize(product.generic_name) &&
    ['strength', 'form', 'packSize'].every(field => Boolean(identity[field]) && normalize(identity[field]) === normalize(candidate[field]))
}

module.exports = { exactMatch, identityFields }
