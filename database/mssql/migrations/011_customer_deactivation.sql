SET XACT_ABORT ON;

IF COL_LENGTH(N'dbo.customers', N'is_active') IS NULL
    ALTER TABLE dbo.customers ADD is_active BIT NOT NULL CONSTRAINT DF_customers_is_active DEFAULT (1) WITH VALUES;

IF COL_LENGTH(N'dbo.customers', N'deactivated_at') IS NULL
    ALTER TABLE dbo.customers ADD deactivated_at DATETIME2(0) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.customers') AND name = N'IX_customers_active_name')
    CREATE INDEX IX_customers_active_name ON dbo.customers(is_active, last_name, first_name);
