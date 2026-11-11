-- OPTIONAL demo images for the seed products (Unsplash) and POS-only visibility.
-- Local use: run on YOUR database. On the shared DB, only Jean runs it (it changes is_online for ALL products).
USE mindafresh_db;
UPDATE products SET is_online = 0;
UPDATE products SET image_url = CASE id
  WHEN 1 THEN 'https://images.unsplash.com/photo-1565507853153-26f5d6e71caa?auto=format&fit=crop&w=600&q=70'
  WHEN 2 THEN 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=600&q=70'
  WHEN 3 THEN 'https://images.unsplash.com/photo-1582284540020-8acbe03f4924?auto=format&fit=crop&w=600&q=70'
  WHEN 4 THEN 'https://images.unsplash.com/photo-1563263357-a04f90b8d4dc?auto=format&fit=crop&w=600&q=70'
  WHEN 5 THEN 'https://images.unsplash.com/photo-1587593810167-a84920ea0781?auto=format&fit=crop&w=600&q=70'
  WHEN 6 THEN 'https://images.unsplash.com/photo-1611059263765-f57653f3bba3?auto=format&fit=crop&w=600&q=70'
  WHEN 7 THEN 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=70'
  WHEN 8 THEN 'https://images.unsplash.com/photo-1770123366817-743776f66d6a?auto=format&fit=crop&w=600&q=70'
  WHEN 9 THEN 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=600&q=70'
  WHEN 10 THEN 'https://images.unsplash.com/photo-1506976785307-8732e854ad03?auto=format&fit=crop&w=600&q=70'
  WHEN 11 THEN 'https://images.unsplash.com/photo-1611214774777-3d997a9d0e35?auto=format&fit=crop&w=600&q=70'
  ELSE image_url END
WHERE id BETWEEN 1 AND 11 AND image_url IS NULL;
