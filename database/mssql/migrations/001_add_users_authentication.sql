USE pharmacy_management;
GO

-- Run after the core schema. One account has one role; customer demographics
-- remain in dbo.customers and supplier details remain in dbo.suppliers.
IF OBJECT_ID(N'dbo.users', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.users (
        id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_users PRIMARY KEY,
        username NVARCHAR(100) NOT NULL,
        email NVARCHAR(255) NOT NULL,
        password_hash NVARCHAR(255) NOT NULL,
        role NVARCHAR(30) NOT NULL,
        account_status NVARCHAR(20) NOT NULL CONSTRAINT DF_users_status DEFAULT N'ACTIVE',
        customer_id INT NULL,
        supplier_id INT NULL,
        created_at DATETIME2(0) NOT NULL CONSTRAINT DF_users_created DEFAULT SYSDATETIME(),
        updated_at DATETIME2(0) NOT NULL CONSTRAINT DF_users_updated DEFAULT SYSDATETIME(),
        CONSTRAINT FK_users_customer FOREIGN KEY (customer_id) REFERENCES dbo.customers(id),
        CONSTRAINT FK_users_supplier FOREIGN KEY (supplier_id) REFERENCES dbo.suppliers(id),
        CONSTRAINT CK_users_role CHECK (role IN (N'CUSTOMER', N'PRESCRIPTION_STAFF', N'SUPPLIER', N'INVENTORY_STAFF', N'SALES_STAFF')),
        CONSTRAINT CK_users_status CHECK (account_status IN (N'ACTIVE', N'DISABLED')),
        CONSTRAINT CK_users_customer_link CHECK (
            (role = N'CUSTOMER' AND customer_id IS NOT NULL AND supplier_id IS NULL)
            OR (role = N'SUPPLIER' AND customer_id IS NULL)
            OR (role IN (N'PRESCRIPTION_STAFF', N'INVENTORY_STAFF', N'SALES_STAFF') AND customer_id IS NULL AND supplier_id IS NULL)
        )
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.users') AND name = N'UX_users_username')
    CREATE UNIQUE INDEX UX_users_username ON dbo.users(username);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.users') AND name = N'UX_users_email')
    CREATE UNIQUE INDEX UX_users_email ON dbo.users(email);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.users') AND name = N'UX_users_customer_id')
    CREATE UNIQUE INDEX UX_users_customer_id ON dbo.users(customer_id) WHERE customer_id IS NOT NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.users') AND name = N'UX_users_supplier_id')
    CREATE UNIQUE INDEX UX_users_supplier_id ON dbo.users(supplier_id) WHERE supplier_id IS NOT NULL;
GO

-- No demo passwords or hashes are shipped. Use the local provisioning command
-- described in TEAM_DATABASE_UPDATE_GUIDE.md after choosing private passwords.
