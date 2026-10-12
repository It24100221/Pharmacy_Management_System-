SET XACT_ABORT ON;

-- Existing records are preserved. Supplier identities must be linked explicitly by an administrator.
IF OBJECT_ID(N'dbo.supplier_users', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.supplier_users (
    user_id INT NOT NULL CONSTRAINT PK_supplier_users PRIMARY KEY,
    supplier_id INT NOT NULL,
    linked_by INT NOT NULL,
    linked_at DATETIME2(0) NOT NULL CONSTRAINT DF_supplier_users_linked DEFAULT SYSDATETIME(),
    CONSTRAINT FK_supplier_users_user FOREIGN KEY (user_id) REFERENCES dbo.users(user_id),
    CONSTRAINT FK_supplier_users_supplier FOREIGN KEY (supplier_id) REFERENCES dbo.suppliers(id),
    CONSTRAINT FK_supplier_users_linked_by FOREIGN KEY (linked_by) REFERENCES dbo.users(user_id)
  );
  CREATE INDEX IX_supplier_users_supplier ON dbo.supplier_users(supplier_id);
END;
IF COL_LENGTH(N'dbo.medicines', N'reorder_target') IS NULL
  ALTER TABLE dbo.medicines ADD reorder_target INT NULL;
IF COL_LENGTH(N'dbo.medicines', N'auto_reorder_enabled') IS NULL
  ALTER TABLE dbo.medicines ADD auto_reorder_enabled BIT NOT NULL CONSTRAINT DF_medicines_auto_reorder DEFAULT (0);
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_medicines_reorder_target')
  ALTER TABLE dbo.medicines ADD CONSTRAINT CK_medicines_reorder_target CHECK (reorder_target IS NULL OR reorder_target > min_stock_level);

IF COL_LENGTH(N'dbo.reorder_requests', N'request_number') IS NULL
  ALTER TABLE dbo.reorder_requests ADD request_number AS (N'RR-' + RIGHT(N'000000' + CONVERT(NVARCHAR(10), reorder_request_id), 6)) PERSISTED;
IF COL_LENGTH(N'dbo.reorder_requests', N'available_quantity_snapshot') IS NULL
  ALTER TABLE dbo.reorder_requests ADD available_quantity_snapshot INT NULL, minimum_stock_snapshot INT NULL,
    reorder_target_snapshot INT NULL, requested_delivery_date DATE NULL,
    priority NVARCHAR(10) NOT NULL CONSTRAINT DF_reorder_requests_priority DEFAULT N'NORMAL';
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_reorder_requests_priority')
  ALTER TABLE dbo.reorder_requests ADD CONSTRAINT CK_reorder_requests_priority CHECK (priority IN (N'NORMAL', N'URGENT'));
-- Replace the medicine-only open uniqueness rule with a supplier-specific active-workflow rule.
IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.reorder_requests') AND name = N'UQ_reorder_requests_open')
  DROP INDEX UQ_reorder_requests_open ON dbo.reorder_requests;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.reorder_requests') AND name = N'UQ_reorder_requests_active_supplier')
  CREATE UNIQUE INDEX UQ_reorder_requests_active_supplier ON dbo.reorder_requests(medicine_id, supplier_id) WHERE status IN (N'OPEN', N'ORDERED');

IF OBJECT_ID(N'dbo.supplier_responses', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.supplier_responses (
    supplier_response_id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_supplier_responses PRIMARY KEY,
    reorder_request_id INT NOT NULL CONSTRAINT UQ_supplier_responses_request UNIQUE,
    supplier_id INT NOT NULL,
    medicine_id INT NOT NULL,
    responded_by INT NOT NULL,
    available_quantity INT NOT NULL,
    estimated_delivery_date DATE NULL,
    unit_purchase_price DECIMAL(12,2) NULL,
    supplier_message NVARCHAR(1000) NULL,
    response_status NVARCHAR(30) NOT NULL,
    approval_status NVARCHAR(20) NOT NULL CONSTRAINT DF_supplier_responses_approval DEFAULT N'PENDING',
    reviewed_by INT NULL,
    reviewed_at DATETIME2(0) NULL,
    created_at DATETIME2(0) NOT NULL CONSTRAINT DF_supplier_responses_created DEFAULT SYSDATETIME(),
    CONSTRAINT FK_supplier_responses_request FOREIGN KEY (reorder_request_id) REFERENCES dbo.reorder_requests(reorder_request_id),
    CONSTRAINT FK_supplier_responses_supplier FOREIGN KEY (supplier_id) REFERENCES dbo.suppliers(id),
    CONSTRAINT FK_supplier_responses_medicine FOREIGN KEY (medicine_id) REFERENCES dbo.medicines(id),
    CONSTRAINT FK_supplier_responses_user FOREIGN KEY (responded_by) REFERENCES dbo.users(user_id),
    CONSTRAINT FK_supplier_responses_reviewer FOREIGN KEY (reviewed_by) REFERENCES dbo.users(user_id),
    CONSTRAINT CK_supplier_responses_quantity CHECK (available_quantity >= 0),
    CONSTRAINT CK_supplier_responses_price CHECK (unit_purchase_price IS NULL OR unit_purchase_price >= 0),
    CONSTRAINT CK_supplier_responses_status CHECK (response_status IN (N'AVAILABLE', N'PARTIALLY_AVAILABLE', N'UNAVAILABLE')),
    CONSTRAINT CK_supplier_responses_approval CHECK (approval_status IN (N'PENDING', N'APPROVED', N'REJECTED')),
    CONSTRAINT CK_supplier_responses_availability CHECK ((response_status = N'UNAVAILABLE' AND available_quantity = 0) OR (response_status <> N'UNAVAILABLE' AND available_quantity > 0 AND estimated_delivery_date IS NOT NULL))
  );
END;
IF COL_LENGTH(N'dbo.purchase_orders', N'reorder_request_id') IS NULL
  ALTER TABLE dbo.purchase_orders ADD reorder_request_id INT NULL, supplier_response_id INT NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_purchase_orders_reorder')
  ALTER TABLE dbo.purchase_orders ADD CONSTRAINT FK_purchase_orders_reorder FOREIGN KEY (reorder_request_id) REFERENCES dbo.reorder_requests(reorder_request_id);
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_purchase_orders_response')
  ALTER TABLE dbo.purchase_orders ADD CONSTRAINT FK_purchase_orders_response FOREIGN KEY (supplier_response_id) REFERENCES dbo.supplier_responses(supplier_response_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.purchase_orders') AND name = N'UQ_purchase_orders_reorder')
  CREATE UNIQUE INDEX UQ_purchase_orders_reorder ON dbo.purchase_orders(reorder_request_id) WHERE reorder_request_id IS NOT NULL;
GO
CREATE OR ALTER VIEW dbo.v_inventory_supply_stock AS
SELECT m.id AS medicine_id, m.name, m.medicine_number, m.quantity AS physical_quantity,
  m.min_stock_level, m.reorder_target, m.auto_reorder_enabled, m.is_active,
  COALESCE(b.eligible_quantity, 0) + CASE WHEN m.quantity > COALESCE(b.all_quantity, 0)
    AND m.expiry_date >= CONVERT(date, SYSDATETIME()) THEN m.quantity - COALESCE(b.all_quantity, 0) ELSE 0 END AS available_quantity
FROM dbo.medicines m
OUTER APPLY (SELECT SUM(quantity_available) AS all_quantity,
  SUM(CASE WHEN is_active = 1 AND expiry_date >= CONVERT(date, SYSDATETIME()) THEN quantity_available ELSE 0 END) AS eligible_quantity
  FROM dbo.medicine_batches WHERE medicine_id = m.id) b;
