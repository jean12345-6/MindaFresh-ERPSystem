---
title: "MindaFresh ERP — Master Blueprint (v2.4: One Shared Database)"
---

Revised Nov 10, 2026 (v2.4) · replaces v2.3 (Nov 9, 2026), v2.2 (Oct 30, 2026), v2.1 (Oct 25, 2026) and v1 (Oct 6, 2026)

## What Changed in v2

Our professor's guidance (Sep 30 consultation) is that **all modules use one database**: separate folders, but one database name and one set of tables, with a single `employees` table that every module joins to and a `users` table joined to it. Version 1 used five databases linked by REST APIs, so this version rewrites the parts that depended on that.

| Area | v1 (Oct 6) | v2 (this version) |
|-------------------------------------------------------|------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------|
| Database | 5 databases, one per module | **One database, `mindafresh_db`**, on one DB host laptop |
| Links between modules | REST APIs with an API key | **Foreign keys** (`employee_id` → `employees.id`) and direct reads of shared tables |
| Writing another module's data | Through the owner's API | Through the owner's **shared service** (for example POS's `stockService.deductStock`) |
| Login | HR login API + JWT | Every module checks the same `users` ⨝ `employees` tables through a shared `authService` |
| Customers | In HR's `users` table | In the Shop's own `customers` table (users = staff only, one per employee) |
| Accounting | Other modules pushed events and retried when offline | **Accounting pulls**: one *Post new transactions* step finds unposted sales, orders, purchases, adjustments and payrolls |
| Schema | `sequelize.sync()` in each app | **`shared/database/schema.sql`** is the only source; apps never call `sync()` |
| Payroll paid | HR status `paid`, set by Accounting through an API | Shown as paid when Accounting's salary release is released (no cross-module write) |

Fixes carried into v2 from the review of v1:

- The code-generation hook now passes the transaction along. v1's hook would freeze for about 50 seconds inside every POS sale, purchase receipt and stock deduction.
- Journal entries are unique on `source_module + entry_type + reference_code`, so a void or refund can be posted after its sale (v1 rejected it as a duplicate).
- Attendance has a `holidays` table and working days, so Sundays and holidays are no longer marked absent. It also tracks undertime and has a corrections screen for missed time-outs.
- Emergency leave uses the vacation balance. Leave is in whole days.
- Purchases use **weighted average cost**. Stock adjustments are posted to Accounting, so the Inventory account matches the stock count.
- Card sales go to Cash in Bank, and the shipping fee goes to its own income account.
- Seed codes are renumbered with no gaps (EMP-0001 to EMP-0007, USR-0001 to USR-0006).

Added in v2.1 (stricter database rules):

- `stock_movements` links to its source with real foreign keys (`sale_id`, `order_id`, `purchase_order_id`) instead of a text `reference_code`. The database now guarantees every stock change points to a real sale, order or purchase, and the ERD shows POS linked to the Shop's orders.
- **CHECK constraints** (44 in total) make the database itself reject bad data: a misspelled status (`Completed`, `void`), an unknown role, negative stock, a void without a reason, an adjustment without remarks, a stock movement with the wrong source, and an unbalanced journal entry.
- Section 4 now explains how the schema is normalized, for the defence.

Added in v2.2 (what we learned setting up the first module, Online Shop):

| Area | v2.1 | v2.2 |
|-------------------------------------------------------|------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------|
| Database server | XAMPP (MariaDB 10.4) or Laragon (MySQL 8) | **Laragon only** (MySQL 8.4 + its phpMyAdmin), on every laptop |
| Node.js | 20 LTS | **22 LTS** |
| Testing the connection | Trial and error | **`node shared/check-connection.js <module>`** checks `.env`, the network, the login, all the tables and a test write, and says how to fix each failure |
| Starting a new module | Copy files by hand | **Starter kit:** `shared/` + `module-template/` (Tailwind config, fonts, a safe `migrate.js`) + `SETUP.md` |
| Staff login page | `requireRole` always sends to `/login` | `requireRole` sends to **`STAFF_LOGIN_PATH`** from `.env` (default `/login`; the Shop uses `/admin/login`) |
| Repositories | One repository | **Group repository** for the whole ERP + each member's **own repository** for their module |
| Online Shop scope | Admin manages products online | Products stay in POS only. The Shop adds a **customer profile**, **enable/disable customer accounts** and a **sales report** (Section 7A) |

Fixes from the Laragon setup, now in Section 8: comment out `skip-grant-tables` in `my.ini`, keep the `.gitignore` at the **repo root** (so `node_modules/` and `.env` are never pushed), and never leave `sequelize.sync()` in the generated `migrate.js`, `create.js` or `authController.js`.

Added in v2.3 (Online Shop features for the defence):

| Area | v2.2 | v2.3 |
|-------------------------------------------------------|------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------|
| Tables | 26 | **27**: new Shop-owned table **`product_reviews`** (migration `003-product-reviews.sql`). No other module's table changes |
| Product reviews | none | A customer rates a product (1–5 stars + optional comment) **from a delivered order** on My orders; one review per customer per product; the admin hides or shows reviews (Section 7A) |
| Product photos | Set in POS (`image_url`) only | The Shop admin uploads the photo the shop shows; it is saved as a file in `shop/public/images/products`, so the Shop still never writes POS's `products` table |
| Migration 001 (case-sensitive status values) | Proposed | **Dropped.** Status values stay as in `schema.sql`; always write them in lowercase |
| Migration 002 (attendance lunch out / lunch in) | none | **Proposed by Attendance** (Brian), with a CHECK that keeps the times in order; already applied on the DB host for testing. Add to `schema.sql` and Section 4 once the group (and HR, for payroll) agrees |

Added in v2.4 (Attendance works like a real company's, agreed by the group):

| Area | v2.3 | v2.4 |
|-------------------------------------------------------|------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------|
| Migration 002 (lunch out / lunch in) | Proposed | **Accepted.** `attendance_logs` gets `lunch_out` and `lunch_in` plus `chk_attendance_lunch`; now in `schema.sql` (47 CHECK constraints). Still 27 tables. Only a database imported from an older `schema.sql` runs `002-attendance-lunch.sql` |
| Lunch and pay | Fixed 1-hour lunch | Lunch is **recorded**, but `hours_worked` still deducts exactly 1 hour, so HR payroll does not change |
| Kiosk | Time in and time out (`/kiosk/time-in`, `/kiosk/time-out`) | **One button** that shows the next step: Time in → Lunch out → Lunch in → Time out (`POST /kiosk/punch`). Refuses a repeat tap within 1 minute and a fifth punch |
| HR screens in Attendance | Logs, corrections, reports | Adds a **today board**, a **holidays** screen, and a printable **DTR per cutoff** (1–15 and 16–end) with "Prepared by / Approved by" lines |
| Other modules | | **No change** to the Shop, POS or Accounting. HR payroll keeps calling `getSummary`, whose fields do not change |

The full Attendance plan (rules, screens, routes, test script) is in the separate **Attendance Module Blueprint**.

## Title and Tech Stack

**Decision:** all 5 modules are built with the **XianFire framework** (Node.js + Express), **one MySQL database** through **Sequelize + mysql2**, and **.xian (Handlebars) views with Tailwind CSS**. Each module is its own XianFire app in its own folder, and all five connect to the same database. **POS includes inventory and purchasing**: products, stock, suppliers, purchase orders and in-store sales all live in Bren's module.

### Title options

1. **MindaFresh ERP: An Integrated Web-Based Enterprise Resource Planning System for Sales, Workforce, and Financial Management of MindaFresh Food Distribution, Inc.**
2. **MindaFresh OneSuite: A Centralized-Database ERP System Linking Online Ordering, Point-of-Sale, Attendance, Human Resources, and Accounting**
3. **FreshLink ERP: A Modular Web-Based Enterprise System for Retail Sales, Employee Management, and Financial Reporting of a Food Distribution Company**

Option 1 is the safest for defence: it names every area our 5 modules cover.

### Stack (same for all 5 members)

| Part | Tool | Notes |
|------------------------------------|--------------------------------------------------------------------|------------------------------------------------------------------------------------------------|
| Runtime | Node.js 22 LTS + npm | Same version on every laptop |
| Framework | XianFire (`xianfires` CLI) on Express | ECMAScript modules (`"type": "module"`) |
| Database | MySQL 8.4 (Laragon) + Laragon's phpMyAdmin | **One database: `mindafresh_db`**. Everyone uses Laragon; no XAMPP |
| ORM | Sequelize + mysql2 | `dialect: "mysql"`. Chosen at generation: **MySQL** |
| Views | .xian (Handlebars) + Tailwind CSS | Same `head.xian` / `footer.xian` partials in all 5. Tailwind is built to `public/css/app.css` and the font is in `public/fonts`, so pages work without internet |
| Sessions | express-session + connect-flash | Comes with XianFire. Each module keeps its own session |
| Passwords | bcrypt | Staff (`users`) and customers (`customers`) |
| Dev server | `xian dev` (Nodemon hot reload) | `xian start` for defence |

### Generator choices (everyone picks the same)

```
xianfires new pos        (shop / pos / attendance / hr / accounting)
Template: With CRUD Functions
Database: MySQL
Electron: No
Jest: No
```

The CRUD template gives everyone the same `/login`, `/dashboard` and `/logout` pages. Each staff module changes its `authController.js` to use the shared `authService` (Section 6). The Shop logs customers in against its own `customers` table.

## 1. System Overview

MindaFresh ERP runs MindaFresh Food Distribution, Inc. as one system on **one database**: customers buy online, cashiers sell in-store, staff buy stock from suppliers, staff clock in and out, HR keeps employee records, leaves and payroll, and Accounting turns every sale, purchase, stock adjustment and approved payroll into journal entries, releases salaries, and makes reports.

**HR owns people, logins, leaves and payroll. POS owns products, stock and purchasing. Attendance owns the time records. The Shop owns customers and online orders. Accounting owns the books.** Every module can *read* every table; each module *writes* only its own tables, or another module's tables through that owner's shared service.

| Module | Owner | Folder | Local URL (port) | Tables it owns |
|---------------------------------------------------|--------------------------|-----------------------------|----------------------------------|--------------------------------------------------------------------------------------|
| Online Shop | Ali | `shop/` | http://\<ip\>:3001 | customers, cart_items, orders, order_items, product_reviews |
| POS (with Inventory and Purchasing) | Bren | `pos/` | http://\<ip\>:3002 | categories, products, stock_levels, stock_movements, suppliers, purchase_orders, purchase_order_items, sales, sale_items |
| Attendance | Brian | `attendance/` | http://\<ip\>:3003 | attendance_logs, holidays |
| HR | Fate | `hr/` | http://\<ip\>:3004 | departments, employees, users, leave_requests, payroll_runs, payroll_items |
| Accounting & Finance | Jean | `accounting/` | http://\<ip\>:3005 | accounts, journal_entries, journal_lines, salary_releases, remittances |

**How the modules connect**

- **employee_id is the shared key.** `employees.id` is the foreign key in users, attendance_logs, sales, purchase_orders, stock_movements, payroll_items and journal_entries. A new employee in HR can time in, sell and be paid right away, with nothing to copy.
- **POS sale** → POS saves the sale and deducts stock in one transaction → Accounting's *Post new transactions* turns it into Cash / Sales and COGS / Inventory.
- **Online order** → Shop saves the order and calls POS's `stockService.deductStock` in the **same** transaction (all or nothing) → when delivered, Accounting posts it.
- **Purchase order received** → POS adds stock at weighted average cost → Accounting posts Inventory / Cash or Accounts Payable.
- **Payroll** → Attendance's summary gives days, lates, undertime and absences → HR applies leaves and holidays, computes payslips, and the admin approves → Accounting posts the payroll, releases salaries, and remits SSS, PhilHealth, Pag-IBIG and withholding tax → HR shows the run as paid.
- **Login** → every staff module checks `users` joined to `employees`. The Shop checks `customers`.

![MindaFresh ERP · 5 modules, 1 shared database](diagram.png){width="6.3in"}

Solid arrows: a module writes its own tables. Dashed arrows: the main reads and the one cross-module write (the Shop deducting stock through POS's service).

### How we are graded (from the professor)

- Each module is worth **20%** of the project grade (5 × 20% = 100%). A module that is not finished counts as 0, so the group's maximum drops to 80%.
- Each member's **laboratory grade** is their own module's score transmuted: 17/20 → 85, 20/20 → 100. A teammate who does not finish does not lower your lab grade.
- At the final defence, each module is presented and graded first (HR first), then the whole group.

That is why **every member must be able to run the whole system alone** (solo mode, Section 8), and why the database and shared rules come first.

## 2. Data Ownership

Only the **owner** module creates or edits a table. Other modules **read it directly** (a join or a query) and never keep their own editable copy. When another module has to change owned data, it calls the **owner's shared service**, never its own `UPDATE`.

| Data | Owner | Read by | How others change it |
|--------------------------------------------------------------------|------------------------------|------------------------------------------------------------------|-------------------------------------------------------------------------|
| employees, departments | HR | All modules | They don't |
| users (staff logins) | HR | All staff modules, through `authService.login` | They don't |
| leave_requests, leave balances | HR | Attendance (on_leave days) | They don't |
| payroll_runs, payroll_items | HR | Accounting | They don't (Accounting reads approved runs) |
| categories, products, prices | POS | Shop, Accounting | They don't |
| stock_levels, stock_movements | POS | Shop, Accounting | Shop: `stockService.deductStock` / `returnStock` only |
| suppliers, purchase_orders, purchase_order_items | POS | Accounting | They don't |
| sales, sale_items | POS | Accounting | They don't |
| customers, cart_items, orders, order_items, product_reviews | Shop | Accounting (orders), POS (stock movements) | They don't |
| attendance_logs, holidays | Attendance | HR (payroll, employee profile) | They don't (HR reads `attendanceService.getSummary`) |
| accounts, journal_entries, journal_lines | Accounting | Admin, all modules (posted / not posted) | They don't |
| salary_releases | Accounting | HR (paid / not paid) | They don't |
| remittances | Accounting | Admin | They don't |

**Special rules**

- **Stock changes only through `stockService`** (owned by POS). It locks the stock rows, refuses to go below 0, and writes the stock movement. Nobody runs `UPDATE stock_levels` anywhere else.
- **Payroll is computed only in HR.** Accounting never recomputes pay; it posts the totals of approved runs and pays the net amount.
- **Accounting is the only module that writes journal entries.** Other modules never write debit and credit lines; Accounting reads their finished records and decides the accounts.
- A module may save a **snapshot** (for example `product_name` + `unit_price` inside an order item) so old records stay correct after a price change. A snapshot is history only. It is never edited and never used as the live value.

## 3. Naming Conventions

**Database setup: one database, `mindafresh_db`.** All five apps use the same database name and the same tables. The database is created only from `shared/database/schema.sql`; nobody creates or changes tables from their own app.

### Sequelize settings (copy into every config/database.js)

Sequelize uses camelCase and changes table names by default. These settings force our snake_case rules:

```js
import { Sequelize } from "sequelize";

export const sequelize = new Sequelize(
  process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASS,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: "mysql",                       // MySQL 8.4 (Laragon)
    timezone: "+08:00",
    logging: false,
    dialectOptions: { decimalNumbers: true }, // DECIMAL comes back as a number
    define: {
      underscored: true,      // created_at, updated_at, employee_id
      freezeTableName: true,  // table name = exactly what we write
      timestamps: true
    }
  }
);
```

**Never call `sequelize.sync()`** (with or without `force` or `alter`). Five apps syncing one database will fight over the tables. `index.js` only runs `await sequelize.authenticate()` before `app.listen`.

### Naming rules

| Item | Rule | Example |
|-------------------------------------------------|------------------------------------------------------------------------------------------------|--------------------------------------------------------------------|
| Table names | snake_case, **plural**, set with `tableName` | `employees`, `sale_items` |
| Column names | snake_case, **singular** | `first_name`, `total_amount` |
| Primary key | `id` INT UNSIGNED auto-increment | `id = 15` |
| Foreign key | `<singular_table>_id` with a real foreign key, **also across modules** | `attendance_logs.employee_id` |
| Foreign key with a role | `<role>_id` → employees.id | `approved_by_id`, `prepared_by_id` |
| Display code | `<entity>_code` VARCHAR(20) UNIQUE. Shown on screens, receipts, payslips | `employee_code = 'EMP-0001'` |
| Booleans | `is_` prefix, BOOLEAN (TINYINT(1)) | `is_online` |
| Timestamps | `created_at`, `updated_at` (from `underscored: true`) |  |
| Date only | DATE (Sequelize DATEONLY), YYYY-MM-DD | `2026-10-06` |
| Date and time | DATETIME in Asia/Manila (+08:00) | `2026-10-06 14:30:00` |
| Money | DECIMAL(12,2). On screen: peso sign and commas. Never FLOAT | DB 1250.50, screen ₱1,250.50 |
| Money in JavaScript | Round every computed amount with `round2()` from `utils/money.js` | `round2(0.1 + 0.2) = 0.3` |
| Quantity | INT (whole units) | `quantity = 3` |
| Status values | lowercase snake_case, only from the list below | `out_for_delivery` |
| Model files | Singular PascalCase in `models/` | `models/Employee.js`, `models/SaleItem.js` |
| Shared service files | camelCase + Service in `services/` | `services/stockService.js` |
| Controller files | camelCase + Controller in `controllers/` | `controllers/salesController.js` |
| View files | kebab-case `.xian` in `views/` | `views/sales-list.xian` |

### ID formats

Format: **PREFIX-0001** (prefix, hyphen, 4-digit number with leading zeros). After 9999 it simply grows to 5 digits. The code comes from the row's `id`, is made only by the owner module right after insert, and is never reused or changed. A rolled-back insert can leave a gap (for example ORD-0008 missing). That is normal.

| Prefix | Entity | Owner |
|------------------------------------|-----------------------------------------------|-------------------------------------|
| EMP | Employee | HR |
| USR | User account | HR |
| DEP | Department | HR |
| LVE | Leave request | HR |
| PAY | Payroll run | HR |
| CAT | Product category | POS |
| PRD | Product | POS |
| STK | Stock movement | POS |
| SUP | Supplier | POS |
| PUR | Purchase order | POS |
| SAL | POS sale | POS |
| CUS | Customer | Online Shop |
| ORD | Online order | Online Shop |
| ATT | Attendance log | Attendance |
| TXN | Journal entry | Accounting |
| REL | Salary release | Accounting |
| REM | Government remittance | Accounting |

Code generation in every model. **Pass the transaction through**, or the save waits on the row its own transaction just inserted and times out:

```js
StockMovement.afterCreate(async (row, options) => {
  row.movement_code = `STK-${String(row.id).padStart(4, "0")}`;
  await row.save({ hooks: false, transaction: options.transaction });
});
```

### Fixed status values

Every value list below is enforced by a **CHECK constraint** in `schema.sql`. Saving a role that is not on the list fails with a database error, so a typo is caught the first time it happens. **Capital letters:** the tables use the case-insensitive `utf8mb4_unicode_ci` collation, so the database would still accept `Completed` for `completed`. Always write the values in lowercase, exactly as listed.

| Field | Allowed values |
|-------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------|
| employees.status | active, inactive, resigned |
| employees.employment_type | regular, probationary, contractual |
| users.role | admin, cashier, inventory_staff, hr_staff, accountant, employee |
| users.status, customers.status | active, disabled |
| leave_requests.leave_type | vacation, sick, emergency, unpaid |
| leave_requests.status | pending, approved, rejected, cancelled |
| payroll_runs.status | draft, approved |
| products.status, suppliers.status | active, inactive |
| products.unit | pc, kg, pack, box, tray |
| stock_movements.movement_type | opening, stock_in, sale, online_order, adjustment, return |
| purchase_orders.status | draft, ordered, received, cancelled |
| purchase_orders.payment_method | cash, on_account |
| sales.status | completed, voided |
| sales.payment_method | cash, gcash, card |
| orders.order_status | pending, confirmed, out_for_delivery, delivered, cancelled, returned |
| orders.payment_status | unpaid, paid, refunded |
| orders.payment_method | cod, gcash |
| product_reviews.status | visible, hidden |
| attendance_logs.status | present, late, absent, on_leave |
| holidays.holiday_type | regular, special |
| salary_releases.status | pending, released |
| salary_releases.release_method | bank_transfer, cash |
| remittances.agency | sss, philhealth, pagibig, bir |
| remittances.status | pending, paid |
| journal_entries.status | posted, voided |
| journal_entries.source_module | shop, pos, hr, accounting |
| journal_entries.entry_type | opening, sale, sale_reversal, purchase, stock_adjustment, payroll, salary_release, remittance, manual |
| accounts.account_type | asset, liability, equity, revenue, expense |
| accounts.normal_balance | debit, credit |

## 4. Database Schema

**27 tables in one database, `mindafresh_db`.** Every table also has `created_at` and `updated_at` (not repeated below). The exact SQL is in **`shared/database/schema.sql`**, and the test data in **`shared/database/seed.sql`**; both come with this document. Import schema first, then seed.

| Owner (module) | Tables | Count |
|----------------------------------------|------------------------------------------------------------------------------------------------|------------------------------------|
| HR | departments, employees, users, leave_requests, payroll_runs, payroll_items | 6 |
| POS | categories, products, stock_levels, stock_movements, suppliers, purchase_orders, purchase_order_items, sales, sale_items | 9 |
| Online Shop | customers, cart_items, orders, order_items, product_reviews | 5 |
| Attendance | holidays, attendance_logs | 2 |
| Accounting | accounts, journal_entries, journal_lines, salary_releases, remittances | 5 |
| **Total** |  | **27** |

Payroll uses **simplified academic rates** stored in HR's `config/payroll.js`, not the official 2026 contribution and tax tables. Employer shares are left out. Say this clearly during defence.

In the tables below, *unique* rows are keys over several columns, and *check* rows are rules the database enforces on every insert and update. Value lists from Section 3 are also enforced, but not repeated here.

### Normalization (for defence)

The schema is in **Third Normal Form (3NF)**:

- **1NF:** every column holds one value. Repeating items have their own tables (`sale_items`, `order_items`, `purchase_order_items`, `payroll_items`, `journal_lines`).
- **2NF:** every table has a single-column key (`id`), so no column depends on only part of a key.
- **3NF:** every fact is stored once and linked by a foreign key. Department, employee, product, customer, supplier and account details each live in one table; `users` repeats nothing from `employees`.
- **Referential integrity:** 38 foreign keys, including across modules (for example `attendance_logs.employee_id`, `stock_movements.order_id`, `product_reviews.product_id`), plus 47 CHECK constraints.

Some values are stored on purpose even though they could be computed. Each is written once, by its owner module, inside a transaction:

| Kind | Examples | Why it is stored |
|------------------------------------------|------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------|
| Snapshots | `sale_items.product_name`, `unit_price`, `unit_cost`; `payroll_items.daily_rate`; `orders.delivery_address` | The value at the time of the transaction. Old receipts and payslips must not change when a price or rate changes |
| Totals | `sales.total_amount`, `orders.total_amount`, `purchase_orders.total_cost`, `line_total`, `payroll_runs` totals, journal totals | Freezes the official figure once completed or approved, and keeps reports fast |
| Computed results | `payroll_items` pay amounts, `attendance_logs.hours_worked`, `stock_movements.quantity_before` / `quantity_after` | The result at that moment, kept as an audit trail |
| Running balances | `stock_levels.quantity_on_hand`, `employees` leave balances | Needed instantly; can be rebuilt from `stock_movements` or `leave_requests` if ever in doubt |
| Display codes | `employee_code` (EMP-0001), `sale_code`, and the other `_code` columns | A readable second key for receipts, payslips and the kiosk. Never changed |

One field is deliberately not a foreign key: `journal_entries.reference_code`. A journal entry can come from seven kinds of record, so it stores the source's code together with `source_module` and `entry_type`, a standard accounting pattern. The unique key on those three columns prevents double posting.

**If the panel asks:** "The schema is in 3NF. The only redundancy is intentional: snapshots keep historical prices and rates, and stored totals and balances freeze official figures and keep reports fast. Each is written in one place, by one module, inside a transaction."

### HR (Fate)

**departments**: Departments.

| Column | Type | Rules |
|------------------------------|----------------------|--------------------------------------------------------------------------------|
| id | INT UNSIGNED | PK, auto-increment. Used for joins and foreign keys |
| department_code | VARCHAR(20) | Unique, DEP-0001. Display code, set by the afterCreate hook |
| name | VARCHAR(100) | Sales, Inventory, HR, Finance, Delivery |

**employees**: Employee master record. **The table every module joins to.**

| Column | Type | Rules |
|------------------------------|----------------------|--------------------------------------------------------------------------------|
| id | INT UNSIGNED | PK, auto-increment. Used for joins and foreign keys |
| employee_code | VARCHAR(20) | Unique, EMP-0001. Typed at the kiosk, printed on receipts and payslips. Display code, set by the afterCreate hook |
| first_name | VARCHAR(50) | Required |
| middle_name | VARCHAR(50) | Nullable |
| last_name | VARCHAR(50) | Required |
| email | VARCHAR(100) |  |
| phone | VARCHAR(20) | 09171234567. Nullable |
| address | VARCHAR(255) | Nullable |
| birth_date | DATE | Nullable |
| hire_date | DATE |  |
| department_id | INT UNSIGNED | FK → departments.id |
| position | VARCHAR(100) | Cashier, Delivery Rider |
| employment_type | VARCHAR(20) | regular / probationary / contractual |
| daily_rate | DECIMAL(12,2) | 650.00. Used by payroll |
| vacation_leave_balance | INT | Whole days left. Emergency leave also uses this balance. Default 5 |
| sick_leave_balance | INT | Whole days left. Default 5 |
| status | VARCHAR(20) | active / inactive / resigned. Default active |
| *check* | | Leave balances never below 0 |

**users**: Staff login accounts. **One per employee, joined to employees.** Customers are not here (see customers).

| Column | Type | Rules |
|------------------------------|----------------------|--------------------------------------------------------------------------------|
| id | INT UNSIGNED | PK, auto-increment. Used for joins and foreign keys |
| user_code | VARCHAR(20) | Unique, USR-0001. Display code, set by the afterCreate hook |
| employee_id | INT UNSIGNED | FK → employees.id. Required, one login per employee |
| username | VARCHAR(50) |  |
| password | VARCHAR(255) | bcrypt hash (bcrypt.hash(password, 10)) |
| role | VARCHAR(20) | One role from the status list |
| status | VARCHAR(20) | active / disabled. Default active |
| last_login_at | DATETIME | Nullable |

**leave_requests**

| Column | Type | Rules |
|------------------------------|----------------------|--------------------------------------------------------------------------------|
| id | INT UNSIGNED | PK, auto-increment. Used for joins and foreign keys |
| leave_code | VARCHAR(20) | Unique, LVE-0001. Display code, set by the afterCreate hook |
| employee_id | INT UNSIGNED | FK → employees.id |
| leave_type | VARCHAR(20) | vacation / sick / emergency / unpaid |
| start_date | DATE |  |
| end_date | DATE |  |
| days | INT | Working days covered (rest days and holidays not counted). Whole days only |
| reason | VARCHAR(255) | Nullable |
| status | VARCHAR(20) | pending / approved / rejected / cancelled. Default pending |
| approved_by_id | INT UNSIGNED | FK → employees.id (HR staff who decided). Nullable |
| *check* | | end_date on or after start_date; days above 0 |

**payroll_runs**: One per pay period. **Paid** is not a status here: a run is paid when its salary_releases row is released.

| Column | Type | Rules |
|------------------------------|----------------------|--------------------------------------------------------------------------------|
| id | INT UNSIGNED | PK, auto-increment. Used for joins and foreign keys |
| payroll_code | VARCHAR(20) | Unique, PAY-0001. Display code, set by the afterCreate hook |
| period_start | DATE | 2026-10-01 |
| period_end | DATE | 2026-10-15 |
| employee_count | INT |  |
| total_gross | DECIMAL(12,2) | Sum of payroll_items.gross_pay |
| total_contributions | DECIMAL(12,2) | Employee share of SSS + PhilHealth + Pag-IBIG |
| total_withholding_tax | DECIMAL(12,2) |  |
| total_net | DECIMAL(12,2) | gross − contributions − tax |
| status | VARCHAR(20) | draft / approved. Approved runs are locked. Default draft |
| prepared_by_id | INT UNSIGNED | FK → employees.id (HR staff) |
| approved_by_id | INT UNSIGNED | FK → employees.id (admin). Nullable |
| approved_at | DATETIME | Nullable |
| *unique* | | (period_start, period_end) together |
| *check* | | period_end on or after period_start |

**payroll_items**: One per employee per run = the payslip.

| Column | Type | Rules |
|------------------------------|----------------------|--------------------------------------------------------------------------------|
| id | INT UNSIGNED | PK, auto-increment. Used for joins and foreign keys |
| payroll_run_id | INT UNSIGNED | FK → payroll_runs.id |
| employee_id | INT UNSIGNED | FK → employees.id |
| daily_rate | DECIMAL(12,2) | Snapshot |
| days_worked | INT | days_present from the Attendance summary (late days included) |
| paid_leave_days | INT | Approved vacation, sick or emergency leave in the period |
| paid_holiday_days | INT | Regular holidays in the period |
| unpaid_days | INT | Absences + unpaid leave |
| late_minutes | INT | From the Attendance summary |
| undertime_minutes | INT | From the Attendance summary |
| basic_pay | DECIMAL(12,2) | (days_worked + paid_leave_days + paid_holiday_days) × daily_rate |
| tardiness_deduction | DECIMAL(12,2) | (daily_rate ÷ 480) × (late_minutes + undertime_minutes) |
| gross_pay | DECIMAL(12,2) | basic_pay − tardiness_deduction |
| sss | DECIMAL(12,2) | Employee share |
| philhealth | DECIMAL(12,2) | Employee share |
| pagibig | DECIMAL(12,2) | Employee share |
| withholding_tax | DECIMAL(12,2) |  |
| net_pay | DECIMAL(12,2) | gross_pay − sss − philhealth − pagibig − withholding_tax |
| *unique* | | (payroll_run_id, employee_id) together |

### POS with Inventory and Purchasing (Bren)

**categories**

| Column | Type | Rules |
|------------------------------|----------------------|--------------------------------------------------------------------------------|
| id | INT UNSIGNED | PK, auto-increment. Used for joins and foreign keys |
| category_code | VARCHAR(20) | Unique, CAT-0001. Display code, set by the afterCreate hook |
| name | VARCHAR(100) | Fresh Produce, Frozen Goods, Dry Goods |

**products**

| Column | Type | Rules |
|------------------------------|----------------------|--------------------------------------------------------------------------------|
| id | INT UNSIGNED | PK, auto-increment. Used for joins and foreign keys |
| product_code | VARCHAR(20) | Unique, PRD-0001. Display code, set by the afterCreate hook |
| name | VARCHAR(150) | Calamansi 1kg Pack |
| description | TEXT | Nullable |
| category_id | INT UNSIGNED | FK → categories.id |
| unit | VARCHAR(10) | pc / kg / pack / box / tray |
| cost_price | DECIMAL(12,2) | Weighted average cost per unit. Updated when a purchase order is received. Used for COGS. Never shown in the Shop |
| selling_price | DECIMAL(12,2) |  |
| reorder_level | INT | Low-stock alert when quantity_on_hand ≤ this. Default 10 |
| is_online | BOOLEAN | 1 = shown in the Online Shop. Default 1 |
| image_url | VARCHAR(255) | Nullable |
| status | VARCHAR(20) | active / inactive. Default active |

**stock_levels**: One row per product.

| Column | Type | Rules |
|------------------------------|----------------------|--------------------------------------------------------------------------------|
| id | INT UNSIGNED | PK, auto-increment. Used for joins and foreign keys |
| product_id | INT UNSIGNED | FK → products.id, unique |
| quantity_on_hand | INT | Never below 0. Changed only by stockService. Default 0 |
| *check* | | quantity_on_hand never below 0 |

**stock_movements**: Every change to stock, no exceptions.

| Column | Type | Rules |
|------------------------------|----------------------|--------------------------------------------------------------------------------|
| id | INT UNSIGNED | PK, auto-increment. Used for joins and foreign keys |
| movement_code | VARCHAR(20) | Unique, STK-0001. Display code, set by the afterCreate hook |
| product_id | INT UNSIGNED | FK → products.id |
| movement_type | VARCHAR(20) | opening / stock_in / sale / online_order / adjustment / return |
| quantity_change | INT | +50 for stock in, −3 for a sale |
| quantity_before | INT |  |
| quantity_after | INT |  |
| unit_cost | DECIMAL(12,2) | Cost per unit at that moment |
| sale_id | INT UNSIGNED | FK → sales.id. Set for sale, and for return of a voided sale. Nullable |
| order_id | INT UNSIGNED | FK → orders.id (Shop). Set for online_order, and for return of a cancelled or returned order. Nullable |
| purchase_order_id | INT UNSIGNED | FK → purchase_orders.id. Set for stock_in. Nullable |
| remarks | VARCHAR(255) | Required for adjustment. Nullable |
| employee_id | INT UNSIGNED | FK → employees.id. Who did it. Null for online orders |
| *check* | | Exactly the right source is set: stock_in → purchase_order_id; sale → sale_id; online_order → order_id; return → sale_id or order_id; opening and adjustment → none |
| *check* | | An adjustment must have remarks |

**suppliers**

| Column | Type | Rules |
|------------------------------|----------------------|--------------------------------------------------------------------------------|
| id | INT UNSIGNED | PK, auto-increment. Used for joins and foreign keys |
| supplier_code | VARCHAR(20) | Unique, SUP-0001. Display code, set by the afterCreate hook |
| name | VARCHAR(150) | Mindoro Fresh Farms Cooperative |
| contact_person | VARCHAR(100) | Nullable |
| phone | VARCHAR(20) | Nullable |
| email | VARCHAR(100) | Nullable |
| address | VARCHAR(255) | Nullable |
| status | VARCHAR(20) | active / inactive. Default active |

**purchase_orders**

| Column | Type | Rules |
|------------------------------|----------------------|--------------------------------------------------------------------------------|
| id | INT UNSIGNED | PK, auto-increment. Used for joins and foreign keys |
| purchase_order_code | VARCHAR(20) | Unique, PUR-0001. Display code, set by the afterCreate hook |
| supplier_id | INT UNSIGNED | FK → suppliers.id |
| employee_id | INT UNSIGNED | FK → employees.id. Who made the order |
| order_date | DATE |  |
| expected_date | DATE | Nullable |
| total_cost | DECIMAL(12,2) | Sum of line totals |
| payment_method | VARCHAR(20) | cash / on_account |
| status | VARCHAR(20) | draft / ordered / received / cancelled. Default draft |
| received_at | DATETIME | Nullable |

**purchase_order_items**

| Column | Type | Rules |
|------------------------------|----------------------|--------------------------------------------------------------------------------|
| id | INT UNSIGNED | PK, auto-increment. Used for joins and foreign keys |
| purchase_order_id | INT UNSIGNED | FK → purchase_orders.id |
| product_id | INT UNSIGNED | FK → products.id |
| quantity | INT |  |
| unit_cost | DECIMAL(12,2) |  |
| line_total | DECIMAL(12,2) | quantity × unit_cost |
| *check* | | quantity above 0 |

**sales**: In-store sales.

| Column | Type | Rules |
|------------------------------|----------------------|--------------------------------------------------------------------------------|
| id | INT UNSIGNED | PK, auto-increment. Used for joins and foreign keys |
| sale_code | VARCHAR(20) | Unique, SAL-0001. Display code, set by the afterCreate hook |
| employee_id | INT UNSIGNED | FK → employees.id. The cashier |
| subtotal | DECIMAL(12,2) |  |
| discount_amount | DECIMAL(12,2) | Default 0.00 |
| total_amount | DECIMAL(12,2) | subtotal − discount_amount |
| total_cost | DECIMAL(12,2) | Sum of quantity × unit_cost. For COGS |
| amount_paid | DECIMAL(12,2) |  |
| change_amount | DECIMAL(12,2) |  |
| payment_method | VARCHAR(20) | cash / gcash / card |
| status | VARCHAR(20) | completed / voided. Default completed |
| void_reason | VARCHAR(255) | Required when voided. Nullable |
| sold_at | DATETIME |  |
| *check* | | A voided sale must have a void_reason |

**sale_items**

| Column | Type | Rules |
|------------------------------|----------------------|--------------------------------------------------------------------------------|
| id | INT UNSIGNED | PK, auto-increment. Used for joins and foreign keys |
| sale_id | INT UNSIGNED | FK → sales.id |
| product_id | INT UNSIGNED | FK → products.id |
| product_name | VARCHAR(150) | Snapshot |
| quantity | INT |  |
| unit_price | DECIMAL(12,2) | Price at time of sale |
| unit_cost | DECIMAL(12,2) | Cost at time of sale |
| line_total | DECIMAL(12,2) | quantity × unit_price |
| *check* | | quantity above 0 |

### Online Shop (Ali)

**customers**: Shop accounts. Customers log in **only** to the Shop, with this table.

| Column | Type | Rules |
|------------------------------|----------------------|--------------------------------------------------------------------------------|
| id | INT UNSIGNED | PK, auto-increment. Used for joins and foreign keys |
| customer_code | VARCHAR(20) | Unique, CUS-0001. Display code, set by the afterCreate hook |
| first_name | VARCHAR(50) |  |
| last_name | VARCHAR(50) |  |
| email | VARCHAR(100) | Used to log in |
| password | VARCHAR(255) | bcrypt hash |
| phone | VARCHAR(20) | Nullable |
| address | VARCHAR(255) | Nullable |
| city | VARCHAR(100) | Calapan City. Nullable |
| status | VARCHAR(20) | active / disabled. Default active |

**cart_items**

| Column | Type | Rules |
|------------------------------|----------------------|--------------------------------------------------------------------------------|
| id | INT UNSIGNED | PK, auto-increment. Used for joins and foreign keys |
| customer_id | INT UNSIGNED | FK → customers.id |
| product_id | INT UNSIGNED | FK → products.id (POS) |
| quantity | INT |  |
| *unique* | | (customer_id, product_id) together |
| *check* | | quantity above 0 |

**orders**

| Column | Type | Rules |
|------------------------------|----------------------|--------------------------------------------------------------------------------|
| id | INT UNSIGNED | PK, auto-increment. Used for joins and foreign keys |
| order_code | VARCHAR(20) | Unique, ORD-0001. Display code, set by the afterCreate hook |
| customer_id | INT UNSIGNED | FK → customers.id |
| subtotal | DECIMAL(12,2) |  |
| shipping_fee | DECIMAL(12,2) | Posted to 4030 Delivery Fee Income. Default 0.00 |
| total_amount | DECIMAL(12,2) | subtotal + shipping_fee |
| total_cost | DECIMAL(12,2) | Sum of order_items quantity × unit_cost. For COGS |
| payment_method | VARCHAR(20) | cod / gcash |
| payment_status | VARCHAR(20) | unpaid / paid / refunded. Default unpaid |
| order_status | VARCHAR(20) | Status list. Default pending |
| delivery_address | VARCHAR(255) |  |
| ordered_at | DATETIME |  |
| delivered_at | DATETIME | Nullable |

**order_items**

| Column | Type | Rules |
|------------------------------|----------------------|--------------------------------------------------------------------------------|
| id | INT UNSIGNED | PK, auto-increment. Used for joins and foreign keys |
| order_id | INT UNSIGNED | FK → orders.id |
| product_id | INT UNSIGNED | FK → products.id (POS) |
| product_name | VARCHAR(150) | Snapshot |
| quantity | INT |  |
| unit_price | DECIMAL(12,2) | Snapshot |
| unit_cost | DECIMAL(12,2) | Snapshot, returned by stockService.deductStock |
| line_total | DECIMAL(12,2) | quantity × unit_price |
| *check* | | quantity above 0 |

**product_reviews**: One review per customer per product, written from a delivered order. Added in v2.3 (migration 003).

| Column | Type | Rules |
|------------------------------|----------------------|--------------------------------------------------------------------------------|
| id | INT UNSIGNED | PK, auto-increment. Used for joins and foreign keys |
| customer_id | INT UNSIGNED | FK → customers.id |
| product_id | INT UNSIGNED | FK → products.id (POS) |
| order_id | INT UNSIGNED | FK → orders.id. The delivered (or returned) order that proves the purchase |
| rating | TINYINT UNSIGNED | 1 to 5 stars |
| comment | VARCHAR(500) | Nullable |
| status | VARCHAR(20) | visible / hidden. Hidden by the admin, never deleted. Default visible |
| *unique* | | (customer_id, product_id) together: writing again updates the same review |
| *check* | | rating between 1 and 5 |

### Attendance (Brian)

**holidays**: Non-working days. No log is expected on these dates.

| Column | Type | Rules |
|------------------------------|----------------------|--------------------------------------------------------------------------------|
| id | INT UNSIGNED | PK, auto-increment. Used for joins and foreign keys |
| holiday_date | DATE | 2026-12-25 |
| name | VARCHAR(100) | Christmas Day |
| holiday_type | VARCHAR(20) | regular (paid even if not worked) / special (no work, no pay) |

**attendance_logs**: One row per employee per working day.

| Column | Type | Rules |
|------------------------------|----------------------|--------------------------------------------------------------------------------|
| id | INT UNSIGNED | PK, auto-increment. Used for joins and foreign keys |
| log_code | VARCHAR(20) | Unique, ATT-0001. Display code, set by the afterCreate hook |
| employee_id | INT UNSIGNED | FK → employees.id. Unique together with log_date |
| log_date | DATE |  |
| time_in | DATETIME | Nullable |
| lunch_out | DATETIME | Nullable. Set by the kiosk's Lunch out step (v2.4, migration 002) |
| lunch_in | DATETIME | Nullable. Set by the kiosk's Lunch in step (v2.4, migration 002) |
| time_out | DATETIME | Null = forgot to time out (shown on the corrections list) |
| hours_worked | DECIMAL(5,2) | Computed at time out, minus a fixed 1-hour lunch (even if the recorded lunch is shorter or longer), max 8.00. Default 0.00 |
| late_minutes | INT | Minutes after SHIFT_START. Default 0 |
| undertime_minutes | INT | Minutes before SHIFT_END. Default 0 |
| status | VARCHAR(20) | present / late / absent / on_leave |
| remarks | VARCHAR(255) | Required on a correction. Nullable |
| corrected_by_id | INT UNSIGNED | FK → employees.id. Set when HR or admin edits the log. Nullable |
| *unique* | | (employee_id, log_date) together |
| *check* | | time_out not earlier than time_in |
| *check* | | `chk_attendance_lunch`: lunch_in needs lunch_out, and time_in ≤ lunch_out ≤ lunch_in ≤ time_out |

### Accounting & Finance (Jean)

**accounts**: Chart of accounts.

| Column | Type | Rules |
|------------------------------|----------------------|--------------------------------------------------------------------------------|
| id | INT UNSIGNED | PK, auto-increment. Used for joins and foreign keys |
| account_code | VARCHAR(10) | 4 digits, 1010 |
| account_name | VARCHAR(100) |  |
| account_type | VARCHAR(20) | asset / liability / equity / revenue / expense |
| normal_balance | VARCHAR(10) | debit / credit |
| is_active | BOOLEAN | Default 1 |

**journal_entries**: One per business event.

| Column | Type | Rules |
|------------------------------|----------------------|--------------------------------------------------------------------------------|
| id | INT UNSIGNED | PK, auto-increment. Used for joins and foreign keys |
| entry_code | VARCHAR(20) | Unique, TXN-0001. Display code, set by the afterCreate hook |
| entry_date | DATE | Date of the event (sold_at, delivered_at, received_at…), not the posting date |
| description | VARCHAR(255) | POS sale SAL-0001 |
| source_module | VARCHAR(20) | shop / pos / hr / accounting |
| entry_type | VARCHAR(20) | Status list |
| reference_code | VARCHAR(20) | SAL-0001, ORD-0001, PUR-0001, STK-0001, PAY-0001, REL-0001, REM-0001. Null for manual entries |
| total_debit | DECIMAL(12,2) | Must equal total_credit |
| total_credit | DECIMAL(12,2) |  |
| status | VARCHAR(20) | posted / voided. Default posted |
| posted_by_id | INT UNSIGNED | FK → employees.id. Null for automatic entries |
| *unique* | | (source_module, entry_type, reference_code) together |
| *check* | | total_debit = total_credit |

**journal_lines**

| Column | Type | Rules |
|------------------------------|----------------------|--------------------------------------------------------------------------------|
| id | INT UNSIGNED | PK, auto-increment. Used for joins and foreign keys |
| journal_entry_id | INT UNSIGNED | FK → journal_entries.id |
| account_id | INT UNSIGNED | FK → accounts.id |
| debit | DECIMAL(12,2) | Default 0.00 |
| credit | DECIMAL(12,2) | Default 0.00 |
| memo | VARCHAR(255) | Nullable |
| *check* | | Each line is either a debit or a credit, above 0 |

**salary_releases**: One per approved payroll run.

| Column | Type | Rules |
|------------------------------|----------------------|--------------------------------------------------------------------------------|
| id | INT UNSIGNED | PK, auto-increment. Used for joins and foreign keys |
| release_code | VARCHAR(20) | Unique, REL-0001. Display code, set by the afterCreate hook |
| payroll_run_id | INT UNSIGNED | FK → payroll_runs.id, unique. Totals are read from the run, not copied |
| release_method | VARCHAR(20) | bank_transfer / cash. Nullable |
| status | VARCHAR(20) | pending / released. Default pending |
| released_at | DATETIME | Nullable |
| released_by_id | INT UNSIGNED | FK → employees.id (accountant). Nullable |

**remittances**: Government contributions and tax paid out.

| Column | Type | Rules |
|------------------------------|----------------------|--------------------------------------------------------------------------------|
| id | INT UNSIGNED | PK, auto-increment. Used for joins and foreign keys |
| remittance_code | VARCHAR(20) | Unique, REM-0001. Display code, set by the afterCreate hook |
| agency | VARCHAR(20) | sss / philhealth / pagibig / bir |
| period_month | VARCHAR(7) | 2026-10 |
| amount | DECIMAL(12,2) |  |
| reference_number | VARCHAR(50) | Agency receipt number. Nullable |
| status | VARCHAR(20) | pending / paid. Default pending |
| paid_at | DATETIME | Nullable |
| recorded_by_id | INT UNSIGNED | FK → employees.id. Nullable |
| *unique* | | (agency, period_month) together |


**Chart of accounts (seeded):** 1010 Cash on Hand, 1020 Cash in Bank / E-Wallet, 1200 Merchandise Inventory, 2010 Accounts Payable, 2100 Salaries Payable, 2110 Government Contributions Payable, 2120 Withholding Tax Payable, 3010 Owner's Capital, 4010 Sales Revenue – POS, 4020 Sales Revenue – Online, 4030 Delivery Fee Income, 5010 Cost of Goods Sold, 6010 Salaries Expense, 6020 Rent Expense, 6030 Utilities Expense, 6040 Inventory Loss and Spoilage. The seed also posts the opening balances (TXN-0001: cash ₱20,000.00, bank ₱100,000.00, opening stock ₱55,525.00, owner's capital ₱175,525.00), so the trial balance is right from day one.

## 5. Shared Code Contract

With one database there is no REST API between modules. The bridge is **shared code**: a few files written once in `shared/` by their owner and copied into every module by `node shared/sync.js` (Section 8). If a file is not in this list, it is not shared. A module's own partials (for example the Shop's SweetAlert2 `alert/swal.xian`) stay in that module.

| File | Owner | Used by | What it does |
|-------------------------------------------------------------|--------------------------------------|---------------------------------------------------|------------------------------------------------------------------------------------------|
| `config/database.js` | Fate (HR) | All 5 | Sequelize settings from Section 3 |
| `models/*.js` + `models/index.js` | Each table's owner | All 5 | One model per table (27) and all associations |
| `services/authService.js` | Fate (HR) | HR, POS, Attendance, Accounting | `login(username, password)` |
| `services/stockService.js` | Bren (POS) | POS, Shop | `deductStock(...)`, `returnStock(...)`, `receiveStock(...)` |
| `services/attendanceService.js` | Brian | Attendance, HR | `getSummary(dateFrom, dateTo)`, `closeDays(upToDate)` |
| `middleware/requireRole.js` | Fate (HR) | All staff modules | Page guard by role. Sends refused users to `STAFF_LOGIN_PATH` (default `/login`) |
| `utils/appError.js` | Fate (HR) | All 5 | `throw new AppError("INSUFFICIENT_STOCK", "Only 2 left of Calamansi 1kg Pack.")` |
| `utils/money.js` | Jean | All 5 | `round2()`, `peso()` → ₱1,250.50 |
| `utils/dates.js` | Brian | All 5 | Manila date helpers, `isWorkingDay(date)` |
| `views/partials/head.xian`, `footer.xian` | Ali | All 5 | Same font, colours and page frame. Needs `public/css/app.css` and `public/fonts` from `module-template/` |
| `sync.js` (tool, not copied) | Ali | Everyone, after every `git pull` | Copies the folders above into each module |
| `check-connection.js` (tool, not copied) | Ali | Everyone | `node shared/check-connection.js hr` tests that module's `.env`, network, database login, tables and a rolled-back test write |
| `database/migrations/*.sql` | Whoever proposes the change | DB host and solo laptops | One file per agreed schema change, run once in phpMyAdmin |

**Errors.** Shared services throw `AppError(code, message)`. Controllers catch it and show `message` with `req.flash`, never an Express error page.

| Code | When |
|-----------------------------------------------------------|--------------------------------------------------------------------------------------------------------------|
| INVALID_LOGIN | Wrong username or password |
| ACCOUNT_DISABLED | User disabled, or employee inactive or resigned |
| PRODUCT_UNAVAILABLE | Product inactive or not found |
| INSUFFICIENT_STOCK | Not enough stock for one of the items (nothing is deducted) |
| DUPLICATE | Stock already deducted or returned for this reference, or the event already posted |
| VALIDATION_ERROR | Bad input (for example an adjustment without remarks) |

### stockService (owner: Bren)

`deductStock` and `returnStock` **must run inside the caller's transaction**, so the order or sale and its stock change succeed or fail together.

```js
// shared/services/stockService.js
import { Product, StockLevel, StockMovement } from "../models/index.js";
import { AppError } from "../utils/appError.js";

// items: [{ product_id, quantity }]. Pass sale_id (POS) OR order_id (Shop), never both.
export async function deductStock({ items, sale_id = null, order_id = null, employee_id = null }, t) {
  if (!t) throw new Error("deductStock must run inside a transaction");
  if (!sale_id === !order_id) throw new Error("Pass exactly one of sale_id or order_id");
  const movement_type = sale_id ? "sale" : "online_order";
  const source = sale_id ? { sale_id } : { order_id };
  const already = await StockMovement.count({ where: { ...source, movement_type }, transaction: t });
  if (already) throw new AppError("DUPLICATE", "Stock for this sale or order was already deducted.");

  const sorted = [...items].sort((a, b) => a.product_id - b.product_id); // same lock order everywhere
  const results = [];
  for (const { product_id, quantity } of sorted) {
    const product = await Product.findByPk(product_id, { transaction: t });
    if (!product || product.status !== "active")
      throw new AppError("PRODUCT_UNAVAILABLE", `Product ${product?.product_code ?? product_id} is not available.`);

    const level = await StockLevel.findOne({ where: { product_id }, transaction: t, lock: t.LOCK.UPDATE });
    if (level.quantity_on_hand < quantity)
      throw new AppError("INSUFFICIENT_STOCK", `Only ${level.quantity_on_hand} left of ${product.name}.`);

    const before = level.quantity_on_hand;
    level.quantity_on_hand = before - quantity;
    await level.save({ transaction: t });

    const movement = await StockMovement.create({
      product_id, movement_type, quantity_change: -quantity,
      quantity_before: before, quantity_after: level.quantity_on_hand,
      unit_cost: product.cost_price, ...source, employee_id
    }, { transaction: t });
    results.push({ product_id, unit_cost: product.cost_price, movement_code: movement.movement_code });
  }
  return results; // the caller saves unit_cost into its sale_items / order_items
}
```

- `returnStock({ sale_id | order_id, employee_id }, t)` reads the `sale` or `online_order` movements for that sale or order and adds the same quantities back as `return` movements, at the same `unit_cost`. Returning twice throws DUPLICATE.
- `receiveStock({ purchase_order_id, employee_id }, t)` is used only by POS. For each line it adds the quantity, writes a `stock_in` movement, and sets **weighted average cost**: `new_cost = round2((qty_on_hand × cost_price + qty_received × unit_cost) ÷ (qty_on_hand + qty_received))`.
- Adjustments (POS only) go through `adjustStock({ product_id, quantity_change, remarks, employee_id }, t)`. Remarks are required, and stock can never go below 0.

### attendanceService (owner: Brian)

`getSummary("2026-10-01", "2026-10-15")` returns one row per active employee:

```js
[{ employee_id: 2, employee_code: "EMP-0002",
   days_present: 10,      // present + late
   days_late: 2, days_absent: 1, days_on_leave: 1,
   late_minutes: 25, undertime_minutes: 30, hours_worked: 79.50 }]
```

It first calls `closeDays(period_end or yesterday)`, so every past working day has a row for every active employee.

## 6. Authentication

**One staff account, one table pair: `users` joined to `employees`.** Every staff module's `/login` page calls the same shared `authService.login()`, which reads the shared tables directly. No token or API key is needed. Each module keeps its own session (different ports), so a user logs in to each module they open, with the same username and password everywhere.

```js
// shared/services/authService.js (owner: Fate)
import bcrypt from "bcrypt";
import { User, Employee } from "../models/index.js";
import { AppError } from "../utils/appError.js";

export async function login(username, password) {
  const user = await User.findOne({ where: { username }, include: Employee });
  if (!user || !(await bcrypt.compare(password, user.password)))
    throw new AppError("INVALID_LOGIN", "Wrong username or password.");
  if (user.status !== "active" || user.Employee.status !== "active")
    throw new AppError("ACCOUNT_DISABLED", "This account is disabled.");
  await user.update({ last_login_at: new Date() });
  const e = user.Employee;
  return { user_id: user.id, employee_id: e.id, employee_code: e.employee_code,
           role: user.role, full_name: `${e.first_name} ${e.last_name}` };
}
```

### Login steps (every staff module)

1. The user opens the module's `/login` page (from the XianFire CRUD template) and types username and password.
2. `authController.js` calls `authService.login()`.
3. On success the module saves the result in `req.session.user` and redirects to `/dashboard`. On failure it shows the error's message.
4. `/logout` destroys the session (`req.session.destroy()`).

A disabled user, or an employee who is inactive or resigned, cannot log in. A session that is already open stays open until logout, which is fine for this project.

**Customers** register and log in only in the Shop, against the Shop's own `customers` table (email + bcrypt password). The Shop keeps them in `req.session.customer`, separate from staff sessions. A customer whose `status` is set to `disabled` by the admin cannot log in, and an open session is logged out on the next click.

### Roles and access

| Role | Online Shop | POS | Attendance | HR | Accounting |
|----------------------------|------------------------------------------|---------------------------------------------------------------------|---------------------------------------|------------------------------------------------------------|-------------------------------------------------------------------------|
| admin | Full: orders (status, cancel, return), customer accounts, product photos, reviews (hide / show), sales report | Full | Full | Full, **approves payroll** | Full |
| cashier |  | Sell, void with reason, view stock | Own time in/out | Own profile, own leave, own payslip |  |
| inventory_staff |  | Products, stock, adjustments, suppliers, purchase orders | Own time in/out | Own profile, own leave, own payslip |  |
| hr_staff |  |  | View all logs, corrections | Full: employees, users, leaves, prepare payroll | View salary release status |
| accountant | View orders, sales report | View sales, purchase orders, stock movements |  | View employees, view approved payroll | Full: posting, journal, salary release, remittances, reports |
| employee |  |  | Own time in/out, own logs | Own profile, file leave, own payslip |  |

Each module guards its pages with one middleware, `requireRole("cashier", "admin")`, that reads `req.session.user.role` and redirects to the module's staff login if it does not match: `STAFF_LOGIN_PATH` in `.env`, or `/login` if it is not set. Use the role names exactly as written above.

The Shop's `/login` is for customers, so its staff log in at **`/admin/login`** (`STAFF_LOGIN_PATH=/admin/login` in `shop/.env`). Only admin and accountant may log in there; other roles get "Your account cannot use the Shop admin."

### Seed accounts (in seed.sql, for testing)

| Username | Password | Role | Employee |
|-----------------------------------------|-----------------------------------|-----------------------------------|-----------------------------------------------------------------------|
| admin | Admin@2026 | admin | EMP-0001 Roberto Dela Cruz |
| maria.cashier | Cashier@2026 | cashier | EMP-0002 Maria Santos |
| jose.inventory | Inventory@2026 | inventory_staff | EMP-0003 Jose Ramos |
| liza.hr | Hr@2026 | hr_staff | EMP-0004 Liza Mendoza |
| carla.accountant | Accountant@2026 | accountant | EMP-0005 Carla Villanueva |
| pedro.employee | Employee@2026 | employee | EMP-0006 Pedro Garcia |
| (no login) |  |  | EMP-0007 Ramon Bautista, delivery rider: kiosk only |
| ana.reyes@example.com | Customer@2026 | Shop customer | CUS-0001 Ana Reyes (Shop login) |

## 7. Integration Flows

**Golden rule:** a business action and its stock change happen in **one transaction**, so there is never half a sale. Accounting posts afterwards by reading finished records, so a sale never depends on the Accounting app being open.

### A. Customer buys online

1. The customer registers or logs in to the Shop (`customers` table).
2. The Shop lists products straight from POS's tables: `products` join `stock_levels` where `is_online = 1` and `status = 'active'`. Quantity 0 shows "Out of stock". `cost_price` is never shown.
3. Add to cart: `cart_items` keeps `product_id` + quantity only.
4. Checkout, all in one `sequelize.transaction()`:
   - create the order (ORD-0007), `order_status = pending`, `payment_status = unpaid` (COD) or `paid` (GCash);
   - call `stockService.deductStock({ items, order_id: order.id }, t)`;
   - save `order_items` with price snapshots and the `unit_cost` returned, then `orders.total_cost`;
   - clear the cart.
   If any item is short, everything rolls back and the customer sees "Only 2 left of Calamansi 1kg Pack."
5. Admin moves the order to confirmed → out_for_delivery → delivered, one step at a time (no skipping). On delivered, set `payment_status = paid` and `delivered_at`.
6. **Cancelled before delivery:** the customer can cancel while the order is `pending`; the admin can cancel it while `pending`, `confirmed` or `out_for_delivery` (failed delivery). In one transaction: `order_status = cancelled`, `stockService.returnStock(...)`, and `payment_status = refunded` if it was GCash. No accounting entry, because a sale is posted only on delivery.
7. **Returned after delivery:** the admin records it. In one transaction, `order_status = returned`, `payment_status = refunded`, and `returnStock(...)`. Accounting posts a reversal.
8. **Profile:** the customer can edit their name, phone and address and change their password. The address is also saved at each checkout.
9. **Customer accounts:** the admin can disable or enable a customer (`customers.status`). Old orders stay.
10. **Product reviews:** on My orders, each item of a delivered (or returned) order has **Rate this product** (1–5 stars + optional comment, up to 500 characters). Writing again updates the same review. The product page and product cards show the average and the reviews with a *Verified purchase* badge and the name as "Ana R.". The admin can hide a rude or off-topic review (kept, not deleted) and show it again.
11. **Product photos:** the admin uploads a JPG, PNG or WebP (up to 2 MB) for each product on the Shop admin's *Product photos* page. The file is kept in `shop/public/images/products`; POS's `image_url` is shown first if POS sets one.
12. **Sales report** (admin and accountant, read only, printable): delivered orders for a date range, counted on the Manila date of `delivered_at` — the same date Accounting posts them — with totals, sales by day, by payment method and by product, plus returned orders and refunds. `cost_price` is never shown.

```js
await sequelize.transaction(async (t) => {
  const order = await Order.create({ customer_id, subtotal, shipping_fee, total_amount, total_cost: 0,
    payment_method, payment_status, delivery_address, ordered_at: new Date() }, { transaction: t });
  const deducted = await deductStock({ items, order_id: order.id }, t);
  // ...create order_items with each unit_cost, update order.total_cost, clear cart_items
});
```

### B. Cashier sells at POS

1. The cashier logs in. POS reads `employee_id` from `req.session.user`.
2. The cashier picks products (active, stock above 0), enters quantity, payment method and amount paid.
3. In one transaction POS saves `sales` + `sale_items` and calls `deductStock({ items, sale_id: sale.id, employee_id }, t)`. `unit_cost` comes from the reply.
4. POS shows the printable receipt (SAL-0015, cashier name, items, total, change).
5. **Void:** in one transaction POS sets `status = voided` with a `void_reason` and calls `returnStock(...)`. Accounting posts a reversal only if the sale had already been posted; otherwise it posts nothing.

### C. Stock is purchased or adjusted

1. Inventory staff adds the supplier once (SUP-0001, Mindoro Fresh Farms Cooperative).
2. Inventory staff creates purchase order PUR-0012: supplier, products, quantity, unit_cost, payment method (cash or on_account). Status draft → ordered.
3. When the goods arrive, staff clicks **Receive**. In one transaction POS sets `status = received` and `received_at`, and calls `receiveStock(...)`, which adds stock, writes `stock_in` movements and updates the weighted average `cost_price`. Only an `ordered` purchase order can be received.
4. A purchase order is received in full, once. If the supplier delivers less, receive it and fix the difference with an adjustment.
5. **Adjustment** (spoiled, damaged, counting error): `adjustStock(...)` with required remarks. Stock can never go below 0. Accounting posts it to 6040 Inventory Loss and Spoilage.
6. **Low stock:** the POS dashboard lists products where `quantity_on_hand <= reorder_level`, with a button to start a new purchase order.
7. **New product or new price:** the Shop sees it right away because it reads the same tables. Old sales and orders keep their snapshot price.

### D. Employee clocks in and out

1. The employee types their employee code (or scans an ID QR) on the Attendance **kiosk page**. This is an ordinary web form posting to `/kiosk/punch`; no login is needed on the kiosk. One button shows the next step for that employee today: Time in → Lunch out → Lunch in → Time out, and a confirmation card shows the name, the step and the time.
2. Attendance looks up `employees` by `employee_code`. If not found or not active, it rejects.
3. **Time in:** create today's log, `time_in = now`. If later than `SHIFT_START`, set `late_minutes` and `status = late`, else `present`. Time in on a rest day or holiday is refused unless the admin allows it.
4. **Lunch out / lunch in:** set `lunch_out`, then `lunch_in`. They are recorded only; pay still deducts a fixed 1 hour.
5. **Time out:** set `time_out`, compute `hours_worked` (minus 1-hour lunch, max 8.00) and `undertime_minutes` if earlier than `SHIFT_END`.
6. A second time in on the same day is refused (unique `employee_id + log_date`). A repeat tap within 1 minute and a fifth punch after time out are refused too.
7. **Close days:** `attendanceService.closeDays()` runs when the Attendance dashboard opens and before every summary. For each past **working day** (a day in `WORK_DAYS` that is not in `holidays`) and each active employee with no log, it reads `leave_requests`: approved leave covering that day → `on_leave`, none → `absent`. It is safe to run many times.
8. **Corrections:** a log with a time in but no time out shows on the corrections list. HR staff or admin fixes it with required remarks, and `corrected_by_id` is saved.
9. **Filing leave:** the employee files leave in HR (LVE-0004) in whole working days. HR staff approves or rejects it. Approved vacation or emergency leave lowers `vacation_leave_balance`; sick leave lowers `sick_leave_balance`. A leave longer than the balance must be filed as unpaid.

### E. HR adds a new employee

1. HR staff fills the employee form: department, position, daily rate.
2. HR saves the employee. The `afterCreate` hook makes EMP-0008.
3. HR creates the linked login in `users` (USR-0007, role picked by HR staff, `employee_id` set, password hashed with bcrypt). An employee who only uses the kiosk needs no login.
4. Nothing is copied anywhere. EMP-0008 can time in, sell or be paid immediately, because every module reads the same `employees` table.
5. **Resigned employee:** HR sets `employees.status = resigned` and `users.status = disabled`. Login and time in are now refused.

### F. HR prepares payroll

1. HR staff picks the period (1st–15th or 16th–end of month).
2. HR calls `attendanceService.getSummary(period_start, period_end)`.
3. For each active employee HR counts approved paid leave days and regular holidays in the period. Absences not covered by paid leave, plus unpaid leave, are unpaid days.
4. HR computes each payslip in `payroll_items` (basic pay, tardiness deduction, gross, SSS, PhilHealth, Pag-IBIG, withholding tax, net pay). Status draft. A draft can be recomputed.
5. HR staff reviews the draft. **Admin approves** it → `status = approved`, `approved_at`. An approved run is locked.
6. Accounting posts it on its next *Post new transactions* (flow G). HR shows the run as **posted** when a payroll journal entry exists, and as **paid** when its salary release is released.
7. Employees can open their payslip in HR only after the run is paid.

### G. Accounting posts, pays out, and makes reports

**Post new transactions** is one service in Accounting (`services/postingService.js`, not shared). It runs when the Accounting dashboard opens and when the accountant clicks the button. It finds every finished business record that has no journal entry yet and posts each one in its own transaction:

| Records it looks for | entry_type | Debit | Credit |
|---------------------------------------------------------------------------|------------------------------------|------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------|
| sales, status completed | sale | 1010 Cash on Hand (cash) or 1020 Cash in Bank / E-Wallet (GCash, card); 5010 COGS | 4010 Sales Revenue – POS; 1200 Merchandise Inventory |
| sales, status voided, with a posted sale entry | sale_reversal | Reverse the sale lines |  |
| orders, order_status delivered | sale | 1010 (COD) or 1020 (GCash); 5010 COGS | 4020 Sales Revenue – Online (subtotal); 4030 Delivery Fee Income (shipping_fee); 1200 Inventory |
| orders, order_status returned, with a posted sale entry | sale_reversal | Reverse the order lines |  |
| purchase_orders, status received | purchase | 1200 Merchandise Inventory | 1010 Cash on Hand (cash) or 2010 Accounts Payable (on_account) |
| stock_movements, adjustment | stock_adjustment | 6040 Inventory Loss and Spoilage (stock down) or 1200 (stock up) | 1200 (stock down) or 6040 (stock up) |
| payroll_runs, status approved | payroll | 6010 Salaries Expense (gross) | 2110 Gov't Contributions Payable + 2120 Withholding Tax Payable (if above 0) + 2100 Salaries Payable (net) |

The payroll posting also creates salary release REL-0001 with `status = pending`. Manual entries made by the accountant:

| Event | entry_type | Debit | Credit |
|-------------------------------------------------|----------------------------------|-----------------------------------------|-------------------------------------------------------|
| Salaries released | salary_release | 2100 Salaries Payable | 1020 Cash in Bank (or 1010 if cash) |
| Contributions or tax remitted | remittance | 2110 or 2120 | 1020 Cash in Bank |
| Supplier paid later | manual | 2010 Accounts Payable | 1010 or 1020 |
| Rent, utilities | manual | 6020 / 6030 Expense | 1010 or 1020 |

Example query for unposted POS sales (the other record types follow the same pattern):

```sql
SELECT s.id, s.sale_code, s.payment_method, s.total_amount, s.total_cost, DATE(s.sold_at) AS entry_date
FROM sales s
LEFT JOIN journal_entries j
  ON j.source_module = 'pos' AND j.entry_type = 'sale' AND j.reference_code = s.sale_code
WHERE s.status = 'completed' AND j.id IS NULL;
```

- A sale voided before it was ever posted is skipped by both queries, so nothing is posted for it.
- The unique key `source_module + entry_type + reference_code` makes double posting impossible. If two people click *Post* at once, the second insert fails with a duplicate; skip it and continue.
- `entry_date` is the date of the event, not the posting date, so reports land in the right period.
- Every entry is checked before saving: total debit = total credit, or it is not saved.

**Salary release and remittance**

1. The accountant opens the pending release (REL-0001), checks it against HR's payroll run and payslips, picks bank_transfer or cash, and clicks **Release**.
2. In one transaction Accounting posts Dr 2100 Salaries Payable / Cr 1020 Cash in Bank and sets `status = released`, `released_at`, `released_by_id`. HR now shows the run as paid.
3. Each month the accountant records the remittance to SSS, PhilHealth, Pag-IBIG and BIR (REM-0001), which posts Dr 2110 or 2120 / Cr 1020.

**Reports:** journal, general ledger per account, trial balance, income statement, and sales summary (POS vs Online) for any date range, read from `journal_entries` and `journal_lines`.

## 8. Project Structure and Environment

**One group repository, five XianFire apps, one database.** The group repository (`jean12345-6/MindaFresh-ERPSystem`) holds `shared/` and all five module folders. Every member clones it, so **any laptop can run all 5 modules** if a teammate is absent or a laptop fails during checking. Each member edits only their own folder and their own files in `shared/`.

Each member also keeps **their own repository** for their module (for individual checking), with the same `shared/` folder. Code is written once and pushed to both; the group repository is the one used for joint tests and the defence.

### Create the projects (Week 1, once)

```
mkdir mindafresh-erp && cd mindafresh-erp
xianfires new shop         # Ali   (same 4 answers for all: CRUD, MySQL, No, No)
xianfires new pos          # Bren
xianfires new attendance   # Brian
xianfires new hr           # Fate
xianfires new accounting   # Jean

cd accounting
npm install
xian dev                   # development, hot reload
```

Run the generator from the `mindafresh-erp` folder, never from inside another module, or you get a nested project.

**Clean up the generated files before the first run** (they would change the shared tables):

- `migrate.js`: replace it with the one in `module-template/` (it only prints how to import `schema.sql`).
- `create.js` and the generated controllers (including `authController.js`): delete every `await sequelize.sync()` line.
- Copy `module-template/tailwind.config.js` and `module-template/public/` into the module, then build the CSS once with `npx tailwindcss -i public/css/input.css -o public/css/app.css --minify`. `SETUP.md` in the starter kit lists every step.

```
mindafresh-erp/
├── docs/
│   ├── blueprint.md            (this document, exported)
│   └── erd.png                 (export from phpMyAdmin Designer)
├── shared/                     (master copies, "same in all 5")
│   ├── database/
│   │   ├── schema.sql          (the only place tables are defined)
│   │   ├── seed.sql            (test data)
│   │   └── migrations/         (002-attendance-lunch.sql, 003-product-reviews.sql, one file per change)
│   ├── config/database.js
│   ├── models/                 (26 models + index.js with associations)
│   ├── services/               (authService, stockService, attendanceService)
│   ├── middleware/requireRole.js
│   ├── utils/                  (appError.js, money.js, dates.js)
│   ├── views/partials/         (head.xian, footer.xian)
│   ├── sync.js                 (copies shared/ into all 5 modules)
│   └── check-connection.js     (tests one module's database link)
├── module-template/            (tailwind.config.js, public/css, public/fonts, migrate.js)
├── SETUP.md                    (steps to set up a new module)
├── .gitignore                  (node_modules/, .env, .vscode/ — at the repo root)
├── shop/         Ali   – port 3001
├── pos/          Bren  – port 3002
├── attendance/   Brian – port 3003
├── hr/           Fate  – port 3004
└── accounting/   Jean  – port 3005
```

**`node shared/sync.js`** copies `config/`, `models/`, `services/`, `middleware/`, `utils/` and `views/partials/` from `shared/` into each module's own folders. Run it after every `git pull`. Never edit a copied file inside a module; edit the master in `shared/` (only the owner does), commit, and everyone syncs.

In each module's `index.js`: `await sequelize.authenticate()` then `app.listen(PORT)`. **No `sequelize.sync()`.**

### Set up the database host (Week 1, once)

One laptop runs the database for the group (the **DB host**). Pick a laptop that will be on for every joint test and the defence. Everyone uses **Laragon** (MySQL 8.4):

1. Open Laragon and click **Start All**. Click **Database** (or open `http://localhost/phpmyadmin`) and log in as `root` with an empty password.
2. Laragon → Menu → MySQL → `my.ini`: make sure `bind-address` is `0.0.0.0` or commented out, and that **`skip-grant-tables` is commented out** (`# skip-grant-tables`). With it on, the next step fails and any password is accepted. Save, then **Stop** and **Start All**.
3. In phpMyAdmin → SQL, create a group account (the `localhost` lines let the account also work on the DB host itself):

```sql
CREATE USER 'mindafresh'@'%' IDENTIFIED BY 'MindaFresh@2026';
CREATE USER 'mindafresh'@'localhost' IDENTIFIED BY 'MindaFresh@2026';
GRANT ALL PRIVILEGES ON mindafresh_db.* TO 'mindafresh'@'%';
GRANT ALL PRIVILEGES ON mindafresh_db.* TO 'mindafresh'@'localhost';
FLUSH PRIVILEGES;
```

4. phpMyAdmin → Import `shared/database/schema.sql`, then `seed.sql` (then any agreed migrations, in number order).
5. Windows Firewall → allow inbound TCP port **3306** on private networks. Also allow Node.js, so others can open your module's port.
6. Run `ipconfig` and share the DB host's IPv4 address. Everyone puts it in `DB_HOST`.
7. Every member runs `node shared/check-connection.js <module>` from the repo root. It must end with no ✗ before the joint test starts.

### .env for each module

Only `PORT`, `APP_NAME`, `APP_URL` and `SESSION_SECRET` change per module. The database block is the same on every laptop.

```
# --- example: accounting/.env ---
PORT=3005
APP_NAME="MindaFresh Accounting"
APP_URL=http://192.168.1.15:3005
TZ=Asia/Manila
SESSION_SECRET=accounting-session-secret

# --- shared by all 5 modules ---
DB_HOST=192.168.1.10          # the DB host's IP (127.0.0.1 in solo mode)
DB_PORT=3306
DB_NAME=mindafresh_db
DB_USER=mindafresh
DB_PASS=MindaFresh@2026

# --- used by the Shop only ---
SHIPPING_FEE=50
STAFF_LOGIN_PATH=/admin/login  # staff login page; other modules leave it out (/login)

# --- used by Attendance and HR ---
SHIFT_START=08:00
SHIFT_END=17:00
WORK_DAYS=1,2,3,4,5,6          # Monday to Saturday (0 = Sunday)
```

Keep `.env` out of GitHub. Commit a `.env.example` with the same names and no real passwords.

**Two modes, one switch:**

- **LAN mode (joint tests and defence):** each laptop runs its own module with `xian start`, and all point `DB_HOST` to the DB host. Check every IP with `ipconfig` on defence day.
- **Solo mode (one laptop):** import `schema.sql` + `seed.sql` into your own Laragon, set `DB_HOST=127.0.0.1` (and `DB_USER=root`, empty `DB_PASS`, if you did not create the group account), and run all 5 apps in 5 terminals. Use it to work alone, to test, and as the backup for individual checking.

Never type an IP or password in code; read them from `process.env`. Restart the app after editing `.env`. (If the group later puts the database online, only `DB_HOST`, `DB_USER` and `DB_PASS` change.)

**Schema changes after Week 1:** write a migration file in `shared/database/migrations/` (for example `002-add-orders-notes.sql`, with the `ALTER TABLE`), update `schema.sql` and this document, and announce it. The DB host runs the migration; solo-mode laptops run it too. `003-product-reviews.sql` adds the Shop's `product_reviews` table; `002-attendance-lunch.sql` (Attendance's lunch times) was accepted in v2.4 and is already in `schema.sql`: run it only on a database imported from an older `schema.sql`, and only once.

## 9. Work Plan

**Database first, then HR, then everyone in parallel.** As the professor said, the database is the most important part, so Week 1 is spent agreeing on it together. HR comes next because every module needs login and `employees`. Because the seed data already has employees, products and accounts, **nobody needs fake data**: everyone builds against the real shared tables from Week 2.

| Wk | Everyone | HR (Fate) | POS (Bren) | Shop (Ali) | Attendance (Brian) | Accounting (Jean) |
|---------------------|---------------------------------------------------------------------------------|---------------------------------------------------------------------------------|-----------------------------------------------------------------|----------------------------------------------------------------|-----------------------------------------------------------------|---------------------------------------------------------------------------|
| 1 | Review and agree on Section 4 table by table; set up the DB host; import schema + seed; create repo; generate 5 apps | `config/database.js`, `authService`, `requireRole`, `appError`; models for HR tables; `sync.js` | Models for POS tables; `stockService` (deduct, return) | Models for Shop tables; Tailwind layout, `head.xian` | Models for Attendance tables; `dates.js`; kiosk page | Models for Accounting tables; `money.js`; chart of accounts page |
| 2 | **Joint test 1:** login from all 5 modules on the shared database (LAN mode) | Employees + departments CRUD, user accounts | Product CRUD, stock adjustment screen, low-stock list | Customer register/login, product list from POS tables | Time in/out, late and undertime rules, holidays screen | Manual journal entry, journal and ledger pages |
| 3 |  | Leave: file, approve, balances | Suppliers, purchase orders, receive (weighted average) | Cart, checkout with `deductStock` | `closeDays`, corrections screen, `getSummary` | Posting service: POS sales, purchases, adjustments |
| 4 | **Joint test 2:** online order and POS sale end to end into Accounting | Employee profile with attendance logs, role management | POS sales screen, receipt, void | Order status flow, cancel and return | Attendance reports | Posting: online orders, reversals; trial balance |
| 5 |  | Payroll: compute from summary + leaves + holidays, admin approval | Stock movement and sales reports | Customer order history | Fix bugs, help HR test payroll | Payroll posting, salary release, remittances |
| 6 | **Joint test 3:** full checklist (Section 10) | Payslip page for employees, fix bugs | Fix bugs | Fix bugs | Fix bugs | Income statement, sales summary |
| 7 | Freeze the schema (no more changes), UI polish, user manual screenshots, ERD |  |  |  |  |  |
| 8 | **Defence rehearsal** on 5 laptops (LAN mode) and on 1 laptop (solo mode) |  |  |  |  |  |

If the deadline is shorter, merge Weeks 6 and 7; never skip the joint tests. POS and HR carry the most work. If Bren or Fate falls behind by Week 3, a member who is ahead takes over the purchase order screens or the leave screens, following this blueprint exactly.

**Joint test sessions:** all 5 laptops, same Wi-Fi, 2–3 hours, end of Weeks 2, 4, 6 and 8. Write every failed test as a GitHub issue with the module owner's name.

**Change rule:** a change to any table, column, status value or shared file needs a message in the group chat, agreement from every member who uses it, a migration file, and an update to this document **before** the code changes.

## 10. Integration Testing Checklist

Run the whole list at Joint test 3 and again the day before defence, on the same Wi-Fi as defence if possible, in **LAN mode on the DB host**.

### Setup

- [ ] All 5 `.env` files point to the same `DB_HOST`, `DB_NAME`, `DB_USER`
- [ ] `node shared/check-connection.js <module>` passes (no ✗) for all 5 modules
- [ ] Every laptop can open every module at `http://<ip>:<port>`
- [ ] phpMyAdmin shows exactly 27 tables in `mindafresh_db`, snake_case names, `created_at` / `updated_at`
- [ ] No module calls `sequelize.sync()`; `shared/` copies are up to date (`node shared/sync.js` changes nothing)
- [ ] In phpMyAdmin, saving `manager` as a role, or a review rating of 6, fails with a CHECK error
- [ ] Every stock movement in phpMyAdmin has the right link: `sale_id`, `order_id` or `purchase_order_id`
- [ ] All 5 modules show Asia/Manila times and money as ₱1,250.50

### Login and roles

- [ ] Each seed account logs in to every module it is allowed in, with the same password
- [ ] Wrong password shows a clear message in every module
- [ ] A cashier cannot open HR or Accounting pages (redirect, not a crash)
- [ ] A disabled user, and a resigned employee, cannot log in anywhere
- [ ] A customer can log in to the Shop only, and staff accounts cannot log in to the Shop as customers
- [ ] Only admin and accountant can log in at the Shop's `/admin/login`; the accountant sees orders and the sales report but no action buttons
- [ ] A customer disabled by the admin cannot log in to the Shop
- [ ] A customer can rate a product only from a delivered order; a review hidden by the admin disappears from the product page

### Employees and attendance

- [ ] A new employee in HR (EMP-0008) can time in at Attendance right away
- [ ] An unknown code (EMP-9999) is refused at the kiosk
- [ ] Late time in sets `late_minutes` and `status = late`; early time out sets `undertime_minutes`
- [ ] A second time in on the same day is refused
- [ ] The kiosk goes Time in → Lunch out → Lunch in → Time out; a repeat tap within 1 minute and a fifth punch are refused
- [ ] Lunch is saved, and a full day (8:00 to 17:00) still gives `hours_worked` = 8.00
- [ ] The DTR for a cutoff (1–15 or 16–end) matches the logs, and the Attendance period summary equals `getSummary` for the same dates
- [ ] No absent rows are created on Sundays or on holidays
- [ ] Approved leave shows as `on_leave` in Attendance, not absent
- [ ] Approved vacation, emergency or sick leave lowers the right balance; a leave longer than the balance is refused unless filed as unpaid
- [ ] A missed time out appears on the corrections list and can be fixed with remarks
- [ ] HR's employee profile shows that employee's attendance logs

### Products, stock, purchasing and sales

- [ ] A new product in POS appears in the Shop (when `is_online = 1`)
- [ ] A price change in POS shows in the Shop at once; old orders keep the old price
- [ ] Receiving a purchase order raises `quantity_on_hand`, updates `cost_price` to the weighted average, and Accounting posts it
- [ ] A purchase order cannot be received twice
- [ ] An on_account purchase posts to Accounts Payable; a cash purchase posts to Cash on Hand
- [ ] An adjustment without remarks is refused; stock never goes below 0; Accounting posts it to 6040
- [ ] A POS sale lowers stock, prints a receipt, and Accounting posts it with COGS
- [ ] A voided sale returns stock, and Accounting posts a reversal (or nothing, if the sale was never posted)
- [ ] Ordering more than the available stock online is blocked, and nothing is saved
- [ ] Two orders for the last item at the same time: only one succeeds
- [ ] A cancelled order returns its stock, with no accounting entry
- [ ] A delivered order is posted once: Sales Revenue – Online, Delivery Fee Income and COGS
- [ ] The Shop's sales report total for a day equals Accounting's online sales + delivery fees for the same day
- [ ] Clicking *Post new transactions* twice never doubles anything
- [ ] The low-stock list shows products at or below `reorder_level`

### Payroll and reports

- [ ] HR payroll lists every active employee for the period
- [ ] Days worked, absences, lates and undertime match the Attendance summary; paid leave and regular holidays are paid
- [ ] A draft payroll is not posted by Accounting until the admin approves it
- [ ] An approved payroll creates one balanced entry (Salaries Expense = Contributions + Tax + Salaries Payable) and one REL with pending
- [ ] Releasing salaries posts Salaries Payable / Cash and HR then shows the run as paid
- [ ] Employees see their payslip in HR only after the payroll is paid
- [ ] A remittance clears the matching payable account
- [ ] The trial balance totals are equal
- [ ] The sales summary equals POS completed sales + delivered online orders for the same dates

### Backup and solo mode

- [ ] DB host off: every module shows "Database is offline" instead of crashing
- [ ] Each member can import schema + seed and demo the full system alone (solo mode)
- [ ] Accounting closed while sales happen: the next *Post new transactions* picks them all up

## 11. Common Mistakes and How We Avoid Them

| Mistake | What goes wrong | How we avoid it |
|------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------|
| Each module makes its own employees or products table | Data goes out of sync; graders see 5 apps, not 1 system | One database; read the owner's table, never copy it (Section 2) |
| `sequelize.sync()` left in a module | Five apps alter the same tables; data deleted with `force` | `schema.sql` is the only source; `index.js` only calls `authenticate()` |
| Editing a table straight in phpMyAdmin | Other laptops and solo copies no longer match | Migration file + `schema.sql` + this document, under the change rule |
| Writing another module's table directly | Stock or books break with no stock movement or entry | Go through the owner's shared service; only Accounting writes journal entries |
| Deducting stock item by item without a transaction | Half an order deducted; negative stock | `deductStock` inside the caller's transaction, rows locked in product order |
| Hook saves without the transaction | Every sale freezes for about 50 seconds | `save({ hooks: false, transaction: options.transaction })` |
| Posting the same event twice | Doubled revenue in reports | Unique `source_module + entry_type + reference_code`; posting skips duplicates |
| Sequelize defaults left on | Tables become `Employees`, columns `createdAt` | `underscored: true`, `freezeTableName: true`, explicit `tableName` |
| Small naming differences (`emp_id` vs `employee_id`, `Pending` vs `pending`) | Queries return nothing or fail | Copy names from Sections 3–4 and `schema.sql`; CHECK constraints reject wrong status values |
| Editing a copied shared file inside a module | The next `sync.js` wipes it, or modules behave differently | Edit only the master in `shared/`, owner only, then everyone syncs |
| DECIMAL returned as text | `"500.00" + "50.00" = "500.0050.00"` | `dialectOptions: { decimalNumbers: true }` |
| Adding money in plain JavaScript | ₱0.01 errors in totals | `round2()` on every computed amount; DECIMAL(12,2) in the database |
| Typing IPs or passwords in code | Breaks when Wi-Fi changes on defence day | Everything from `.env` through `process.env` |
| An unhandled `await` error | The Node app crashes and the module goes offline | try/catch in every controller; show the `AppError` message |
| Firewall blocks port 3306 or Node | Other laptops cannot reach the database or your module | Allow both on private networks before every joint test |
| DB host laptop asleep or absent | Every module goes down | Keep it plugged in, sleep off; every member can switch to solo mode |
| Missing `.js` in ES module imports | `ERR_MODULE_NOT_FOUND` on start | Always `import x from "./file.js"` |
| Building alone, testing together only in the last week | Integration bugs found too late to fix | Real shared database from Week 2; joint tests every 2 weeks |
| Different Node or package versions | "Works on my laptop" errors | Node 22 LTS for all; commit `package-lock.json` |
| Pushing `.env` or `node_modules/` to GitHub | Leaked passwords, huge repo | `.gitignore` at the **repo root** with both; share `.env.example` only. If already pushed: `git rm -r --cached <path>` |
| `skip-grant-tables` left on in Laragon's `my.ini` | `CREATE USER` fails; any password is accepted | Comment it out and restart Laragon (Section 8) |
| `sequelize.sync()` left in the generated `migrate.js`, `create.js` or `authController.js` | Tables altered or emptied when the file runs | Clean up the generated files before the first run (Section 8) |
| Guessing why a module cannot connect | Hours lost on defence day | `node shared/check-connection.js <module>` names the failing step and the fix |
| Payroll computed in both HR and Accounting | Two different net pay figures | Only HR computes; Accounting posts approved totals and pays the net |

## Rules Every Member Must Follow

*Pin this in the group chat.*

1. **One stack:** XianFire (Node.js 22 + Express), Sequelize + mysql2, .xian views + Tailwind, **Laragon (MySQL 8.4)**, generated with **CRUD, MySQL, No Electron, No Jest**.
2. **One database: `mindafresh_db`.** Tables come only from `shared/database/schema.sql`. Never call `sequelize.sync()`.
3. **`employee_id` is the shared key.** Every table that names a person links to `employees.id`. Users are joined to employees, one login per employee.
4. **Read anything, write only your own tables.** To change another module's data, call the owner's shared service.
5. **POS owns products, stock, suppliers and purchase orders.** Stock changes only through `stockService`, and every change writes a stock movement.
6. **HR owns employees, logins, leaves and payroll computation.** Accounting never recomputes pay.
7. **Accounting owns the books.** Only Accounting writes journal entries; it posts finished records with *Post new transactions*.
8. **One action, one transaction.** A sale or order and its stock change succeed or fail together.
9. **Names are copied, not typed from memory:** tables plural snake_case, columns singular snake_case, status values lowercase from Section 3 (the database rejects anything else). Same Sequelize `define` settings everywhere.
10. **Codes:** PREFIX-0001, made by the owner's model hook (with the transaction), never reused.
11. **Money:** DECIMAL(12,2) in the database, `round2()` in JavaScript, ₱1,250.50 on screen.
12. **Dates:** YYYY-MM-DD for dates, Asia/Manila for date and time.
13. **Shared files live in `shared/`.** Only the owner edits a master; everyone runs `node shared/sync.js` after pulling.
14. **No IPs or passwords in code.** Everything comes from `.env`.
15. **Change rule:** a change to a table, column, status value or shared file needs group chat agreement, a migration file, and an update to this document first.
16. **Test together** at the end of Weeks 2, 4, 6 and 8, after `check-connection.js` passes on every laptop. Every member must also be able to demo the full system alone (solo mode).
