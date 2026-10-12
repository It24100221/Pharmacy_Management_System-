USE pharmacy_management;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET ARITHABORT ON;
SET NUMERIC_ROUNDABORT OFF;
GO

IF OBJECT_ID(N'dbo.prescription_uploads', N'U') IS NULL
BEGIN
    CREATE TABLE prescription_uploads (
        prescription_id INT IDENTITY(1,1) PRIMARY KEY,
        customer_id INT NOT NULL,
        image NVARCHAR(500) NOT NULL,
        doctor_name NVARCHAR(200) NULL,
        notes NVARCHAR(MAX) NULL,
        status NVARCHAR(20) NOT NULL DEFAULT N'PENDING',
        uploaded_date DATETIME2(0) NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT FK_customer_workflow_upload_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
        CONSTRAINT CK_customer_workflow_upload_status CHECK (status IN (N'PENDING', N'APPROVED', N'REJECTED', N'COMPLETED'))
    );
END;
GO

IF COL_LENGTH(N'dbo.prescription_uploads', N'doctor_name') IS NULL ALTER TABLE prescription_uploads ADD doctor_name NVARCHAR(200) NULL;
IF COL_LENGTH(N'dbo.prescription_uploads', N'notes') IS NULL ALTER TABLE prescription_uploads ADD notes NVARCHAR(MAX) NULL;
GO