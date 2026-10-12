const { sql, sqlConfig } = require('../config/sqlServer');

const queries = {
  identity: `
    SELECT
      DB_NAME() AS database_name,
      CAST(SERVERPROPERTY('ProductVersion') AS NVARCHAR(128)) AS product_version,
      CAST(SERVERPROPERTY('ProductLevel') AS NVARCHAR(128)) AS product_level,
      CAST(SERVERPROPERTY('Edition') AS NVARCHAR(128)) AS edition
  `,
  tables: `
    SELECT
      s.name AS schema_name,
      t.name AS table_name,
      SUM(CASE WHEN p.index_id IN (0, 1) THEN p.rows ELSE 0 END) AS row_count
    FROM sys.tables t
    JOIN sys.schemas s ON s.schema_id = t.schema_id
    LEFT JOIN sys.partitions p ON p.object_id = t.object_id
    GROUP BY s.name, t.name
    ORDER BY s.name, t.name
  `,
  columns: `
    SELECT
      s.name AS schema_name,
      t.name AS table_name,
      c.column_id,
      c.name AS column_name,
      ty.name AS data_type,
      c.max_length,
      c.precision,
      c.scale,
      c.is_nullable,
      c.is_identity,
      dc.name AS default_name,
      dc.definition AS default_definition
    FROM sys.tables t
    JOIN sys.schemas s ON s.schema_id = t.schema_id
    JOIN sys.columns c ON c.object_id = t.object_id
    JOIN sys.types ty ON ty.user_type_id = c.user_type_id
    LEFT JOIN sys.default_constraints dc ON dc.object_id = c.default_object_id
    ORDER BY s.name, t.name, c.column_id
  `,
  keys: `
    SELECT
      s.name AS schema_name,
      t.name AS table_name,
      k.name AS key_name,
      k.type_desc,
      STRING_AGG(c.name, ',') WITHIN GROUP (ORDER BY ic.key_ordinal) AS columns
    FROM sys.key_constraints k
    JOIN sys.tables t ON t.object_id = k.parent_object_id
    JOIN sys.schemas s ON s.schema_id = t.schema_id
    JOIN sys.index_columns ic
      ON ic.object_id = t.object_id AND ic.index_id = k.unique_index_id
    JOIN sys.columns c
      ON c.object_id = t.object_id AND c.column_id = ic.column_id
    GROUP BY s.name, t.name, k.name, k.type_desc
    ORDER BY s.name, t.name, k.name
  `,
  foreign_keys: `
    SELECT
      fk.name,
      ps.name AS parent_schema,
      pt.name AS parent_table,
      pc.name AS parent_column,
      rs.name AS referenced_schema,
      rt.name AS referenced_table,
      rc.name AS referenced_column,
      fk.delete_referential_action_desc,
      fk.update_referential_action_desc
    FROM sys.foreign_keys fk
    JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
    JOIN sys.tables pt ON pt.object_id = fk.parent_object_id
    JOIN sys.schemas ps ON ps.schema_id = pt.schema_id
    JOIN sys.columns pc
      ON pc.object_id = pt.object_id AND pc.column_id = fkc.parent_column_id
    JOIN sys.tables rt ON rt.object_id = fk.referenced_object_id
    JOIN sys.schemas rs ON rs.schema_id = rt.schema_id
    JOIN sys.columns rc
      ON rc.object_id = rt.object_id AND rc.column_id = fkc.referenced_column_id
    ORDER BY fk.name, fkc.constraint_column_id
  `,
  indexes: `
    SELECT
      s.name AS schema_name,
      t.name AS table_name,
      i.name AS index_name,
      i.type_desc,
      i.is_unique,
      i.is_primary_key,
      i.has_filter,
      i.filter_definition,
      STRING_AGG(c.name, ',') WITHIN GROUP (ORDER BY ic.key_ordinal) AS columns
    FROM sys.indexes i
    JOIN sys.tables t ON t.object_id = i.object_id
    JOIN sys.schemas s ON s.schema_id = t.schema_id
    JOIN sys.index_columns ic
      ON ic.object_id = i.object_id
      AND ic.index_id = i.index_id
      AND ic.is_included_column = 0
    JOIN sys.columns c
      ON c.object_id = t.object_id AND c.column_id = ic.column_id
    WHERE i.name IS NOT NULL
    GROUP BY
      s.name, t.name, i.name, i.type_desc, i.is_unique,
      i.is_primary_key, i.has_filter, i.filter_definition
    ORDER BY s.name, t.name, i.name
  `,
  checks: `
    SELECT
      s.name AS schema_name,
      t.name AS table_name,
      cc.name,
      cc.definition,
      cc.is_disabled,
      cc.is_not_trusted
    FROM sys.check_constraints cc
    JOIN sys.tables t ON t.object_id = cc.parent_object_id
    JOIN sys.schemas s ON s.schema_id = t.schema_id
    ORDER BY s.name, t.name, cc.name
  `,
  triggers: `
    SELECT
      s.name AS schema_name,
      t.name AS table_name,
      tr.name,
      tr.is_disabled
    FROM sys.triggers tr
    JOIN sys.tables t ON t.object_id = tr.parent_id
    JOIN sys.schemas s ON s.schema_id = t.schema_id
    ORDER BY s.name, t.name, tr.name
  `,
};

async function inventoryDatabase() {
  const connection = await new sql.ConnectionPool(sqlConfig).connect();
  try {
    const inventory = {};
    for (const [name, query] of Object.entries(queries)) {
      const result = await connection.request().query(query);
      inventory[name] = name === 'identity' ? result.recordset[0] : result.recordset;
    }
    return inventory;
  } finally {
    await connection.close();
  }
}

if (require.main === module) {
  inventoryDatabase()
    .then(inventory => console.log(JSON.stringify(inventory, null, 2)))
    .catch(error => {
      console.error(`Database inventory failed: ${error.message}`);
      process.exitCode = 1;
    });
}

module.exports = { inventoryDatabase };
