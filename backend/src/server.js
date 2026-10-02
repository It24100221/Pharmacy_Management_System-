const app = require('./app');
const { testConnection, close } = require('./config/database');

const PORT = process.env.PORT || 5000;

// Probe the database at startup and say clearly whether it is reachable.
// A failure here does not fake anything: the API still starts, every database
// request then fails with 503 "Database unavailable: ...", and /api/health
// reports database.status = unreachable.
async function reportDatabaseStatus() {
  const result = await testConnection();

  if (result.ok) {
    console.log(`Database connected successfully (${result.driver}, ${result.auth})`);
    console.log(`  server : ${result.server}`);
    console.log(`  database: ${result.database}`);
    console.log(`  login   : ${result.login}`);
    console.log(`  tables  : ${result.base_tables}`);
  } else {
    console.error('Database connection FAILED at startup.');
    console.error(`  ${result.message}`);
    console.error('  Fix DB_SERVER / DB_INSTANCE / DB_DATABASE in backend/.env (see backend/.env.example).');
    console.error('  No local or mock data will be substituted for database writes.');
  }

  return result.ok;
}

// Start server
const server = app.listen(PORT, () => {
  console.log(`Pharmacy Management API running on port ${PORT}`);
  console.log(`Health endpoint: http://localhost:${PORT}/api/health`);
  reportDatabaseStatus();
});

// Clean shutdown — release the SQL Server pool instead of dropping it.
function shutdown(signal) {
  console.log(`${signal} received, closing database pool...`);
  server.close(async () => {
    await close();
    process.exit(0);
  });
  // Failsafe if a request hangs the pool.
  setTimeout(() => process.exit(0), 5000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
