-- Image metadata only. No product images or commercial data are assigned/changed.
IF COL_LENGTH('dbo.products', 'image_source_url') IS NULL
  ALTER TABLE dbo.products ADD image_source_url NVARCHAR(2048) NULL;
IF COL_LENGTH('dbo.products', 'image_license') IS NULL
  ALTER TABLE dbo.products ADD image_license NVARCHAR(500) NULL;
IF COL_LENGTH('dbo.products', 'image_alt_text') IS NULL
  ALTER TABLE dbo.products ADD image_alt_text NVARCHAR(255) NULL;
