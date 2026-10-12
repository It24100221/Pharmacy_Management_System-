const fs = require('fs/promises');
const path = require('path');
const { sql, sqlConfig } = require('../config/sqlServer');

const migrationsDirectory = path.resolve(__dirname, '../../../database/mssql/migrations');
const migrationPattern = /^(\d{3})_([a-z0-9_]+)\.sql$/;

const splitBatches = script => script
  .split(/^\s*GO\s*;?\s*$/gim)
  .map(batch => batch.trim())
  .filter(Boolean);

async function run() {
  const connection = await new sql.ConnectionPool(sqlConfig).connect();
  try {
    await connection.request().query(`
      IF OBJECT_ID(N'dbo.schema_migrations', N'U') IS NULL
      BEGIN
        CREATE TABLE dbo.schema_migrations (
          migration_id INT NOT NULL CONSTRAINT PK_schema_migrations PRIMARY KEY,
          migration_name NVARCHAR(255) NOT NULL CONSTRAINT UQ_schema_migrations_name UNIQUE,
          applied_at DATETIME2(0) NOT NULL CONSTRAINT DF_schema_migrations_applied_at DEFAULT SYSDATETIME()
        );
      END;
    `);

    const files = (await fs.readdir(migrationsDirectory))
      .filter(file => migrationPattern.test(file))
      .sort();
    const seenIds = new Set();

    for (const file of files) {
      const match = file.match(migrationPattern);
      const migrationId = Number(match[1]);
      const migrationName = file.replace(/\.sql$/, '');
      if (seenIds.has(migrationId)) throw new Error(`Duplicate migration ID ${migrationId}`);
      seenIds.add(migrationId);

      const appliedResult = await connection.request()
        .input('migrationId', sql.Int, migrationId)
        .query('SELECT migration_name FROM dbo.schema_migrations WHERE migration_id = @migrationId');
      const applied = appliedResult.recordset[0];
      if (applied) {
        if (applied.migration_name !== migrationName) {
          throw new Error(`Migration ${migrationId} was recorded as ${applied.migration_name}, not ${migrationName}`);
        }
        console.log(`Already applied: ${migrationName}`);
        continue;
      }

      const transaction = new sql.Transaction(connection);
      await transaction.begin();
      try {
        const script = await fs.readFile(path.join(migrationsDirectory, file), 'utf8');
        for (const batch of splitBatches(script)) await transaction.request().query(batch);
        await transaction.request()
          .input('migrationId', sql.Int, migrationId)
          .input('migrationName', sql.NVarChar(255), migrationName)
          .query(`
            INSERT INTO dbo.schema_migrations (migration_id, migration_name)
            VALUES (@migrationId, @migrationName)
          `);
        await transaction.commit();
        console.log(`Applied: ${migrationName}`);
      } catch (error) {
        try {
          await transaction.rollback();
        } catch {
          // XACT_ABORT can roll back automatically; preserve the original SQL error.
        }
        throw error;
      }
    }
  } finally {
    await connection.close();
  }
}

run().catch(error => {
  console.error(`Migration failed: ${error.message}`);
  process.exitCode = 1;
});
