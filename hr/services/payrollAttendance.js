import { rows } from "../models/db.js";
import { dateRange, isWorkDay } from "./dates.js";
// Read-only adapter. No attendance log is created or corrected by this HR module.
// Missing past working dates are counted as absent in the summary, not written.
export async function getPayrollDays(employee, start, end, transaction) {
  const dates = dateRange(start, end).filter((d) => d >= employee.hire_date);
  const holidays = await rows(
    "SELECT * FROM holidays WHERE holiday_date BETWEEN :start AND :end",
    { start, end },
    transaction,
  );
  const logs = await rows(
    "SELECT * FROM attendance_logs WHERE employee_id=:id AND log_date BETWEEN :start AND :end",
    { id: employee.id, start, end },
    transaction,
  );
  const leaves = await rows(
    "SELECT * FROM leave_requests WHERE employee_id=:id AND status='approved' AND start_date<=:end AND end_date>=:start",
    { id: employee.id, start, end },
    transaction,
  );
  let result = {
    days_worked: 0,
    paid_leave_days: 0,
    paid_holiday_days: 0,
    unpaid_days: 0,
    late_minutes: 0,
    undertime_minutes: 0,
  };
  for (const d of dates) {
    const holiday = holidays.find((h) => h.holiday_date === d);
    if (holiday) {
      if (holiday.holiday_type === "regular") result.paid_holiday_days++;
      continue;
    }
    if (!isWorkDay(d, holidays)) continue;
    const l = logs.find((l) => l.log_date === d);
    const leave = leaves.find((l) => l.start_date <= d && l.end_date >= d);
    if (l && ["present", "late"].includes(l.status)) {
      if (!l.time_out)
        throw Error(
          "Resolve missing time-out for " +
            employee.employee_code +
            " on " +
            d +
            " in Attendance.",
        );
      result.days_worked++;
      result.late_minutes += Number(l.late_minutes);
      result.undertime_minutes += Number(l.undertime_minutes);
    } else if (leave && leave.leave_type !== "unpaid") result.paid_leave_days++;
    else result.unpaid_days++;
  }
  return result;
}
