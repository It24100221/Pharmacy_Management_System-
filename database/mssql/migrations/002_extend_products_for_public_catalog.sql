USE pharmacy_management;
GO

-- Keep dbo.medicines as the one product master: all existing item FKs still
-- point at medicines.id. product_code is the permanent, public business ID.
IF COL_LENGTH(N'dbo.medicines', N'product_code') IS NULL
    ALTER TABLE dbo.medicines ADD product_code NVARCHAR(32) NULL;
GO
IF COL_LENGTH(N'dbo.medicines', N'product_type') IS NULL
    ALTER TABLE dbo.medicines ADD product_type NVARCHAR(30) NOT NULL
        CONSTRAINT DF_medicines_product_type DEFAULT N'Medicine' WITH VALUES;
GO
IF COL_LENGTH(N'dbo.medicines', N'image_url') IS NULL
    ALTER TABLE dbo.medicines ADD image_url NVARCHAR(512) NULL;
GO
IF COL_LENGTH(N'dbo.medicines', N'requires_prescription') IS NULL
    ALTER TABLE dbo.medicines ADD requires_prescription BIT NOT NULL
        CONSTRAINT DF_medicines_requires_prescription DEFAULT 1 WITH VALUES;
GO
IF COL_LENGTH(N'dbo.medicines', N'is_active') IS NULL
    ALTER TABLE dbo.medicines ADD is_active BIT NOT NULL
        CONSTRAINT DF_medicines_is_active DEFAULT 1 WITH VALUES;
GO

-- The two distributed seed scripts contain the same seven named products.
-- These codes are fixed across team databases and DO NOT encode category.
-- A batch number is used only to recognize the original seed row; once set,
-- product_code never changes when the name, batch or category is edited.
UPDATE m SET product_code = mapping.product_code
FROM dbo.medicines AS m
JOIN (VALUES
    (N'Amoxicillin 500mg Capsules (100pcs)', N'AMX-001', N'P001'),
    (N'Paracetamol 500mg Tablets (100pcs)', N'PCM-002', N'P002'),
    (N'Omeprazole 20mg Capsules (30pcs)', N'OME-003', N'P003'),
    (N'Azithromycin 250mg Tablets (6pcs)', N'AZI-004', N'P004'),
    (N'Atorvastatin 20mg Tablets (30pcs)', N'ATOR-005', N'P005'),
    (N'Ibuprofen 400mg Tablets (50pcs)', N'IBU-006', N'P006'),
    (N'Cough Syrup - Honey Lemon (100ml)', N'COUGH-007', N'P007')
) AS mapping(product_name, batch_number, product_code)
    ON m.name = mapping.product_name AND m.batch_number = mapping.batch_number
WHERE m.product_code IS NULL;
GO

-- Stop before enforcing NOT NULL if a member has local products not present
-- in the shared seed. Obtain shared business codes and fill them manually,
-- then rerun this script. Never derive them from local identity values.
IF EXISTS (SELECT 1 FROM dbo.medicines WHERE product_code IS NULL)
    THROW 51001, 'Unmapped products remain. Assign shared product_code values to those rows, then rerun migration 002.', 1;
IF EXISTS (SELECT product_code FROM dbo.medicines GROUP BY product_code HAVING COUNT(*) > 1)
    THROW 51002, 'Duplicate product_code values remain. Resolve them before migration 002.', 1;

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.medicines') AND name = N'product_code' AND is_nullable = 1)
    ALTER TABLE dbo.medicines ALTER COLUMN product_code NVARCHAR(32) NOT NULL;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.medicines') AND name = N'UX_medicines_product_code')
    CREATE UNIQUE INDEX UX_medicines_product_code ON dbo.medicines(product_code);
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID(N'dbo.medicines') AND name = N'CK_medicines_product_type')
    ALTER TABLE dbo.medicines ADD CONSTRAINT CK_medicines_product_type
        CHECK (product_type IN (N'Medicine', N'Baby Items', N'Lab Items', N'Medical Accessories'));
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID(N'dbo.medicines') AND name = N'CK_medicines_product_code_format')
    ALTER TABLE dbo.medicines ADD CONSTRAINT CK_medicines_product_code_format
        CHECK (LEN(product_code) BETWEEN 2 AND 32 AND product_code COLLATE Latin1_General_100_BIN2 NOT LIKE N'%[^A-Z0-9-]%');
GO

-- Non-medicine catalog products need not have an expiry date. Medicine rows
-- retain their existing dates; new Medicine records still require a date in
-- API validation. Rebuild the existing expiry index around ALTER COLUMN.
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.medicines') AND name = N'expiry_date' AND is_nullable = 0)
BEGIN
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.medicines') AND name = N'IX_medicines_expiry')
        DROP INDEX IX_medicines_expiry ON dbo.medicines;
    ALTER TABLE dbo.medicines ALTER COLUMN expiry_date DATE NULL;
END;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.medicines') AND name = N'IX_medicines_expiry')
    CREATE INDEX IX_medicines_expiry ON dbo.medicines(expiry_date);
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID(N'dbo.medicines') AND name = N'CK_medicines_medicine_expiry')
    ALTER TABLE dbo.medicines ADD CONSTRAINT CK_medicines_medicine_expiry
        CHECK (product_type <> N'Medicine' OR expiry_date IS NOT NULL);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.medicines') AND name = N'IX_medicines_public_catalog')
    CREATE INDEX IX_medicines_public_catalog ON dbo.medicines(is_active, product_type, name);
GO

CREATE OR ALTER TRIGGER dbo.trg_medicines_product_code_immutable
ON dbo.medicines AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    IF UPDATE(product_code) AND EXISTS (
        SELECT 1 FROM inserted AS i JOIN deleted AS d ON i.id = d.id
        WHERE i.product_code <> d.product_code
    )
        THROW 51003, 'Product ID cannot be changed after creation.', 1;
END;
GO
