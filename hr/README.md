# MindaFresh PeoplePay 1.4

XianFire HR and payroll module for MindaFresh ERP, updated against the supplied blueprint v2.4 and master SQL schema. Uses an orange/cream sidebar, the supplied **logo option 1**, and separate `.xian` layout, page, form and modal partials.

## Update your current system

1. Stop PeoplePay with Ctrl+C. Back up your existing project and `mindafresh_db`.
2. Extract this ZIP into a new folder, such as `C:\laragon\www\mindafresh-peoplepay-fixed`.
3. Copy your existing **root `.env`** into that new folder, beside `package.json`. The download intentionally excludes private credentials. Keep your existing database host, user, password and session secret.
4. In PowerShell in the new folder, run:

```powershell
npm install
npm run check:db
npm test
npm start
```

5. Open `http://localhost:3004` (or your configured PORT). Sign in with your existing shared staff username and password. Updating does not reset accounts.

**Do not reimport schema.sql over your existing ERP database.** The checker reports the database server/account, attendance record count and earliest/latest dates. If lunch columns are missing, the database host should review and run `database/migrations/002-attendance-lunch.sql` once, only when both columns are absent. If one column already exists, reconcile that partial migration first. No schema change runs automatically.

## New installation only

Use Node.js 22+ and your group's MySQL/MariaDB server. Import `database/schema.sql` **once into a new database** on the designated host. This is the supplied complete 27-table ERP master schema, not an HR-only replacement. It contains migration 002 already.

```powershell
npm install
Copy-Item .env.example .env
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Put the generated value in SESSION_SECRET. Set DB_HOST, DB_PORT, DB_NAME=mindafresh_db, DB_USER and DB_PASS to the actual database account. A genuinely blank MySQL password is `DB_PASS=`; do not put the literal word `null` there. A PeoplePay sign-in password is separate from the database password.

For an empty users table only, temporarily set BOOTSTRAP_USERNAME and BOOTSTRAP_PASSWORD (12–72 bytes), then run `npm run bootstrap`. Remove those two values afterward. If users already exist, ask the administrator to reset your PeoplePay password in Staff accounts. No default password is supplied.

```powershell
npm run check:db
npm start
```

## Connecting different laptops

All modules must point to **the same server and mindafresh_db**, using the same employee IDs. On client laptops, DB_HOST is the database laptop's LAN IPv4 address, not localhost. A successful `Test-NetConnection <host> -Port 3306` establishes network reachability only; MySQL must also authorize your DB_USER from the client address. Ask the database host to provision the agreed application account. Changing PeoplePay sign-in credentials does not grant MySQL access.

Run `npm run check:db` on both laptops and compare the reported server/database and attendance date range. Attendance → Apply filters shows only selected dates; empty records can mean the Attendance module uses a different database or employee ID. The HR module does not implement the kiosk or invent punches.

## Folder structure

- `index.js`, `package.json`, `.env.example`, `migrate.js`, `bootstrap.js`: normal XianFire application root; no nested hr/ application.
- `routes/`, `controllers/`, `middleware/`: routing, controllers, session authentication, canonical role checks, CSRF and flash messages.
- `models/*Model.js`: individual Sequelize model definitions and display-code hooks. `models/index.js`: associations.
- `config/database.js`: canonical shared database settings; `models/db.js`: query helpers and compatible connection export.
- `services/`: HR business rules plus the Attendance-owned summary/closing contract.
- `utils/`: shared role constants and AppError.
- `views/*.xian`: page shells; `views/partials/`: sidebar, head, header, messages and footer; `pages/`, `forms/`, `modals/`: separate content partials.
- `public/images/mindafresh-logo.svg`: exact option 1 clipped from the supplied image, with no generated redesign.
- `database/`: supplied master schema and migration 002 for older databases.
- `tests/`: payroll, real view-engine, session/CSRF, model-hook and blueprint contract tests.
- `dist/`: optional browser-only demonstration using sample data; not the MySQL application.

## Blueprint behavior and ownership

Admin and HR maintain employee records, departments, staff accounts and leave; HR prepares draft payroll and **admin alone approves** it. Accountant reads employee and approved payroll records. Employee, cashier and inventory_staff use their own profile, leave requests and released payslips. Self-service queries scope by session employee_id and do not expose company payroll totals.

Shared login returns user_id, employee_id, employee_code, role and full_name (plus id/username for compatibility), saved in `req.session.user`. Every request rechecks active employee/account status. Modules have separate sessions and share the same staff credentials. Sessions stay in memory for local development, avoiding Windows file rename errors; restarting signs users out. For production, configure a persistent session store and HTTPS before deployment.

Attendance owns attendance_logs and holidays. HR's attendance page is read-only and displays time-in, lunch-out, lunch-in and time-out, with date/employee filtering and printable records. `services/attendanceService.js` exports the shared `getSummary(dateFrom,dateTo)` and `closeDays(upToDate)` contract. Share this implementation with Attendance's owner rather than maintaining competing versions.

As required by the blueprint, summary generation first closes past working days: approved leave → on_leave; otherwise a missing log → absent. Repeated calls preserve existing punches. Closure excludes holidays, rest days, dates before hire, today/future dates and already-approved payroll periods. First preparation may therefore create missing historical absence/leave rows through the Attendance-owned service. It never creates clock punches or edits an existing record. The kiosk and manual corrections remain in the separate Attendance module.

Attendance continues to compute hours with a fixed one-hour lunch; HR keeps its existing academic payroll rate configuration. Completed attendance, paid leave and regular holidays feed draft payroll. Missing time-outs block preparation. Recomputing replaces draft items only; approval checks for changes before locking the snapshot. Accounting owns journals and salary releases; PeoplePay reads only posted journals and released salaries. It does not post accounting entries or release cash.

## Validation and limits

Run `npm test` and `npm run route:list`. Automated tests exercise the real `.xian` engine, HTTP sessions/CSRF, payroll rules, day closure, summary shape and all three self-service roles. Database-bound contract tests use an injected in-memory query boundary. The developer environment cannot verify your Windows LAN database; `npm run check:db` and an end-to-end test with your group's Attendance/Accounting modules are still required on your laptops.

See `docs/BLUEPRINT-CHANGES.md` for the specific repairs and the included blueprint reference for the source requirements.
