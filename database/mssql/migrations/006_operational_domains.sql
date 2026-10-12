SET XACT_ABORT ON;

IF DB_NAME() <> N'pharmacy_management' AND DB_NAME() <> N'pharmacy_management_test'
    THROW 51040, 'Migration must run against pharmacy_management or pharmacy_management_test', 1;

/* Medicine identity and safe lifecycle. The legacy category column remains for compatibility. */
IF COL_LENGTH(N'dbo.medicines', N'medicine_number') IS NULL
    ALTER TABLE dbo.medicines ADD medicine_number AS
      (N'MED-' + RIGHT(N'000000' + CONVERT(NVARCHAR(10), id), 6)) PERSISTED;
IF COL_LENGTH(N'dbo.medicines', N'is_active') IS NULL
    ALTER TABLE dbo.medicines ADD is_active BIT NOT NULL CONSTRAINT DF_medicines_is_active DEFAULT (1);
IF COL_LENGTH(N'dbo.medicines', N'deactivated_at') IS NULL
    ALTER TABLE dbo.medicines ADD deactivated_at DATETIME2(0) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.medicines') AND name = N'UQ_medicines_medicine_number')
    CREATE UNIQUE INDEX UQ_medicines_medicine_number ON dbo.medicines(medicine_number);

IF OBJECT_ID(N'dbo.medicine_batches', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.medicine_batches (
      batch_id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_medicine_batches PRIMARY KEY,
      medicine_id INT NOT NULL,
      batch_number NVARCHAR(100) NOT NULL,
      expiry_date DATE NOT NULL,
      quantity_available INT NOT NULL CONSTRAINT DF_medicine_batches_quantity DEFAULT (0),
      unit_cost DECIMAL(12,2) NULL,
      received_at DATETIME2(0) NOT NULL CONSTRAINT DF_medicine_batches_received DEFAULT SYSDATETIME(),
      is_active BIT NOT NULL CONSTRAINT DF_medicine_batches_active DEFAULT (1),
      CONSTRAINT FK_medicine_batches_medicine FOREIGN KEY (medicine_id) REFERENCES dbo.medicines(id),
      CONSTRAINT UQ_medicine_batches_number UNIQUE (medicine_id, batch_number),
      CONSTRAINT CK_medicine_batches_quantity CHECK (quantity_available >= 0),
      CONSTRAINT CK_medicine_batches_cost CHECK (unit_cost IS NULL OR unit_cost >= 0)
    );
    CREATE INDEX IX_medicine_batches_expiry ON dbo.medicine_batches(expiry_date, medicine_id);
END;

IF OBJECT_ID(N'dbo.stock_movements', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.stock_movements (
      movement_id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_stock_movements PRIMARY KEY,
      medicine_id INT NOT NULL,
      batch_id INT NULL,
      movement_type NVARCHAR(30) NOT NULL,
      quantity_delta INT NOT NULL,
      balance_after INT NOT NULL,
      reference_type NVARCHAR(40) NULL,
      reference_id INT NULL,
      idempotency_key NVARCHAR(100) NULL,
      notes NVARCHAR(1000) NULL,
      created_by INT NULL,
      created_at DATETIME2(0) NOT NULL CONSTRAINT DF_stock_movements_created DEFAULT SYSDATETIME(),
      CONSTRAINT FK_stock_movements_medicine FOREIGN KEY (medicine_id) REFERENCES dbo.medicines(id),
      CONSTRAINT FK_stock_movements_batch FOREIGN KEY (batch_id) REFERENCES dbo.medicine_batches(batch_id),
      CONSTRAINT FK_stock_movements_user FOREIGN KEY (created_by) REFERENCES dbo.users(user_id),
      CONSTRAINT CK_stock_movements_type CHECK (movement_type IN (N'OPENING', N'GOODS_RECEIPT', N'SALE', N'REFUND', N'ADJUSTMENT', N'EXPIRY', N'CANCELLATION')),
      CONSTRAINT CK_stock_movements_delta CHECK (quantity_delta <> 0),
      CONSTRAINT CK_stock_movements_balance CHECK (balance_after >= 0)
    );
    CREATE INDEX IX_stock_movements_medicine_created ON dbo.stock_movements(medicine_id, created_at DESC);
    CREATE UNIQUE INDEX UQ_stock_movements_idempotency ON dbo.stock_movements(idempotency_key) WHERE idempotency_key IS NOT NULL;
END;

IF OBJECT_ID(N'dbo.supplier_medicines', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.supplier_medicines (
      supplier_medicine_id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_supplier_medicines PRIMARY KEY,
      supplier_id INT NOT NULL,
      medicine_id INT NOT NULL,
      supplier_sku NVARCHAR(100) NULL,
      last_unit_cost DECIMAL(12,2) NULL,
      lead_time_days INT NULL,
      is_preferred BIT NOT NULL CONSTRAINT DF_supplier_medicines_preferred DEFAULT (0),
      is_active BIT NOT NULL CONSTRAINT DF_supplier_medicines_active DEFAULT (1),
      created_at DATETIME2(0) NOT NULL CONSTRAINT DF_supplier_medicines_created DEFAULT SYSDATETIME(),
      CONSTRAINT FK_supplier_medicines_supplier FOREIGN KEY (supplier_id) REFERENCES dbo.suppliers(id),
      CONSTRAINT FK_supplier_medicines_medicine FOREIGN KEY (medicine_id) REFERENCES dbo.medicines(id),
      CONSTRAINT UQ_supplier_medicines_pair UNIQUE (supplier_id, medicine_id),
      CONSTRAINT CK_supplier_medicines_cost CHECK (last_unit_cost IS NULL OR last_unit_cost >= 0),
      CONSTRAINT CK_supplier_medicines_lead CHECK (lead_time_days IS NULL OR lead_time_days >= 0)
    );
END;

IF OBJECT_ID(N'dbo.supplier_queries', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.supplier_queries (
      query_id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_supplier_queries PRIMARY KEY,
      supplier_id INT NOT NULL,
      subject NVARCHAR(200) NOT NULL,
      status NVARCHAR(20) NOT NULL CONSTRAINT DF_supplier_queries_status DEFAULT N'OPEN',
      created_by INT NOT NULL,
      created_at DATETIME2(0) NOT NULL CONSTRAINT DF_supplier_queries_created DEFAULT SYSDATETIME(),
      closed_at DATETIME2(0) NULL,
      CONSTRAINT FK_supplier_queries_supplier FOREIGN KEY (supplier_id) REFERENCES dbo.suppliers(id),
      CONSTRAINT FK_supplier_queries_user FOREIGN KEY (created_by) REFERENCES dbo.users(user_id),
      CONSTRAINT CK_supplier_queries_status CHECK (status IN (N'OPEN', N'ANSWERED', N'CLOSED'))
    );
END;

IF OBJECT_ID(N'dbo.supplier_query_messages', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.supplier_query_messages (
      message_id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_supplier_query_messages PRIMARY KEY,
      query_id INT NOT NULL,
      sender_user_id INT NOT NULL,
      message NVARCHAR(2000) NOT NULL,
      created_at DATETIME2(0) NOT NULL CONSTRAINT DF_supplier_query_messages_created DEFAULT SYSDATETIME(),
      CONSTRAINT FK_supplier_query_messages_query FOREIGN KEY (query_id) REFERENCES dbo.supplier_queries(query_id) ON DELETE CASCADE,
      CONSTRAINT FK_supplier_query_messages_user FOREIGN KEY (sender_user_id) REFERENCES dbo.users(user_id)
    );
END;

IF OBJECT_ID(N'dbo.reorder_requests', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.reorder_requests (
      reorder_request_id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_reorder_requests PRIMARY KEY,
      medicine_id INT NOT NULL,
      requested_quantity INT NOT NULL,
      status NVARCHAR(20) NOT NULL CONSTRAINT DF_reorder_requests_status DEFAULT N'OPEN',
      requested_by INT NOT NULL,
      created_at DATETIME2(0) NOT NULL CONSTRAINT DF_reorder_requests_created DEFAULT SYSDATETIME(),
      resolved_at DATETIME2(0) NULL,
      CONSTRAINT FK_reorder_requests_medicine FOREIGN KEY (medicine_id) REFERENCES dbo.medicines(id),
      CONSTRAINT FK_reorder_requests_user FOREIGN KEY (requested_by) REFERENCES dbo.users(user_id),
      CONSTRAINT CK_reorder_requests_quantity CHECK (requested_quantity > 0),
      CONSTRAINT CK_reorder_requests_status CHECK (status IN (N'OPEN', N'ORDERED', N'CANCELLED', N'RECEIVED'))
    );
    CREATE UNIQUE INDEX UQ_reorder_requests_open ON dbo.reorder_requests(medicine_id) WHERE status = N'OPEN';
END;

IF OBJECT_ID(N'dbo.purchase_orders', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.purchase_orders (
      purchase_order_id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_purchase_orders PRIMARY KEY,
      purchase_order_number AS (N'PO-' + RIGHT(N'000000' + CONVERT(NVARCHAR(10), purchase_order_id), 6)) PERSISTED,
      supplier_id INT NOT NULL,
      status NVARCHAR(30) NOT NULL CONSTRAINT DF_purchase_orders_status DEFAULT N'DRAFT',
      expected_date DATE NULL,
      notes NVARCHAR(2000) NULL,
      idempotency_key NVARCHAR(100) NULL,
      created_by INT NOT NULL,
      created_at DATETIME2(0) NOT NULL CONSTRAINT DF_purchase_orders_created DEFAULT SYSDATETIME(),
      sent_at DATETIME2(0) NULL,
      confirmed_at DATETIME2(0) NULL,
      updated_at DATETIME2(0) NOT NULL CONSTRAINT DF_purchase_orders_updated DEFAULT SYSDATETIME(),
      CONSTRAINT FK_purchase_orders_supplier FOREIGN KEY (supplier_id) REFERENCES dbo.suppliers(id),
      CONSTRAINT FK_purchase_orders_user FOREIGN KEY (created_by) REFERENCES dbo.users(user_id),
      CONSTRAINT CK_purchase_orders_status CHECK (status IN (N'DRAFT', N'SENT', N'CONFIRMED', N'PARTIALLY_RECEIVED', N'RECEIVED', N'CANCELLED'))
    );
    CREATE UNIQUE INDEX UQ_purchase_orders_number ON dbo.purchase_orders(purchase_order_number);
    CREATE UNIQUE INDEX UQ_purchase_orders_idempotency ON dbo.purchase_orders(idempotency_key) WHERE idempotency_key IS NOT NULL;
    CREATE INDEX IX_purchase_orders_supplier_status ON dbo.purchase_orders(supplier_id, status);
END;

IF OBJECT_ID(N'dbo.purchase_order_items', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.purchase_order_items (
      purchase_order_item_id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_purchase_order_items PRIMARY KEY,
      purchase_order_id INT NOT NULL,
      medicine_id INT NOT NULL,
      ordered_quantity INT NOT NULL,
      received_quantity INT NOT NULL CONSTRAINT DF_purchase_order_items_received DEFAULT (0),
      unit_cost DECIMAL(12,2) NOT NULL,
      CONSTRAINT FK_purchase_order_items_order FOREIGN KEY (purchase_order_id) REFERENCES dbo.purchase_orders(purchase_order_id) ON DELETE CASCADE,
      CONSTRAINT FK_purchase_order_items_medicine FOREIGN KEY (medicine_id) REFERENCES dbo.medicines(id),
      CONSTRAINT UQ_purchase_order_items_medicine UNIQUE (purchase_order_id, medicine_id),
      CONSTRAINT CK_purchase_order_items_ordered CHECK (ordered_quantity > 0),
      CONSTRAINT CK_purchase_order_items_received CHECK (received_quantity >= 0 AND received_quantity <= ordered_quantity),
      CONSTRAINT CK_purchase_order_items_cost CHECK (unit_cost >= 0)
    );
END;

IF OBJECT_ID(N'dbo.goods_receipts', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.goods_receipts (
      goods_receipt_id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_goods_receipts PRIMARY KEY,
      goods_receipt_number AS (N'GRN-' + RIGHT(N'000000' + CONVERT(NVARCHAR(10), goods_receipt_id), 6)) PERSISTED,
      purchase_order_id INT NOT NULL,
      supplier_delivery_reference NVARCHAR(100) NULL,
      received_by INT NOT NULL,
      received_at DATETIME2(0) NOT NULL CONSTRAINT DF_goods_receipts_received DEFAULT SYSDATETIME(),
      idempotency_key NVARCHAR(100) NOT NULL,
      notes NVARCHAR(2000) NULL,
      CONSTRAINT FK_goods_receipts_order FOREIGN KEY (purchase_order_id) REFERENCES dbo.purchase_orders(purchase_order_id),
      CONSTRAINT FK_goods_receipts_user FOREIGN KEY (received_by) REFERENCES dbo.users(user_id)
    );
    CREATE UNIQUE INDEX UQ_goods_receipts_number ON dbo.goods_receipts(goods_receipt_number);
    CREATE UNIQUE INDEX UQ_goods_receipts_idempotency ON dbo.goods_receipts(idempotency_key);
END;

IF OBJECT_ID(N'dbo.goods_receipt_items', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.goods_receipt_items (
      goods_receipt_item_id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_goods_receipt_items PRIMARY KEY,
      goods_receipt_id INT NOT NULL,
      purchase_order_item_id INT NOT NULL,
      medicine_id INT NOT NULL,
      batch_id INT NOT NULL,
      quantity_received INT NOT NULL,
      unit_cost DECIMAL(12,2) NOT NULL,
      CONSTRAINT FK_goods_receipt_items_receipt FOREIGN KEY (goods_receipt_id) REFERENCES dbo.goods_receipts(goods_receipt_id) ON DELETE CASCADE,
      CONSTRAINT FK_goods_receipt_items_order_item FOREIGN KEY (purchase_order_item_id) REFERENCES dbo.purchase_order_items(purchase_order_item_id),
      CONSTRAINT FK_goods_receipt_items_medicine FOREIGN KEY (medicine_id) REFERENCES dbo.medicines(id),
      CONSTRAINT FK_goods_receipt_items_batch FOREIGN KEY (batch_id) REFERENCES dbo.medicine_batches(batch_id),
      CONSTRAINT UQ_goods_receipt_items_order_item UNIQUE (goods_receipt_id, purchase_order_item_id),
      CONSTRAINT CK_goods_receipt_items_quantity CHECK (quantity_received > 0),
      CONSTRAINT CK_goods_receipt_items_cost CHECK (unit_cost >= 0)
    );
END;

IF OBJECT_ID(N'dbo.supplier_invoices', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.supplier_invoices (
      supplier_invoice_id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_supplier_invoices PRIMARY KEY,
      supplier_id INT NOT NULL,
      purchase_order_id INT NULL,
      invoice_number NVARCHAR(100) NOT NULL,
      invoice_date DATE NOT NULL,
      due_date DATE NULL,
      total_amount DECIMAL(12,2) NOT NULL,
      paid_amount DECIMAL(12,2) NOT NULL CONSTRAINT DF_supplier_invoices_paid DEFAULT (0),
      status NVARCHAR(20) NOT NULL CONSTRAINT DF_supplier_invoices_status DEFAULT N'OPEN',
      created_at DATETIME2(0) NOT NULL CONSTRAINT DF_supplier_invoices_created DEFAULT SYSDATETIME(),
      CONSTRAINT FK_supplier_invoices_supplier FOREIGN KEY (supplier_id) REFERENCES dbo.suppliers(id),
      CONSTRAINT FK_supplier_invoices_order FOREIGN KEY (purchase_order_id) REFERENCES dbo.purchase_orders(purchase_order_id),
      CONSTRAINT UQ_supplier_invoices_number UNIQUE (supplier_id, invoice_number),
      CONSTRAINT CK_supplier_invoices_amount CHECK (total_amount >= 0 AND paid_amount >= 0 AND paid_amount <= total_amount),
      CONSTRAINT CK_supplier_invoices_status CHECK (status IN (N'OPEN', N'PARTIALLY_PAID', N'PAID', N'VOID'))
    );
END;

IF OBJECT_ID(N'dbo.supplier_payments', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.supplier_payments (
      supplier_payment_id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_supplier_payments PRIMARY KEY,
      supplier_invoice_id INT NOT NULL,
      amount DECIMAL(12,2) NOT NULL,
      payment_method NVARCHAR(30) NOT NULL,
      reference_number NVARCHAR(100) NULL,
      idempotency_key NVARCHAR(100) NOT NULL,
      status NVARCHAR(20) NOT NULL CONSTRAINT DF_supplier_payments_status DEFAULT N'CONFIRMED',
      paid_by INT NOT NULL,
      paid_at DATETIME2(0) NOT NULL CONSTRAINT DF_supplier_payments_paid DEFAULT SYSDATETIME(),
      CONSTRAINT FK_supplier_payments_invoice FOREIGN KEY (supplier_invoice_id) REFERENCES dbo.supplier_invoices(supplier_invoice_id),
      CONSTRAINT FK_supplier_payments_user FOREIGN KEY (paid_by) REFERENCES dbo.users(user_id),
      CONSTRAINT CK_supplier_payments_amount CHECK (amount > 0),
      CONSTRAINT CK_supplier_payments_method CHECK (payment_method IN (N'CASH', N'BANK_TRANSFER', N'CHEQUE', N'CARD')),
      CONSTRAINT CK_supplier_payments_status CHECK (status IN (N'CONFIRMED', N'VOID'))
    );
    CREATE UNIQUE INDEX UQ_supplier_payments_idempotency ON dbo.supplier_payments(idempotency_key);
    CREATE UNIQUE INDEX UQ_supplier_payments_reference ON dbo.supplier_payments(reference_number) WHERE reference_number IS NOT NULL;
END;

/* Customer sales accounting remains strictly separate from supplier payables. */
IF COL_LENGTH(N'dbo.sales', N'tax_amount') IS NULL
    ALTER TABLE dbo.sales ADD tax_amount DECIMAL(12,2) NOT NULL CONSTRAINT DF_sales_tax DEFAULT (0);
IF COL_LENGTH(N'dbo.sales', N'status') IS NULL
    ALTER TABLE dbo.sales ADD status NVARCHAR(20) NOT NULL CONSTRAINT DF_sales_status DEFAULT N'COMPLETED';
IF COL_LENGTH(N'dbo.sales', N'payment_status') IS NULL
    ALTER TABLE dbo.sales ADD payment_status NVARCHAR(20) NOT NULL CONSTRAINT DF_sales_payment_status DEFAULT N'UNPAID';
IF COL_LENGTH(N'dbo.sales', N'idempotency_key') IS NULL
    ALTER TABLE dbo.sales ADD idempotency_key NVARCHAR(100) NULL;
IF COL_LENGTH(N'dbo.sales', N'invoice_number') IS NULL
    ALTER TABLE dbo.sales ADD invoice_number AS
      (N'INV-' + RIGHT(N'000000' + CONVERT(NVARCHAR(10), id), 6)) PERSISTED;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.sales') AND name = N'UQ_sales_invoice_number')
    CREATE UNIQUE INDEX UQ_sales_invoice_number ON dbo.sales(invoice_number);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.sales') AND name = N'UQ_sales_idempotency')
    CREATE UNIQUE INDEX UQ_sales_idempotency ON dbo.sales(idempotency_key) WHERE idempotency_key IS NOT NULL;

IF OBJECT_ID(N'dbo.customer_invoices', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.customer_invoices (
      customer_invoice_id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_customer_invoices PRIMARY KEY,
      sale_id INT NOT NULL,
      customer_id INT NULL,
      subtotal DECIMAL(12,2) NOT NULL,
      discount_amount DECIMAL(12,2) NOT NULL CONSTRAINT DF_customer_invoices_discount DEFAULT (0),
      tax_amount DECIMAL(12,2) NOT NULL CONSTRAINT DF_customer_invoices_tax DEFAULT (0),
      total_amount DECIMAL(12,2) NOT NULL,
      status NVARCHAR(20) NOT NULL CONSTRAINT DF_customer_invoices_status DEFAULT N'UNPAID',
      issued_at DATETIME2(0) NOT NULL CONSTRAINT DF_customer_invoices_issued DEFAULT SYSDATETIME(),
      CONSTRAINT FK_customer_invoices_sale FOREIGN KEY (sale_id) REFERENCES dbo.sales(id),
      CONSTRAINT FK_customer_invoices_customer FOREIGN KEY (customer_id) REFERENCES dbo.customers(id),
      CONSTRAINT UQ_customer_invoices_sale UNIQUE (sale_id),
      CONSTRAINT CK_customer_invoices_amount CHECK (subtotal >= 0 AND discount_amount >= 0 AND tax_amount >= 0 AND total_amount >= 0),
      CONSTRAINT CK_customer_invoices_status CHECK (status IN (N'UNPAID', N'PAID', N'PARTIALLY_REFUNDED', N'REFUNDED', N'VOID'))
    );
END;

IF OBJECT_ID(N'dbo.customer_payments', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.customer_payments (
      customer_payment_id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_customer_payments PRIMARY KEY,
      customer_invoice_id INT NOT NULL,
      amount DECIMAL(12,2) NOT NULL,
      payment_method NVARCHAR(30) NOT NULL,
      status NVARCHAR(20) NOT NULL CONSTRAINT DF_customer_payments_status DEFAULT N'PENDING',
      idempotency_key NVARCHAR(100) NOT NULL,
      provider_reference NVARCHAR(150) NULL,
      failure_reason NVARCHAR(500) NULL,
      created_by INT NOT NULL,
      created_at DATETIME2(0) NOT NULL CONSTRAINT DF_customer_payments_created DEFAULT SYSDATETIME(),
      confirmed_at DATETIME2(0) NULL,
      CONSTRAINT FK_customer_payments_invoice FOREIGN KEY (customer_invoice_id) REFERENCES dbo.customer_invoices(customer_invoice_id),
      CONSTRAINT FK_customer_payments_user FOREIGN KEY (created_by) REFERENCES dbo.users(user_id),
      CONSTRAINT CK_customer_payments_amount CHECK (amount > 0),
      CONSTRAINT CK_customer_payments_method CHECK (payment_method IN (N'CASH', N'CARD', N'BANK_TRANSFER', N'MOBILE')),
      CONSTRAINT CK_customer_payments_status CHECK (status IN (N'PENDING', N'CONFIRMED', N'FAILED', N'VOID'))
    );
    CREATE UNIQUE INDEX UQ_customer_payments_idempotency ON dbo.customer_payments(idempotency_key);
    CREATE UNIQUE INDEX UQ_customer_payments_provider ON dbo.customer_payments(provider_reference) WHERE provider_reference IS NOT NULL;
END;

IF OBJECT_ID(N'dbo.sale_refunds', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.sale_refunds (
      refund_id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_sale_refunds PRIMARY KEY,
      customer_payment_id INT NOT NULL,
      amount DECIMAL(12,2) NOT NULL,
      reason NVARCHAR(1000) NOT NULL,
      idempotency_key NVARCHAR(100) NOT NULL,
      status NVARCHAR(20) NOT NULL CONSTRAINT DF_sale_refunds_status DEFAULT N'CONFIRMED',
      created_by INT NOT NULL,
      created_at DATETIME2(0) NOT NULL CONSTRAINT DF_sale_refunds_created DEFAULT SYSDATETIME(),
      CONSTRAINT FK_sale_refunds_payment FOREIGN KEY (customer_payment_id) REFERENCES dbo.customer_payments(customer_payment_id),
      CONSTRAINT FK_sale_refunds_user FOREIGN KEY (created_by) REFERENCES dbo.users(user_id),
      CONSTRAINT CK_sale_refunds_amount CHECK (amount > 0),
      CONSTRAINT CK_sale_refunds_status CHECK (status IN (N'CONFIRMED', N'FAILED', N'VOID'))
    );
    CREATE UNIQUE INDEX UQ_sale_refunds_idempotency ON dbo.sale_refunds(idempotency_key);
END;

IF OBJECT_ID(N'dbo.notifications', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.notifications (
      notification_id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_notifications PRIMARY KEY,
      recipient_user_id INT NULL,
      recipient_role NVARCHAR(20) NULL,
      notification_type NVARCHAR(50) NOT NULL,
      title NVARCHAR(200) NOT NULL,
      message NVARCHAR(1000) NOT NULL,
      entity_type NVARCHAR(50) NULL,
      entity_id INT NULL,
      deduplication_key NVARCHAR(150) NULL,
      read_at DATETIME2(0) NULL,
      created_at DATETIME2(0) NOT NULL CONSTRAINT DF_notifications_created DEFAULT SYSDATETIME(),
      CONSTRAINT FK_notifications_user FOREIGN KEY (recipient_user_id) REFERENCES dbo.users(user_id),
      CONSTRAINT CK_notifications_recipient CHECK (recipient_user_id IS NOT NULL OR recipient_role IS NOT NULL),
      CONSTRAINT CK_notifications_role CHECK (recipient_role IS NULL OR recipient_role IN (N'CUSTOMER', N'ADMIN', N'PHARMACIST', N'INVENTORY', N'SALES', N'SUPPLIER'))
    );
    CREATE UNIQUE INDEX UQ_notifications_deduplication ON dbo.notifications(deduplication_key) WHERE deduplication_key IS NOT NULL;
    CREATE INDEX IX_notifications_user_unread ON dbo.notifications(recipient_user_id, read_at, created_at DESC);
    CREATE INDEX IX_notifications_role_unread ON dbo.notifications(recipient_role, read_at, created_at DESC);
END;

IF OBJECT_ID(N'dbo.notification_outbox', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.notification_outbox (
      outbox_id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_notification_outbox PRIMARY KEY,
      notification_id BIGINT NOT NULL,
      channel NVARCHAR(20) NOT NULL,
      destination NVARCHAR(255) NOT NULL,
      status NVARCHAR(20) NOT NULL CONSTRAINT DF_notification_outbox_status DEFAULT N'PENDING',
      attempt_count INT NOT NULL CONSTRAINT DF_notification_outbox_attempts DEFAULT (0),
      last_error NVARCHAR(1000) NULL,
      next_attempt_at DATETIME2(0) NULL,
      delivered_at DATETIME2(0) NULL,
      created_at DATETIME2(0) NOT NULL CONSTRAINT DF_notification_outbox_created DEFAULT SYSDATETIME(),
      CONSTRAINT FK_notification_outbox_notification FOREIGN KEY (notification_id) REFERENCES dbo.notifications(notification_id) ON DELETE CASCADE,
      CONSTRAINT CK_notification_outbox_channel CHECK (channel IN (N'EMAIL', N'SMS')),
      CONSTRAINT CK_notification_outbox_status CHECK (status IN (N'PENDING', N'PROCESSING', N'DELIVERED', N'FAILED', N'DISABLED')),
      CONSTRAINT CK_notification_outbox_attempts CHECK (attempt_count >= 0)
    );
END;

IF OBJECT_ID(N'dbo.audit_logs', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.audit_logs (
      audit_log_id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_audit_logs PRIMARY KEY,
      actor_user_id INT NULL,
      action NVARCHAR(100) NOT NULL,
      entity_type NVARCHAR(50) NOT NULL,
      entity_id NVARCHAR(100) NULL,
      request_id NVARCHAR(100) NULL,
      details_json NVARCHAR(MAX) NULL,
      created_at DATETIME2(0) NOT NULL CONSTRAINT DF_audit_logs_created DEFAULT SYSDATETIME(),
      CONSTRAINT FK_audit_logs_user FOREIGN KEY (actor_user_id) REFERENCES dbo.users(user_id),
      CONSTRAINT CK_audit_logs_json CHECK (details_json IS NULL OR ISJSON(details_json) = 1)
    );
    CREATE INDEX IX_audit_logs_entity_created ON dbo.audit_logs(entity_type, entity_id, created_at DESC);
END;

/* Prescription documents may be PDF, JPEG, or PNG after server-side signature validation. */
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID(N'dbo.prescription_uploads') AND name = N'CK_prescription_uploads_mime_type')
    ALTER TABLE dbo.prescription_uploads DROP CONSTRAINT CK_prescription_uploads_mime_type;
GO
ALTER TABLE dbo.prescription_uploads WITH CHECK ADD CONSTRAINT CK_prescription_uploads_mime_type
  CHECK (mime_type IS NULL OR mime_type IN (N'image/jpeg', N'image/png', N'application/pdf'));
