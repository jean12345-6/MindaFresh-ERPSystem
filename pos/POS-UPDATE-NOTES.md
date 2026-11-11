# POS update notes (Bren) - for Jean and the team

## What changed (pos/ folder only, nothing in shared/)
- Logo #1 (circle + M + leaf): `pos/public/img/logo.svg`, used in the top bar, login page and tab icon.
- Cashier is now a real POS: search bar types `10@112233` (10 pcs of barcode 112233) or a product name. Enter adds. Scanner works the same way.
- Shortcuts: F1 search, F2 discount, F3 cash received, F4 payment method, F8 clear sale, F9 complete sale, Up/Down pick line, +/- qty, Del remove line, Esc clear search.
- Admin > Settings (`/settings`): store image ON (Unsplash photo under the search bar, no products listed) or OFF (old product grid with categories).
- Products form: Barcode field appears automatically IF the database has the optional `barcode` column.

## Database: do we need to change anything?
NO. The system works on the current shared schema. Nothing will crash.
- Barcode (without the column) = product code. `PRD-0001`, `1` and `0001` all find product 1, and the name works too.
- Settings are saved in `pos/data/settings.json` on each laptop (git-ignored). Not in the database.

OPTIONAL (only if the shop wants real barcodes such as 112233): Jean runs `pos/sql/optional-barcode.sql` once in phpMyAdmin.
It adds one nullable column `products.barcode` (unique). No other module reads it, so nothing else breaks.
The POS detects the column by itself; before it exists, the POS ignores it.
If Jean also updates `shared/database/schema.sql`, add `barcode VARCHAR(50) NULL` after `product_code` in the products table.

## What to tell Jean and the classmates
1. Pull only the `pos/` folder. Do not edit `shared/`. Do not copy `node_modules`, `.env` or `pos/data`.
2. After pulling: `node shared/sync.js`, then `npm install` in `pos/`, then make your own `.env` (DB_HOST = Jean's IP).
3. No SQL is required to run the POS. The barcode SQL is optional and only Jean (DB host) runs it, once.
4. Never run `sequelize.sync()` and never rename or drop columns. Only ADD nullable columns, and tell the team first.
5. Always `git pull` before `git push`. Push only your own folder.

## Going back if something crashes
- Git tag: `git checkout backup-before-pos-rework -- pos` restores the old POS.
- Folder copy: `C:\laragon\www\mindafresh-backup\pre-pos-rework`.

## .env (pos)
Local now: `DB_HOST=127.0.0.1`. To go back to the classmate database, comment that line and uncomment
`# DB_HOST=10.205.157.58` (the line is already in the file). Restart the POS after changing .env.

## Update 2: sidebar UI, SweetAlert, image uploads
- New sidebar layout on every page. Messages and confirmations use SweetAlert (installed with `npm install`; served from node_modules).
- Uploads (product image, store image): images only (PNG, JPG, WEBP, GIF, max 3 MB). The file content is checked on the server, so a PDF renamed to .png is refused.
- Uploaded files are saved in `pos/public/uploads/` on that laptop only (git-ignored). Classmates (Shop) will not see them. The seed products use Unsplash links, which work everywhere.
- Optional SQL `pos/sql/product-images.sql`: sets Unsplash images for products 1-11 and turns "Show in the Online Shop" OFF for ALL products. Already run on the local DB. On the shared DB only Jean runs it, because it changes the Shop.
- After pulling: run `npm install` in `pos/` (new packages: multer, sweetalert2).
