-- External image URLs stay separate from the constrained local upload path.
IF COL_LENGTH('dbo.products', 'image_external_url') IS NULL
  ALTER TABLE dbo.products ADD image_external_url NVARCHAR(2048) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_products_external_image_url' AND parent_object_id = OBJECT_ID('dbo.products'))
  ALTER TABLE dbo.products WITH CHECK ADD CONSTRAINT CK_products_external_image_url CHECK (
    image_external_url IS NULL OR (image_external_url LIKE N'https://%.%' AND image_path IS NULL)
  );
