SET XACT_ABORT ON;

IF DB_NAME() <> N'pharmacy_management'
    THROW 51030, 'Migration must run against pharmacy_management', 1;

IF OBJECT_ID(N'dbo.carts', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.carts (
      cart_id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_carts PRIMARY KEY,
      customer_id INT NOT NULL,
      status NVARCHAR(20) NOT NULL CONSTRAINT DF_carts_status DEFAULT N'ACTIVE',
      created_at DATETIME2(0) NOT NULL CONSTRAINT DF_carts_created DEFAULT SYSDATETIME(),
      updated_at DATETIME2(0) NOT NULL CONSTRAINT DF_carts_updated DEFAULT SYSDATETIME(),
      CONSTRAINT FK_carts_customer FOREIGN KEY (customer_id) REFERENCES dbo.customers(id),
      CONSTRAINT CK_carts_status CHECK (status IN (N'ACTIVE', N'CHECKED_OUT'))
    );
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.carts') AND name = N'UQ_carts_active_customer')
    CREATE UNIQUE INDEX UQ_carts_active_customer ON dbo.carts(customer_id) WHERE status = N'ACTIVE';

IF OBJECT_ID(N'dbo.cart_items', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.cart_items (
      cart_item_id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_cart_items PRIMARY KEY,
      cart_id INT NOT NULL,
      product_id INT NOT NULL,
      quantity INT NOT NULL,
      created_at DATETIME2(0) NOT NULL CONSTRAINT DF_cart_items_created DEFAULT SYSDATETIME(),
      updated_at DATETIME2(0) NOT NULL CONSTRAINT DF_cart_items_updated DEFAULT SYSDATETIME(),
      CONSTRAINT FK_cart_items_cart FOREIGN KEY (cart_id) REFERENCES dbo.carts(cart_id) ON DELETE CASCADE,
      CONSTRAINT FK_cart_items_product FOREIGN KEY (product_id) REFERENCES dbo.products(product_id),
      CONSTRAINT UQ_cart_items_product UNIQUE (cart_id, product_id),
      CONSTRAINT CK_cart_items_quantity CHECK (quantity > 0 AND quantity <= 999)
    );
END;

IF OBJECT_ID(N'dbo.orders', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.orders (
      order_id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_orders PRIMARY KEY,
      customer_id INT NOT NULL,
      status NVARCHAR(30) NOT NULL,
      requires_prescription BIT NOT NULL CONSTRAINT DF_orders_requires_prescription DEFAULT (0),
      subtotal DECIMAL(12,2) NOT NULL,
      reviewer_user_id INT NULL,
      reviewed_at DATETIME2(0) NULL,
      rejection_reason NVARCHAR(1000) NULL,
      created_at DATETIME2(0) NOT NULL CONSTRAINT DF_orders_created DEFAULT SYSDATETIME(),
      updated_at DATETIME2(0) NOT NULL CONSTRAINT DF_orders_updated DEFAULT SYSDATETIME(),
      CONSTRAINT FK_orders_customer FOREIGN KEY (customer_id) REFERENCES dbo.customers(id),
      CONSTRAINT FK_orders_reviewer FOREIGN KEY (reviewer_user_id) REFERENCES dbo.users(user_id),
      CONSTRAINT CK_orders_subtotal CHECK (subtotal >= 0),
      CONSTRAINT CK_orders_status CHECK (status IN (N'PENDING', N'PRESCRIPTION_REQUIRED', N'PENDING_REVIEW', N'APPROVED', N'REJECTED', N'READY_FOR_BILLING', N'COMPLETED', N'CANCELLED'))
    );
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.orders') AND name = N'IX_orders_customer_created')
    CREATE INDEX IX_orders_customer_created ON dbo.orders(customer_id, created_at DESC);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.orders') AND name = N'IX_orders_status_created')
    CREATE INDEX IX_orders_status_created ON dbo.orders(status, created_at);

IF OBJECT_ID(N'dbo.order_items', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.order_items (
      order_item_id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_order_items PRIMARY KEY,
      order_id INT NOT NULL,
      product_id INT NOT NULL,
      medicine_id INT NULL,
      product_code NVARCHAR(11) NOT NULL,
      product_name NVARCHAR(255) NOT NULL,
      quantity INT NOT NULL,
      unit_price DECIMAL(10,2) NOT NULL,
      line_total DECIMAL(12,2) NOT NULL,
      prescription_required BIT NOT NULL,
      CONSTRAINT FK_order_items_order FOREIGN KEY (order_id) REFERENCES dbo.orders(order_id) ON DELETE CASCADE,
      CONSTRAINT FK_order_items_product FOREIGN KEY (product_id) REFERENCES dbo.products(product_id),
      CONSTRAINT FK_order_items_medicine FOREIGN KEY (medicine_id) REFERENCES dbo.medicines(id),
      CONSTRAINT UQ_order_items_product UNIQUE (order_id, product_id),
      CONSTRAINT CK_order_items_quantity CHECK (quantity > 0 AND quantity <= 999),
      CONSTRAINT CK_order_items_price CHECK (unit_price >= 0 AND line_total >= 0)
    );
END;

IF COL_LENGTH(N'dbo.prescription_uploads', N'order_id') IS NULL
    ALTER TABLE dbo.prescription_uploads ADD order_id INT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_prescription_uploads_order' AND parent_object_id = OBJECT_ID(N'dbo.prescription_uploads'))
    ALTER TABLE dbo.prescription_uploads ADD CONSTRAINT FK_prescription_uploads_order FOREIGN KEY (order_id) REFERENCES dbo.orders(order_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.prescription_uploads') AND name = N'UQ_prescription_uploads_order')
    CREATE UNIQUE INDEX UQ_prescription_uploads_order ON dbo.prescription_uploads(order_id) WHERE order_id IS NOT NULL;

IF COL_LENGTH(N'dbo.sales', N'order_id') IS NULL
    ALTER TABLE dbo.sales ADD order_id INT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_sales_order' AND parent_object_id = OBJECT_ID(N'dbo.sales'))
    ALTER TABLE dbo.sales ADD CONSTRAINT FK_sales_order FOREIGN KEY (order_id) REFERENCES dbo.orders(order_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.sales') AND name = N'UQ_sales_order')
    CREATE UNIQUE INDEX UQ_sales_order ON dbo.sales(order_id) WHERE order_id IS NOT NULL;

UPDATE p
SET prescription_required = 1
FROM dbo.products p
INNER JOIN dbo.medicines m ON m.id = p.medicine_id
WHERE m.name LIKE N'Amoxicillin%' OR m.name LIKE N'Azithromycin%' OR m.name LIKE N'Amoxiling%';
GO

CREATE OR ALTER TRIGGER dbo.trg_carts_updated_at ON dbo.carts AFTER UPDATE AS
BEGIN
  SET NOCOUNT ON;
  UPDATE c SET updated_at = SYSDATETIME() FROM dbo.carts c INNER JOIN inserted i ON i.cart_id = c.cart_id;
END;
GO

CREATE OR ALTER TRIGGER dbo.trg_cart_items_updated_at ON dbo.cart_items AFTER UPDATE AS
BEGIN
  SET NOCOUNT ON;
  UPDATE ci SET updated_at = SYSDATETIME() FROM dbo.cart_items ci INNER JOIN inserted i ON i.cart_item_id = ci.cart_item_id;
END;
GO

CREATE OR ALTER TRIGGER dbo.trg_orders_updated_at ON dbo.orders AFTER UPDATE AS
BEGIN
  SET NOCOUNT ON;
  UPDATE o SET updated_at = SYSDATETIME() FROM dbo.orders o INNER JOIN inserted i ON i.order_id = o.order_id;
END;
