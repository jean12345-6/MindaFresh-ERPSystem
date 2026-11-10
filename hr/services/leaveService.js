import { isSelfService } from "../utils/roles.js";
import {
  rows,
  execute,
  insert,
  sequelize,
} from "../models/db.js";
import { dateRange, isWorkDay } from "./dates.js";
import { need } from "./validation.js";
export async function createLeave(b, user) {
  need(
    ["vacation", "sick", "emergency", "unpaid"].includes(b.leave_type),
    "Invalid leave type",
  );
  const employee_id =
    isSelfService(user.role) ? user.employee_id : Number(b.employee_id);
  const dates = dateRange(b.start_date, b.end_date);
  need(
    !b.reason || (typeof b.reason === "string" && b.reason.length <= 255),
    "Reason is too long",
  );
  return sequelize.transaction(async (t) => {
    const [e] = await rows(
      "SELECT * FROM employees WHERE id=:id AND status='active' FOR UPDATE",
      { id: employee_id },
      t,
    );
    need(e, "Active employee not found");
    const holidays = await rows(
      "SELECT holiday_date FROM holidays WHERE holiday_date BETWEEN :start AND :end",
      { start: b.start_date, end: b.end_date },
      t,
    );
    const days = dates.filter(
      (d) => isWorkDay(d, holidays) && d >= e.hire_date,
    ).length;
    need(days > 0, "Select at least one working day after hire date");
    const overlaps = await rows(
      "SELECT id FROM leave_requests WHERE employee_id=:id AND status IN ('pending','approved') AND start_date<=:end AND end_date>=:start",
      { id: employee_id, start: b.start_date, end: b.end_date },
      t,
    );
    need(!overlaps.length, "Leave overlaps an existing request");
    const payroll = await rows(
      "SELECT id FROM payroll_runs WHERE status='approved' AND period_start<=:end AND period_end>=:start",
      { start: b.start_date, end: b.end_date },
      t,
    );
    need(!payroll.length, "Leave cannot change an approved payroll period");
    return insert(
      "leave_requests",
      {
        employee_id,
        leave_type: b.leave_type,
        start_date: b.start_date,
        end_date: b.end_date,
        days,
        reason: b.reason || null,
        status: "pending",
      },
      "LVE",
      "leave_code",
      t,
    );
  });
}
export async function decideLeave(id, status, user) {
  need(
    ["approved", "rejected", "cancelled"].includes(status),
    "Invalid decision",
  );
  return sequelize.transaction(async (t) => {
    // Employee first: all leave operations use one lock order.
    const [ref] = await rows(
      "SELECT employee_id FROM leave_requests WHERE id=:id",
      { id },
      t,
    );
    need(ref, "Request not found");
    const [e] = await rows(
      "SELECT * FROM employees WHERE id=:id FOR UPDATE",
      { id: ref.employee_id },
      t,
    );
    const [l] = await rows(
      "SELECT * FROM leave_requests WHERE id=:id FOR UPDATE",
      { id },
      t,
    );
    need(l.status === "pending", "Request already reviewed");
    need(
      !isSelfService(user.role) ||
        (status === "cancelled" && l.employee_id === user.employee_id),
      "You can only cancel your own pending leave",
    );
    need(
      status === "cancelled" || ["admin", "hr_staff"].includes(user.role),
      "HR access required",
    );
    const runs = await rows(
      "SELECT id FROM payroll_runs WHERE status='approved' AND period_start<=:end AND period_end>=:start",
      { start: l.start_date, end: l.end_date },
      t,
    );
    need(!runs.length, "Decision would change an approved payroll period");
    if (status === "approved" && l.leave_type !== "unpaid") {
      const col =
        l.leave_type === "sick"
          ? "sick_leave_balance"
          : "vacation_leave_balance";
      need(e[col] >= l.days, "Insufficient leave balance");
      await execute(
        `UPDATE employees SET ${col}=${col}-:days,updated_at=NOW() WHERE id=:id`,
        { days: l.days, id: e.id },
        t,
      );
    }
    await execute(
      "UPDATE leave_requests SET status=:status,approved_by_id=:actor,updated_at=NOW() WHERE id=:id",
      { status, actor: status === "cancelled" ? null : user.employee_id, id },
      t,
    );
  });
}
