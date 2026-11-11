-- OPTIONAL. POS works without it (barcode = product code, e.g. PRD-0001 or just 1).
-- Run ONCE by the DB host (Jean) in phpMyAdmin if the shop wants real barcodes like 112233.
-- Safe for other modules: new nullable column, nothing else reads it.
USE mindafresh_db;
ALTER TABLE products
  ADD COLUMN barcode VARCHAR(50) NULL AFTER product_code,
  ADD UNIQUE KEY uq_products_barcode (barcode);
