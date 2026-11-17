# Change request for shared/ (from Bren, POS)

Why: `node shared/sync.js` copies `shared/models`, `shared/services` into every module, including pos.
Today shared has no POS models and no `openStock` / `receiveStock` / `adjustStock` / `checkStock`,
so after the sync the POS cannot start ("does not provide an export named PurchaseOrder / openStock").

These files only ADD to what is there. Nothing from Shop, HR, Attendance or Accounting is removed or changed.

| File | What it does |
|---|---|
| models/Sale.js, SaleItem.js, Supplier.js, PurchaseOrder.js, PurchaseOrderItem.js | the 5 POS models (new files) |
| models/index.js | Jean's current index.js plus the 5 POS imports, their associations and exports |
| services/stockService.js | same deductStock and returnStock as before, plus checkStock, receiveStock, adjustStock, openStock |

## Apply (Jean, in the group repo)
1. Copy these files into `shared/models/` and `shared/services/` (replace index.js and stockService.js).
2. `node shared/sync.js`
3. `git add shared`, commit, `git pull`, `git push`.
4. Everyone: `git pull`, then `node shared/sync.js` again.

Checked: shared/models/index.js from the group repo (commit f4f15ec) with these files loads without errors, and
Sale, SaleItem, PurchaseOrder, Supplier, ProductReview and the Accounting models are all exported.

No database change is needed for this. The POS label printing uses `product_code`, which already exists.
The only optional SQL is `pos/sql/optional-barcode.sql`, for registering a manufacturer barcode (like the Coke bottle at the defense).
