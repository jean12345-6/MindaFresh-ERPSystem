-- 007-order-delivered-by.sql  (Ali, Online Shop: changes the Shop's own orders table)
-- Rider history: each delivered order remembers which rider (employee) delivered it.
-- Orders delivered before this change keep NULL ("rider not recorded").
-- Run once on the DB host (and on solo-mode laptops): phpMyAdmin -> mindafresh_db -> Import this file.
USE mindafresh_db;

ALTER TABLE orders ADD COLUMN delivered_by_id INT UNSIGNED NULL AFTER delivered_at;
ALTER TABLE orders ADD CONSTRAINT fk_orders_delivered_by_id FOREIGN KEY (delivered_by_id) REFERENCES employees (id);
