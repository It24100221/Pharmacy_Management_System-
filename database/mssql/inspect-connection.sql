-- Read-only Stage 0 diagnostics. Run in the SSMS session that can access
-- pharmacy_management. Does not insert/update/delete or expose passwords.
SELECT
    @@SERVERNAME AS registered_server_name,
    CONVERT(nvarchar(128), SERVERPROPERTY('MachineName')) AS machine_name,
    CONVERT(nvarchar(128), SERVERPROPERTY('InstanceName')) AS instance_name,
    CONVERT(nvarchar(128), SERVERPROPERTY('ProductVersion')) AS product_version,
    CONNECTIONPROPERTY('net_transport') AS net_transport,
    CONNECTIONPROPERTY('auth_scheme') AS authentication_scheme,
    CONNECTIONPROPERTY('local_net_address') AS server_address,
    CONNECTIONPROPERTY('local_tcp_port') AS server_tcp_port;
GO

USE [pharmacy_management];
GO

SELECT DB_NAME() AS database_name;

SELECT TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME, DATA_TYPE,
       CHARACTER_MAXIMUM_LENGTH, NUMERIC_PRECISION, NUMERIC_SCALE, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
ORDER BY TABLE_SCHEMA, TABLE_NAME, ORDINAL_POSITION;

SELECT SCHEMA_NAME(t.schema_id) AS schema_name, t.name AS table_name,
       tr.name AS trigger_name, tr.is_disabled
FROM sys.triggers AS tr
JOIN sys.tables AS t ON t.object_id = tr.parent_id
ORDER BY schema_name, table_name, trigger_name;

SELECT fk.name AS constraint_name,
       OBJECT_SCHEMA_NAME(fk.parent_object_id) AS parent_schema,
       OBJECT_NAME(fk.parent_object_id) AS parent_table,
       OBJECT_SCHEMA_NAME(fk.referenced_object_id) AS referenced_schema,
       OBJECT_NAME(fk.referenced_object_id) AS referenced_table,
       fk.is_disabled, fk.is_not_trusted
FROM sys.foreign_keys AS fk
ORDER BY parent_schema, parent_table, constraint_name;
GO
