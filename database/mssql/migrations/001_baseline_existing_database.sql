SET XACT_ABORT ON;

IF DB_NAME() <> N'pharmacy_management'
    THROW 51000, 'Migration must run against pharmacy_management', 1;

IF OBJECT_ID(N'dbo.medicines', N'U') IS NULL
   OR OBJECT_ID(N'dbo.suppliers', N'U') IS NULL
   OR OBJECT_ID(N'dbo.customers', N'U') IS NULL
   OR OBJECT_ID(N'dbo.users', N'U') IS NULL
   OR OBJECT_ID(N'dbo.staff', N'U') IS NULL
   OR OBJECT_ID(N'dbo.prescription_uploads', N'U') IS NULL
    THROW 51001, 'Existing foundation schema is incomplete; do not baseline this database', 1;

-- This migration intentionally changes no legacy object. It records that the
-- live, inventoried A1/A2 foundation existed before ordered migrations began.
