const { sql, sqlConfig } = require('./sqlServer');

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

  return { query: converted, parameterCount: parameterIndex };
}

async function executeOn(requestFactory, query, params = []) {
  const converted = convertQuery(query);
  const request = requestFactory();

  params.forEach((value, index) => request.input(`p${index}`, value));

  const result = await request.query(converted.query);
  if (converted.query.trimStart().toUpperCase().startsWith('INSERT')) {
    return [result.recordset?.[0] || {}];
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

async function closePool() {
  const connectionPool = await poolPromise;
  await connectionPool.close();
}

module.exports = {
  pool,
  testConnection,
  closePool,
  sql,
  sqlConfig
};
