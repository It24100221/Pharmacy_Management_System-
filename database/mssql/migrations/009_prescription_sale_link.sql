IF COL_LENGTH(N'dbo.sales', N'prescription_id') IS NULL
    ALTER TABLE dbo.sales ADD prescription_id INT NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_sales_prescription' AND parent_object_id = OBJECT_ID(N'dbo.sales'))
    ALTER TABLE dbo.sales ADD CONSTRAINT FK_sales_prescription FOREIGN KEY (prescription_id) REFERENCES dbo.prescriptions(id);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UQ_sales_prescription' AND object_id = OBJECT_ID(N'dbo.sales'))
    CREATE UNIQUE INDEX UQ_sales_prescription ON dbo.sales(prescription_id) WHERE prescription_id IS NOT NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_sales_prescription' AND object_id = OBJECT_ID(N'dbo.sales'))
    CREATE INDEX IX_sales_prescription ON dbo.sales(prescription_id);
