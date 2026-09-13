-- ============================================================================
-- SEED DATA
-- Pharmacy Management System
--
-- This seed data is REQUIRED for Sprint 1 testing:
-- - Normal stock medicine
-- - Low-stock medicine
-- - Near-expiry medicine
-- - Expired medicine
-- - Supplier
-- - Customer
-- ============================================================================

USE pharmacy_management;

-- ============================================================================
-- Suppliers (required for purchases)
-- ============================================================================
INSERT INTO suppliers (company_name, contact_person, email, phone, address) VALUES
('MedPharm Distributors', 'John Smith', 'sales@medpharm.com', '+94 77 123 4567', '123 Healthcare Street, Colombo 05'),
('HealthCare Supplies Ltd', 'Sarah Johnson', 'orders@healthcare.com', '+94 71 987 6543', '45 Medical Avenue, Kandy'),
('PharmaSource International', 'Michael Brown', 'info@pharmasource.com', '+94 76 555 1234', '78 Commerce Road, Galle'),
('Local Medical Imports', 'Priya Silva', 'contact@localmed.com', '+94 77 888 9999', '22 Pharmacy Lane, Jaffna'),
('Generic Pharma Co', 'David Wilson', 'support@genericpharma.com', '+94 71 222 3333', '55 Bulk Order Street, Batticaloa');

-- ============================================================================
-- Medicines
-- ============================================================================

-- Normal stock medicine (healthy quantity, not expiring soon)
INSERT INTO medicines (name, description, generic_name, manufacturer, category, batch_number, quantity, unit_price, expiry_date, min_stock_level) VALUES
('Amoxicillin 500mg Capsules (100pcs)', 'Broad-spectrum antibiotic', 'Amoxicillin', 'SmithKline Beecham', 'Antibiotics', 'AMX-2024-001', 150, 2500.00, '2026-12-31', 20),
('Paracetamol 500mg Tablets (100pcs)', 'Pain reliever and fever reducer', 'Paracetamol', 'Cipla Ltd', 'Analgesics', 'PCM-2024-002', 200, 850.00, '2026-08-15', 30),
('Omeprazole 20mg Capsules (30pcs)', 'Proton pump inhibitor for acid reflux', 'Omeprazole', 'AstraZeneca', 'Gastrointestinal', 'OME-2024-003', 85, 1200.00, '2026-06-30', 15),
('Metformin 500mg Tablets (100pcs)', 'Type 2 diabetes medication', 'Metformin HCl', 'Merck', 'Diabetes', 'MET-2024-004', 120, 1800.00, '2026-09-30', 25),
('Cetirizine 10mg Tablets (30pcs)', 'Antihistamine for allergies', 'Cetirizine HCl', 'UCB Pharma', 'Antihistamines', 'CTZ-2024-005', 60, 650.00, '2026-04-20', 10);

-- Low stock medicines (below min_stock_level)
INSERT INTO medicines (name, description, generic_name, manufacturer, category, batch_number, quantity, unit_price, expiry_date, min_stock_level) VALUES
('Azithromycin 250mg Tablets (6pcs)', 'Macrolide antibiotic', 'Azithromycin', 'Pfizer', 'Antibiotics', 'AZI-2024-006', 5, 3200.00, '2026-11-15', 10),
('Atorvastatin 20mg Tablets (30pcs)', 'Cholesterol-lowering statin', 'Atorvastatin Calcium', 'Lipitor Pfizer', 'Cardiovascular', 'ATOR-2024-007', 8, 2100.00, '2026-07-20', 15);

-- Near-expiry medicine (expires within 30-60 days)
INSERT INTO medicines (name, description, generic_name, manufacturer, category, batch_number, quantity, unit_price, expiry_date, min_stock_level) VALUES
('Ibuprofen 400mg Tablets (50pcs)', 'NSAID pain reliever', 'Ibuprofen', 'Boots Pharmaceuticals', 'Analgesics', 'IBU-2024-008', 45, 950.00, '2026-05-15', 20);

-- Expired medicine (for testing expired filter)
INSERT INTO medicines (name, description, generic_name, manufacturer, category, batch_number, quantity, unit_price, expiry_date, min_stock_level) VALUES
('Cough Syrup - Honey Lemon (100ml)', 'Cough suppressant syrup', 'Dextromethorphan', 'Bristol Myers', 'Respiratory', 'COUGHY-2023-009', 25, 750.00, '2025-01-10', 10);

-- Additional medicines for testing
INSERT INTO medicines (name, description, generic_name, manufacturer, category, batch_number, quantity, unit_price, expiry_date, min_stock_level) VALUES
('Loratadine 10mg Tablets (30pcs)', 'Non-drowsy antihistamine', 'Loratadine', 'Clarityne', 'Antihistamines', 'LRT-2024-010', 90, 890.00, '2026-10-01', 15),
('Losartan 50mg Tablets (30pcs)', 'ARB blood pressure medication', 'Losartan Potassium', 'Merck', 'Cardiovascular', 'LOS-2024-011', 75, 1450.00, '2026-03-25', 20),
('Salbutamol Inhaler (100mcg)', 'Bronchodilator for asthma', 'Salbutamol', 'GlaxoSmithKline', 'Respiratory', 'SAL-2024-012', 30, 3500.00, '2026-08-01', 5),
('Metformin 1000mg Tablets (60pcs)', 'Extended release diabetes medication', 'Metformin HCl ER', 'Santofi', 'Diabetes', 'MET1000-2024-013', 40, 2200.00, '2026-12-01', 10),
('Vitamin C 1000mg Tablets (60pcs)', 'Vitamin supplement', 'Ascorbic Acid', 'Nature Made', 'Supplements', 'VITC-2024-014', 180, 550.00, '2027-01-15', 25);

-- ============================================================================
-- Customers (required for prescriptions and sales)
-- ============================================================================
INSERT INTO customers (first_name, last_name, email, phone, address, date_of_birth) VALUES
('Kamal', 'Perera', 'kamal.perera@email.com', '+94 77 111 2222', '15 Baddegama Road, Dehiwala', '1985-03-15'),
('Samantha', 'Fernando', 'sam.fernando@email.com', '+94 71 333 4444', '28 Kotte Road, Maharagama', '1990-07-22'),
('Ranjith', 'Wijesinghe', 'ranjith.w@email.com', '+94 76 555 6666', '42 Galle Road, Bambalapitiya', '1978-11-08'),
('Nimali', 'Abeykoon', 'nimali.abeykoon@email.com', '+94 77 777 8888', '7 Wellawatte High Road, Wellawatte', '1992-04-30'),
('Chandrika', 'De Silva', 'chandrika.ds@email.com', '+94 71 999 0000', '55 Negombo Road, Kaduwela', '1988-09-12');

-- ============================================================================
-- Verify seed data was inserted correctly
-- ============================================================================
-- SELECT 'Suppliers count: ' AS info, COUNT(*) AS count FROM suppliers;
-- SELECT 'Medicines count: ' AS info, COUNT(*) AS count FROM medicines;
-- SELECT 'Customers count: ' AS info, COUNT(*) AS count FROM customers;
