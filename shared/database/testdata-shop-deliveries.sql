-- testdata-shop-deliveries.sql - TEST DATA ONLY (not part of the official seed)
-- Online orders in every delivery stage, so the Rider's Deliveries page, the admin's orders and the
-- customer's My orders have something to show. Times are relative to the moment you import it.
--
--   4 out for delivery  (on the rider's Deliveries page: 3 COD with cash to collect, 1 GCash already paid)
--   2 confirmed         (the admin can mark them out for delivery)
--   2 pending           (the admin can confirm them)
--   3 delivered today   (rider's "Delivered today"; run the photo script below to give them proof photos)
--   3 delivered earlier (3, 5 and 7 days ago: "delivered before proof photos were required")
--   All 6 delivered orders were delivered by Ramon (EMP-0007), so his history page has entries.
--   1 cancelled         (GCash refunded, stock returned)
--
-- Customers: Ana Reyes (seed) plus 4 new test customers, all with password Customer@2026:
--   benjie.cruz, carmela.dizon, dennis.macaraeg, elena.garcia  (@example.com)
-- Rider: ramon.rider / Rider@2026 (migration 004 must be run first).
--
-- Stock is deducted through stock_movements exactly like a real checkout (movement type online_order,
-- linked to the order), and the cancelled order's stock is returned. Delivered orders are real sales,
-- so Accounting's "Post new transactions" will post them.
--
-- Import on the DB host AFTER schema.sql, seed.sql and migrations 004-007:
--   phpMyAdmin -> mindafresh_db -> Import.
-- Safe to import again: if these test orders are already there, it changes nothing.
-- If it stops with chk_stock_not_negative, a product is out of stock: restock it in POS and import again
-- (everything is in one transaction, so nothing is half-saved).
--
-- Proof photos for the 3 orders delivered today (files, not database rows). In the shop folder run:
--   node scripts/seed-delivery-photos.js
USE mindafresh_db;
SET time_zone = '+08:00';
START TRANSACTION;

-- Already imported? (the test customers already have orders)
SET @seed_done = (SELECT COUNT(*) FROM orders o JOIN customers c ON c.id = o.customer_id
                  WHERE c.email = 'benjie.cruz@example.com');

-- The rider who delivered the delivered orders: Ramon Bautista (EMP-0007, login ramon.rider)
SET @rider = (SELECT id FROM employees WHERE employee_code = 'EMP-0007');

-- 1. Test customers
INSERT IGNORE INTO customers (first_name, last_name, email, password, phone, address, city, status) VALUES
  ('Benjie', 'Cruz', 'benjie.cruz@example.com', '$2b$10$poknT00lFKVqEJSgnFdzqe17LqAU4xrtt.WtB.KbTgf9RDGlkoU3i', '09171230001', '45 Roxas Drive, Brgy. Sto. Nino', 'Calapan City', 'active'),
  ('Carmela', 'Dizon', 'carmela.dizon@example.com', '$2b$10$poknT00lFKVqEJSgnFdzqe17LqAU4xrtt.WtB.KbTgf9RDGlkoU3i', '09171230002', '18 Mabini St., Brgy. Ibaba East', 'Calapan City', 'active'),
  ('Dennis', 'Macaraeg', 'dennis.macaraeg@example.com', '$2b$10$poknT00lFKVqEJSgnFdzqe17LqAU4xrtt.WtB.KbTgf9RDGlkoU3i', '09171230003', '7 Aurora St., Brgy. Camilmil', 'Calapan City', 'active'),
  ('Elena', 'Garcia', 'elena.garcia@example.com', '$2b$10$poknT00lFKVqEJSgnFdzqe17LqAU4xrtt.WtB.KbTgf9RDGlkoU3i', '09171230004', '102 Leuterio St., Brgy. Guinobatan', 'Calapan City', 'active');
UPDATE customers SET customer_code = CONCAT('CUS-', LPAD(id, 4, '0')) WHERE customer_code IS NULL;

-- 2. Orders. Each one: create the order, deduct stock with a movement per item, save the items, set the totals.

-- Order a: out_for_delivery, cod
SET @c = (SELECT id FROM customers WHERE email = 'ana.reyes@example.com');
INSERT INTO orders (customer_id, subtotal, shipping_fee, total_amount, total_cost, payment_method, payment_status,
                    order_status, delivery_address, ordered_at, delivered_at, delivered_by_id, created_at, updated_at)
SELECT @c, 0, 50.00, 0, 0, 'cod', 'unpaid', 'out_for_delivery', '123 J.P. Rizal St., Brgy. Lalud, Calapan City', NOW() - INTERVAL 300 MINUTE, NULL, NULL, NOW() - INTERVAL 300 MINUTE, NOW() - INTERVAL 270 MINUTE
 WHERE @seed_done = 0;
SET @o = IF(@seed_done = 0, LAST_INSERT_ID(), NULL);
SELECT id, name, selling_price, cost_price INTO @p, @pname, @price, @cost FROM products WHERE product_code = 'PRD-0001';
SET @before = (SELECT quantity_on_hand FROM stock_levels WHERE product_id = @p FOR UPDATE);
UPDATE stock_levels SET quantity_on_hand = quantity_on_hand - 2 WHERE product_id = @p AND @seed_done = 0;
INSERT INTO stock_movements (product_id, movement_type, quantity_change, quantity_before, quantity_after, unit_cost, order_id, created_at, updated_at)
SELECT @p, 'online_order', -2, @before, @before - 2, @cost, @o, NOW() - INTERVAL 300 MINUTE, NOW() - INTERVAL 300 MINUTE WHERE @seed_done = 0;
INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, unit_cost, line_total)
SELECT @o, @p, @pname, 2, @price, @cost, @price * 2 WHERE @seed_done = 0;
SELECT id, name, selling_price, cost_price INTO @p, @pname, @price, @cost FROM products WHERE product_code = 'PRD-0010';
SET @before = (SELECT quantity_on_hand FROM stock_levels WHERE product_id = @p FOR UPDATE);
UPDATE stock_levels SET quantity_on_hand = quantity_on_hand - 1 WHERE product_id = @p AND @seed_done = 0;
INSERT INTO stock_movements (product_id, movement_type, quantity_change, quantity_before, quantity_after, unit_cost, order_id, created_at, updated_at)
SELECT @p, 'online_order', -1, @before, @before - 1, @cost, @o, NOW() - INTERVAL 300 MINUTE, NOW() - INTERVAL 300 MINUTE WHERE @seed_done = 0;
INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, unit_cost, line_total)
SELECT @o, @p, @pname, 1, @price, @cost, @price * 1 WHERE @seed_done = 0;
UPDATE orders o SET
  subtotal = (SELECT SUM(line_total) FROM order_items WHERE order_id = o.id),
  total_cost = (SELECT SUM(quantity * unit_cost) FROM order_items WHERE order_id = o.id),
  total_amount = (SELECT SUM(line_total) FROM order_items WHERE order_id = o.id) + shipping_fee
WHERE o.id = @o AND @seed_done = 0;

-- Order b: out_for_delivery, gcash
SET @c = (SELECT id FROM customers WHERE email = 'benjie.cruz@example.com');
INSERT INTO orders (customer_id, subtotal, shipping_fee, total_amount, total_cost, payment_method, payment_status,
                    order_status, delivery_address, ordered_at, delivered_at, delivered_by_id, created_at, updated_at)
SELECT @c, 0, 50.00, 0, 0, 'gcash', 'paid', 'out_for_delivery', '45 Roxas Drive, Brgy. Sto. Nino, Calapan City', NOW() - INTERVAL 240 MINUTE, NULL, NULL, NOW() - INTERVAL 240 MINUTE, NOW() - INTERVAL 210 MINUTE
 WHERE @seed_done = 0;
SET @o = IF(@seed_done = 0, LAST_INSERT_ID(), NULL);
SELECT id, name, selling_price, cost_price INTO @p, @pname, @price, @cost FROM products WHERE product_code = 'PRD-0005';
SET @before = (SELECT quantity_on_hand FROM stock_levels WHERE product_id = @p FOR UPDATE);
UPDATE stock_levels SET quantity_on_hand = quantity_on_hand - 1 WHERE product_id = @p AND @seed_done = 0;
INSERT INTO stock_movements (product_id, movement_type, quantity_change, quantity_before, quantity_after, unit_cost, order_id, created_at, updated_at)
SELECT @p, 'online_order', -1, @before, @before - 1, @cost, @o, NOW() - INTERVAL 240 MINUTE, NOW() - INTERVAL 240 MINUTE WHERE @seed_done = 0;
INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, unit_cost, line_total)
SELECT @o, @p, @pname, 1, @price, @cost, @price * 1 WHERE @seed_done = 0;
SELECT id, name, selling_price, cost_price INTO @p, @pname, @price, @cost FROM products WHERE product_code = 'PRD-0007';
SET @before = (SELECT quantity_on_hand FROM stock_levels WHERE product_id = @p FOR UPDATE);
UPDATE stock_levels SET quantity_on_hand = quantity_on_hand - 1 WHERE product_id = @p AND @seed_done = 0;
INSERT INTO stock_movements (product_id, movement_type, quantity_change, quantity_before, quantity_after, unit_cost, order_id, created_at, updated_at)
SELECT @p, 'online_order', -1, @before, @before - 1, @cost, @o, NOW() - INTERVAL 240 MINUTE, NOW() - INTERVAL 240 MINUTE WHERE @seed_done = 0;
INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, unit_cost, line_total)
SELECT @o, @p, @pname, 1, @price, @cost, @price * 1 WHERE @seed_done = 0;
UPDATE orders o SET
  subtotal = (SELECT SUM(line_total) FROM order_items WHERE order_id = o.id),
  total_cost = (SELECT SUM(quantity * unit_cost) FROM order_items WHERE order_id = o.id),
  total_amount = (SELECT SUM(line_total) FROM order_items WHERE order_id = o.id) + shipping_fee
WHERE o.id = @o AND @seed_done = 0;

-- Order c: out_for_delivery, cod
SET @c = (SELECT id FROM customers WHERE email = 'carmela.dizon@example.com');
INSERT INTO orders (customer_id, subtotal, shipping_fee, total_amount, total_cost, payment_method, payment_status,
                    order_status, delivery_address, ordered_at, delivered_at, delivered_by_id, created_at, updated_at)
SELECT @c, 0, 50.00, 0, 0, 'cod', 'unpaid', 'out_for_delivery', '18 Mabini St., Brgy. Ibaba East, Calapan City', NOW() - INTERVAL 180 MINUTE, NULL, NULL, NOW() - INTERVAL 180 MINUTE, NOW() - INTERVAL 150 MINUTE
 WHERE @seed_done = 0;
SET @o = IF(@seed_done = 0, LAST_INSERT_ID(), NULL);
SELECT id, name, selling_price, cost_price INTO @p, @pname, @price, @cost FROM products WHERE product_code = 'PRD-0004';
SET @before = (SELECT quantity_on_hand FROM stock_levels WHERE product_id = @p FOR UPDATE);
UPDATE stock_levels SET quantity_on_hand = quantity_on_hand - 2 WHERE product_id = @p AND @seed_done = 0;
INSERT INTO stock_movements (product_id, movement_type, quantity_change, quantity_before, quantity_after, unit_cost, order_id, created_at, updated_at)
SELECT @p, 'online_order', -2, @before, @before - 2, @cost, @o, NOW() - INTERVAL 180 MINUTE, NOW() - INTERVAL 180 MINUTE WHERE @seed_done = 0;
INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, unit_cost, line_total)
SELECT @o, @p, @pname, 2, @price, @cost, @price * 2 WHERE @seed_done = 0;
SELECT id, name, selling_price, cost_price INTO @p, @pname, @price, @cost FROM products WHERE product_code = 'PRD-0003';
SET @before = (SELECT quantity_on_hand FROM stock_levels WHERE product_id = @p FOR UPDATE);
UPDATE stock_levels SET quantity_on_hand = quantity_on_hand - 1 WHERE product_id = @p AND @seed_done = 0;
INSERT INTO stock_movements (product_id, movement_type, quantity_change, quantity_before, quantity_after, unit_cost, order_id, created_at, updated_at)
SELECT @p, 'online_order', -1, @before, @before - 1, @cost, @o, NOW() - INTERVAL 180 MINUTE, NOW() - INTERVAL 180 MINUTE WHERE @seed_done = 0;
INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, unit_cost, line_total)
SELECT @o, @p, @pname, 1, @price, @cost, @price * 1 WHERE @seed_done = 0;
UPDATE orders o SET
  subtotal = (SELECT SUM(line_total) FROM order_items WHERE order_id = o.id),
  total_cost = (SELECT SUM(quantity * unit_cost) FROM order_items WHERE order_id = o.id),
  total_amount = (SELECT SUM(line_total) FROM order_items WHERE order_id = o.id) + shipping_fee
WHERE o.id = @o AND @seed_done = 0;

-- Order d: out_for_delivery, cod
SET @c = (SELECT id FROM customers WHERE email = 'dennis.macaraeg@example.com');
INSERT INTO orders (customer_id, subtotal, shipping_fee, total_amount, total_cost, payment_method, payment_status,
                    order_status, delivery_address, ordered_at, delivered_at, delivered_by_id, created_at, updated_at)
SELECT @c, 0, 50.00, 0, 0, 'cod', 'unpaid', 'out_for_delivery', '7 Aurora St., Brgy. Camilmil, Calapan City', NOW() - INTERVAL 120 MINUTE, NULL, NULL, NOW() - INTERVAL 120 MINUTE, NOW() - INTERVAL 90 MINUTE
 WHERE @seed_done = 0;
SET @o = IF(@seed_done = 0, LAST_INSERT_ID(), NULL);
SELECT id, name, selling_price, cost_price INTO @p, @pname, @price, @cost FROM products WHERE product_code = 'PRD-0009';
SET @before = (SELECT quantity_on_hand FROM stock_levels WHERE product_id = @p FOR UPDATE);
UPDATE stock_levels SET quantity_on_hand = quantity_on_hand - 2 WHERE product_id = @p AND @seed_done = 0;
INSERT INTO stock_movements (product_id, movement_type, quantity_change, quantity_before, quantity_after, unit_cost, order_id, created_at, updated_at)
SELECT @p, 'online_order', -2, @before, @before - 2, @cost, @o, NOW() - INTERVAL 120 MINUTE, NOW() - INTERVAL 120 MINUTE WHERE @seed_done = 0;
INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, unit_cost, line_total)
SELECT @o, @p, @pname, 2, @price, @cost, @price * 2 WHERE @seed_done = 0;
SELECT id, name, selling_price, cost_price INTO @p, @pname, @price, @cost FROM products WHERE product_code = 'PRD-0002';
SET @before = (SELECT quantity_on_hand FROM stock_levels WHERE product_id = @p FOR UPDATE);
UPDATE stock_levels SET quantity_on_hand = quantity_on_hand - 1 WHERE product_id = @p AND @seed_done = 0;
INSERT INTO stock_movements (product_id, movement_type, quantity_change, quantity_before, quantity_after, unit_cost, order_id, created_at, updated_at)
SELECT @p, 'online_order', -1, @before, @before - 1, @cost, @o, NOW() - INTERVAL 120 MINUTE, NOW() - INTERVAL 120 MINUTE WHERE @seed_done = 0;
INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, unit_cost, line_total)
SELECT @o, @p, @pname, 1, @price, @cost, @price * 1 WHERE @seed_done = 0;
UPDATE orders o SET
  subtotal = (SELECT SUM(line_total) FROM order_items WHERE order_id = o.id),
  total_cost = (SELECT SUM(quantity * unit_cost) FROM order_items WHERE order_id = o.id),
  total_amount = (SELECT SUM(line_total) FROM order_items WHERE order_id = o.id) + shipping_fee
WHERE o.id = @o AND @seed_done = 0;

-- Order e: confirmed, cod
SET @c = (SELECT id FROM customers WHERE email = 'elena.garcia@example.com');
INSERT INTO orders (customer_id, subtotal, shipping_fee, total_amount, total_cost, payment_method, payment_status,
                    order_status, delivery_address, ordered_at, delivered_at, delivered_by_id, created_at, updated_at)
SELECT @c, 0, 50.00, 0, 0, 'cod', 'unpaid', 'confirmed', '102 Leuterio St., Brgy. Guinobatan, Calapan City', NOW() - INTERVAL 90 MINUTE, NULL, NULL, NOW() - INTERVAL 90 MINUTE, NOW() - INTERVAL 60 MINUTE
 WHERE @seed_done = 0;
SET @o = IF(@seed_done = 0, LAST_INSERT_ID(), NULL);
SELECT id, name, selling_price, cost_price INTO @p, @pname, @price, @cost FROM products WHERE product_code = 'PRD-0007';
SET @before = (SELECT quantity_on_hand FROM stock_levels WHERE product_id = @p FOR UPDATE);
UPDATE stock_levels SET quantity_on_hand = quantity_on_hand - 1 WHERE product_id = @p AND @seed_done = 0;
INSERT INTO stock_movements (product_id, movement_type, quantity_change, quantity_before, quantity_after, unit_cost, order_id, created_at, updated_at)
SELECT @p, 'online_order', -1, @before, @before - 1, @cost, @o, NOW() - INTERVAL 90 MINUTE, NOW() - INTERVAL 90 MINUTE WHERE @seed_done = 0;
INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, unit_cost, line_total)
SELECT @o, @p, @pname, 1, @price, @cost, @price * 1 WHERE @seed_done = 0;
UPDATE orders o SET
  subtotal = (SELECT SUM(line_total) FROM order_items WHERE order_id = o.id),
  total_cost = (SELECT SUM(quantity * unit_cost) FROM order_items WHERE order_id = o.id),
  total_amount = (SELECT SUM(line_total) FROM order_items WHERE order_id = o.id) + shipping_fee
WHERE o.id = @o AND @seed_done = 0;

-- Order f: confirmed, gcash
SET @c = (SELECT id FROM customers WHERE email = 'ana.reyes@example.com');
INSERT INTO orders (customer_id, subtotal, shipping_fee, total_amount, total_cost, payment_method, payment_status,
                    order_status, delivery_address, ordered_at, delivered_at, delivered_by_id, created_at, updated_at)
SELECT @c, 0, 50.00, 0, 0, 'gcash', 'paid', 'confirmed', '123 J.P. Rizal St., Brgy. Lalud, Calapan City', NOW() - INTERVAL 60 MINUTE, NULL, NULL, NOW() - INTERVAL 60 MINUTE, NOW() - INTERVAL 30 MINUTE
 WHERE @seed_done = 0;
SET @o = IF(@seed_done = 0, LAST_INSERT_ID(), NULL);
SELECT id, name, selling_price, cost_price INTO @p, @pname, @price, @cost FROM products WHERE product_code = 'PRD-0006';
SET @before = (SELECT quantity_on_hand FROM stock_levels WHERE product_id = @p FOR UPDATE);
UPDATE stock_levels SET quantity_on_hand = quantity_on_hand - 1 WHERE product_id = @p AND @seed_done = 0;
INSERT INTO stock_movements (product_id, movement_type, quantity_change, quantity_before, quantity_after, unit_cost, order_id, created_at, updated_at)
SELECT @p, 'online_order', -1, @before, @before - 1, @cost, @o, NOW() - INTERVAL 60 MINUTE, NOW() - INTERVAL 60 MINUTE WHERE @seed_done = 0;
INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, unit_cost, line_total)
SELECT @o, @p, @pname, 1, @price, @cost, @price * 1 WHERE @seed_done = 0;
UPDATE orders o SET
  subtotal = (SELECT SUM(line_total) FROM order_items WHERE order_id = o.id),
  total_cost = (SELECT SUM(quantity * unit_cost) FROM order_items WHERE order_id = o.id),
  total_amount = (SELECT SUM(line_total) FROM order_items WHERE order_id = o.id) + shipping_fee
WHERE o.id = @o AND @seed_done = 0;

-- Order g: pending, cod
SET @c = (SELECT id FROM customers WHERE email = 'benjie.cruz@example.com');
INSERT INTO orders (customer_id, subtotal, shipping_fee, total_amount, total_cost, payment_method, payment_status,
                    order_status, delivery_address, ordered_at, delivered_at, delivered_by_id, created_at, updated_at)
SELECT @c, 0, 50.00, 0, 0, 'cod', 'unpaid', 'pending', '45 Roxas Drive, Brgy. Sto. Nino, Calapan City', NOW() - INTERVAL 40 MINUTE, NULL, NULL, NOW() - INTERVAL 40 MINUTE, NOW() - INTERVAL 10 MINUTE
 WHERE @seed_done = 0;
SET @o = IF(@seed_done = 0, LAST_INSERT_ID(), NULL);
SELECT id, name, selling_price, cost_price INTO @p, @pname, @price, @cost FROM products WHERE product_code = 'PRD-0001';
SET @before = (SELECT quantity_on_hand FROM stock_levels WHERE product_id = @p FOR UPDATE);
UPDATE stock_levels SET quantity_on_hand = quantity_on_hand - 3 WHERE product_id = @p AND @seed_done = 0;
INSERT INTO stock_movements (product_id, movement_type, quantity_change, quantity_before, quantity_after, unit_cost, order_id, created_at, updated_at)
SELECT @p, 'online_order', -3, @before, @before - 3, @cost, @o, NOW() - INTERVAL 40 MINUTE, NOW() - INTERVAL 40 MINUTE WHERE @seed_done = 0;
INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, unit_cost, line_total)
SELECT @o, @p, @pname, 3, @price, @cost, @price * 3 WHERE @seed_done = 0;
UPDATE orders o SET
  subtotal = (SELECT SUM(line_total) FROM order_items WHERE order_id = o.id),
  total_cost = (SELECT SUM(quantity * unit_cost) FROM order_items WHERE order_id = o.id),
  total_amount = (SELECT SUM(line_total) FROM order_items WHERE order_id = o.id) + shipping_fee
WHERE o.id = @o AND @seed_done = 0;

-- Order h: pending, gcash
SET @c = (SELECT id FROM customers WHERE email = 'carmela.dizon@example.com');
INSERT INTO orders (customer_id, subtotal, shipping_fee, total_amount, total_cost, payment_method, payment_status,
                    order_status, delivery_address, ordered_at, delivered_at, delivered_by_id, created_at, updated_at)
SELECT @c, 0, 50.00, 0, 0, 'gcash', 'paid', 'pending', '18 Mabini St., Brgy. Ibaba East, Calapan City', NOW() - INTERVAL 20 MINUTE, NULL, NULL, NOW() - INTERVAL 20 MINUTE, NOW() - INTERVAL -10 MINUTE
 WHERE @seed_done = 0;
SET @o = IF(@seed_done = 0, LAST_INSERT_ID(), NULL);
SELECT id, name, selling_price, cost_price INTO @p, @pname, @price, @cost FROM products WHERE product_code = 'PRD-0010';
SET @before = (SELECT quantity_on_hand FROM stock_levels WHERE product_id = @p FOR UPDATE);
UPDATE stock_levels SET quantity_on_hand = quantity_on_hand - 1 WHERE product_id = @p AND @seed_done = 0;
INSERT INTO stock_movements (product_id, movement_type, quantity_change, quantity_before, quantity_after, unit_cost, order_id, created_at, updated_at)
SELECT @p, 'online_order', -1, @before, @before - 1, @cost, @o, NOW() - INTERVAL 20 MINUTE, NOW() - INTERVAL 20 MINUTE WHERE @seed_done = 0;
INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, unit_cost, line_total)
SELECT @o, @p, @pname, 1, @price, @cost, @price * 1 WHERE @seed_done = 0;
UPDATE orders o SET
  subtotal = (SELECT SUM(line_total) FROM order_items WHERE order_id = o.id),
  total_cost = (SELECT SUM(quantity * unit_cost) FROM order_items WHERE order_id = o.id),
  total_amount = (SELECT SUM(line_total) FROM order_items WHERE order_id = o.id) + shipping_fee
WHERE o.id = @o AND @seed_done = 0;

-- Order i: delivered, cod
SET @c = (SELECT id FROM customers WHERE email = 'dennis.macaraeg@example.com');
INSERT INTO orders (customer_id, subtotal, shipping_fee, total_amount, total_cost, payment_method, payment_status,
                    order_status, delivery_address, ordered_at, delivered_at, delivered_by_id, created_at, updated_at)
SELECT @c, 0, 50.00, 0, 0, 'cod', 'paid', 'delivered', '7 Aurora St., Brgy. Camilmil, Calapan City', NOW() - INTERVAL 540 MINUTE, NOW() - INTERVAL 60 MINUTE, @rider, NOW() - INTERVAL 540 MINUTE, NOW() - INTERVAL 60 MINUTE
 WHERE @seed_done = 0;
SET @o = IF(@seed_done = 0, LAST_INSERT_ID(), NULL);
SELECT id, name, selling_price, cost_price INTO @p, @pname, @price, @cost FROM products WHERE product_code = 'PRD-0004';
SET @before = (SELECT quantity_on_hand FROM stock_levels WHERE product_id = @p FOR UPDATE);
UPDATE stock_levels SET quantity_on_hand = quantity_on_hand - 1 WHERE product_id = @p AND @seed_done = 0;
INSERT INTO stock_movements (product_id, movement_type, quantity_change, quantity_before, quantity_after, unit_cost, order_id, created_at, updated_at)
SELECT @p, 'online_order', -1, @before, @before - 1, @cost, @o, NOW() - INTERVAL 540 MINUTE, NOW() - INTERVAL 540 MINUTE WHERE @seed_done = 0;
INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, unit_cost, line_total)
SELECT @o, @p, @pname, 1, @price, @cost, @price * 1 WHERE @seed_done = 0;
SELECT id, name, selling_price, cost_price INTO @p, @pname, @price, @cost FROM products WHERE product_code = 'PRD-0001';
SET @before = (SELECT quantity_on_hand FROM stock_levels WHERE product_id = @p FOR UPDATE);
UPDATE stock_levels SET quantity_on_hand = quantity_on_hand - 1 WHERE product_id = @p AND @seed_done = 0;
INSERT INTO stock_movements (product_id, movement_type, quantity_change, quantity_before, quantity_after, unit_cost, order_id, created_at, updated_at)
SELECT @p, 'online_order', -1, @before, @before - 1, @cost, @o, NOW() - INTERVAL 540 MINUTE, NOW() - INTERVAL 540 MINUTE WHERE @seed_done = 0;
INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, unit_cost, line_total)
SELECT @o, @p, @pname, 1, @price, @cost, @price * 1 WHERE @seed_done = 0;
UPDATE orders o SET
  subtotal = (SELECT SUM(line_total) FROM order_items WHERE order_id = o.id),
  total_cost = (SELECT SUM(quantity * unit_cost) FROM order_items WHERE order_id = o.id),
  total_amount = (SELECT SUM(line_total) FROM order_items WHERE order_id = o.id) + shipping_fee
WHERE o.id = @o AND @seed_done = 0;

-- Order j: delivered, gcash
SET @c = (SELECT id FROM customers WHERE email = 'elena.garcia@example.com');
INSERT INTO orders (customer_id, subtotal, shipping_fee, total_amount, total_cost, payment_method, payment_status,
                    order_status, delivery_address, ordered_at, delivered_at, delivered_by_id, created_at, updated_at)
SELECT @c, 0, 50.00, 0, 0, 'gcash', 'paid', 'delivered', '102 Leuterio St., Brgy. Guinobatan, Calapan City', NOW() - INTERVAL 480 MINUTE, NOW() - INTERVAL 120 MINUTE, @rider, NOW() - INTERVAL 480 MINUTE, NOW() - INTERVAL 120 MINUTE
 WHERE @seed_done = 0;
SET @o = IF(@seed_done = 0, LAST_INSERT_ID(), NULL);
SELECT id, name, selling_price, cost_price INTO @p, @pname, @price, @cost FROM products WHERE product_code = 'PRD-0005';
SET @before = (SELECT quantity_on_hand FROM stock_levels WHERE product_id = @p FOR UPDATE);
UPDATE stock_levels SET quantity_on_hand = quantity_on_hand - 2 WHERE product_id = @p AND @seed_done = 0;
INSERT INTO stock_movements (product_id, movement_type, quantity_change, quantity_before, quantity_after, unit_cost, order_id, created_at, updated_at)
SELECT @p, 'online_order', -2, @before, @before - 2, @cost, @o, NOW() - INTERVAL 480 MINUTE, NOW() - INTERVAL 480 MINUTE WHERE @seed_done = 0;
INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, unit_cost, line_total)
SELECT @o, @p, @pname, 2, @price, @cost, @price * 2 WHERE @seed_done = 0;
UPDATE orders o SET
  subtotal = (SELECT SUM(line_total) FROM order_items WHERE order_id = o.id),
  total_cost = (SELECT SUM(quantity * unit_cost) FROM order_items WHERE order_id = o.id),
  total_amount = (SELECT SUM(line_total) FROM order_items WHERE order_id = o.id) + shipping_fee
WHERE o.id = @o AND @seed_done = 0;

-- Order k: delivered, cod
SET @c = (SELECT id FROM customers WHERE email = 'ana.reyes@example.com');
INSERT INTO orders (customer_id, subtotal, shipping_fee, total_amount, total_cost, payment_method, payment_status,
                    order_status, delivery_address, ordered_at, delivered_at, delivered_by_id, created_at, updated_at)
SELECT @c, 0, 50.00, 0, 0, 'cod', 'paid', 'delivered', '123 J.P. Rizal St., Brgy. Lalud, Calapan City', NOW() - INTERVAL 600 MINUTE, NOW() - INTERVAL 180 MINUTE, @rider, NOW() - INTERVAL 600 MINUTE, NOW() - INTERVAL 180 MINUTE
 WHERE @seed_done = 0;
SET @o = IF(@seed_done = 0, LAST_INSERT_ID(), NULL);
SELECT id, name, selling_price, cost_price INTO @p, @pname, @price, @cost FROM products WHERE product_code = 'PRD-0003';
SET @before = (SELECT quantity_on_hand FROM stock_levels WHERE product_id = @p FOR UPDATE);
UPDATE stock_levels SET quantity_on_hand = quantity_on_hand - 2 WHERE product_id = @p AND @seed_done = 0;
INSERT INTO stock_movements (product_id, movement_type, quantity_change, quantity_before, quantity_after, unit_cost, order_id, created_at, updated_at)
SELECT @p, 'online_order', -2, @before, @before - 2, @cost, @o, NOW() - INTERVAL 600 MINUTE, NOW() - INTERVAL 600 MINUTE WHERE @seed_done = 0;
INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, unit_cost, line_total)
SELECT @o, @p, @pname, 2, @price, @cost, @price * 2 WHERE @seed_done = 0;
SELECT id, name, selling_price, cost_price INTO @p, @pname, @price, @cost FROM products WHERE product_code = 'PRD-0002';
SET @before = (SELECT quantity_on_hand FROM stock_levels WHERE product_id = @p FOR UPDATE);
UPDATE stock_levels SET quantity_on_hand = quantity_on_hand - 2 WHERE product_id = @p AND @seed_done = 0;
INSERT INTO stock_movements (product_id, movement_type, quantity_change, quantity_before, quantity_after, unit_cost, order_id, created_at, updated_at)
SELECT @p, 'online_order', -2, @before, @before - 2, @cost, @o, NOW() - INTERVAL 600 MINUTE, NOW() - INTERVAL 600 MINUTE WHERE @seed_done = 0;
INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, unit_cost, line_total)
SELECT @o, @p, @pname, 2, @price, @cost, @price * 2 WHERE @seed_done = 0;
UPDATE orders o SET
  subtotal = (SELECT SUM(line_total) FROM order_items WHERE order_id = o.id),
  total_cost = (SELECT SUM(quantity * unit_cost) FROM order_items WHERE order_id = o.id),
  total_amount = (SELECT SUM(line_total) FROM order_items WHERE order_id = o.id) + shipping_fee
WHERE o.id = @o AND @seed_done = 0;

-- Order l: delivered, cod
SET @c = (SELECT id FROM customers WHERE email = 'benjie.cruz@example.com');
INSERT INTO orders (customer_id, subtotal, shipping_fee, total_amount, total_cost, payment_method, payment_status,
                    order_status, delivery_address, ordered_at, delivered_at, delivered_by_id, created_at, updated_at)
SELECT @c, 0, 50.00, 0, 0, 'cod', 'paid', 'delivered', '45 Roxas Drive, Brgy. Sto. Nino, Calapan City', TIMESTAMP(CURDATE() - INTERVAL 3 DAY, '09:15:00') + INTERVAL 0 MINUTE, TIMESTAMP(CURDATE() - INTERVAL 3 DAY, '14:40:00') + INTERVAL 0 MINUTE, @rider, TIMESTAMP(CURDATE() - INTERVAL 3 DAY, '09:15:00') + INTERVAL 0 MINUTE, TIMESTAMP(CURDATE() - INTERVAL 3 DAY, '14:40:00') + INTERVAL 0 MINUTE
 WHERE @seed_done = 0;
SET @o = IF(@seed_done = 0, LAST_INSERT_ID(), NULL);
SELECT id, name, selling_price, cost_price INTO @p, @pname, @price, @cost FROM products WHERE product_code = 'PRD-0007';
SET @before = (SELECT quantity_on_hand FROM stock_levels WHERE product_id = @p FOR UPDATE);
UPDATE stock_levels SET quantity_on_hand = quantity_on_hand - 1 WHERE product_id = @p AND @seed_done = 0;
INSERT INTO stock_movements (product_id, movement_type, quantity_change, quantity_before, quantity_after, unit_cost, order_id, created_at, updated_at)
SELECT @p, 'online_order', -1, @before, @before - 1, @cost, @o, TIMESTAMP(CURDATE() - INTERVAL 3 DAY, '09:15:00') + INTERVAL 0 MINUTE, TIMESTAMP(CURDATE() - INTERVAL 3 DAY, '09:15:00') + INTERVAL 0 MINUTE WHERE @seed_done = 0;
INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, unit_cost, line_total)
SELECT @o, @p, @pname, 1, @price, @cost, @price * 1 WHERE @seed_done = 0;
SELECT id, name, selling_price, cost_price INTO @p, @pname, @price, @cost FROM products WHERE product_code = 'PRD-0010';
SET @before = (SELECT quantity_on_hand FROM stock_levels WHERE product_id = @p FOR UPDATE);
UPDATE stock_levels SET quantity_on_hand = quantity_on_hand - 1 WHERE product_id = @p AND @seed_done = 0;
INSERT INTO stock_movements (product_id, movement_type, quantity_change, quantity_before, quantity_after, unit_cost, order_id, created_at, updated_at)
SELECT @p, 'online_order', -1, @before, @before - 1, @cost, @o, TIMESTAMP(CURDATE() - INTERVAL 3 DAY, '09:15:00') + INTERVAL 0 MINUTE, TIMESTAMP(CURDATE() - INTERVAL 3 DAY, '09:15:00') + INTERVAL 0 MINUTE WHERE @seed_done = 0;
INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, unit_cost, line_total)
SELECT @o, @p, @pname, 1, @price, @cost, @price * 1 WHERE @seed_done = 0;
UPDATE orders o SET
  subtotal = (SELECT SUM(line_total) FROM order_items WHERE order_id = o.id),
  total_cost = (SELECT SUM(quantity * unit_cost) FROM order_items WHERE order_id = o.id),
  total_amount = (SELECT SUM(line_total) FROM order_items WHERE order_id = o.id) + shipping_fee
WHERE o.id = @o AND @seed_done = 0;

-- Order m: delivered, gcash
SET @c = (SELECT id FROM customers WHERE email = 'carmela.dizon@example.com');
INSERT INTO orders (customer_id, subtotal, shipping_fee, total_amount, total_cost, payment_method, payment_status,
                    order_status, delivery_address, ordered_at, delivered_at, delivered_by_id, created_at, updated_at)
SELECT @c, 0, 50.00, 0, 0, 'gcash', 'paid', 'delivered', '18 Mabini St., Brgy. Ibaba East, Calapan City', TIMESTAMP(CURDATE() - INTERVAL 5 DAY, '10:05:00') + INTERVAL 0 MINUTE, TIMESTAMP(CURDATE() - INTERVAL 5 DAY, '15:20:00') + INTERVAL 0 MINUTE, @rider, TIMESTAMP(CURDATE() - INTERVAL 5 DAY, '10:05:00') + INTERVAL 0 MINUTE, TIMESTAMP(CURDATE() - INTERVAL 5 DAY, '15:20:00') + INTERVAL 0 MINUTE
 WHERE @seed_done = 0;
SET @o = IF(@seed_done = 0, LAST_INSERT_ID(), NULL);
SELECT id, name, selling_price, cost_price INTO @p, @pname, @price, @cost FROM products WHERE product_code = 'PRD-0006';
SET @before = (SELECT quantity_on_hand FROM stock_levels WHERE product_id = @p FOR UPDATE);
UPDATE stock_levels SET quantity_on_hand = quantity_on_hand - 1 WHERE product_id = @p AND @seed_done = 0;
INSERT INTO stock_movements (product_id, movement_type, quantity_change, quantity_before, quantity_after, unit_cost, order_id, created_at, updated_at)
SELECT @p, 'online_order', -1, @before, @before - 1, @cost, @o, TIMESTAMP(CURDATE() - INTERVAL 5 DAY, '10:05:00') + INTERVAL 0 MINUTE, TIMESTAMP(CURDATE() - INTERVAL 5 DAY, '10:05:00') + INTERVAL 0 MINUTE WHERE @seed_done = 0;
INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, unit_cost, line_total)
SELECT @o, @p, @pname, 1, @price, @cost, @price * 1 WHERE @seed_done = 0;
UPDATE orders o SET
  subtotal = (SELECT SUM(line_total) FROM order_items WHERE order_id = o.id),
  total_cost = (SELECT SUM(quantity * unit_cost) FROM order_items WHERE order_id = o.id),
  total_amount = (SELECT SUM(line_total) FROM order_items WHERE order_id = o.id) + shipping_fee
WHERE o.id = @o AND @seed_done = 0;

-- Order n: delivered, cod
SET @c = (SELECT id FROM customers WHERE email = 'elena.garcia@example.com');
INSERT INTO orders (customer_id, subtotal, shipping_fee, total_amount, total_cost, payment_method, payment_status,
                    order_status, delivery_address, ordered_at, delivered_at, delivered_by_id, created_at, updated_at)
SELECT @c, 0, 50.00, 0, 0, 'cod', 'paid', 'delivered', '102 Leuterio St., Brgy. Guinobatan, Calapan City', TIMESTAMP(CURDATE() - INTERVAL 7 DAY, '08:40:00') + INTERVAL 0 MINUTE, TIMESTAMP(CURDATE() - INTERVAL 7 DAY, '13:10:00') + INTERVAL 0 MINUTE, @rider, TIMESTAMP(CURDATE() - INTERVAL 7 DAY, '08:40:00') + INTERVAL 0 MINUTE, TIMESTAMP(CURDATE() - INTERVAL 7 DAY, '13:10:00') + INTERVAL 0 MINUTE
 WHERE @seed_done = 0;
SET @o = IF(@seed_done = 0, LAST_INSERT_ID(), NULL);
SELECT id, name, selling_price, cost_price INTO @p, @pname, @price, @cost FROM products WHERE product_code = 'PRD-0001';
SET @before = (SELECT quantity_on_hand FROM stock_levels WHERE product_id = @p FOR UPDATE);
UPDATE stock_levels SET quantity_on_hand = quantity_on_hand - 2 WHERE product_id = @p AND @seed_done = 0;
INSERT INTO stock_movements (product_id, movement_type, quantity_change, quantity_before, quantity_after, unit_cost, order_id, created_at, updated_at)
SELECT @p, 'online_order', -2, @before, @before - 2, @cost, @o, TIMESTAMP(CURDATE() - INTERVAL 7 DAY, '08:40:00') + INTERVAL 0 MINUTE, TIMESTAMP(CURDATE() - INTERVAL 7 DAY, '08:40:00') + INTERVAL 0 MINUTE WHERE @seed_done = 0;
INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, unit_cost, line_total)
SELECT @o, @p, @pname, 2, @price, @cost, @price * 2 WHERE @seed_done = 0;
SELECT id, name, selling_price, cost_price INTO @p, @pname, @price, @cost FROM products WHERE product_code = 'PRD-0004';
SET @before = (SELECT quantity_on_hand FROM stock_levels WHERE product_id = @p FOR UPDATE);
UPDATE stock_levels SET quantity_on_hand = quantity_on_hand - 1 WHERE product_id = @p AND @seed_done = 0;
INSERT INTO stock_movements (product_id, movement_type, quantity_change, quantity_before, quantity_after, unit_cost, order_id, created_at, updated_at)
SELECT @p, 'online_order', -1, @before, @before - 1, @cost, @o, TIMESTAMP(CURDATE() - INTERVAL 7 DAY, '08:40:00') + INTERVAL 0 MINUTE, TIMESTAMP(CURDATE() - INTERVAL 7 DAY, '08:40:00') + INTERVAL 0 MINUTE WHERE @seed_done = 0;
INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, unit_cost, line_total)
SELECT @o, @p, @pname, 1, @price, @cost, @price * 1 WHERE @seed_done = 0;
UPDATE orders o SET
  subtotal = (SELECT SUM(line_total) FROM order_items WHERE order_id = o.id),
  total_cost = (SELECT SUM(quantity * unit_cost) FROM order_items WHERE order_id = o.id),
  total_amount = (SELECT SUM(line_total) FROM order_items WHERE order_id = o.id) + shipping_fee
WHERE o.id = @o AND @seed_done = 0;

-- Order o: cancelled, gcash
SET @c = (SELECT id FROM customers WHERE email = 'dennis.macaraeg@example.com');
INSERT INTO orders (customer_id, subtotal, shipping_fee, total_amount, total_cost, payment_method, payment_status,
                    order_status, delivery_address, ordered_at, delivered_at, delivered_by_id, created_at, updated_at)
SELECT @c, 0, 50.00, 0, 0, 'gcash', 'refunded', 'cancelled', '7 Aurora St., Brgy. Camilmil, Calapan City', TIMESTAMP(CURDATE() - INTERVAL 2 DAY, '11:30:00') + INTERVAL 0 MINUTE, NULL, NULL, TIMESTAMP(CURDATE() - INTERVAL 2 DAY, '11:30:00') + INTERVAL 0 MINUTE, TIMESTAMP(CURDATE() - INTERVAL 2 DAY, '11:30:00') + INTERVAL 30 MINUTE
 WHERE @seed_done = 0;
SET @o = IF(@seed_done = 0, LAST_INSERT_ID(), NULL);
SELECT id, name, selling_price, cost_price INTO @p, @pname, @price, @cost FROM products WHERE product_code = 'PRD-0009';
SET @before = (SELECT quantity_on_hand FROM stock_levels WHERE product_id = @p FOR UPDATE);
UPDATE stock_levels SET quantity_on_hand = quantity_on_hand - 1 WHERE product_id = @p AND @seed_done = 0;
INSERT INTO stock_movements (product_id, movement_type, quantity_change, quantity_before, quantity_after, unit_cost, order_id, created_at, updated_at)
SELECT @p, 'online_order', -1, @before, @before - 1, @cost, @o, TIMESTAMP(CURDATE() - INTERVAL 2 DAY, '11:30:00') + INTERVAL 0 MINUTE, TIMESTAMP(CURDATE() - INTERVAL 2 DAY, '11:30:00') + INTERVAL 0 MINUTE WHERE @seed_done = 0;
INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, unit_cost, line_total)
SELECT @o, @p, @pname, 1, @price, @cost, @price * 1 WHERE @seed_done = 0;
UPDATE orders o SET
  subtotal = (SELECT SUM(line_total) FROM order_items WHERE order_id = o.id),
  total_cost = (SELECT SUM(quantity * unit_cost) FROM order_items WHERE order_id = o.id),
  total_amount = (SELECT SUM(line_total) FROM order_items WHERE order_id = o.id) + shipping_fee
WHERE o.id = @o AND @seed_done = 0;
-- cancelled: the stock goes back, like orderService.cancelOrder
SELECT id, cost_price INTO @p, @cost FROM products WHERE product_code = 'PRD-0009';
SET @before = (SELECT quantity_on_hand FROM stock_levels WHERE product_id = @p FOR UPDATE);
UPDATE stock_levels SET quantity_on_hand = quantity_on_hand + 1 WHERE product_id = @p AND @seed_done = 0;
INSERT INTO stock_movements (product_id, movement_type, quantity_change, quantity_before, quantity_after, unit_cost, order_id, created_at, updated_at)
SELECT @p, 'return', 1, @before, @before + 1, @cost, @o, TIMESTAMP(CURDATE() - INTERVAL 2 DAY, '11:30:00') + INTERVAL 30 MINUTE, TIMESTAMP(CURDATE() - INTERVAL 2 DAY, '11:30:00') + INTERVAL 30 MINUTE WHERE @seed_done = 0;

-- 3. Display codes (normally made by the models' afterCreate hooks)
UPDATE orders SET order_code = CONCAT('ORD-', LPAD(id, 4, '0')) WHERE order_code IS NULL;
UPDATE stock_movements SET movement_code = CONCAT('STK-', LPAD(id, 4, '0')) WHERE movement_code IS NULL;

COMMIT;

-- 4. Check: run after importing
-- SELECT o.order_code, CONCAT(c.first_name, ' ', c.last_name) AS customer, o.order_status, o.payment_method,
--        o.payment_status, o.total_amount, o.ordered_at, o.delivered_at
--   FROM orders o JOIN customers c ON c.id = o.customer_id ORDER BY o.id DESC LIMIT 15;
