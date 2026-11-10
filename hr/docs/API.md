# PeoplePay routes (XianFire MVC)

The local application uses server-rendered .xian pages and standard HTML forms. GET routes render pages; POST routes call named controllers, validate input, perform an owned service/model action and redirect with connect-flash messages. All write forms carry a session CSRF token.

Run `npm run route:list` to list the exact routes.

Core pages: /dashboard, /profile, /employees, /departments, /users, /attendance, /leaves, /payroll, /payslips, /reports, /connections and /settings. New employees use /employees/create, edits use /employees/:id/edit. Payroll review uses /payroll/:id. Payslips use /payslips/:runId/:employeeId.

Writes: POST /employees; POST /employees/:id/update; POST /departments; POST /departments/:id/update; POST /users; POST /users/:id/update; POST /leaves; POST /leaves/:id/update; POST /payroll; POST /payroll/:id/recompute; POST /payroll/:id/approve; POST /logout.

Admin alone approves payroll. HR manages employees, departments, non-admin accounts, leave and draft payroll. Accountant can view employee and approved payroll records. Employee, cashier and inventory_staff can request/cancel their own pending leave and see only their own released payslips.

No HR controller writes punches, journal entries or salary releases. Payroll preparation calls Attendance's shared getSummary service, which closes missing past working days as required by the blueprint. No schema synchronization, shared-table drops or destructive employee deletion is performed.
