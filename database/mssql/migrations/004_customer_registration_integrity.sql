SET XACT_ABORT ON;

IF DB_NAME() <> N'pharmacy_management'
    THROW 51020, 'Migration must run against pharmacy_management', 1;

IF EXISTS (
    SELECT LOWER(LTRIM(RTRIM(email)))
    FROM dbo.customers
    WHERE email IS NOT NULL AND LEN(LTRIM(RTRIM(email))) > 0
    GROUP BY LOWER(LTRIM(RTRIM(email)))
    HAVING COUNT(*) > 1
)
    THROW 51021, 'Duplicate customer email addresses must be reconciled before migration', 1;

UPDATE dbo.customers
SET email = LOWER(LTRIM(RTRIM(email)))
WHERE email IS NOT NULL;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.customers') AND name = N'UQ_customers_email'
)
    CREATE UNIQUE INDEX UQ_customers_email ON dbo.customers(email) WHERE email IS NOT NULL;
