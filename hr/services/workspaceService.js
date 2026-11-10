import { isSelfService } from "../utils/roles.js";
import { rows } from "../models/db.js";
export async function getWorkspaceData(user, query = rows) {
  const employee = isSelfService(user.role),
    accountant = user.role === "accountant";
  const id = user.employee_id;
  const employees = await query(
    "SELECT e.*,d.name AS department FROM employees e JOIN departments d ON d.id=e.department_id" +
      (employee ? " WHERE e.id=:id" : ""),
    { id },
  );
  const departments = await query("SELECT * FROM departments");
  const leaves = accountant
    ? []
    : await query(
        "SELECT * FROM leave_requests" +
          (employee ? " WHERE employee_id=:id" : ""),
        { id },
      );
  const runs = await query(
    `SELECT r.*,s.status AS release_status, 0 AS is_posted FROM payroll_runs r LEFT JOIN salary_releases s ON s.payroll_run_id=r.id ${employee ? "WHERE s.status='released'" : accountant ? "WHERE r.status='approved'" : ""} ORDER BY r.id DESC`,
  );
  for (const r of runs)
    r.items = await query(
      "SELECT * FROM payroll_items WHERE payroll_run_id=:rid" +
        (employee ? " AND employee_id=:id" : ""),
      { rid: r.id, id },
    );
  // A self-service response contains only this employee's amounts, never company totals.
  if (employee) {
    for (let i = runs.length - 1; i >= 0; i--) {
      const run = runs[i];
      if (!run.items.length) { runs.splice(i, 1); continue; }
      run.employee_count = run.items.length;
      run.total_gross = run.items.reduce((s, item) => s + Number(item.gross_pay), 0);
      run.total_net = run.items.reduce((s, item) => s + Number(item.net_pay), 0);
      run.total_contributions = run.items.reduce((s, item) => s + Number(item.sss) + Number(item.philhealth) + Number(item.pagibig), 0);
      run.total_withholding_tax = run.items.reduce((s, item) => s + Number(item.withholding_tax), 0);
    }
  }
  const users = ["admin", "hr_staff"].includes(user.role)
    ? await query(
        "SELECT id,user_code,employee_id,username,role,status,last_login_at FROM users",
      )
    : [];
  const attendance = []; // Attendance controller fetches only the requested date range.
  const holidays = await query("SELECT * FROM holidays");
  const employeeMap = new Map(employees.map((e) => [e.id, e]));
  for (const employee of employees)
    employee.full_name = employee.first_name + " " + employee.last_name;
  for (const leave of leaves) {
    leave.employee_name =
      employeeMap.get(leave.employee_id)?.full_name || "Unknown employee";
    leave.can_review =
      ["admin", "hr_staff"].includes(user.role) && leave.status === "pending";
    leave.can_cancel =
      isSelfService(user.role) &&
      leave.employee_id === user.employee_id &&
      leave.status === "pending";
  }
  for (const run of runs) {
    run.display_status =
      run.release_status === "released"
        ? "paid"
        : run.is_posted
          ? "posted"
          : run.status;
    run.is_draft = run.status === "draft";
    run.total_deductions =
      Number(run.total_contributions) + Number(run.total_withholding_tax);
    for (const item of run.items)
      item.employee_name =
        employeeMap.get(item.employee_id)?.full_name || "Unknown employee";
  }
  for (const account of users)
    account.employee_name =
      employeeMap.get(account.employee_id)?.full_name || "Unknown employee";
  for (const log of attendance)
    log.employee_name =
      employeeMap.get(log.employee_id)?.full_name || "Unknown employee";
  return {
    employees,
    departments,
    leaves,
    runs,
    users,
    attendance,
    holidays,
    activeCount: employees.filter((e) => e.status === "active").length,
    pendingLeaves: leaves.filter((l) => l.status === "pending"),
    latestRun: runs[0] || null,
  };
}
