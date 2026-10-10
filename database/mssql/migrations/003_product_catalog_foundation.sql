SET XACT_ABORT ON;

IF DB_NAME() <> N'pharmacy_management'
    THROW 51010, 'Migration must run against pharmacy_management', 1;

IF OBJECT_ID(N'dbo.medicines', N'U') IS NULL
    THROW 51011, 'dbo.medicines is required before creating the product catalogue', 1;

IF OBJECT_ID(N'dbo.categories', N'U') IS NOT NULL
   AND (
     COL_LENGTH(N'dbo.categories', N'category_id') IS NULL
     OR COL_LENGTH(N'dbo.categories', N'category_code') IS NULL
     OR COL_LENGTH(N'dbo.categories', N'category_name') IS NULL
   )
    THROW 51012, 'An incompatible legacy dbo.categories table exists; manual reconciliation is required', 1;

IF OBJECT_ID(N'dbo.categories', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.categories (
      category_id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_categories PRIMARY KEY,
      category_code NVARCHAR(50) NOT NULL,
      category_name NVARCHAR(120) NOT NULL,
      is_active BIT NOT NULL CONSTRAINT DF_categories_is_active DEFAULT (1),
      created_at DATETIME2(0) NOT NULL CONSTRAINT DF_categories_created_at DEFAULT SYSDATETIME(),
      CONSTRAINT UQ_categories_code UNIQUE (category_code),
      CONSTRAINT UQ_categories_name UNIQUE (category_name),
      CONSTRAINT CK_categories_code_upper CHECK (category_code = UPPER(category_code))
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.categories WHERE category_code = N'MEDICINE')
    INSERT dbo.categories (category_code, category_name) VALUES (N'MEDICINE', N'Medicine');
IF NOT EXISTS (SELECT 1 FROM dbo.categories WHERE category_code = N'BABY_ITEMS')
    INSERT dbo.categories (category_code, category_name) VALUES (N'BABY_ITEMS', N'Baby Items');
IF NOT EXISTS (SELECT 1 FROM dbo.categories WHERE category_code = N'LAB_ITEMS')
    INSERT dbo.categories (category_code, category_name) VALUES (N'LAB_ITEMS', N'Lab Items');
IF NOT EXISTS (SELECT 1 FROM dbo.categories WHERE category_code = N'MEDICAL_ACCESSORIES')
    INSERT dbo.categories (category_code, category_name) VALUES (N'MEDICAL_ACCESSORIES', N'Medical Accessories');

IF EXISTS (
    SELECT category_code FROM dbo.categories
    WHERE category_code IN (N'MEDICINE', N'BABY_ITEMS', N'LAB_ITEMS', N'MEDICAL_ACCESSORIES')
    GROUP BY category_code HAVING COUNT(*) > 1
)
    THROW 51013, 'Duplicate required category codes exist', 1;

IF OBJECT_ID(N'dbo.products', N'U') IS NOT NULL
   AND (
     COL_LENGTH(N'dbo.products', N'product_id') IS NULL
     OR COL_LENGTH(N'dbo.products', N'product_code') IS NULL
     OR COL_LENGTH(N'dbo.products', N'category_id') IS NULL
     OR COL_LENGTH(N'dbo.products', N'medicine_id') IS NULL
   )
    THROW 51014, 'An incompatible legacy dbo.products table exists; the old duplicate-stock design will not be upgraded automatically', 1;

IF OBJECT_ID(N'dbo.products', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.products (
      product_id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_products PRIMARY KEY,
      product_code AS CONVERT(NVARCHAR(11), N'P' + RIGHT(REPLICATE(N'0', 10) + CONVERT(NVARCHAR(10), product_id), 10)) PERSISTED,
      category_id INT NOT NULL,
      medicine_id INT NULL,
      standalone_name NVARCHAR(255) NULL,
      standalone_description NVARCHAR(MAX) NULL,
      standalone_unit_price DECIMAL(10,2) NULL,
      standalone_quantity INT NULL,
      standalone_min_stock_level INT NULL,
      prescription_required BIT NOT NULL CONSTRAINT DF_products_prescription_required DEFAULT (0),
      is_active BIT NOT NULL CONSTRAINT DF_products_is_active DEFAULT (1),
      image_original_filename NVARCHAR(255) NULL,
      image_stored_filename NVARCHAR(255) NULL,
      image_path NVARCHAR(500) NULL,
      image_mime_type NVARCHAR(100) NULL,
      image_file_size BIGINT NULL,
      created_at DATETIME2(0) NOT NULL CONSTRAINT DF_products_created_at DEFAULT SYSDATETIME(),
      updated_at DATETIME2(0) NOT NULL CONSTRAINT DF_products_updated_at DEFAULT SYSDATETIME(),
      CONSTRAINT FK_products_category FOREIGN KEY (category_id) REFERENCES dbo.categories(category_id),
      CONSTRAINT FK_products_medicine FOREIGN KEY (medicine_id) REFERENCES dbo.medicines(id),
      CONSTRAINT CK_products_backing CHECK (
        (medicine_id IS NOT NULL
          AND standalone_name IS NULL
          AND standalone_description IS NULL
          AND standalone_unit_price IS NULL
          AND standalone_quantity IS NULL
          AND standalone_min_stock_level IS NULL)
        OR
        (medicine_id IS NULL
          AND standalone_name IS NOT NULL
          AND standalone_unit_price IS NOT NULL
          AND standalone_quantity IS NOT NULL
          AND standalone_min_stock_level IS NOT NULL)
      ),
      CONSTRAINT CK_products_standalone_price CHECK (standalone_unit_price IS NULL OR standalone_unit_price >= 0),
      CONSTRAINT CK_products_standalone_quantity CHECK (standalone_quantity IS NULL OR standalone_quantity >= 0),
      CONSTRAINT CK_products_standalone_min_stock CHECK (standalone_min_stock_level IS NULL OR standalone_min_stock_level >= 0),
      CONSTRAINT CK_products_image_size CHECK (image_file_size IS NULL OR (image_file_size > 0 AND image_file_size <= 5242880)),
      CONSTRAINT CK_products_image_mime CHECK (image_mime_type IS NULL OR image_mime_type IN (N'image/jpeg', N'image/png')),
      CONSTRAINT CK_products_image_metadata CHECK (
        (image_original_filename IS NULL AND image_stored_filename IS NULL AND image_path IS NULL AND image_mime_type IS NULL AND image_file_size IS NULL)
        OR
        (image_original_filename IS NOT NULL AND image_stored_filename IS NOT NULL AND image_path IS NOT NULL AND image_mime_type IS NOT NULL AND image_file_size IS NOT NULL)
      ),
      CONSTRAINT CK_products_image_path CHECK (
        image_path IS NULL
        OR (
          LEFT(image_path, 9) = N'products/'
          AND CHARINDEX(N'..', image_path) = 0
          AND CHARINDEX(N'\', image_path) = 0
          AND CHARINDEX(N':', image_path) = 0
        )
      )
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.products') AND name = N'UQ_products_product_code')
    CREATE UNIQUE INDEX UQ_products_product_code ON dbo.products(product_code);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.products') AND name = N'UQ_products_medicine')
    CREATE UNIQUE INDEX UQ_products_medicine ON dbo.products(medicine_id) WHERE medicine_id IS NOT NULL;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.products') AND name = N'IX_products_category_active')
    CREATE INDEX IX_products_category_active ON dbo.products(category_id, is_active);

DECLARE @medicine_category_id INT = (
  SELECT category_id FROM dbo.categories WHERE category_code = N'MEDICINE'
);

INSERT dbo.products (category_id, medicine_id)
SELECT @medicine_category_id, m.id
FROM dbo.medicines m
WHERE NOT EXISTS (SELECT 1 FROM dbo.products p WHERE p.medicine_id = m.id);

IF EXISTS (
  SELECT medicine_id FROM dbo.products
  WHERE medicine_id IS NOT NULL
  GROUP BY medicine_id HAVING COUNT(*) > 1
)
    THROW 51015, 'Duplicate medicine-to-product mappings exist', 1;

IF (SELECT COUNT(*) FROM dbo.products WHERE medicine_id IS NOT NULL) <> (SELECT COUNT(*) FROM dbo.medicines)
    THROW 51016, 'Not every medicine has exactly one product mapping', 1;
GO

CREATE OR ALTER TRIGGER dbo.trg_products_updated_at ON dbo.products AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL() > 1 RETURN;
    UPDATE p SET updated_at = SYSDATETIME()
    FROM dbo.products p
    INNER JOIN inserted i ON i.product_id = p.product_id;
END;
GO

CREATE OR ALTER TRIGGER dbo.trg_medicines_product_mapping ON dbo.medicines AFTER INSERT AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @medicine_category_id INT = (
      SELECT category_id FROM dbo.categories WHERE category_code = N'MEDICINE'
    );
    IF @medicine_category_id IS NULL
        THROW 51017, 'Medicine catalogue category is unavailable', 1;

    INSERT dbo.products (category_id, medicine_id)
    SELECT @medicine_category_id, i.id
    FROM inserted i
    WHERE NOT EXISTS (SELECT 1 FROM dbo.products p WHERE p.medicine_id = i.id);
END;
GO

CREATE OR ALTER VIEW dbo.v_product_catalog AS
SELECT
  p.product_id,
  p.product_code,
  p.category_id,
  c.category_code,
  c.category_name,
  p.medicine_id,
  CASE WHEN p.medicine_id IS NOT NULL THEN m.name ELSE p.standalone_name END AS product_name,
  CASE WHEN p.medicine_id IS NOT NULL THEN m.description ELSE p.standalone_description END AS product_description,
  CASE WHEN p.medicine_id IS NOT NULL THEN m.unit_price ELSE p.standalone_unit_price END AS unit_price,
  CASE WHEN p.medicine_id IS NOT NULL THEN m.quantity ELSE p.standalone_quantity END AS stock_quantity,
  CASE WHEN p.medicine_id IS NOT NULL THEN m.min_stock_level ELSE p.standalone_min_stock_level END AS min_stock_level,
  CASE WHEN p.medicine_id IS NOT NULL THEN m.expiry_date ELSE NULL END AS expiry_date,
  CASE WHEN p.medicine_id IS NOT NULL THEN m.generic_name ELSE NULL END AS generic_name,
  CASE WHEN p.medicine_id IS NOT NULL THEN m.category ELSE NULL END AS therapeutic_category,
  p.prescription_required,
  p.is_active,
  p.image_original_filename,
  p.image_stored_filename,
  p.image_path,
  p.image_mime_type,
  p.image_file_size,
  CASE
    WHEN p.is_active = 0 THEN N'INACTIVE'
    WHEN p.medicine_id IS NOT NULL AND m.expiry_date < CAST(GETDATE() AS date) THEN N'EXPIRED'
    WHEN (CASE WHEN p.medicine_id IS NOT NULL THEN m.quantity ELSE p.standalone_quantity END) <= 0 THEN N'OUT_OF_STOCK'
    WHEN (CASE WHEN p.medicine_id IS NOT NULL THEN m.quantity ELSE p.standalone_quantity END)
       <= (CASE WHEN p.medicine_id IS NOT NULL THEN m.min_stock_level ELSE p.standalone_min_stock_level END) THEN N'LOW_STOCK'
    ELSE N'AVAILABLE'
  END AS availability
FROM dbo.products p
INNER JOIN dbo.categories c ON c.category_id = p.category_id
LEFT JOIN dbo.medicines m ON m.id = p.medicine_id;
GO
