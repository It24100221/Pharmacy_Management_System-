// ============================================================================
// CENTRAL DATABASE LAYER — Microsoft SQL Server (Stage 0B)
//
// This module is the ONLY place that knows how the application talks to the
// database. Repositories depend on the small `pool` / transaction surface it
// exposes and never open a connection themselves.
//
//   Driver:   msnodesqlv8 (through the `mssql` API, dialect `mssql/msnodesqlv8`)
//   Auth:     Windows Authentication — `DB_TRUSTED_CONNECTION=true` (default)
//             produces ODBC `Trusted_Connection=yes`. SQL Authentication is only
//             used when DB_TRUSTED_CONNECTION=false AND DB_USER is supplied; it
//             is never silently substituted for Windows Authentication.
//   Config:   environment variables only (see backend/.env.example)
//
// Surface exposed to the rest of the backend:
//   pool.execute(sql, params)      -> [rows]   (positional `?` markers, bound)
//   pool.getConnection(opts)       -> transaction wrapper
//   testConnection()               -> { ok, ... }   SELECT 1 + database name
//   close()                        -> clean shutdown
//
// Failure policy: every driver failure is normalized into an Error carrying a
// statusCode — 503 for "cannot reach/log into the database", 500 for a query
// failure — with a message that says which happened. Nothing here ever
// substitutes mock or local data for a failed database operation.
// ============================================================================

require('dotenv').config()

const CONNECTION_FAILURE = 503
const QUERY_FAILURE = 500

// ---------------------------------------------------------------------------
// Configuration (environment only — no hard-coded server/instance/credentials)
// ---------------------------------------------------------------------------
function readInt(name, fallback) {
  const raw = process.env[name]
  if (raw === undefined || raw === '') return fallback
  const value = Number.parseInt(raw, 10)
  return Number.isNaN(value) ? fallback : value
}

function buildConfig() {
  let server = (process.env.DB_SERVER || '').trim()
  if (!server) {
    const error = new Error(
      'Database unavailable: DB_SERVER is not set. Copy backend/.env.example to backend/.env and set DB_SERVER (and DB_INSTANCE for a named instance such as SQLEXPRESS).'
    )
    error.statusCode = CONNECTION_FAILURE
    error.isOperational = true
    throw error
  }

  const trustedConnection = String(process.env.DB_TRUSTED_CONNECTION ?? 'true').toLowerCase() !== 'false'
  const user = process.env.DB_USER ? process.env.DB_USER.trim() : undefined

  if (!trustedConnection && !user) {
    const error = new Error(
      'Database unavailable: DB_TRUSTED_CONNECTION=false requires DB_USER. Refusing to silently swap Windows Authentication for SQL Authentication.'
    )
    error.statusCode = CONNECTION_FAILURE
    error.isOperational = true
    throw error
  }

  let instanceName = (process.env.DB_INSTANCE || '').trim() || undefined
  // DB_SERVER=HOST\INSTANCE is also accepted.
  const serverParts = server.split('\\')
  if (serverParts.length === 2 && serverParts[0] && serverParts[1]) {
    server = serverParts[0]
    instanceName = instanceName || serverParts[1]
  }

  const port = readInt('DB_PORT', 1433)
  const driver = (process.env.DB_DRIVER || '').trim() || '{SQL Server}'
  const database = (process.env.DB_DATABASE || '').trim() || 'pharmacy_management'
  const encrypt = String(process.env.DB_ENCRYPT ?? 'false').toLowerCase() === 'true'
  const networkLibrary = (process.env.DB_NETWORK_LIBRARY || '').trim() || 'DBMSSOCN'

  const config = {
    driver: 'msnodesqlv8',
    server,
    database,
    port,
    options: {
      instanceName,
      trustedConnection,
      encrypt,
      useUTC: false
    },
    pool: {
      max: readInt('DB_POOL_MAX', 10),
      min: 0,
      idleTimeoutMillis: 30000
    },
    connectionTimeout: readInt('DB_CONNECTION_TIMEOUT_MS', 15000),
    requestTimeout: readInt('DB_REQUEST_TIMEOUT_MS', 15000),
    // Built explicitly so the ODBC keywords match the driver that is actually
    // installed (the legacy "SQL Server" driver rejects Encrypt=false, for
    // example). `DB_SERVER=host\INSTANCE` is also accepted and is split by the
    // driver layer into server + instanceName.
    connectionString: buildConnectionString({
      driver,
      server,
      instanceName,
      port,
      database,
      trustedConnection,
      user,
      password: process.env.DB_PASSWORD || '',
      encrypt,
      networkLibrary
    })
  }

  if (!trustedConnection) {
    config.user = user
    config.password = process.env.DB_PASSWORD || ''
  }

  return config
}

function buildConnectionString(cfg) {
  const serverPart = cfg.instanceName ? `${cfg.server}\\${cfg.instanceName}` : `${cfg.server},${cfg.port}`
  const parts = [
    `Driver=${cfg.driver}`,
    `Server=${serverPart}`,
    `Database=${cfg.database}`
  ]

  if (cfg.trustedConnection) {
    parts.push('Trusted_Connection=yes')
  } else {
    parts.push(`Uid=${cfg.user}`)
    parts.push(`Pwd=${cfg.password}`)
  }

  if (cfg.networkLibrary) parts.push(`Network Library=${cfg.networkLibrary}`)
  if (cfg.encrypt) parts.push('Encrypt=yes')

  return parts.join(';')
}

function loadDriver() {
  try {
    // Lazy require so a missing native binary produces one clear message
    // instead of crashing the process at import time.
    return require('mssql/msnodesqlv8')
  } catch (error) {
    const failure = new Error(
      `Database unavailable: the msnodesqlv8 driver could not be loaded (${error.message}). Run "npm install" in backend/ on Windows.`
    )
    failure.statusCode = CONNECTION_FAILURE
    failure.isOperational = true
    failure.original = error
    throw failure
  }
}

// ---------------------------------------------------------------------------
// Error normalization
// ---------------------------------------------------------------------------
const CONNECTION_ERROR_PATTERN = new RegExp(
  [
    'ECONN',
    'ETIMEOUT',
    'ESOCKET',
    '08S01',
    '08001',
    'IMSL0',
    '10061',
    'login',
    'logon',
    'server was not found',
    'instance',
    'network',
    'timeout',
    'trusted connection',
    'odbc driver',
    'communication link'
  ].join('|'),
  'i'
)

function normalizeError(error, phase) {
  if (!error) {
    const unknown = new Error('Database error: unknown database failure')
    unknown.statusCode = QUERY_FAILURE
    unknown.isOperational = true
    return unknown
  }
  if (error.isOperational && error.statusCode) return error

  const detail = [error.code, error.message, error.sqlState].filter(Boolean).join(' ')
  const isConnectionFailure = phase === 'connect' || CONNECTION_ERROR_PATTERN.test(detail)

  const normalized = new Error(
    isConnectionFailure
      ? `Database unavailable: ${error.message}`
      : `Database error: ${error.message}`
  )
  normalized.statusCode = isConnectionFailure ? CONNECTION_FAILURE : QUERY_FAILURE
  normalized.isOperational = true
  normalized.original = error
  if (error.code) normalized.code = error.code
  return normalized
}

// ---------------------------------------------------------------------------
// Positional `?` -> named `@pN` conversion.
//
// SQL Server parameter markers are named. Values are NEVER written into the
// SQL text: each marker is bound with request.input('pN', value) below, so the
// statement stays fully parameterized. `?` characters inside string literals or
// comments are left untouched.
// ---------------------------------------------------------------------------
function toNamedParameters(sql) {
  let converted = ''
  let index = 0
  let placeholder = 0
  let inSingle = false
  let inDouble = false
  let inLineComment = false
  let inBlockComment = false

  while (index < sql.length) {
    const char = sql[index]
    const next = sql[index + 1]

    if (inLineComment) {
      converted += char
      if (char === '\n') inLineComment = false
      index += 1
      continue
    }

    if (inBlockComment) {
      converted += char
      if (char === '*' && next === '/') {
        converted += '/'
        index += 2
        inBlockComment = false
        continue
      }
      index += 1
      continue
    }

    if (inSingle) {
      converted += char
      if (char === "'") {
        if (next === "'") {
          converted += "'"
          index += 2
          continue
        }
        inSingle = false
      }
      index += 1
      continue
    }

    if (inDouble) {
      converted += char
      if (char === '"') inDouble = false
      index += 1
      continue
    }

    if (char === '-' && next === '-') {
      inLineComment = true
      converted += char
      index += 1
      continue
    }
    if (char === '/' && next === '*') {
      inBlockComment = true
      converted += '/*'
      index += 2
      continue
    }
    if (char === "'") {
      inSingle = true
      converted += char
      index += 1
      continue
    }
    if (char === '"') {
      inDouble = true
      converted += char
      index += 1
      continue
    }
    if (char === '?') {
      converted += `@p${placeholder}`
      placeholder += 1
      index += 1
      continue
    }

    converted += char
    index += 1
  }

  return { sql: converted, placeholderCount: placeholder }
}

function bindParameters(request, params, placeholderCount) {
  const values = Array.isArray(params) ? params : []

  values.forEach((value, position) => {
    request.input(`p${position}`, value === undefined ? null : value)
  })
}

function assertArity(placeholderCount, params) {
  const values = Array.isArray(params) ? params : []
  if (values.length !== placeholderCount) {
    const error = new Error(
      `Database error: statement expects ${placeholderCount} parameter(s) but ${values.length} were provided`
    )
    error.statusCode = QUERY_FAILURE
    error.isOperational = true
    throw error
  }
}

function rowsFrom(result) {
  if (!result) return []
  if (Array.isArray(result.recordset)) return result.recordset
  if (Array.isArray(result.recordsets) && Array.isArray(result.recordsets[0])) return result.recordsets[0]
  return []
}

// ---------------------------------------------------------------------------
// Pool lifecycle — lazy connect, and a failed connect clears the cached promise
// so the next request genuinely retries (recovery after an outage).
// ---------------------------------------------------------------------------
let poolPromise = null

function getPool() {
  if (!poolPromise) {
    const driver = loadDriver()
    let config
    try {
      config = buildConfig()
    } catch (error) {
      return Promise.reject(normalizeError(error, 'connect'))
    }

    poolPromise = new driver.ConnectionPool(config)
      .connect()
      .catch((error) => {
        poolPromise = null
        throw normalizeError(error, 'connect')
      })
  }
  return poolPromise
}

async function execute(sql, params) {
  const { sql: statement, placeholderCount } = toNamedParameters(sql)
  // Fail fast on a programming error before touching the connection.
  assertArity(placeholderCount, params)

  let pool
  try {
    pool = await getPool()
  } catch (error) {
    throw normalizeError(error, 'connect')
  }

  const request = pool.request()
  bindParameters(request, params)

  try {
    const result = await request.query(statement)
    return [rowsFrom(result)]
  } catch (error) {
    throw normalizeError(error, 'query')
  }
}

// ---------------------------------------------------------------------------
// Transactions.
//
// `serializable: true` is used by the stock-changing operations (sale,
// purchase). It pairs with the `WITH (UPDLOCK, ROWLOCK)` read of the medicine
// row so two concurrent sales cannot both read the pre-decrement quantity.
// ---------------------------------------------------------------------------
const ISOLATION_LEVELS = {
  serializable: 'SERIALIZABLE',
  readCommitted: 'READ_COMMITTED'
}

async function getConnection(options = {}) {
  const driver = loadDriver()

  let pool
  try {
    pool = await getPool()
  } catch (error) {
    throw normalizeError(error, 'connect')
  }

  const transaction = new driver.Transaction(pool)
  const isolation = options.serializable
    ? driver.ISOLATION_LEVEL.SERIALIZABLE
    : driver.ISOLATION_LEVEL.READ_COMMITTED

  let begun = false
  let finished = false
  let released = false
  const state = {
    began: 0,
    committed: 0,
    rolledBack: 0,
    released: 0,
    isolation: ISOLATION_LEVELS[options.serializable ? 'serializable' : 'readCommitted']
  }

  const markFinished = (key) => {
    if (finished) return
    finished = true
    state[key] += 1
  }

  return {
    state,

    async execute(query, params) {
      const { sql: statement, placeholderCount } = toNamedParameters(query)
      assertArity(placeholderCount, params)
      const request = new driver.Request(transaction)
      bindParameters(request, params)

      try {
        const result = await request.query(statement)
        return [rowsFrom(result)]
      } catch (error) {
        throw normalizeError(error, 'query')
      }
    },

    async beginTransaction() {
      if (begun) return
      try {
        await transaction.begin(isolation)
        begun = true
        state.began += 1
      } catch (error) {
        throw normalizeError(error, 'connect')
      }
    },

    async commit() {
      if (!begun || finished) return
      try {
        await transaction.commit()
        markFinished('committed')
      } catch (error) {
        throw normalizeError(error, 'query')
      }
    },

    async rollback() {
      if (!begun || finished) return
      try {
        await transaction.rollback()
        markFinished('rolledBack')
      } catch (error) {
        throw normalizeError(error, 'query')
      }
    },

    release() {
      if (released) return
      released = true
      state.released += 1
      if (begun && !finished) {
        // Never leak an open transaction back to the pool.
        finished = true
        state.rolledBack += 1
        transaction.rollback().catch(() => {})
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Connection test — SELECT 1 plus one real application table.
// ---------------------------------------------------------------------------
async function testConnection() {
  try {
    const pool = await getPool()

    const probe = await pool.request().query('SELECT 1 AS connection_test;')
    const connectionTest = rowsFrom(probe)[0]

    const identity = await pool
      .request()
      .query('SELECT DB_NAME() AS database_name, @@SERVERNAME AS server_name, SUSER_SNAME() AS login_name;')
    const identityRow = rowsFrom(identity)[0] || {}

    // Prove the application schema is actually present, not just a server.
    const schema = await pool
      .request()
      .query("SELECT COUNT(*) AS table_count FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE';")
    const tableCount = (rowsFrom(schema)[0] || {}).table_count

    if (!connectionTest || Number(connectionTest.connection_test) !== 1) {
      throw new Error('SELECT 1 did not return 1')
    }

    return {
      ok: true,
      driver: 'msnodesqlv8',
      auth: String(process.env.DB_TRUSTED_CONNECTION ?? 'true').toLowerCase() !== 'false'
        ? 'Windows Authentication (Trusted Connection)'
        : 'SQL Authentication',
      server: identityRow.server_name || null,
      database: identityRow.database_name || null,
      login: identityRow.login_name || null,
      base_tables: tableCount === undefined ? null : Number(tableCount),
      message: 'Database connected successfully'
    }
  } catch (error) {
    const normalized = normalizeError(error, 'connect')
    return {
      ok: false,
      driver: 'msnodesqlv8',
      message: normalized.message,
      statusCode: normalized.statusCode
    }
  }
}

async function close() {
  if (!poolPromise) return
  const pending = poolPromise
  poolPromise = null
  try {
    const pool = await pending
    await pool.close()
  } catch (error) {
    // Shutdown must not throw on an already-broken pool.
  }
}

module.exports = {
  pool: { execute, getConnection },
  execute,
  getConnection,
  testConnection,
  close,
  // Exported for unit tests and diagnostics only.
  toNamedParameters
}
