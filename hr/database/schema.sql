-- MindaFresh ERP - one shared database
-- Generated from the blueprint (v2.1, one shared database). Import once in phpMyAdmin.
-- Works on MySQL 8.0.16+ and on MariaDB 10.4+ (the database in XAMPP); both enforce CHECK constraints.

CREATE DATABASE IF NOT EXISTS mindafresh_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE mindafresh_db;
SET time_zone = '+08:00';

-- HR (Fate): departments
CREATE TABLE departments (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  department_code VARCHAR(20) NULL,
  name VARCHAR(100) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_departments_department_code (department_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- HR (Fate): employees
CREATE TABLE employees (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  employee_code VARCHAR(20) NULL,
  first_name VARCHAR(50) NOT NULL,
  middle_name VARCHAR(50) NULL,
  last_name VARCHAR(50) NOT NULL,
  email VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NULL,
  address VARCHAR(255) NULL,
  birth_date DATE NULL,
  hire_date DATE NOT NULL,
  department_id INT UNSIGNED NOT NULL,
  position VARCHAR(100) NOT NULL,
  employment_type VARCHAR(20) NOT NULL,
  daily_rate DECIMAL(12,2) NOT NULL,
  vacation_leave_balance INT NOT NULL DEFAULT 5,
  sick_leave_balance INT NOT NULL DEFAULT 5,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_employees_employee_code (employee_code),
  UNIQUE KEY uq_employees_email (email),
  CONSTRAINT fk_employees_department_id FOREIGN KEY (department_id) REFERENCES departments (id),
  CONSTRAINT chk_employees_employment_type CHECK (employment_type IN ('regular', 'probationary', 'contractual')),
  CONSTRAINT chk_employees_status CHECK (status IN ('active', 'inactive', 'resigned')),
  CONSTRAINT chk_employees_leave CHECK (vacation_leave_balance >= 0 AND sick_leave_balance >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- HR (Fate): users
CREATE TABLE users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_code VARCHAR(20) NULL,
  employee_id INT UNSIGNED NOT NULL,
  username VARCHAR(50) NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_user_code (user_code),
  UNIQUE KEY uq_users_employee_id (employee_id),
  CONSTRAINT fk_users_employee_id FOREIGN KEY (employee_id) REFERENCES employees (id),
  UNIQUE KEY uq_users_username (username),
  CONSTRAINT chk_users_role CHECK (role IN ('admin', 'cashier', 'inventory_staff', 'hr_staff', 'accountant', 'employee')),
  CONSTRAINT chk_users_status CHECK (status IN ('active', 'disabled'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- HR (Fate): leave_requests
CREATE TABLE leave_requests (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  leave_code VARCHAR(20) NULL,
  employee_id INT UNSIGNED NOT NULL,
  leave_type VARCHAR(20) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days INT NOT NULL,
  reason VARCHAR(255) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  approved_by_id INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_leave_requests_leave_code (leave_code),
  CONSTRAINT fk_leave_requests_employee_id FOREIGN KEY (employee_id) REFERENCES employees (id),
  CONSTRAINT chk_leave_requests_leave_type CHECK (leave_type IN ('vacation', 'sick', 'emergency', 'unpaid')),
  CONSTRAINT chk_leave_requests_status CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  CONSTRAINT fk_leave_requests_approved_by_id FOREIGN KEY (approved_by_id) REFERENCES employees (id),
  CONSTRAINT chk_leave_dates CHECK (end_date >= start_date AND days > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- HR (Fate): payroll_runs
CREATE TABLE payroll_runs (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  payroll_code VARCHAR(20) NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  employee_count INT NOT NULL,
  total_gross DECIMAL(12,2) NOT NULL,
  total_contributions DECIMAL(12,2) NOT NULL,
  total_withholding_tax DECIMAL(12,2) NOT NULL,
  total_net DECIMAL(12,2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  prepared_by_id INT UNSIGNED NOT NULL,
  approved_by_id INT UNSIGNED NULL,
  approved_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_payroll_runs_payroll_code (payroll_code),
  CONSTRAINT chk_payroll_runs_status CHECK (status IN ('draft', 'approved')),
  CONSTRAINT fk_payroll_runs_prepared_by_id FOREIGN KEY (prepared_by_id) REFERENCES employees (id),
  CONSTRAINT fk_payroll_runs_approved_by_id FOREIGN KEY (approved_by_id) REFERENCES employees (id),
  UNIQUE KEY uq_payroll_period (period_start, period_end),
  CONSTRAINT chk_payroll_period CHECK (period_end >= period_start)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- HR (Fate): payroll_items
CREATE TABLE payroll_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  payroll_run_id INT UNSIGNED NOT NULL,
  employee_id INT UNSIGNED NOT NULL,
  daily_rate DECIMAL(12,2) NOT NULL,
  days_worked INT NOT NULL,
  paid_leave_days INT NOT NULL,
  paid_holiday_days INT NOT NULL,
  unpaid_days INT NOT NULL,
  late_minutes INT NOT NULL,
  undertime_minutes INT NOT NULL,
  basic_pay DECIMAL(12,2) NOT NULL,
  tardiness_deduction DECIMAL(12,2) NOT NULL,
  gross_pay DECIMAL(12,2) NOT NULL,
  sss DECIMAL(12,2) NOT NULL,
  philhealth DECIMAL(12,2) NOT NULL,
  pagibig DECIMAL(12,2) NOT NULL,
  withholding_tax DECIMAL(12,2) NOT NULL,
  net_pay DECIMAL(12,2) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_payroll_items_payroll_run_id FOREIGN KEY (payroll_run_id) REFERENCES payroll_runs (id),
  CONSTRAINT fk_payroll_items_employee_id FOREIGN KEY (employee_id) REFERENCES employees (id),
  UNIQUE KEY uq_payroll_item (payroll_run_id, employee_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- POS with Inventory and Purchasing (Bren): categories
CREATE TABLE categories (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  category_code VARCHAR(20) NULL,
  name VARCHAR(100) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_categories_category_code (category_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- POS with Inventory and Purchasing (Bren): products
CREATE TABLE products (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_code VARCHAR(20) NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT NULL,
  category_id INT UNSIGNED NOT NULL,
  unit VARCHAR(10) NOT NULL,
  cost_price DECIMAL(12,2) NOT NULL,
  selling_price DECIMAL(12,2) NOT NULL,
  reorder_level INT NOT NULL DEFAULT 10,
  is_online TINYINT(1) NOT NULL DEFAULT 1,
  image_url VARCHAR(255) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_products_product_code (product_code),
  CONSTRAINT fk_products_category_id FOREIGN KEY (category_id) REFERENCES categories (id),
  CONSTRAINT chk_products_unit CHECK (unit IN ('pc', 'kg', 'pack', 'box', 'tray')),
  CONSTRAINT chk_products_status CHECK (status IN ('active', 'inactive'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- POS with Inventory and Purchasing (Bren): stock_levels
CREATE TABLE stock_levels (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id INT UNSIGNED NOT NULL,
  quantity_on_hand INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_stock_levels_product_id (product_id),
  CONSTRAINT fk_stock_levels_product_id FOREIGN KEY (product_id) REFERENCES products (id),
  CONSTRAINT chk_stock_not_negative CHECK (quantity_on_hand >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- POS with Inventory and Purchasing (Bren): stock_movements
CREATE TABLE stock_movements (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  movement_code VARCHAR(20) NULL,
  product_id INT UNSIGNED NOT NULL,
  movement_type VARCHAR(20) NOT NULL,
  quantity_change INT NOT NULL,
  quantity_before INT NOT NULL,
  quantity_after INT NOT NULL,
  unit_cost DECIMAL(12,2) NOT NULL,
  sale_id INT UNSIGNED NULL,
  order_id INT UNSIGNED NULL,
  purchase_order_id INT UNSIGNED NULL,
  remarks VARCHAR(255) NULL,
  employee_id INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_stock_movements_movement_code (movement_code),
  CONSTRAINT fk_stock_movements_product_id FOREIGN KEY (product_id) REFERENCES products (id),
  CONSTRAINT chk_stock_movements_movement_type CHECK (movement_type IN ('opening', 'stock_in', 'sale', 'online_order', 'adjustment', 'return')),
  CONSTRAINT fk_stock_movements_employee_id FOREIGN KEY (employee_id) REFERENCES employees (id),
  CONSTRAINT chk_movement_source CHECK ((movement_type IN ('opening','adjustment') AND sale_id IS NULL AND order_id IS NULL AND purchase_order_id IS NULL) OR (movement_type = 'stock_in' AND purchase_order_id IS NOT NULL AND sale_id IS NULL AND order_id IS NULL) OR (movement_type = 'sale' AND sale_id IS NOT NULL AND order_id IS NULL AND purchase_order_id IS NULL) OR (movement_type = 'online_order' AND order_id IS NOT NULL AND sale_id IS NULL AND purchase_order_id IS NULL) OR (movement_type = 'return' AND purchase_order_id IS NULL AND ((sale_id IS NULL) <> (order_id IS NULL)))),
  CONSTRAINT chk_adjustment_remarks CHECK (movement_type <> 'adjustment' OR remarks IS NOT NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- POS with Inventory and Purchasing (Bren): suppliers
CREATE TABLE suppliers (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  supplier_code VARCHAR(20) NULL,
  name VARCHAR(150) NOT NULL,
  contact_person VARCHAR(100) NULL,
  phone VARCHAR(20) NULL,
  email VARCHAR(100) NULL,
  address VARCHAR(255) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_suppliers_supplier_code (supplier_code),
  CONSTRAINT chk_suppliers_status CHECK (status IN ('active', 'inactive'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- POS with Inventory and Purchasing (Bren): purchase_orders
CREATE TABLE purchase_orders (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  purchase_order_code VARCHAR(20) NULL,
  supplier_id INT UNSIGNED NOT NULL,
  employee_id INT UNSIGNED NOT NULL,
  order_date DATE NOT NULL,
  expected_date DATE NULL,
  total_cost DECIMAL(12,2) NOT NULL,
  payment_method VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  received_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_purchase_orders_purchase_order_code (purchase_order_code),
  CONSTRAINT fk_purchase_orders_supplier_id FOREIGN KEY (supplier_id) REFERENCES suppliers (id),
  CONSTRAINT fk_purchase_orders_employee_id FOREIGN KEY (employee_id) REFERENCES employees (id),
  CONSTRAINT chk_purchase_orders_payment_method CHECK (payment_method IN ('cash', 'on_account')),
  CONSTRAINT chk_purchase_orders_status CHECK (status IN ('draft', 'ordered', 'received', 'cancelled'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- POS with Inventory and Purchasing (Bren): purchase_order_items
CREATE TABLE purchase_order_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  purchase_order_id INT UNSIGNED NOT NULL,
  product_id INT UNSIGNED NOT NULL,
  quantity INT NOT NULL,
  unit_cost DECIMAL(12,2) NOT NULL,
  line_total DECIMAL(12,2) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_purchase_order_items_purchase_order_id FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders (id),
  CONSTRAINT fk_purchase_order_items_product_id FOREIGN KEY (product_id) REFERENCES products (id),
  CONSTRAINT chk_po_item_qty CHECK (quantity > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- POS with Inventory and Purchasing (Bren): sales
CREATE TABLE sales (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  sale_code VARCHAR(20) NULL,
  employee_id INT UNSIGNED NOT NULL,
  subtotal DECIMAL(12,2) NOT NULL,
  discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  total_amount DECIMAL(12,2) NOT NULL,
  total_cost DECIMAL(12,2) NOT NULL,
  amount_paid DECIMAL(12,2) NOT NULL,
  change_amount DECIMAL(12,2) NOT NULL,
  payment_method VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'completed',
  void_reason VARCHAR(255) NULL,
  sold_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sales_sale_code (sale_code),
  CONSTRAINT fk_sales_employee_id FOREIGN KEY (employee_id) REFERENCES employees (id),
  CONSTRAINT chk_sales_payment_method CHECK (payment_method IN ('cash', 'gcash', 'card')),
  CONSTRAINT chk_sales_status CHECK (status IN ('completed', 'voided')),
  CONSTRAINT chk_void_reason CHECK (status <> 'voided' OR void_reason IS NOT NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- POS with Inventory and Purchasing (Bren): sale_items
CREATE TABLE sale_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  sale_id INT UNSIGNED NOT NULL,
  product_id INT UNSIGNED NOT NULL,
  product_name VARCHAR(150) NOT NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  unit_cost DECIMAL(12,2) NOT NULL,
  line_total DECIMAL(12,2) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_sale_items_sale_id FOREIGN KEY (sale_id) REFERENCES sales (id),
  CONSTRAINT fk_sale_items_product_id FOREIGN KEY (product_id) REFERENCES products (id),
  CONSTRAINT chk_sale_item_qty CHECK (quantity > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Online Shop (Ali): customers
CREATE TABLE customers (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  customer_code VARCHAR(20) NULL,
  first_name VARCHAR(50) NOT NULL,
  last_name VARCHAR(50) NOT NULL,
  email VARCHAR(100) NOT NULL,
  password VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NULL,
  address VARCHAR(255) NULL,
  city VARCHAR(100) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_customers_customer_code (customer_code),
  UNIQUE KEY uq_customers_email (email),
  CONSTRAINT chk_customers_status CHECK (status IN ('active', 'disabled'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Online Shop (Ali): cart_items
CREATE TABLE cart_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  customer_id INT UNSIGNED NOT NULL,
  product_id INT UNSIGNED NOT NULL,
  quantity INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_cart_items_customer_id FOREIGN KEY (customer_id) REFERENCES customers (id),
  CONSTRAINT fk_cart_items_product_id FOREIGN KEY (product_id) REFERENCES products (id),
  UNIQUE KEY uq_cart_item (customer_id, product_id),
  CONSTRAINT chk_cart_item_qty CHECK (quantity > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Online Shop (Ali): orders
CREATE TABLE orders (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_code VARCHAR(20) NULL,
  customer_id INT UNSIGNED NOT NULL,
  subtotal DECIMAL(12,2) NOT NULL,
  shipping_fee DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  total_amount DECIMAL(12,2) NOT NULL,
  total_cost DECIMAL(12,2) NOT NULL,
  payment_method VARCHAR(20) NOT NULL,
  payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid',
  order_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  delivery_address VARCHAR(255) NOT NULL,
  ordered_at DATETIME NOT NULL,
  delivered_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_orders_order_code (order_code),
  CONSTRAINT fk_orders_customer_id FOREIGN KEY (customer_id) REFERENCES customers (id),
  CONSTRAINT chk_orders_payment_method CHECK (payment_method IN ('cod', 'gcash')),
  CONSTRAINT chk_orders_payment_status CHECK (payment_status IN ('unpaid', 'paid', 'refunded')),
  CONSTRAINT chk_orders_order_status CHECK (order_status IN ('pending', 'confirmed', 'out_for_delivery', 'delivered', 'cancelled', 'returned'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Online Shop (Ali): order_items
CREATE TABLE order_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id INT UNSIGNED NOT NULL,
  product_id INT UNSIGNED NOT NULL,
  product_name VARCHAR(150) NOT NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  unit_cost DECIMAL(12,2) NOT NULL,
  line_total DECIMAL(12,2) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_order_items_order_id FOREIGN KEY (order_id) REFERENCES orders (id),
  CONSTRAINT fk_order_items_product_id FOREIGN KEY (product_id) REFERENCES products (id),
  CONSTRAINT chk_order_item_qty CHECK (quantity > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Online Shop (Ali): product_reviews
CREATE TABLE product_reviews (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  customer_id INT UNSIGNED NOT NULL,
  product_id INT UNSIGNED NOT NULL,
  order_id INT UNSIGNED NOT NULL,
  rating TINYINT UNSIGNED NOT NULL,
  comment VARCHAR(500) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'visible',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_review_customer_product (customer_id, product_id),
  CONSTRAINT fk_product_reviews_customer_id FOREIGN KEY (customer_id) REFERENCES customers (id),
  CONSTRAINT fk_product_reviews_product_id FOREIGN KEY (product_id) REFERENCES products (id),
  CONSTRAINT fk_product_reviews_order_id FOREIGN KEY (order_id) REFERENCES orders (id),
  CONSTRAINT chk_review_rating CHECK (rating BETWEEN 1 AND 5),
  CONSTRAINT chk_product_reviews_status CHECK (status IN ('visible', 'hidden'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Attendance (Brian): holidays
CREATE TABLE holidays (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  holiday_date DATE NOT NULL,
  name VARCHAR(100) NOT NULL,
  holiday_type VARCHAR(20) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_holidays_holiday_date (holiday_date),
  CONSTRAINT chk_holidays_holiday_type CHECK (holiday_type IN ('regular', 'special'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Attendance (Brian): attendance_logs
CREATE TABLE attendance_logs (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  log_code VARCHAR(20) NULL,
  employee_id INT UNSIGNED NOT NULL,
  log_date DATE NOT NULL,
  time_in DATETIME NULL,
  lunch_out DATETIME NULL,
  lunch_in DATETIME NULL,
  time_out DATETIME NULL,
  hours_worked DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  late_minutes INT NOT NULL DEFAULT 0,
  undertime_minutes INT NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL,
  remarks VARCHAR(255) NULL,
  corrected_by_id INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_attendance_logs_log_code (log_code),
  CONSTRAINT fk_attendance_logs_employee_id FOREIGN KEY (employee_id) REFERENCES employees (id),
  CONSTRAINT chk_attendance_logs_status CHECK (status IN ('present', 'late', 'absent', 'on_leave')),
  CONSTRAINT fk_attendance_logs_corrected_by_id FOREIGN KEY (corrected_by_id) REFERENCES employees (id),
  UNIQUE KEY uq_attendance_day (employee_id, log_date),
  CONSTRAINT chk_attendance_times CHECK (time_in IS NULL OR time_out IS NULL OR time_out >= time_in),
  CONSTRAINT chk_attendance_lunch CHECK (
        (lunch_in  IS NULL OR lunch_out IS NOT NULL)
    AND (lunch_out IS NULL OR time_in  IS NULL OR lunch_out >= time_in)
    AND (lunch_in  IS NULL OR lunch_in >= lunch_out)
    AND (lunch_in  IS NULL OR time_out IS NULL OR time_out >= lunch_in)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Accounting & Finance (Jean): accounts
CREATE TABLE accounts (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  account_code VARCHAR(10) NOT NULL,
  account_name VARCHAR(100) NOT NULL,
  account_type VARCHAR(20) NOT NULL,
  normal_balance VARCHAR(10) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_accounts_account_code (account_code),
  CONSTRAINT chk_accounts_account_type CHECK (account_type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
  CONSTRAINT chk_accounts_normal_balance CHECK (normal_balance IN ('debit', 'credit'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Accounting & Finance (Jean): journal_entries
CREATE TABLE journal_entries (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  entry_code VARCHAR(20) NULL,
  entry_date DATE NOT NULL,
  description VARCHAR(255) NOT NULL,
  source_module VARCHAR(20) NOT NULL,
  entry_type VARCHAR(20) NOT NULL,
  reference_code VARCHAR(20) NULL,
  total_debit DECIMAL(12,2) NOT NULL,
  total_credit DECIMAL(12,2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'posted',
  posted_by_id INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_journal_entries_entry_code (entry_code),
  CONSTRAINT chk_journal_entries_source_module CHECK (source_module IN ('shop', 'pos', 'hr', 'accounting')),
  CONSTRAINT chk_journal_entries_entry_type CHECK (entry_type IN ('opening', 'sale', 'sale_reversal', 'purchase', 'stock_adjustment', 'payroll', 'salary_release', 'remittance', 'manual')),
  CONSTRAINT chk_journal_entries_status CHECK (status IN ('posted', 'voided')),
  CONSTRAINT fk_journal_entries_posted_by_id FOREIGN KEY (posted_by_id) REFERENCES employees (id),
  UNIQUE KEY uq_journal_event (source_module, entry_type, reference_code),
  CONSTRAINT chk_journal_balanced CHECK (total_debit = total_credit)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Accounting & Finance (Jean): journal_lines
CREATE TABLE journal_lines (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  journal_entry_id INT UNSIGNED NOT NULL,
  account_id INT UNSIGNED NOT NULL,
  debit DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  credit DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  memo VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_journal_lines_journal_entry_id FOREIGN KEY (journal_entry_id) REFERENCES journal_entries (id),
  CONSTRAINT fk_journal_lines_account_id FOREIGN KEY (account_id) REFERENCES accounts (id),
  CONSTRAINT chk_line_one_side CHECK (debit >= 0 AND credit >= 0 AND (debit = 0 OR credit = 0) AND debit + credit > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Accounting & Finance (Jean): salary_releases
CREATE TABLE salary_releases (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  release_code VARCHAR(20) NULL,
  payroll_run_id INT UNSIGNED NOT NULL,
  release_method VARCHAR(20) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  released_at DATETIME NULL,
  released_by_id INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_salary_releases_release_code (release_code),
  UNIQUE KEY uq_salary_releases_payroll_run_id (payroll_run_id),
  CONSTRAINT fk_salary_releases_payroll_run_id FOREIGN KEY (payroll_run_id) REFERENCES payroll_runs (id),
  CONSTRAINT chk_salary_releases_release_method CHECK (release_method IN ('bank_transfer', 'cash')),
  CONSTRAINT chk_salary_releases_status CHECK (status IN ('pending', 'released')),
  CONSTRAINT fk_salary_releases_released_by_id FOREIGN KEY (released_by_id) REFERENCES employees (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Accounting & Finance (Jean): remittances
CREATE TABLE remittances (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  remittance_code VARCHAR(20) NULL,
  agency VARCHAR(20) NOT NULL,
  period_month VARCHAR(7) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  reference_number VARCHAR(50) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  paid_at DATETIME NULL,
  recorded_by_id INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_remittances_remittance_code (remittance_code),
  CONSTRAINT chk_remittances_agency CHECK (agency IN ('sss', 'philhealth', 'pagibig', 'bir')),
  CONSTRAINT chk_remittances_status CHECK (status IN ('pending', 'paid')),
  CONSTRAINT fk_remittances_recorded_by_id FOREIGN KEY (recorded_by_id) REFERENCES employees (id),
  UNIQUE KEY uq_remittance (agency, period_month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Foreign keys to tables created further down (stock movements → Shop orders)
ALTER TABLE stock_movements ADD CONSTRAINT fk_stock_movements_sale_id FOREIGN KEY (sale_id) REFERENCES sales (id);
ALTER TABLE stock_movements ADD CONSTRAINT fk_stock_movements_order_id FOREIGN KEY (order_id) REFERENCES orders (id);
ALTER TABLE stock_movements ADD CONSTRAINT fk_stock_movements_purchase_order_id FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders (id);
