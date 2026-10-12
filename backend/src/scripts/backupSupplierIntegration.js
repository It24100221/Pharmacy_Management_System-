const fs = require('fs/promises');
const path = require('path');
const { sql, sqlConfig } = require('../config/sqlServer');

async function run() {
  if (sqlConfig.database !== 'pharmacy_management') throw new Error('Backup must use the existing pharmacy_management database');
  const connection = await new sql.ConnectionPool(sqlConfig).connect();
  try {
    const paths = (await connection.request().query("SELECT CAST(SERVERPROPERTY('InstanceDefaultBackupPath') AS nvarchar(500)) AS backupPath, CAST(SERVERPROPERTY('InstanceDefaultDataPath') AS nvarchar(500)) AS dataPath, CAST(SERVERPROPERTY('InstanceDefaultLogPath') AS nvarchar(500)) AS logPath")).recordset[0];
    if (!paths.backupPath) throw new Error('SQL Server backup directory is unavailable');
    const stamp = new Date().toISOString().replace(/[^0-9]/g, '');
    const backupPath = path.win32.join(paths.backupPath, `pharmacy_management_before_supplier_integration_${stamp}.bak`);
    await connection.request().input('file', sql.NVarChar(1000), backupPath).query('BACKUP DATABASE [pharmacy_management] TO DISK = @file WITH COPY_ONLY, CHECKSUM');
    await connection.request().input('file', sql.NVarChar(1000), backupPath).query('RESTORE VERIFYONLY FROM DISK = @file WITH CHECKSUM');
    const baseline = {};
    for (const table of ['medicines', 'products', 'suppliers', 'purchases', 'purchase_items', 'sales', 'sale_items', 'reorder_requests']) baseline[table] = (await connection.request().query(`SELECT * FROM dbo.${table}`)).recordset;
    const directory = path.resolve(__dirname, '../../.local'); await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, 'supplier-integration-baseline.json'), JSON.stringify(baseline, null, 2));
    const receipt = { ...paths, createdAt: new Date().toISOString(), sourceDatabase: sqlConfig.database, backupPath, verified: true };
    await fs.writeFile(path.join(directory, 'supplier-integration-backup.json'), JSON.stringify(receipt, null, 2));
    console.log(JSON.stringify(receipt));
    if (process.argv.includes('--prepare-test-database')) {
      const exists = (await connection.request().query("SELECT database_id FROM sys.databases WHERE name = 'pharmacy_management_test'")).recordset.length;
      if (exists) { console.log('Existing isolated test database preserved'); return; }
      const files = (await connection.request().input('file', sql.NVarChar(1000), backupPath).query('RESTORE FILELISTONLY FROM DISK = @file')).recordset;
      if (files.length !== 2 || !files.some(file => file.Type === 'D') || !files.some(file => file.Type === 'L')) throw new Error('Automatic test restore supports one data and one log file');
      const dataFile = files.find(file => file.Type === 'D'); const logFile = files.find(file => file.Type === 'L');
      await connection.request().input('file', sql.NVarChar(1000), backupPath)
        .input('dataName', sql.NVarChar(500), dataFile.LogicalName).input('logName', sql.NVarChar(500), logFile.LogicalName)
        .input('dataPath', sql.NVarChar(1000), path.win32.join(paths.dataPath, 'pharmacy_management_test.mdf'))
        .input('logPath', sql.NVarChar(1000), path.win32.join(paths.logPath, 'pharmacy_management_test_log.ldf'))
        .query('RESTORE DATABASE [pharmacy_management_test] FROM DISK = @file WITH MOVE @dataName TO @dataPath, MOVE @logName TO @logPath, RECOVERY, CHECKSUM');
      console.log('Created isolated pharmacy_management_test database from the verified backup; live database untouched');
    }
  } finally { await connection.close(); }
}
run().catch(error => { console.error(error.message); process.exitCode = 1; });
