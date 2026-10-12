-- Extend only the MIME allow-list; size, path and complete-file checks remain.
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_products_image_mime' AND parent_object_id = OBJECT_ID('dbo.products'))
  ALTER TABLE dbo.products DROP CONSTRAINT CK_products_image_mime;
ALTER TABLE dbo.products WITH CHECK ADD CONSTRAINT CK_products_image_mime CHECK (
  image_mime_type IS NULL OR image_mime_type IN (N'image/jpeg', N'image/png', N'image/webp')
);
