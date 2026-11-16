-- MindaFresh ERP - test data. Import AFTER schema.sql.
-- Passwords are bcrypt hashes of the seed passwords in the blueprint (Section 6).
USE mindafresh_db;
SET time_zone = '+08:00';

INSERT INTO departments (department_code, name) VALUES
  ('DEP-0001', 'Management'),
  ('DEP-0002', 'Sales'),
  ('DEP-0003', 'Inventory'),
  ('DEP-0004', 'Human Resources'),
  ('DEP-0005', 'Finance'),
  ('DEP-0006', 'Delivery');

INSERT INTO employees (employee_code, first_name, last_name, email, phone, hire_date, department_id, position, employment_type, daily_rate, vacation_leave_balance, sick_leave_balance, status) VALUES
  ('EMP-0001', 'Roberto', 'Dela Cruz', 'roberto.delacruz@mindafresh.test', '09171000001', '2025-06-01', 1, 'General Manager', 'regular', 1200.00, 5, 5, 'active'),
  ('EMP-0002', 'Maria', 'Santos', 'maria.santos@mindafresh.test', '09171000002', '2025-06-01', 2, 'Cashier', 'regular', 650.00, 5, 5, 'active'),
  ('EMP-0003', 'Jose', 'Ramos', 'jose.ramos@mindafresh.test', '09171000003', '2025-06-01', 3, 'Inventory Clerk', 'regular', 650.00, 5, 5, 'active'),
  ('EMP-0004', 'Liza', 'Mendoza', 'liza.mendoza@mindafresh.test', '09171000004', '2025-06-01', 4, 'HR Officer', 'regular', 750.00, 5, 5, 'active'),
  ('EMP-0005', 'Carla', 'Villanueva', 'carla.villanueva@mindafresh.test', '09171000005', '2025-06-01', 5, 'Accountant', 'regular', 850.00, 5, 5, 'active'),
  ('EMP-0006', 'Pedro', 'Garcia', 'pedro.garcia@mindafresh.test', '09171000006', '2025-06-01', 2, 'Sales Staff', 'probationary', 610.00, 5, 5, 'active'),
  ('EMP-0007', 'Ramon', 'Bautista', 'ramon.bautista@mindafresh.test', '09171000007', '2025-06-01', 6, 'Delivery Rider', 'contractual', 610.00, 5, 5, 'active');

INSERT INTO users (user_code, employee_id, username, password, role, status) VALUES
  ('USR-0001', 1, 'admin', '$2b$10$o6hD15Els8qttxipsIc4aezO0PRJYG1M762288K6yf.tzZdod/hzm', 'admin', 'active'),
  ('USR-0002', 2, 'maria.cashier', '$2b$10$VCxmm.GiISiNQOxGVNL1OuQC4jc2vAqd56tNGXbNT5hlTZ9OVyXiG', 'cashier', 'active'),
  ('USR-0003', 3, 'jose.inventory', '$2b$10$dgF/oWHHZCRUQ.16.aGacucDihB6WK.rOwmy3u7ilG/uihAMPYIFe', 'inventory_staff', 'active'),
  ('USR-0004', 4, 'liza.hr', '$2b$10$NPWnKmqwxMXripnw9ze72.E3nzZRmu3w8CMg.uVl.Er9jfI6VWP3W', 'hr_staff', 'active'),
  ('USR-0005', 5, 'carla.accountant', '$2b$10$yEzOa.CcvB/MBSJFVcPube/vDhZAf157rN7aQAjo9A26klb3ccDrO', 'accountant', 'active'),
  ('USR-0006', 6, 'pedro.employee', '$2b$10$qIbri2JyMZiNOMuB8jdHLeHL.9/8rR4aobOg9QWmIQ6PEL7aNL3UC', 'employee', 'active'),
  ('USR-0007', 7, 'ramon.rider', '$2b$10$vU0jj6FTSUa59gvdMBdAHu/YZg67j093vaMgxYXMWrj1nxt2d4OZ2', 'rider', 'active');

INSERT INTO categories (category_code, name) VALUES
  ('CAT-0001', 'Fresh Produce'),
  ('CAT-0002', 'Frozen Goods'),
  ('CAT-0003', 'Dry Goods');

INSERT INTO products (product_code, name, category_id, unit, cost_price, selling_price, reorder_level, is_online, status) VALUES
  ('PRD-0001', 'Calamansi 1kg Pack', 1, 'pack', 55.00, 85.00, 10, 1, 'active'),
  ('PRD-0002', 'Lakatan Banana 1kg', 1, 'kg', 60.00, 95.00, 10, 1, 'active'),
  ('PRD-0003', 'Native Tomato 1kg', 1, 'kg', 50.00, 80.00, 10, 1, 'active'),
  ('PRD-0004', 'Frozen Bangus 1kg', 2, 'kg', 140.00, 210.00, 10, 1, 'active'),
  ('PRD-0005', 'Frozen Chicken Breast 1kg', 2, 'kg', 190.00, 260.00, 10, 1, 'active'),
  ('PRD-0006', 'Frozen Pork Liempo 1kg', 2, 'kg', 280.00, 360.00, 10, 1, 'active'),
  ('PRD-0007', 'Well-milled Rice 5kg', 3, 'pack', 240.00, 300.00, 10, 1, 'active'),
  ('PRD-0008', 'Brown Sugar 1kg', 3, 'pack', 70.00, 95.00, 10, 1, 'active'),
  ('PRD-0009', 'Cooking Oil 1L', 3, 'pc', 85.00, 115.00, 10, 1, 'active'),
  ('PRD-0010', 'Eggs, Medium (Tray of 30)', 3, 'tray', 210.00, 270.00, 10, 1, 'active');

INSERT INTO stock_levels (product_id, quantity_on_hand) VALUES
  (1, 120),
  (2, 80),
  (3, 60),
  (4, 40),
  (5, 30),
  (6, 25),
  (7, 50),
  (8, 40),
  (9, 45),
  (10, 20);

INSERT INTO stock_movements (movement_code, product_id, movement_type, quantity_change, quantity_before, quantity_after, unit_cost, remarks, employee_id) VALUES
  ('STK-0001', 1, 'opening', 120, 0, 120, 55.00, 'Opening stock', 3),
  ('STK-0002', 2, 'opening', 80, 0, 80, 60.00, 'Opening stock', 3),
  ('STK-0003', 3, 'opening', 60, 0, 60, 50.00, 'Opening stock', 3),
  ('STK-0004', 4, 'opening', 40, 0, 40, 140.00, 'Opening stock', 3),
  ('STK-0005', 5, 'opening', 30, 0, 30, 190.00, 'Opening stock', 3),
  ('STK-0006', 6, 'opening', 25, 0, 25, 280.00, 'Opening stock', 3),
  ('STK-0007', 7, 'opening', 50, 0, 50, 240.00, 'Opening stock', 3),
  ('STK-0008', 8, 'opening', 40, 0, 40, 70.00, 'Opening stock', 3),
  ('STK-0009', 9, 'opening', 45, 0, 45, 85.00, 'Opening stock', 3),
  ('STK-0010', 10, 'opening', 20, 0, 20, 210.00, 'Opening stock', 3);

INSERT INTO suppliers (supplier_code, name, contact_person, phone, address, status) VALUES
  ('SUP-0001', 'Mindoro Fresh Farms Cooperative', 'Elena Castillo', '09181234567', 'Naujan, Oriental Mindoro', 'active'),
  ('SUP-0002', 'Calapan Cold Storage Trading', 'Mark Aquino', '09191234567', 'Calapan City, Oriental Mindoro', 'active');

INSERT INTO customers (customer_code, first_name, last_name, email, password, phone, address, city, status) VALUES
  ('CUS-0001', 'Ana', 'Reyes', 'ana.reyes@example.com', '$2b$10$poknT00lFKVqEJSgnFdzqe17LqAU4xrtt.WtB.KbTgf9RDGlkoU3i', '09201234567', '123 J.P. Rizal St., Brgy. Lalud', 'Calapan City', 'active');

-- Holidays: verify against the official 2026 proclamation before defence.
INSERT INTO holidays (holiday_date, name, holiday_type) VALUES
  ('2026-11-01', 'All Saints'' Day', 'special'),
  ('2026-11-30', 'Bonifacio Day', 'regular'),
  ('2026-12-08', 'Feast of the Immaculate Conception', 'special'),
  ('2026-12-24', 'Christmas Eve', 'special'),
  ('2026-12-25', 'Christmas Day', 'regular'),
  ('2026-12-30', 'Rizal Day', 'regular'),
  ('2026-12-31', 'Last Day of the Year', 'special');

INSERT INTO accounts (account_code, account_name, account_type, normal_balance, is_active) VALUES
  ('1010', 'Cash on Hand', 'asset', 'debit', 1),
  ('1020', 'Cash in Bank / E-Wallet', 'asset', 'debit', 1),
  ('1200', 'Merchandise Inventory', 'asset', 'debit', 1),
  ('2010', 'Accounts Payable', 'liability', 'credit', 1),
  ('2100', 'Salaries Payable', 'liability', 'credit', 1),
  ('2110', 'Government Contributions Payable', 'liability', 'credit', 1),
  ('2120', 'Withholding Tax Payable', 'liability', 'credit', 1),
  ('3010', 'Owner''s Capital', 'equity', 'credit', 1),
  ('4010', 'Sales Revenue - POS', 'revenue', 'credit', 1),
  ('4020', 'Sales Revenue - Online', 'revenue', 'credit', 1),
  ('4030', 'Delivery Fee Income', 'revenue', 'credit', 1),
  ('5010', 'Cost of Goods Sold', 'expense', 'debit', 1),
  ('6010', 'Salaries Expense', 'expense', 'debit', 1),
  ('6020', 'Rent Expense', 'expense', 'debit', 1),
  ('6030', 'Utilities Expense', 'expense', 'debit', 1),
  ('6040', 'Inventory Loss and Spoilage', 'expense', 'debit', 1);

-- Opening balances, so the trial balance is right from day one.
INSERT INTO journal_entries (entry_code, entry_date, description, source_module, entry_type, reference_code, total_debit, total_credit, status, posted_by_id) VALUES
  ('TXN-0001', '2026-10-01', 'Opening balances', 'accounting', 'opening', NULL, 175525.00, 175525.00, 'posted', 5);

INSERT INTO journal_lines (journal_entry_id, account_id, debit, credit, memo) VALUES
  (1, 1, 20000.00, 0.00, 'Opening cash on hand'),
  (1, 2, 100000.00, 0.00, 'Opening bank balance'),
  (1, 3, 55525.00, 0.00, 'Opening stock (STK-0001 to STK-0010)'),
  (1, 8, 0.00, 175525.00, 'Owner''s capital');
