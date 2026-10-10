IF COL_LENGTH(N'dbo.purchases', N'idempotency_key') IS NULL
    ALTER TABLE dbo.purchases ADD idempotency_key NVARCHAR(100) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UQ_purchases_idempotency' AND object_id = OBJECT_ID(N'dbo.purchases'))
    CREATE UNIQUE INDEX UQ_purchases_idempotency ON dbo.purchases(idempotency_key) WHERE idempotency_key IS NOT NULL;
