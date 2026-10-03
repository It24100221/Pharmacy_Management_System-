USE pharmacy_management;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

CREATE OR ALTER TRIGGER trg_medicines_updated_at ON medicines AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL() > 1 RETURN;
    UPDATE m SET updated_at = SYSDATETIME()
    FROM medicines m INNER JOIN inserted i ON m.id = i.id;
END;
GO

CREATE OR ALTER TRIGGER trg_suppliers_updated_at ON suppliers AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL() > 1 RETURN;
    UPDATE s SET updated_at = SYSDATETIME()
    FROM suppliers s INNER JOIN inserted i ON s.id = i.id;
END;
GO

CREATE OR ALTER TRIGGER trg_customers_updated_at ON customers AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL() > 1 RETURN;
    UPDATE c SET updated_at = SYSDATETIME()
    FROM customers c INNER JOIN inserted i ON c.id = i.id;
END;
GO

CREATE OR ALTER TRIGGER trg_purchases_updated_at ON purchases AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL() > 1 RETURN;
    UPDATE p SET updated_at = SYSDATETIME()
    FROM purchases p INNER JOIN inserted i ON p.id = i.id;
END;
GO

CREATE OR ALTER TRIGGER trg_prescriptions_updated_at ON prescriptions AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL() > 1 RETURN;
    UPDATE p SET updated_at = SYSDATETIME()
    FROM prescriptions p INNER JOIN inserted i ON p.id = i.id;
END;
GO

CREATE OR ALTER TRIGGER trg_sales_updated_at ON sales AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL() > 1 RETURN;
    UPDATE s SET updated_at = SYSDATETIME()
    FROM sales s INNER JOIN inserted i ON s.id = i.id;
END;
GO
