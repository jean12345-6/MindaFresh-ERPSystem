# MindaFresh POS (with Inventory and Purchasing)

Owner: Bren · Port 3002 · Shared database `mindafresh_db` (no separate POS database, no APIs between modules).

## Run it

This folder is already a complete module, so you do not need to run `xianfires new pos`.

```
cd C:\laragon\www\mindafresh-erp
node shared\sync.js
cd pos
npm install
copy .env.example .env          (skip if .env is already there; set DB_HOST at joint tests)
npm run css:build               (or: npm run css   to rebuild on every save)
npm start                       (or: npm run dev   to restart on every save)
```

Open http://localhost:3002. Check the connection from `mindafresh-erp`:

```
node shared\check-connection.js pos --user maria.cashier --pass <seed password>
```

## Logins (the HR seed accounts)

| Role | Username | Opens |
|---|---|---|
| admin | `admin` | everything, including Products and Categories |
| cashier | `maria.cashier` | Dashboard, Cashier, Sales (receipts, voids) |
| inventory_staff | `jose.inventory` | Dashboard, Stock, Movements, Adjust, Suppliers, Purchase orders |

Other roles (hr_staff, accountant, employee) are refused at login.

## Pages

| Page | URL | What it does |
|---|---|---|
| Cashier | `/pos` | Product grid, search (Enter adds by code), cart, discount, cash/GCash/card, change. Checkout saves the sale and deducts stock in one transaction. |
| Receipt | `/sales/:id` | Printable receipt, stock movements, Accounting status, void with reason. |
| Sales | `/sales` | Sales for a day, filter by status. |
| Dashboard | `/dashboard` | Today's sales, gross profit, payment split, top sellers, online orders, low stock. |
| Stock | `/inventory` | Stock levels, value at cost, low-stock filter. |
| Adjust | `/inventory/adjust` | Count corrections and spoilage (+/-, reason required). |
| Movements | `/inventory/movements` | Every stock change: POS sales, Shop orders, POs, adjustments, returns. |
| Suppliers | `/suppliers` | Add, edit, deactivate. |
| Purchase orders | `/purchases` | Draft, then place, then receive (adds stock, updates weighted average cost), or cancel. "Restock low items" pre-fills a PO from the low-stock list. |
| Products | `/products` | Admin: add (with opening stock), edit prices, show online, deactivate. |
| Categories | `/categories` | Admin: add, rename. |

## How POS connects to the other modules

- **Online Shop (Ali):** the Shop calls `deductStock` / `returnStock` from `shared/services/stockService.js`. Its orders appear in POS under Stock movements (type `online_order`) and lower the same `stock_levels`. Products added or deactivated in POS show in the Shop right away (`status = 'active'` and `is_online = 1`).
- **HR (Fate):** login uses `shared/services/authService.js` (users ⨝ employees). An employee added in HR with a cashier or inventory_staff login can use POS at once. Every sale, PO and movement stores `employee_id`.
- **Accounting (Jean):** POS writes only its own tables. Accounting reads them on "Post new transactions". POS shows whether a sale or PO is posted by looking up `journal_entries` (read only) with `source_module = 'pos'` and `reference_code` = the POS code.

What Jean needs from POS tables:

| Event | Where to read it | Suggested entry_type, reference_code |
|---|---|---|
| Sale | `sales` with status `completed`: `total_amount`, `total_cost`, `payment_method` (cash → 1010, gcash/card → 1020) | `sale`, `sale_code` |
| Void | `sales` with status `voided` that already have a posted `sale` entry | `sale_reversal`, `sale_code` |
| Purchase received | `purchase_orders` with status `received`: `total_cost`, `payment_method` (cash → 1010, on_account → 2010) | `purchase`, `purchase_order_code` |
| Stock adjustment | `stock_movements` with type `adjustment`: `quantity_change × unit_cost` (minus → 6040 Inventory Loss) | `stock_adjustment`, `movement_code` |

## Rules this module keeps (from the POS diagrams)

- Stock changes only in `stockService` and always writes a stock movement (PR1, PR2).
- A sale with one short item deducts nothing (row locks plus one transaction; PR3, PR4).
- `sale_items` keeps the name, price and cost at the time of sale (PR5).
- Each role sees only its pages through `requireRole` (PR7).
- Receiving a PO adds the stock and updates the cost price (PR8).
- No `sequelize.sync()` anywhere.

## Smoke test (solo mode only)

```
cd pos
node scripts/smoke-test.js
```

It runs a checkout, a refused short checkout (TC-P1), a void, a PO received with a cost update (TC-P4), an adjustment, and checks that the movements add up to stock on hand (TC-P2). It leaves one voided sale, one received PO and one adjustment in the database, so re-import `schema.sql` and `seed.sql` afterwards for clean data.

## Shared files changed (Bren owns these; tell the group to run `node shared/sync.js`)

- `shared/models/`: new `Supplier.js`, `PurchaseOrder.js`, `PurchaseOrderItem.js`, `Sale.js`, `SaleItem.js`, and their associations in `index.js`. These are additions only; nothing the Shop uses changed.
- `shared/services/stockService.js`: new `receiveStock`, `adjustStock`, `openStock`, `checkStock`. `deductStock` and `returnStock` are unchanged.
