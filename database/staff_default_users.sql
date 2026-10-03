/*
  Senevirathna Medical Pharmacy
  SQL Server migration for default staff authentication accounts.
  All passwords below are non-disclosed bcrypt bootstrap hashes. Working
  credentials are never stored in this repository. Rotate local accounts with
  the backend security:rotate-staff command before use.
*/
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

IF OBJECT_ID(N'dbo.users', N'U') IS NULL
BEGIN
    CREATE TABLE users (
        user_id INT IDENTITY(1,1) PRIMARY KEY,
        username NVARCHAR(100) NOT NULL UNIQUE,
        password NVARCHAR(255) NOT NULL,
        role NVARCHAR(20) NOT NULL,
        created_date DATETIME2(0) NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT CK_users_role_migration CHECK (role IN (N'CUSTOMER', N'ADMIN', N'PHARMACIST', N'INVENTORY', N'SALES', N'SUPPLIER'))
    );
END;
GO

IF OBJECT_ID(N'dbo.staff', N'U') IS NULL
BEGIN
    CREATE TABLE staff (
        staff_id INT IDENTITY(1,1) PRIMARY KEY,
        user_id INT NOT NULL UNIQUE,
        staff_name NVARCHAR(200) NOT NULL,
        staff_role NVARCHAR(20) NOT NULL,
        email NVARCHAR(255) NULL,
        phone NVARCHAR(50) NULL,
        CONSTRAINT FK_staff_user_migration FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    );
END;
GO

IF COL_LENGTH(N'dbo.staff', N'email') IS NULL ALTER TABLE staff ADD email NVARCHAR(255) NULL;
IF COL_LENGTH(N'dbo.staff', N'phone') IS NULL ALTER TABLE staff ADD phone NVARCHAR(50) NULL;
GO

IF COL_LENGTH(N'dbo.customers', N'user_id') IS NULL ALTER TABLE customers ADD user_id INT NULL;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UQ_customers_user' AND object_id = OBJECT_ID(N'dbo.customers'))
    CREATE UNIQUE INDEX UQ_customers_user ON customers(user_id) WHERE user_id IS NOT NULL;
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_customers_user' AND parent_object_id = OBJECT_ID(N'dbo.customers'))
    ALTER TABLE customers ADD CONSTRAINT FK_customers_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL;
GO

DECLARE @staff TABLE (username NVARCHAR(100), password_hash NVARCHAR(255), staff_name NVARCHAR(200), staff_role NVARCHAR(20), email NVARCHAR(255), phone NVARCHAR(50));
INSERT INTO @staff VALUES
    (N'admin', N'$2a$12$H0R7NyUfjMdqur5s9ceRb.nfuFRKslQEEcWzf6X.nQNuN61qpqSLC', N'Pharmacy Administrator', N'ADMIN', N'admin@senevirathna.local', NULL),
    (N'pharmacist', N'$2a$12$BzNGb3ais7ijiAjlo4JPh.18jZ61IKwyUAZK1UeCqjKRtxYyiFPdG', N'Lead Pharmacist', N'PHARMACIST', N'pharmacist@senevirathna.local', NULL),
    (N'inventory', N'$2a$12$kt0OgieNT5v6z2jBsglfFeuXiZDuvUEt/bGJzsmwjbg6YCRaXmKmm', N'Inventory Coordinator', N'INVENTORY', N'inventory@senevirathna.local', NULL),
    (N'sales', N'$2a$12$/thcdH92DyfJBNjtx9JRFO56LZNUeyzuylALp86vHQ.Y3rMZyxL.m', N'Sales Coordinator', N'SALES', N'sales@senevirathna.local', NULL),
    (N'supplier', N'$2a$12$eIdjou3rDD638QoQe9G2xOxZtqoxSA3o8oGh7FbdwGtOOCilG1igW', N'Supplier Coordinator', N'SUPPLIER', N'Supply@gmail.com', NULL);

INSERT INTO users (username, password, role)
SELECT s.username, s.password_hash, s.staff_role
FROM @staff s
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.username = s.username);

UPDATE u
SET u.password = s.password_hash, u.role = s.staff_role
FROM users u
JOIN @staff s ON s.username = u.username;

INSERT INTO staff (user_id, staff_name, staff_role, email, phone)
SELECT u.user_id, s.staff_name, s.staff_role, s.email, s.phone
FROM @staff s
JOIN users u ON u.username = s.username
WHERE NOT EXISTS (SELECT 1 FROM staff existing WHERE existing.user_id = u.user_id);

UPDATE existing
SET existing.staff_name = s.staff_name,
    existing.staff_role = s.staff_role,
    existing.email = s.email,
    existing.phone = s.phone
FROM staff existing
JOIN users u ON u.user_id = existing.user_id
JOIN @staff s ON s.username = u.username;
GO
