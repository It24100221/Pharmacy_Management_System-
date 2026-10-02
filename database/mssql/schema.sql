IF DB_ID(N'pharmacy_management') IS NULL
BEGIN
    CREATE DATABASE pharmacy_management;
END;
GO

USE pharmacy_management;
GO

CREATE TABLE medicines (
    id INT IDENTITY(1,1) PRIMARY KEY,
    name NVARCHAR(255) NOT NULL,
    description NVARCHAR(MAX) NULL,
    generic_name NVARCHAR(255) NULL,
    manufacturer NVARCHAR(255) NULL,
    category NVARCHAR(100) NULL,
    batch_number NVARCHAR(100) NULL,
    quantity INT NOT NULL CONSTRAINT DF_medicines_quantity DEFAULT 0,
    unit_price DECIMAL(10,2) NOT NULL CONSTRAINT DF_medicines_unit_price DEFAULT 0,
    expiry_date DATE NOT NULL,
    min_stock_level INT NOT NULL CONSTRAINT DF_medicines_min_stock DEFAULT 10,
    created_at DATETIME2(0) NOT NULL CONSTRAINT DF_medicines_created DEFAULT SYSDATETIME(),
    updated_at DATETIME2(0) NOT NULL CONSTRAINT DF_medicines_updated DEFAULT SYSDATETIME(),
    CONSTRAINT CK_medicines_quantity CHECK (quantity >= 0),
    CONSTRAINT CK_medicines_unit_price CHECK (unit_price >= 0),
    CONSTRAINT CK_medicines_min_stock CHECK (min_stock_level >= 0)
);
GO

CREATE TABLE suppliers (
    id INT IDENTITY(1,1) PRIMARY KEY,
    company_name NVARCHAR(255) NOT NULL,
    contact_person NVARCHAR(255) NULL,
    email NVARCHAR(255) NULL,
    phone NVARCHAR(50) NULL,
    address NVARCHAR(MAX) NULL,
    created_at DATETIME2(0) NOT NULL CONSTRAINT DF_suppliers_created DEFAULT SYSDATETIME(),
    updated_at DATETIME2(0) NOT NULL CONSTRAINT DF_suppliers_updated DEFAULT SYSDATETIME()
);
GO

CREATE TABLE customers (
    id INT IDENTITY(1,1) PRIMARY KEY,
    first_name NVARCHAR(100) NOT NULL,
    last_name NVARCHAR(100) NOT NULL,
    email NVARCHAR(255) NULL,
    phone NVARCHAR(50) NULL,
    address NVARCHAR(MAX) NULL,
    date_of_birth DATE NULL,
    created_at DATETIME2(0) NOT NULL CONSTRAINT DF_customers_created DEFAULT SYSDATETIME(),
    updated_at DATETIME2(0) NOT NULL CONSTRAINT DF_customers_updated DEFAULT SYSDATETIME()
);
GO

CREATE TABLE purchases (
    id INT IDENTITY(1,1) PRIMARY KEY,
    supplier_id INT NOT NULL,
    purchase_date DATE NOT NULL,
    total_amount DECIMAL(12,2) NOT NULL CONSTRAINT DF_purchases_total DEFAULT 0,
    notes NVARCHAR(MAX) NULL,
    created_at DATETIME2(0) NOT NULL CONSTRAINT DF_purchases_created DEFAULT SYSDATETIME(),
    updated_at DATETIME2(0) NOT NULL CONSTRAINT DF_purchases_updated DEFAULT SYSDATETIME(),
    CONSTRAINT FK_purchases_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
    CONSTRAINT CK_purchases_total CHECK (total_amount >= 0)
);
GO

CREATE TABLE purchase_items (
    id INT IDENTITY(1,1) PRIMARY KEY,
    purchase_id INT NOT NULL,
    medicine_id INT NOT NULL,
    quantity INT NOT NULL,
    unit_cost DECIMAL(10,2) NOT NULL,
    total_cost DECIMAL(12,2) NOT NULL,
    CONSTRAINT FK_purchase_items_purchase FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
    CONSTRAINT FK_purchase_items_medicine FOREIGN KEY (medicine_id) REFERENCES medicines(id),
    CONSTRAINT CK_purchase_items_quantity CHECK (quantity > 0),
    CONSTRAINT CK_purchase_items_unit_cost CHECK (unit_cost >= 0),
    CONSTRAINT CK_purchase_items_total_cost CHECK (total_cost >= 0)
);
GO

CREATE TABLE prescriptions (
    id INT IDENTITY(1,1) PRIMARY KEY,
    customer_id INT NOT NULL,
    prescription_date DATE NOT NULL,
    instructions NVARCHAR(MAX) NULL,
    notes NVARCHAR(MAX) NULL,
    created_at DATETIME2(0) NOT NULL CONSTRAINT DF_prescriptions_created DEFAULT SYSDATETIME(),
    updated_at DATETIME2(0) NOT NULL CONSTRAINT DF_prescriptions_updated DEFAULT SYSDATETIME(),
    CONSTRAINT FK_prescriptions_customer FOREIGN KEY (customer_id) REFERENCES customers(id)
);
GO

CREATE TABLE prescription_items (
    id INT IDENTITY(1,1) PRIMARY KEY,
    prescription_id INT NOT NULL,
    medicine_id INT NOT NULL,
    quantity INT NOT NULL,
    instructions NVARCHAR(MAX) NULL,
    created_at DATETIME2(0) NOT NULL CONSTRAINT DF_prescription_items_created DEFAULT SYSDATETIME(),
    CONSTRAINT FK_prescription_items_prescription FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE CASCADE,
    CONSTRAINT FK_prescription_items_medicine FOREIGN KEY (medicine_id) REFERENCES medicines(id),
    CONSTRAINT CK_prescription_items_quantity CHECK (quantity > 0)
);
GO

CREATE TABLE sales (
    id INT IDENTITY(1,1) PRIMARY KEY,
    sale_date DATETIME2(0) NOT NULL CONSTRAINT DF_sales_date DEFAULT SYSDATETIME(),
    customer_id INT NULL,
    total_amount DECIMAL(12,2) NOT NULL CONSTRAINT DF_sales_total DEFAULT 0,
    discount DECIMAL(10,2) NOT NULL CONSTRAINT DF_sales_discount DEFAULT 0,
    final_amount DECIMAL(12,2) NOT NULL CONSTRAINT DF_sales_final DEFAULT 0,
    payment_method NVARCHAR(50) NOT NULL CONSTRAINT DF_sales_payment DEFAULT N'Cash',
    notes NVARCHAR(MAX) NULL,
    created_at DATETIME2(0) NOT NULL CONSTRAINT DF_sales_created DEFAULT SYSDATETIME(),
    updated_at DATETIME2(0) NOT NULL CONSTRAINT DF_sales_updated DEFAULT SYSDATETIME(),
    CONSTRAINT FK_sales_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
    CONSTRAINT CK_sales_total CHECK (total_amount >= 0),
    CONSTRAINT CK_sales_discount CHECK (discount >= 0),
    CONSTRAINT CK_sales_final CHECK (final_amount >= 0)
);
GO

CREATE TABLE sale_items (
    id INT IDENTITY(1,1) PRIMARY KEY,
    sale_id INT NOT NULL,
    medicine_id INT NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    line_total DECIMAL(12,2) NOT NULL,
    CONSTRAINT FK_sale_items_sale FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
    CONSTRAINT FK_sale_items_medicine FOREIGN KEY (medicine_id) REFERENCES medicines(id),
    CONSTRAINT CK_sale_items_quantity CHECK (quantity > 0),
    CONSTRAINT CK_sale_items_unit_price CHECK (unit_price >= 0),
    CONSTRAINT CK_sale_items_line_total CHECK (line_total >= 0)
);
GO

CREATE INDEX IX_medicines_name ON medicines(name);
CREATE INDEX IX_medicines_expiry ON medicines(expiry_date);
CREATE INDEX IX_medicines_quantity ON medicines(quantity);
CREATE INDEX IX_medicines_category ON medicines(category);
CREATE INDEX IX_suppliers_company ON suppliers(company_name);
CREATE INDEX IX_purchases_supplier ON purchases(supplier_id);
CREATE INDEX IX_purchases_date ON purchases(purchase_date);
CREATE INDEX IX_customers_name ON customers(last_name, first_name);
CREATE INDEX IX_customers_phone ON customers(phone);
CREATE INDEX IX_prescriptions_customer ON prescriptions(customer_id);
CREATE INDEX IX_prescriptions_date ON prescriptions(prescription_date);
CREATE INDEX IX_sales_date ON sales(sale_date);
CREATE INDEX IX_sales_customer ON sales(customer_id);
GO

CREATE TRIGGER trg_medicines_updated_at ON medicines AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL() > 1 RETURN;
    UPDATE m SET updated_at = SYSDATETIME()
    FROM medicines m INNER JOIN inserted i ON m.id = i.id;
END;
GO

CREATE TRIGGER trg_suppliers_updated_at ON suppliers AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL() > 1 RETURN;
    UPDATE s SET updated_at = SYSDATETIME()
    FROM suppliers s INNER JOIN inserted i ON s.id = i.id;
END;
GO

CREATE TRIGGER trg_customers_updated_at ON customers AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL() > 1 RETURN;
    UPDATE c SET updated_at = SYSDATETIME()
    FROM customers c INNER JOIN inserted i ON c.id = i.id;
END;
GO

CREATE TRIGGER trg_purchases_updated_at ON purchases AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL() > 1 RETURN;
    UPDATE p SET updated_at = SYSDATETIME()
    FROM purchases p INNER JOIN inserted i ON p.id = i.id;
END;
GO

CREATE TRIGGER trg_prescriptions_updated_at ON prescriptions AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL() > 1 RETURN;
    UPDATE p SET updated_at = SYSDATETIME()
    FROM prescriptions p INNER JOIN inserted i ON p.id = i.id;
END;
GO

CREATE TRIGGER trg_sales_updated_at ON sales AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL() > 1 RETURN;
    UPDATE s SET updated_at = SYSDATETIME()
    FROM sales s INNER JOIN inserted i ON s.id = i.id;
END;
GO