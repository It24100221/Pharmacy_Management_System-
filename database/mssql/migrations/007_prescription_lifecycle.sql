/* Durable lifecycle fields for structured prescriptions. Additive and safe on existing records. */
IF COL_LENGTH(N'dbo.prescriptions', N'status') IS NULL
    ALTER TABLE dbo.prescriptions ADD status NVARCHAR(30) NOT NULL CONSTRAINT DF_prescriptions_status DEFAULT N'PENDING';
GO
IF COL_LENGTH(N'dbo.prescriptions', N'reviewer_user_id') IS NULL
    ALTER TABLE dbo.prescriptions ADD reviewer_user_id INT NULL;
GO
IF COL_LENGTH(N'dbo.prescriptions', N'reviewed_at') IS NULL
    ALTER TABLE dbo.prescriptions ADD reviewed_at DATETIME2(0) NULL;
GO
IF COL_LENGTH(N'dbo.prescriptions', N'rejection_reason') IS NULL
    ALTER TABLE dbo.prescriptions ADD rejection_reason NVARCHAR(1000) NULL;
GO
IF COL_LENGTH(N'dbo.prescriptions', N'dispensed_at') IS NULL
    ALTER TABLE dbo.prescriptions ADD dispensed_at DATETIME2(0) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_prescriptions_reviewer' AND parent_object_id = OBJECT_ID(N'dbo.prescriptions'))
    ALTER TABLE dbo.prescriptions ADD CONSTRAINT FK_prescriptions_reviewer FOREIGN KEY (reviewer_user_id) REFERENCES dbo.users(user_id);
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_prescriptions_status' AND parent_object_id = OBJECT_ID(N'dbo.prescriptions'))
    ALTER TABLE dbo.prescriptions ADD CONSTRAINT CK_prescriptions_status CHECK (status IN (N'PENDING', N'UNDER_REVIEW', N'APPROVED', N'REJECTED', N'READY_FOR_BILLING', N'DISPENSED', N'CANCELLED'));
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_prescriptions_status_created' AND object_id = OBJECT_ID(N'dbo.prescriptions'))
    CREATE INDEX IX_prescriptions_status_created ON dbo.prescriptions(status, created_at DESC);
