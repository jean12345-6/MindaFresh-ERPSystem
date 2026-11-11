# POS deploy checklist

## Before every push to the team repository
1. `node scripts/smoke-test.js` (only with `DB_HOST=127.0.0.1`). Every line must show a check mark.
2. Push only the `pos/` folder. Never push `.env`, `node_modules`, `pos/data` or `pos/public/uploads`.
3. After a `git pull`, run `node shared/sync.js` and `npm install` inside `pos/`.
   The POS uses its own partials (`pos-head`, `pos-footer`, `pos-end`, `nav`), so `sync.js` can no longer overwrite the layout.

## Going live (a real server or a demo day)
1. In `.env` set a long random `SESSION_SECRET`, then start with `npm run start:prod`.
   In production mode the POS refuses to start if the secret is missing or still the default.
2. If the site is opened over https, add `COOKIE_SECURE=1`. If it runs behind nginx or a hosting proxy, add `TRUST_PROXY=1`.
3. Point `DB_HOST` at the shared database host and run `node ../shared/check-connection.js pos`.
4. Keep the DB host awake and Laragon running. When the DB is down, pages show "Database is offline" and recover on reload.

## Known limits (accepted for this project)
- Sessions are kept in memory. Restarting the POS logs everyone out, and it supports one running process only.
- Settings and uploaded images are stored per computer (`pos/data`, `pos/public/uploads`), not in the shared database.
- `npm audit` reports the `uuid` and `tar` packages inside sequelize and bcrypt. The POS never calls the affected uuid code
  (it needs a caller-supplied buffer), and tar is only used while installing bcrypt. Do not run `npm audit fix --force`: it downgrades sequelize and breaks the shared models.

## Security measures in place
- Role check on every page and every action. Cashiers cannot open admin pages or change settings.
- Cross-site form posts are refused. Session cookie is HttpOnly and SameSite=Lax.
- Login is limited to 8 failed attempts per 15 minutes per user and address.
- Security headers on every response: no sniffing, no framing, same-origin referrer.
- Uploads accept real PNG, JPG, WEBP or GIF files only (content is checked), maximum 3 MB, saved under a random name.
- Checkout re-checks stock, discounts and payment methods on the server. Parallel sales cannot oversell stock.
