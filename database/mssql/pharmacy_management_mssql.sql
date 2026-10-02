/*
  Pharmacy Management System - Microsoft SQL Server schema + starter data
  Based on the uploaded React + Node/Express application.
  Database name intentionally matches the current project: pharmacy_management
*/

IF DB_ID(N'pharmacy_management') IS NULL
BEGIN
    CREATE DATABASE pharmacy_management;
END;
GO

USE pharmacy_management;
GO

/* =========================
   1) MASTER TABLES
   ========================= */

IF OBJECT_ID(N'dbo.medicines', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.medicines (
        id              INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_medicines PRIMARY KEY,
        name            NVARCHAR(255) NOT NULL,
        description     NVARCHAR(MAX) NULL,
        generic_name    NVARCHAR(255) NULL,
        manufacturer    NVARCHAR(255) NULL,
        category        NVARCHAR(100) NULL,
        batch_number    NVARCHAR(100) NULL,
        quantity        INT NOT NULL CONSTRAINT DF_medicines_quantity DEFAULT (0),
        unit_price      DECIMAL(10,2) NOT NULL CONSTRAINT DF_medicines_unit_price DEFAULT (0.00),
        expiry_date     DATE NOT NULL,
        min_stock_level INT NOT NULL CONSTRAINT DF_medicines_min_stock DEFAULT (10),
        created_at      DATETIME2(0) NOT NULL CONSTRAINT DF_medicines_created DEFAULT (SYSDATETIME()),
        updated_at      DATETIME2(0) NOT NULL CONSTRAINT DF_medicines_updated DEFAULT (SYSDATETIME()),
        CONSTRAINT CK_medicines_quantity CHECK (quantity >= 0),
        CONSTRAINT CK_medicines_unit_price CHECK (unit_price >= 0),
        CONSTRAINT CK_medicines_min_stock CHECK (min_stock_level >= 0)
    );
END;
GO

IF OBJECT_ID(N'dbo.suppliers', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.suppliers (
        id             INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_suppliers PRIMARY KEY,
        company_name   NVARCHAR(255) NOT NULL,
        contact_person NVARCHAR(255) NULL,
        email          NVARCHAR(255) NULL,
        phone          NVARCHAR(50) NULL,
        address        NVARCHAR(MAX) NULL,
        created_at     DATETIME2(0) NOT NULL CONSTRAINT DF_suppliers_created DEFAULT (SYSDATETIME()),
        updated_at     DATETIME2(0) NOT NULL CONSTRAINT DF_suppliers_updated DEFAULT (SYSDATETIME()),
        CONSTRAINT CK_suppliers_email CHECK (email IS NULL OR email LIKE N'%_@_%._%')
    );
END;
GO

IF OBJECT_ID(N'dbo.customers', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.customers (
        id            INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_customers PRIMARY KEY,
        first_name    NVARCHAR(100) NOT NULL,
        last_name     NVARCHAR(100) NOT NULL,
        email         NVARCHAR(255) NULL,
        phone         NVARCHAR(50) NULL,
        address       NVARCHAR(MAX) NULL,
        date_of_birth DATE NULL,
        created_at    DATETIME2(0) NOT NULL CONSTRAINT DF_customers_created DEFAULT (SYSDATETIME()),
        updated_at    DATETIME2(0) NOT NULL CONSTRAINT DF_customers_updated DEFAULT (SYSDATETIME()),
        CONSTRAINT CK_customers_email CHECK (email IS NULL OR email LIKE N'%_@_%._%')
    );
END;
GO

/* =========================
   2) PURCHASES
   ========================= */

IF OBJECT_ID(N'dbo.purchases', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.purchases (
        id            INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_purchases PRIMARY KEY,
        supplier_id   INT NOT NULL,
        purchase_date DATE NOT NULL,
        total_amount  DECIMAL(12,2) NOT NULL CONSTRAINT DF_purchases_total DEFAULT (0.00),
        notes         NVARCHAR(MAX) NULL,
        created_at    DATETIME2(0) NOT NULL CONSTRAINT DF_purchases_created DEFAULT (SYSDATETIME()),
        updated_at    DATETIME2(0) NOT NULL CONSTRAINT DF_purchases_updated DEFAULT (SYSDATETIME()),
        CONSTRAINT FK_purchases_supplier FOREIGN KEY (supplier_id)
            REFERENCES dbo.suppliers(id),
        CONSTRAINT CK_purchases_total CHECK (total_amount >= 0)
    );
END;
GO

IF OBJECT_ID(N'dbo.purchase_items', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.purchase_items (
        id          INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_purchase_items PRIMARY KEY,
        purchase_id INT NOT NULL,
        medicine_id INT NOT NULL,
        quantity    INT NOT NULL,
        unit_cost   DECIMAL(10,2) NOT NULL,
        total_cost  DECIMAL(12,2) NOT NULL,
        CONSTRAINT FK_purchase_items_purchase FOREIGN KEY (purchase_id)
            REFERENCES dbo.purchases(id) ON DELETE CASCADE,
        CONSTRAINT FK_purchase_items_medicine FOREIGN KEY (medicine_id)
            REFERENCES dbo.medicines(id),
        CONSTRAINT CK_purchase_items_quantity CHECK (quantity > 0),
        CONSTRAINT CK_purchase_items_unit_cost CHECK (unit_cost >= 0),
        CONSTRAINT CK_purchase_items_total_cost CHECK (total_cost >= 0)
    );
END;
GO

/* =========================
   3) PRESCRIPTIONS
   ========================= */

IF OBJECT_ID(N'dbo.prescriptions', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.prescriptions (
        id                INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_prescriptions PRIMARY KEY,
        customer_id       INT NOT NULL,
        prescription_date DATE NOT NULL,
        instructions      NVARCHAR(MAX) NULL,
        notes             NVARCHAR(MAX) NULL,
        created_at        DATETIME2(0) NOT NULL CONSTRAINT DF_prescriptions_created DEFAULT (SYSDATETIME()),
        updated_at        DATETIME2(0) NOT NULL CONSTRAINT DF_prescriptions_updated DEFAULT (SYSDATETIME()),
        CONSTRAINT FK_prescriptions_customer FOREIGN KEY (customer_id)
            REFERENCES dbo.customers(id)
    );
END;
GO

IF OBJECT_ID(N'dbo.prescription_items', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.prescription_items (
        id              INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_prescription_items PRIMARY KEY,
        prescription_id INT NOT NULL,
        medicine_id     INT NOT NULL,
        quantity        INT NOT NULL,
        instructions    NVARCHAR(MAX) NULL,
        created_at      DATETIME2(0) NOT NULL CONSTRAINT DF_prescription_items_created DEFAULT (SYSDATETIME()),
        CONSTRAINT FK_prescription_items_prescription FOREIGN KEY (prescription_id)
            REFERENCES dbo.prescriptions(id) ON DELETE CASCADE,
        CONSTRAINT FK_prescription_items_medicine FOREIGN KEY (medicine_id)
            REFERENCES dbo.medicines(id),
        CONSTRAINT CK_prescription_items_quantity CHECK (quantity > 0)
    );
END;
GO

/* =========================
   4) SALES / BILLING
   ========================= */

IF OBJECT_ID(N'dbo.sales', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.sales (
        id             INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_sales PRIMARY KEY,
        sale_date      DATETIME2(0) NOT NULL CONSTRAINT DF_sales_date DEFAULT (SYSDATETIME()),
        customer_id    INT NULL,
        total_amount   DECIMAL(12,2) NOT NULL CONSTRAINT DF_sales_total DEFAULT (0.00),
        discount       DECIMAL(10,2) NOT NULL CONSTRAINT DF_sales_discount DEFAULT (0.00),
        final_amount   DECIMAL(12,2) NOT NULL CONSTRAINT DF_sales_final DEFAULT (0.00),
        payment_method NVARCHAR(50) NOT NULL CONSTRAINT DF_sales_payment DEFAULT (N'Cash'),
        notes          NVARCHAR(MAX) NULL,
        created_at     DATETIME2(0) NOT NULL CONSTRAINT DF_sales_created DEFAULT (SYSDATETIME()),
        updated_at     DATETIME2(0) NOT NULL CONSTRAINT DF_sales_updated DEFAULT (SYSDATETIME()),
        CONSTRAINT FK_sales_customer FOREIGN KEY (customer_id)
            REFERENCES dbo.customers(id) ON DELETE SET NULL,
        CONSTRAINT CK_sales_total CHECK (total_amount >= 0),
        CONSTRAINT CK_sales_discount CHECK (discount >= 0),
        CONSTRAINT CK_sales_final CHECK (final_amount >= 0)
    );
END;
GO

IF OBJECT_ID(N'dbo.sale_items', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.sale_items (
        id          INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_sale_items PRIMARY KEY,
        sale_id     INT NOT NULL,
        medicine_id INT NOT NULL,
        quantity    INT NOT NULL,
        unit_price  DECIMAL(10,2) NOT NULL,
        line_total  DECIMAL(12,2) NOT NULL,
        CONSTRAINT FK_sale_items_sale FOREIGN KEY (sale_id)
            REFERENCES dbo.sales(id) ON DELETE CASCADE,
        CONSTRAINT FK_sale_items_medicine FOREIGN KEY (medicine_id)
            REFERENCES dbo.medicines(id),
        CONSTRAINT CK_sale_items_quantity CHECK (quantity > 0),
        CONSTRAINT CK_sale_items_unit_price CHECK (unit_price >= 0),
        CONSTRAINT CK_sale_items_line_total CHECK (line_total >= 0)
    );
END;
GO

/* =========================
   5) INDEXES
   ========================= */

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_medicines_name' AND object_id = OBJECT_ID(N'dbo.medicines'))
    CREATE INDEX IX_medicines_name ON dbo.medicines(name);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_medicines_expiry' AND object_id = OBJECT_ID(N'dbo.medicines'))
    CREATE INDEX IX_medicines_expiry ON dbo.medicines(expiry_date);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_medicines_quantity' AND object_id = OBJECT_ID(N'dbo.medicines'))
    CREATE INDEX IX_medicines_quantity ON dbo.medicines(quantity);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_medicines_category' AND object_id = OBJECT_ID(N'dbo.medicines'))
    CREATE INDEX IX_medicines_category ON dbo.medicines(category);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_suppliers_company' AND object_id = OBJECT_ID(N'dbo.suppliers'))
    CREATE INDEX IX_suppliers_company ON dbo.suppliers(company_name);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_purchases_supplier' AND object_id = OBJECT_ID(N'dbo.purchases'))
    CREATE INDEX IX_purchases_supplier ON dbo.purchases(supplier_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_purchases_date' AND object_id = OBJECT_ID(N'dbo.purchases'))
    CREATE INDEX IX_purchases_date ON dbo.purchases(purchase_date);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_customers_name' AND object_id = OBJECT_ID(N'dbo.customers'))
    CREATE INDEX IX_customers_name ON dbo.customers(last_name, first_name);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_customers_phone' AND object_id = OBJECT_ID(N'dbo.customers'))
    CREATE INDEX IX_customers_phone ON dbo.customers(phone);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_prescriptions_customer' AND object_id = OBJECT_ID(N'dbo.prescriptions'))
    CREATE INDEX IX_prescriptions_customer ON dbo.prescriptions(customer_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_prescriptions_date' AND object_id = OBJECT_ID(N'dbo.prescriptions'))
    CREATE INDEX IX_prescriptions_date ON dbo.prescriptions(prescription_date);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_sales_date' AND object_id = OBJECT_ID(N'dbo.sales'))
    CREATE INDEX IX_sales_date ON dbo.sales(sale_date);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_sales_customer' AND object_id = OBJECT_ID(N'dbo.sales'))
    CREATE INDEX IX_sales_customer ON dbo.sales(customer_id);
GO

/* =========================
   6) UPDATED_AT TRIGGERS
   These reproduce MySQL's ON UPDATE CURRENT_TIMESTAMP behavior.
   ========================= */

CREATE OR ALTER TRIGGER dbo.trg_medicines_updated_at
ON dbo.medicines AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL() > 1 RETURN;
    UPDATE t SET updated_at = SYSDATETIME()
    FROM dbo.medicines t INNER JOIN inserted i ON t.id = i.id;
END;
GO

CREATE OR ALTER TRIGGER dbo.trg_suppliers_updated_at
ON dbo.suppliers AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL() > 1 RETURN;
    UPDATE t SET updated_at = SYSDATETIME()
    FROM dbo.suppliers t INNER JOIN inserted i ON t.id = i.id;
END;
GO

CREATE OR ALTER TRIGGER dbo.trg_customers_updated_at
ON dbo.customers AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL() > 1 RETURN;
    UPDATE t SET updated_at = SYSDATETIME()
    FROM dbo.customers t INNER JOIN inserted i ON t.id = i.id;
END;
GO

CREATE OR ALTER TRIGGER dbo.trg_purchases_updated_at
ON dbo.purchases AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL() > 1 RETURN;
    UPDATE t SET updated_at = SYSDATETIME()
    FROM dbo.purchases t INNER JOIN inserted i ON t.id = i.id;
END;
GO

CREATE OR ALTER TRIGGER dbo.trg_prescriptions_updated_at
ON dbo.prescriptions AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL() > 1 RETURN;
    UPDATE t SET updated_at = SYSDATETIME()
    FROM dbo.prescriptions t INNER JOIN inserted i ON t.id = i.id;
END;
GO

CREATE OR ALTER TRIGGER dbo.trg_sales_updated_at
ON dbo.sales AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL() > 1 RETURN;
    UPDATE t SET updated_at = SYSDATETIME()
    FROM dbo.sales t INNER JOIN inserted i ON t.id = i.id;
END;
GO

/* =========================
   7) STARTER / TEST DATA
   Uses dates relative to today so expiry pages keep working.
   ========================= */

IF NOT EXISTS (SELECT 1 FROM dbo.suppliers)
BEGIN
    INSERT INTO dbo.suppliers (company_name, contact_person, email, phone, address) VALUES
    (N'MedPharm Distributors', N'John Smith', N'sales@medpharm.com', N'+94 77 123 4567', N'123 Healthcare Street, Colombo 05'),
    (N'HealthCare Supplies Ltd', N'Sarah Johnson', N'orders@healthcare.com', N'+94 71 987 6543', N'45 Medical Avenue, Kandy'),
    (N'PharmaSource International', N'Michael Brown', N'info@pharmasource.com', N'+94 76 555 1234', N'78 Commerce Road, Galle');
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.medicines)
BEGIN
    INSERT INTO dbo.medicines
      (name, description, generic_name, manufacturer, category, batch_number, quantity, unit_price, expiry_date, min_stock_level)
    VALUES
      (N'Amoxicillin 500mg Capsules (100pcs)', N'Broad-spectrum antibiotic', N'Amoxicillin', N'SmithKline Beecham', N'Antibiotics', N'AMX-001', 150, 2500.00, CAST(DATEADD(DAY, 365, GETDATE()) AS DATE), 20),
      (N'Paracetamol 500mg Tablets (100pcs)', N'Pain reliever and fever reducer', N'Paracetamol', N'Cipla Ltd', N'Analgesics', N'PCM-002', 200, 850.00, CAST(DATEADD(DAY, 240, GETDATE()) AS DATE), 30),
      (N'Omeprazole 20mg Capsules (30pcs)', N'Proton pump inhibitor', N'Omeprazole', N'AstraZeneca', N'Gastrointestinal', N'OME-003', 85, 1200.00, CAST(DATEADD(DAY, 180, GETDATE()) AS DATE), 15),
      (N'Azithromycin 250mg Tablets (6pcs)', N'Macrolide antibiotic', N'Azithromycin', N'Pfizer', N'Antibiotics', N'AZI-004', 5, 3200.00, CAST(DATEADD(DAY, 200, GETDATE()) AS DATE), 10),
      (N'Atorvastatin 20mg Tablets (30pcs)', N'Cholesterol-lowering statin', N'Atorvastatin Calcium', N'Pfizer', N'Cardiovascular', N'ATOR-005', 8, 2100.00, CAST(DATEADD(DAY, 160, GETDATE()) AS DATE), 15),
      (N'Ibuprofen 400mg Tablets (50pcs)', N'NSAID pain reliever', N'Ibuprofen', N'Boots Pharmaceuticals', N'Analgesics', N'IBU-006', 45, 950.00, CAST(DATEADD(DAY, 20, GETDATE()) AS DATE), 20),
      (N'Cough Syrup - Honey Lemon (100ml)', N'Cough suppressant syrup', N'Dextromethorphan', N'Bristol Myers', N'Respiratory', N'COUGH-007', 25, 750.00, CAST(DATEADD(DAY, -60, GETDATE()) AS DATE), 10);
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.customers)
BEGIN
    INSERT INTO dbo.customers (first_name, last_name, email, phone, address, date_of_birth) VALUES
      (N'Kamal', N'Perera', N'kamal.perera@email.com', N'+94 77 111 2222', N'Dehiwala', '1985-03-15'),
      (N'Samantha', N'Fernando', N'sam.fernando@email.com', N'+94 71 333 4444', N'Maharagama', '1990-07-22'),
      (N'Ranjith', N'Wijesinghe', N'ranjith.w@email.com', N'+94 76 555 6666', N'Bambalapitiya', '1978-11-08');
END;
GO

/* =========================
   8) QUICK CHECKS
   ========================= */
SELECT DB_NAME() AS current_database;
SELECT COUNT(*) AS medicine_count FROM dbo.medicines;
SELECT COUNT(*) AS supplier_count FROM dbo.suppliers;
SELECT COUNT(*) AS customer_count FROM dbo.customers;
SELECT TOP (10) id, name, quantity, unit_price, expiry_date, min_stock_level
FROM dbo.medicines
ORDER BY id;
GO
