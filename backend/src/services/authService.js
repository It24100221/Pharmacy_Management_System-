const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const ApiError = require('../middleware/errorHandler');
const users = require('../repositories/userRepository');
const { validateRegistration, validateLogin } = require('../validators/authValidator');

const TOKEN_AGE_SECONDS = 60 * 60 * 8;
const DUMMY_HASH = bcrypt.hashSync('unregistered-account-placeholder', 12);

function signingSecret() {
  const secret = process.env.AUTH_JWT_SECRET;
  if (!secret || secret.length < 32 || secret.startsWith('CHANGE_ME')) throw new ApiError('Authentication is not configured: set AUTH_JWT_SECRET to a random secret (at least 32 characters)', 503);
  return secret;
}

function publicUser(user) {
  return {
    id: user.id, username: user.username, email: user.email,
    role: user.role, customer_id: user.customer_id, supplier_id: user.supplier_id
  };
}

function issueToken(user) {
  return jwt.sign({ sub: String(user.id) }, signingSecret(), {
    algorithm: 'HS256', expiresIn: TOKEN_AGE_SECONDS, issuer: 'pharmacy-management'
  });
}

async function register(body) {
  signingSecret();
  const data = validateRegistration(body);
  const existingUsername = await users.findByIdentifier(data.username);
  const existingEmail = await users.findByIdentifier(data.email);
  if (existingUsername || existingEmail) throw new ApiError('Username or email is already registered', 409);
  const hash = await bcrypt.hash(data.password, 12);
  try {
    const user = await users.createCustomerAccount(data, hash);
    return publicUser(user);
  } catch (error) {
    // A concurrent registration can race the pre-check; SQL's unique indexes
    // remain authoritative and the transaction rolls back the customer insert.
    const sqlNumber = error.number || error.original?.number || error.original?.originalError?.number;
    if (sqlNumber === 2601 || sqlNumber === 2627) {
      throw new ApiError('Username or email is already registered', 409);
    }
    throw error;
  }
}

async function login(body) {
  signingSecret();
  const { identifier, password } = validateLogin(body);
  const user = await users.findByIdentifier(identifier);
  const match = await bcrypt.compare(password, user?.password_hash || DUMMY_HASH);
  if (!user || !match) throw new ApiError('Invalid username/email or password', 401);
  if (user.account_status !== 'ACTIVE') throw new ApiError('Account is disabled', 403);
  return { user: publicUser(user), token: issueToken(user), expires_in: TOKEN_AGE_SECONDS };
}

async function authenticateToken(token) {
  let payload;
  try {
    payload = jwt.verify(token, signingSecret(), { algorithms: ['HS256'], issuer: 'pharmacy-management' });
  } catch (error) {
    if (error.statusCode === 503) throw error;
    throw new ApiError('Invalid or expired session', 401);
  }
  if (!/^\d+$/.test(payload.sub)) throw new ApiError('Invalid session', 401);
  const user = await users.findById(Number(payload.sub));
  if (!user || user.account_status !== 'ACTIVE') throw new ApiError('Invalid or disabled session', 401);
  return publicUser(user);
}

module.exports = { register, login, authenticateToken, publicUser, signingSecret };
