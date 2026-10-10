SET XACT_ABORT ON;

IF COL_LENGTH(N'dbo.prescription_uploads', N'reviewer_user_id') IS NULL
    ALTER TABLE dbo.prescription_uploads ADD reviewer_user_id INT NULL;
IF COL_LENGTH(N'dbo.prescription_uploads', N'reviewed_at') IS NULL
    ALTER TABLE dbo.prescription_uploads ADD reviewed_at DATETIME2(0) NULL;
IF COL_LENGTH(N'dbo.prescription_uploads', N'rejection_reason') IS NULL
    ALTER TABLE dbo.prescription_uploads ADD rejection_reason NVARCHAR(1000) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_prescription_uploads_reviewer' AND parent_object_id = OBJECT_ID(N'dbo.prescription_uploads'))
    ALTER TABLE dbo.prescription_uploads ADD CONSTRAINT FK_prescription_uploads_reviewer FOREIGN KEY (reviewer_user_id) REFERENCES dbo.users(user_id);

IF COL_LENGTH(N'dbo.prescriptions', N'upload_id') IS NULL
    ALTER TABLE dbo.prescriptions ADD upload_id INT NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_prescriptions_upload' AND parent_object_id = OBJECT_ID(N'dbo.prescriptions'))
    ALTER TABLE dbo.prescriptions ADD CONSTRAINT FK_prescriptions_upload FOREIGN KEY (upload_id) REFERENCES dbo.prescription_uploads(prescription_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UQ_prescriptions_upload' AND object_id = OBJECT_ID(N'dbo.prescriptions'))
    CREATE UNIQUE INDEX UQ_prescriptions_upload ON dbo.prescriptions(upload_id) WHERE upload_id IS NOT NULL;

IF COL_LENGTH(N'dbo.reorder_requests', N'supplier_id') IS NULL
    ALTER TABLE dbo.reorder_requests ADD supplier_id INT NULL;
IF COL_LENGTH(N'dbo.reorder_requests', N'notes') IS NULL
    ALTER TABLE dbo.reorder_requests ADD notes NVARCHAR(1000) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_reorder_requests_supplier' AND parent_object_id = OBJECT_ID(N'dbo.reorder_requests'))
    ALTER TABLE dbo.reorder_requests ADD CONSTRAINT FK_reorder_requests_supplier FOREIGN KEY (supplier_id) REFERENCES dbo.suppliers(id);
