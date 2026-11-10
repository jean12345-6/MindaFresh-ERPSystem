import {
  rows,
  execute,
  insert,
  sequelize,
} from "../models/db.js";
import { validatePeriod } from "./dates.js";
import { getSummary, manilaToday } from "./attendanceService.js";
import { getPayrollDays } from "./payrollAttendance.js";
import { computePay, totals } from "./payrollMath.js";
import { need } from "./validation.js";
export async function preparePayroll(b, user) {
  validatePeriod(b.period_start, b.period_end);
  const today = manilaToday();
  need(
    b.period_end < today,
    "Prepare payroll only after the period has ended.",
  );
  await getSummary(b.period_start, b.period_end);
  return sequelize.transaction(async (t) => {
    // Lock a stable HR-owned row before checking ranges to serialize simultaneous preparations.
    const [anchor] = await rows(
      "SELECT id FROM departments ORDER BY id LIMIT 1 FOR UPDATE",
      {},
      t,
    );
    need(anchor, "Create departments first");
    const overlaps = await rows(
      "SELECT id FROM payroll_runs WHERE period_start<=:end AND period_end>=:start",
      { start: b.period_start, end: b.period_end },
      t,
    );
    need(!overlaps.length, "A payroll run already overlaps this period");
    const employees = await rows(
      "SELECT * FROM employees WHERE status='active' AND hire_date<=:end ORDER BY id FOR UPDATE",
      { end: b.period_end },
      t,
    );
    need(employees.length, "No active employees in this period");
    const items = [];
    for (const e of employees) {
      const summary = await getPayrollDays(e, b.period_start, b.period_end, t);
      items.push({
        employee_id: e.id,
        ...computePay({ daily_rate: Number(e.daily_rate), ...summary }),
      });
    }
    const id = await insert(
      "payroll_runs",
      {
        period_start: b.period_start,
        period_end: b.period_end,
        ...totals(items),
        status: "draft",
        prepared_by_id: user.employee_id,
      },
      "PAY",
      "payroll_code",
      t,
    );
    for (const i of items)
      await insert(
        "payroll_items",
        { payroll_run_id: id, ...i },
        null,
        null,
        t,
      );
    return id;
  });
}
export async function approvePayroll(id, user) {
  need(user.role === "admin", "Only an administrator can approve payroll");
  return sequelize.transaction(async (t) => {
    const [r] = await rows(
      "SELECT * FROM payroll_runs WHERE id=:id FOR UPDATE",
      { id },
      t,
    );
    need(r, "Payroll not found");
    need(r.status === "draft", "Approved payroll is locked");
    const fresh = await freshItems(r, t);
    const old = await rows(
      "SELECT * FROM payroll_items WHERE payroll_run_id=:id ORDER BY employee_id",
      { id },
      t,
    );
    need(
      fresh.length === old.length &&
        fresh.every((item, index) =>
          Object.keys(item).every(
            (k) => Number(item[k]) === Number(old[index][k]),
          ),
        ),
      "Attendance, leave or employee rates changed. Recompute the draft and review it before approval.",
    );
    await execute(
      "UPDATE payroll_runs SET status='approved',approved_by_id=:actor,approved_at=NOW(),updated_at=NOW() WHERE id=:id",
      { id, actor: user.employee_id },
      t,
    );
  });
}

async function freshItems(r, t) {
  const employees = await rows(
    "SELECT * FROM employees WHERE status='active' AND hire_date<=:end ORDER BY id FOR UPDATE",
    { end: r.period_end },
    t,
  );
  const items = [];
  for (const e of employees)
    items.push({
      employee_id: e.id,
      ...computePay({
        daily_rate: Number(e.daily_rate),
        ...(await getPayrollDays(e, r.period_start, r.period_end, t)),
      }),
    });
  return items;
}
export async function recomputePayroll(id, user) {
  return sequelize.transaction(async (t) => {
    const [r] = await rows(
      "SELECT * FROM payroll_runs WHERE id=:id FOR UPDATE",
      { id },
      t,
    );
    need(r && r.status === "draft", "Only draft payrolls can be recomputed");
    const items = await freshItems(r, t);
    need(items.length, "No eligible employees");
    await execute(
      "DELETE FROM payroll_items WHERE payroll_run_id=:id",
      { id },
      t,
    );
    for (const item of items)
      await insert(
        "payroll_items",
        { payroll_run_id: id, ...item },
        null,
        null,
        t,
      );
    const v = totals(items);
    await execute(
      "UPDATE payroll_runs SET " +
        Object.keys(v)
          .map((k) => k + "=:" + k)
          .join(",") +
        ",updated_at=NOW() WHERE id=:id",
      { ...v, id },
      t,
    );
  });
}
