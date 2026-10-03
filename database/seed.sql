USE pharmacy_management;
GO

IF NOT EXISTS (SELECT 1 FROM suppliers)
BEGIN
    INSERT INTO suppliers (company_name, contact_person, email, phone, address) VALUES
    (N'MedPharm Distributors', N'John Smith', N'sales@medpharm.com', N'+94 77 123 4567', N'123 Healthcare Street, Colombo 05'),
    (N'HealthCare Supplies Ltd', N'Sarah Johnson', N'orders@healthcare.com', N'+94 71 987 6543', N'45 Medical Avenue, Kandy'),
    (N'PharmaSource International', N'Michael Brown', N'info@pharmasource.com', N'+94 76 555 1234', N'78 Commerce Road, Galle');
END;
GO

IF NOT EXISTS (SELECT 1 FROM users)
BEGIN
    INSERT INTO users (username, password, role) VALUES
    (N'admin', N'$2a$12$ddm8RHU613WAwzhUwRSf6Oo.Tjf7iAoNhSBiqTbCIGpVzsn/hFEAC', N'ADMIN'),
    (N'pharmacist', N'$2a$12$H6KcerPt46iKr/ZPpKQKKOH74Wg0UhdUN9v9oFFWPGVNedyptfQgu', N'PHARMACIST'),
    (N'inventory', N'$2a$12$E9CLQ67F6SH4t9m.wNWGy.sfil57HgjzlVX8ub0ZC.3OI7BWKl1WW', N'INVENTORY'),
    (N'sales', N'$2a$12$Q9GTxb14dD.ANc.9GUvope/2aoAu.71WxUhQ2sbACL8vIVueQ2YS6', N'SALES'),
    (N'supplier', N'$2a$12$ywEnQuFUZd8XI4s3FalimulvwaiZwe.tx2eEa.Tmd07dytyE2Vn0u', N'SUPPLIER');
END;
GO

IF NOT EXISTS (SELECT 1 FROM staff)
BEGIN
    INSERT INTO staff (user_id, staff_name, staff_role, email, phone)
    SELECT user_id, CASE username
        WHEN N'admin' THEN N'Pharmacy Administrator'
        WHEN N'pharmacist' THEN N'Lead Pharmacist'
        WHEN N'inventory' THEN N'Inventory Coordinator'
        WHEN N'sales' THEN N'Sales Coordinator'
        WHEN N'supplier' THEN N'Supplier Coordinator'
    END, role, CASE username WHEN N'supplier' THEN N'Supply@gmail.com' ELSE CONCAT(username, N'@senevirathna.local') END, NULL
    FROM users
    WHERE role <> N'CUSTOMER';
END;
GO

IF NOT EXISTS (SELECT 1 FROM medicines)
BEGIN
    INSERT INTO medicines (name, description, generic_name, manufacturer, category, batch_number, quantity, unit_price, expiry_date, min_stock_level) VALUES
    (N'Amoxicillin 500mg Capsules (100pcs)', N'Broad-spectrum antibiotic', N'Amoxicillin', N'SmithKline Beecham', N'Antibiotics', N'AMX-001', 150, 2500.00, DATEADD(day, 365, CAST(GETDATE() AS date)), 20),
    (N'Paracetamol 500mg Tablets (100pcs)', N'Pain reliever and fever reducer', N'Paracetamol', N'Cipla Ltd', N'Analgesics', N'PCM-002', 200, 850.00, DATEADD(day, 240, CAST(GETDATE() AS date)), 30),
    (N'Omeprazole 20mg Capsules (30pcs)', N'Proton pump inhibitor', N'Omeprazole', N'AstraZeneca', N'Gastrointestinal', N'OME-003', 85, 1200.00, DATEADD(day, 180, CAST(GETDATE() AS date)), 15),
    (N'Azithromycin 250mg Tablets (6pcs)', N'Macrolide antibiotic', N'Azithromycin', N'Pfizer', N'Antibiotics', N'AZI-004', 5, 3200.00, DATEADD(day, 200, CAST(GETDATE() AS date)), 10),
    (N'Atorvastatin 20mg Tablets (30pcs)', N'Cholesterol-lowering statin', N'Atorvastatin Calcium', N'Pfizer', N'Cardiovascular', N'ATOR-005', 8, 2100.00, DATEADD(day, 160, CAST(GETDATE() AS date)), 15),
    (N'Ibuprofen 400mg Tablets (50pcs)', N'NSAID pain reliever', N'Ibuprofen', N'Boots Pharmaceuticals', N'Analgesics', N'IBU-006', 45, 950.00, DATEADD(day, 20, CAST(GETDATE() AS date)), 20),
    (N'Cough Syrup - Honey Lemon (100ml)', N'Cough suppressant syrup', N'Dextromethorphan', N'Bristol Myers', N'Respiratory', N'COUGH-007', 25, 750.00, DATEADD(day, -60, CAST(GETDATE() AS date)), 10);
END;
GO

IF NOT EXISTS (SELECT 1 FROM customers)
BEGIN
    INSERT INTO customers (first_name, last_name, email, phone, address, date_of_birth) VALUES
    (N'Kamal', N'Perera', N'kamal.perera@email.com', N'+94 77 111 2222', N'Dehiwala', '1985-03-15'),
    (N'Samantha', N'Fernando', N'sam.fernando@email.com', N'+94 71 333 4444', N'Maharagama', '1990-07-22'),
    (N'Ranjith', N'Wijesinghe', N'ranjith.w@email.com', N'+94 76 555 6666', N'Bambalapitiya', '1978-11-08');
END;
GO