SET XACT_ABORT ON;

IF OBJECT_ID(N'dbo.prescription_uploads', N'U') IS NULL
    THROW 51002, 'dbo.prescription_uploads must exist before applying file storage metadata', 1;

IF COL_LENGTH(N'dbo.prescription_uploads', N'original_filename') IS NULL
    ALTER TABLE dbo.prescription_uploads ADD original_filename NVARCHAR(255) NULL;

IF COL_LENGTH(N'dbo.prescription_uploads', N'stored_filename') IS NULL
    ALTER TABLE dbo.prescription_uploads ADD stored_filename NVARCHAR(255) NULL;

IF COL_LENGTH(N'dbo.prescription_uploads', N'storage_path') IS NULL
    ALTER TABLE dbo.prescription_uploads ADD storage_path NVARCHAR(500) NULL;

IF COL_LENGTH(N'dbo.prescription_uploads', N'mime_type') IS NULL
    ALTER TABLE dbo.prescription_uploads ADD mime_type NVARCHAR(100) NULL;

IF COL_LENGTH(N'dbo.prescription_uploads', N'file_size') IS NULL
    ALTER TABLE dbo.prescription_uploads ADD file_size BIGINT NULL;

-- Preserve any legacy rows while stopping new code from writing base64 data.
-- The legacy image column remains nullable for compatibility and can be retired
-- only after any real legacy rows have been migrated to files.
IF EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.prescription_uploads')
      AND name = N'image'
      AND is_nullable = 0
)
    ALTER TABLE dbo.prescription_uploads ALTER COLUMN image NVARCHAR(500) NULL;

-- SQL Server resolves constraint column references when compiling a batch, so
-- start a new batch after conditionally adding the metadata columns.
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID(N'dbo.prescription_uploads')
      AND name = N'CK_prescription_uploads_file_size'
)
    ALTER TABLE dbo.prescription_uploads WITH CHECK
      ADD CONSTRAINT CK_prescription_uploads_file_size
      CHECK (file_size IS NULL OR (file_size > 0 AND file_size <= 10485760));

IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID(N'dbo.prescription_uploads')
      AND name = N'CK_prescription_uploads_mime_type'
)
    ALTER TABLE dbo.prescription_uploads WITH CHECK
      ADD CONSTRAINT CK_prescription_uploads_mime_type
      CHECK (mime_type IS NULL OR mime_type IN (N'image/jpeg', N'image/png'));

IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID(N'dbo.prescription_uploads')
      AND name = N'CK_prescription_uploads_file_metadata'
)
    ALTER TABLE dbo.prescription_uploads WITH CHECK
      ADD CONSTRAINT CK_prescription_uploads_file_metadata CHECK (
        (original_filename IS NULL AND stored_filename IS NULL AND storage_path IS NULL AND mime_type IS NULL AND file_size IS NULL)
        OR
        (original_filename IS NOT NULL AND stored_filename IS NOT NULL AND storage_path IS NOT NULL AND mime_type IS NOT NULL AND file_size IS NOT NULL)
      );

IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID(N'dbo.prescription_uploads')
      AND name = N'CK_prescription_uploads_storage_path'
)
    ALTER TABLE dbo.prescription_uploads WITH CHECK
      ADD CONSTRAINT CK_prescription_uploads_storage_path CHECK (
        storage_path IS NULL
        OR (
          LEFT(storage_path, 14) = N'prescriptions/'
          AND CHARINDEX(N'..', storage_path) = 0
          AND CHARINDEX(N'\', storage_path) = 0
          AND CHARINDEX(N':', storage_path) = 0
        )
      );

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.prescription_uploads')
      AND name = N'IX_prescription_uploads_customer'
)
    CREATE INDEX IX_prescription_uploads_customer ON dbo.prescription_uploads(customer_id);

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.prescription_uploads')
      AND name = N'UQ_prescription_uploads_stored_filename'
)
    CREATE UNIQUE INDEX UQ_prescription_uploads_stored_filename
      ON dbo.prescription_uploads(stored_filename)
      WHERE stored_filename IS NOT NULL;
