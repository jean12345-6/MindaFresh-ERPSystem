-- 004-rider-role.sql  (proposed by Ali, Online Shop; changes HR's users table, so Fate must agree)
-- Panel feedback (Nov 11): the rider attaches a photo as proof of delivery.
-- 1. users.role may now also be 'rider'. Riders log in at the Shop's staff login (/admin/login) and see only Deliveries.
-- 2. Ramon Bautista (EMP-0007, Delivery Rider in the seed) gets a rider login: ramon.rider / Rider@2026.
-- Run once on the DB host (and on solo-mode laptops): phpMyAdmin -> mindafresh_db -> Import this file.
-- Safe to run again. Works on MySQL 8.0.19+ (Laragon MySQL 8.4) and MariaDB.
USE mindafresh_db;

ALTER TABLE users DROP CONSTRAINT chk_users_role;
ALTER TABLE users ADD CONSTRAINT chk_users_role
  CHECK (role IN ('admin', 'cashier', 'inventory_staff', 'hr_staff', 'accountant', 'employee', 'rider'));

INSERT IGNORE INTO users (employee_id, username, password, role, status)
SELECT id, 'ramon.rider', '$2b$10$vU0jj6FTSUa59gvdMBdAHu/YZg67j093vaMgxYXMWrj1nxt2d4OZ2', 'rider', 'active'
  FROM employees WHERE employee_code = 'EMP-0007';
UPDATE users SET user_code = CONCAT('USR-', LPAD(id, 4, '0')) WHERE user_code IS NULL;
