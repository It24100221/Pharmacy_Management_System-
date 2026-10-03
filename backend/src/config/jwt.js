const JWT_ISSUER = 'pharmacy-management-api'
const JWT_AUDIENCE = 'pharmacy-management-web'

function getJwtSecret() {
  const secret = String(process.env.JWT_SECRET || '').trim()
  if (secret.length < 32) {
    throw new Error('JWT_SECRET must be configured with at least 32 characters')
  }
  return secret
}

function assertJwtSecret() {
  getJwtSecret()
}

module.exports = { JWT_ISSUER, JWT_AUDIENCE, getJwtSecret, assertJwtSecret }
