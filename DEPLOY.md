# Deploying MindaFresh ERP on Hostinger (one Node.js web app, one domain)

All five modules run behind one gateway (`server.js`) on one domain:

| Address | Module |
|---|---|
| `/` | landing page with a link to each module |
| `/shop/` | Online Shop (staff log in at `/shop/admin/login`) |
| `/pos/login` | POS |
| `/attendance/login` | Attendance |
| `/hr/login` | HR |
| `/accounting/login` | Accounting and Finance |
| `/healthz` | shows which modules are up |

The gateway starts each module as its own process on a free private port and adds the `/<module>` prefix to the addresses in the pages,
so the modules did not have to change. See `deploy/rewrite.mjs`.

## 1. Database (hPanel > Databases > Management)
1. Create a database and a user. Use `mindafresh_db` as the database name; Hostinger puts its own prefix in front (for example `u123456789_mindafresh_db`).
2. Open phpMyAdmin for it and import `deploy/hostinger-import.sql` once, into the empty database (27 tables, seed users).

## 2. Web app (hPanel > Websites > Create site > Web App)
1. Upload the project zip (or import the GitHub repository). Node.js 20 or 22. Build command: leave default (`npm install`; it also installs the five modules). Start command: `npm start`.
2. Environment variables:

| Name | Value |
|---|---|
| `SESSION_SECRET` | a long random text, at least 32 characters (secret) |
| `DB_HOST` | `localhost` (or the host shown in hPanel for the database) |
| `DB_PORT` | `3306` |
| `DB_NAME` | the full database name, with the prefix |
| `DB_USER` | the database user |
| `DB_PASS` | the database password (secret) |
| `PUBLIC_URL` | `https://<your domain>` with no slash at the end |
| `FORCE_HTTPS` | `1` |
| `TZ` | `Asia/Manila` |

3. Deploy, then open `https://<your domain>/healthz`. All five should say `up`.

## 3. After the first login
Change the seed passwords (the blueprint lists them). They are test passwords.

## Hostinger notes (found while deploying)
- The host blocks loopback TCP between processes, so the gateway talks to each module over a unix socket (`deploy/bind-ipv4.cjs` makes `app.listen(port)` use it). Do not change this back to TCP ports.
- The host limits threads per account. The gateway starts one module every 2.5 seconds and limits each module's threads (`--v8-pool-size=1`, `UV_THREADPOOL_SIZE=2`).
- Hostinger can add characters to the database name. Copy the exact name shown in hPanel into `DB_NAME`.
- After a deploy it takes about 1 to 2 minutes until `/healthz` shows all five modules as `up`.

## Known limits
- Sessions are kept in memory: everyone is logged out when the app restarts.
- Files uploaded in the app (delivery photos, product photos, POS store image) are saved in the app folder. A redeploy replaces the folder, so they are lost then.
- The POS barcode column needs migration 008. It is already in `schema.sql`, so a fresh import has it.
