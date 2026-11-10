# MindaFresh ERP — Accounting & Finance (Jean) · port 3005

Accounting reads the other modules' tables in `mindafresh_db` and writes only its own 5 tables:
`accounts`, `journal_entries`, `journal_lines`, `salary_releases`, `remittances`.
There are no APIs: everything goes through the one shared database.

## 1. Put it in the repo

Copy these into your `mindafresh-erp` folder (the one with `shared/`):

| From this zip | What it is |
|---|---|
| `accounting/` | The whole module (already generated with `xianfires new accounting`, template fixes applied) |
| `shared/models/Account.js`, `JournalEntry.js`, `JournalLine.js`, `SalaryRelease.js`, `Remittance.js` | Accounting models (you own these) |
| `shared/models/index.js` | Adds the Accounting models and associations. **Merge only the lines marked `// Accounting (Jean)`** if others changed this file too |
| `shared/utils/money.js` | `peso()` now shows negatives as `-₱345.00` (you own this file) |

Then, from the `mindafresh-erp` folder:

```
node shared\sync.js
cd accounting
npm install
copy .env.example .env
```

Set `DB_HOST` in `.env` (127.0.0.1 at home, the DB host's IP at joint tests).

## 2. Check and run

```
cd ..
node shared\check-connection.js accounting --user carla.accountant --pass Accountant@2026
cd accounting
xian start
```

Open http://localhost:3005 and log in as `carla.accountant` / `Accountant@2026` (or `admin` / `Admin@2026`).
`liza.hr` / `Hr@2026` can open only Salary releases (view only).

Only if you change a `.xian` view's classes: `npm run build:css` (the built `public/css/app.css` is included).

## 3. Pages

| Page | What it does |
|---|---|
| Dashboard | Cash, bank, inventory, payables; this month's revenue, expenses, net income; how many transactions wait to be posted |
| Post transactions | Runs automatically when the Dashboard opens (blueprint v2.4 flow G). Lists every POS sale, POS void, delivered / returned online order, received purchase order, stock adjustment and approved payroll that is not in the journal yet. **Post** turns them into balanced entries. Posting twice never doubles anything |
| Journal | All entries with filters; open one to see its lines; print |
| New manual entry | Rent, utilities, supplier payments. Saves only when debits = credits. Manual entries can be voided |
| Chart of accounts | All accounts with balances; add an account; turn one off |
| Salary releases | Created when payroll is posted. Release = Dr Salaries Payable, Cr Bank or Cash |
| Remittances | SSS, PhilHealth, Pag-IBIG, BIR. Suggests the amount payroll withheld for that month |
| Reports | Trial balance, income statement, balance sheet, general ledger, sales summary (POS vs Online). All printable |

## 4. Posting rules (blueprint Section 7F)

| Event (from) | Debit | Credit |
|---|---|---|
| POS sale, cash (`sales`) | 1010 Cash on Hand | 4010 Sales Revenue – POS |
| POS sale, GCash or card | 1020 Cash in Bank / E-Wallet | 4010 |
| Online order delivered (`orders`) | 1010 (COD) or 1020 (GCash) | 4020 Sales – Online + 4030 Delivery Fee Income |
| Cost of any sale | 5010 Cost of Goods Sold | 1200 Merchandise Inventory |
| POS void / online return or refund | the original sale lines, swapped | |
| Purchase order received (`purchase_orders`) | 1200 | 1010 (cash) or 2010 Accounts Payable (on account) |
| Stock adjustment loss (`stock_movements`) | 6040 Inventory Loss | 1200 (a gain is the opposite) |
| Payroll approved (`payroll_runs`) | 6010 Salaries Expense | 2100 Salaries Payable, 2110 Gov't Contributions, 2120 Withholding Tax |
| Salary release | 2100 | 1020 (bank) or 1010 (cash) |
| Remittance | 2110 (SSS, PhilHealth, Pag-IBIG) or 2120 (BIR) | 1020 |

A sale voided before it was ever posted gets no entry at all. Payroll numbers are read straight from `payroll_runs`.

## 5. Tell the group

- **Fate (HR):** `shared/models/PayrollRun.js` reuses one `money` object for 4 columns, so Sequelize maps
  `total_contributions`, `total_withholding_tax` and `total_net` all to `total_gross`
  (reading PAY-0001 gives 18000 for all four). Fix: change `const money = {...}` to
  `const money = () => ({ type: DataTypes.DECIMAL(12, 2), allowNull: false });` and use `money()` on each line.
  Accounting already reads payroll with SQL, so it is correct either way, but HR's own saves will fail until fixed.
- **Everyone:** Accounting needs `orders.delivered_at`, `purchase_orders.received_at`, `payroll_runs.approved_at`
  filled in when those statuses change, so entries get the right date.
