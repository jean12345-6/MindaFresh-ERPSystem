-- ============================================================================
-- MindaFresh  -  safe update for the SHARED database (run by the DB host, once)
-- Purpose: give the seed products a photo so the POS and the Online Shop can show it.
-- Safe: it only fills image_url where it is EMPTY. It never changes names, prices, stock,
--       orders, sales, users or any other table. Running it twice changes nothing the second time.
-- ============================================================================
USE mindafresh_db;

-- STEP 1 (look first): which products exist and which already have a photo?
SELECT id, product_code, name, status, is_online, image_url FROM products ORDER BY id;

-- STEP 2: fill the empty photos of the seed products. Run this whole block.
-- It matches by product CODE and NAME so it cannot put a photo on the wrong product.
START TRANSACTION;
UPDATE products SET image_url = CASE product_code
  WHEN 'PRD-0001' THEN 'https://images.unsplash.com/photo-1565507853153-26f5d6e71caa?auto=format&fit=crop&w=600&q=70'
  WHEN 'PRD-0002' THEN 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=600&q=70'
  WHEN 'PRD-0003' THEN 'https://images.unsplash.com/photo-1582284540020-8acbe03f4924?auto=format&fit=crop&w=600&q=70'
  WHEN 'PRD-0004' THEN 'https://images.unsplash.com/photo-1563263357-a04f90b8d4dc?auto=format&fit=crop&w=600&q=70'
  WHEN 'PRD-0005' THEN 'https://images.unsplash.com/photo-1587593810167-a84920ea0781?auto=format&fit=crop&w=600&q=70'
  WHEN 'PRD-0006' THEN 'https://images.unsplash.com/photo-1611059263765-f57653f3bba3?auto=format&fit=crop&w=600&q=70'
  WHEN 'PRD-0007' THEN 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=70'
  WHEN 'PRD-0008' THEN 'https://images.unsplash.com/photo-1770123366817-743776f66d6a?auto=format&fit=crop&w=600&q=70'
  WHEN 'PRD-0009' THEN 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=600&q=70'
  WHEN 'PRD-0010' THEN 'https://images.unsplash.com/photo-1506976785307-8732e854ad03?auto=format&fit=crop&w=600&q=70'
  ELSE image_url END
WHERE (image_url IS NULL OR image_url = '')
  AND product_code IN ('PRD-0001','PRD-0002','PRD-0003','PRD-0004','PRD-0005','PRD-0006','PRD-0007','PRD-0008','PRD-0009','PRD-0010')
  AND (
       (product_code='PRD-0001' AND name LIKE 'Calamansi%') OR (product_code='PRD-0002' AND name LIKE 'Lakatan%')
    OR (product_code='PRD-0003' AND name LIKE 'Native Tomato%') OR (product_code='PRD-0004' AND name LIKE 'Frozen Bangus%')
    OR (product_code='PRD-0005' AND name LIKE 'Frozen Chicken%') OR (product_code='PRD-0006' AND name LIKE 'Frozen Pork%')
    OR (product_code='PRD-0007' AND name LIKE 'Well-milled Rice%') OR (product_code='PRD-0008' AND name LIKE 'Brown Sugar%')
    OR (product_code='PRD-0009' AND name LIKE 'Cooking Oil%') OR (product_code='PRD-0010' AND name LIKE 'Eggs%')
  );
SELECT ROW_COUNT() AS products_updated;
COMMIT;

-- STEP 3 (check): every seed product should now have a link.
SELECT id, product_code, name, is_online, LEFT(image_url, 60) AS photo FROM products ORDER BY id;

-- STEP 4 (OPTIONAL, only if the Online Shop must list these products): turn "Show in the Online Shop" on.
-- Remove the two dashes at the start of the line below to run it. It affects ACTIVE products only.
-- UPDATE products SET is_online = 1 WHERE status = 'active' AND image_url IS NOT NULL AND image_url <> '';
