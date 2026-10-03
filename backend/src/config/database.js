const sql = require('mssql');
require('dotenv').config();

const sqlConfig = {
  server: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 1433,
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'pharmacy_management',
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE !== 'false'
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

const poolPromise = new sql.ConnectionPool(sqlConfig).connect();

function convertQuery(query) {
  let parameterIndex = 0;
  let converted = query.replace(/\?/g, () => `@p${parameterIndex++}`);

  converted = converted
    .replace(/DATE_ADD\(CURDATE\(\), INTERVAL 30 DAY\)/g, 'DATEADD(day, 30, CAST(GETDATE() AS date))')
    .replace(/DATEDIFF\(([^,]+), CURDATE\(\)\)/g, 'DATEDIFF(day, CAST(GETDATE() AS date), $1)')
    .replace(/DATE\(([^)]+)\)/g, 'CAST($1 AS date)')
    .replace(/CURDATE\(\)/g, 'CAST(GETDATE() AS date)')
    .replace(/NOW\(\)/g, 'GETDATE()')
    .replace(/\s+FOR UPDATE\b/gi, '')
    .replace(/FROM medicines(?=\s+WHERE\b)/gi, 'FROM medicines WITH (UPDLOCK, ROWLOCK)')
    .replace(/LIMIT @p(\d+) OFFSET @p(\d+)/i, 'OFFSET @p$2 ROWS FETCH NEXT @p$1 ROWS ONLY')
    .replace(/LIMIT @p(\d+)/i, 'OFFSET 0 ROWS FETCH NEXT @p$1 ROWS ONLY');

  if (/^\s*INSERT\s+INTO\s+\w+/i.test(converted) && !/OUTPUT\s+INSERTED\.id/i.test(converted)) {
    converted = converted.replace(/^(\s*INSERT\s+INTO\s+\w+\s*\([\s\S]*?\))(\s*VALUES\b)/i, '$1 OUTPUT INSERTED.id$2');
  }

  return { query: converted, parameterCount: parameterIndex };
}

async function executeOn(requestFactory, query, params = []) {
  const converted = convertQuery(query);
  const request = requestFactory();

  params.forEach((value, index) => request.input(`p${index}`, value));

  const result = await request.query(converted.query);
  if (converted.query.trimStart().toUpperCase().startsWith('INSERT')) {
    return [{ insertId: result.recordset?.[0]?.id }];
  }
  return [result.recordset || []];
}

const pool = {
  async execute(query, params = []) {
    const connectionPool = await poolPromise;
    return executeOn(() => connectionPool.request(), query, params);
  },

  async getConnection() {
    const connectionPool = await poolPromise;
    const transaction = new sql.Transaction(connectionPool);

    return {
      beginTransaction: () => transaction.begin(),
      commit: () => transaction.commit(),
      rollback: () => transaction.rollback(),
      release: () => {},
      execute: (query, params = []) => executeOn(() => transaction.request(), query, params)
    };
  }
};

// Test connection
async function testConnection() {
  try {
    await poolPromise;
    console.log('Database connected successfully');
    return true;
  } catch (error) {
    console.error('Database connection failed:', error.message);
    return false;
  }
}

module.exports = {
  pool,
  testConnection,
  sql
};
