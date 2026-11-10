# Repairs against blueprint v2.4

- Applied the supplied logo option 1 to login, sidebar and favicon; preserved orange/cream styling and XianFire `.xian` partials.
- Restored cashier/inventory_staff self-service access with the same ownership restrictions as employee.
- Added /profile for the signed-in employee; protected against arbitrary employee selection in self-service leave requests/cancellation.
- Prevented company payroll totals leaking through self-service dashboard/payslip data. Self-service payslips require Accounting's released status.
- Matched shared-login result fields and req.session.user, with AppError authentication messages; deactivated accounts are rechecked per request.
- Added canonical config/database.js and middleware/requireRole.js without moving the normal XianFire application root.
- Added Attendance's two-date getSummary API and idempotent past-day closure; retained separate HR pay-day enrichment and approved snapshot checks.
- Added lunch columns to attendance displays, date/employee filters, print support and sign-off lines. Kiosk/corrections remain Attendance-owned.
- Ignored voided accounting journals when deriving payroll's posted state.
- Replaced the outdated partial SQL/solo fixture with the supplied complete master schema; included opt-in migration 002 for older databases.
- Expanded read-only connection diagnostics to identify server/database/account and attendance date range, and detect missing lunch columns.
- Replaced the deprecated util.isArray flash dependency with session-backed flash middleware using Array.isArray. Disk session writes remain disabled.

No user database was accessed or migrated during these source repairs. Private .env values, node_modules and obsolete generated session files are excluded from the deliverable.
