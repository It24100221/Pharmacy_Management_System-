const net = require('net')
const ApiError = require('../middleware/errorHandler')

function validateImageUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) throw new ApiError('A valid HTTPS image URL is required', 400)
  let url
  try { url = new URL(value) } catch { throw new ApiError('A valid HTTPS image URL is required', 400) }
  const host = url.hostname.toLowerCase()
  if (url.protocol !== 'https:' || url.username || url.password || url.port || net.isIP(host) || host.includes(':') || !host.includes('.') || /(^|\.)(localhost|local|internal|test)$/.test(host)) {
    throw new ApiError('Use a public HTTPS image URL without credentials or a custom port', 400)
  }
  return url.href
}

function validateImageMetadata(body = {}) {
  const text = (key, max) => {
    if (body[key] === undefined || body[key] === null || body[key] === '') return null
    if (typeof body[key] !== 'string' || body[key].trim().length > max) throw new ApiError(`Invalid ${key}`, 400)
    return body[key].trim() || null
  }
  if (body.rights_confirmed !== true && body.rights_confirmed !== 'true') throw new ApiError('Confirm that you have permission to use this image', 400)
  return { sourceUrl: body.source_url ? validateImageUrl(body.source_url) : null, license: text('license', 500), altText: text('alt_text', 255) }
}

module.exports = { validateImageMetadata, validateImageUrl }
