import { rows, execute, sequelize } from "../models/db.js";
import { dateRange, isWorkDay, validDate } from "./dates.js";

export function manilaToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
export function previousDate(date) {
  return new Date(Date.parse(date + "T00:00:00Z") - 86400000).toISOString().slice(0, 10);
}
export function summarizeRecords(employees, logs, start, end) {
  dateRange(start, end);
  return employees.map(e => {
    const result = { employee_id: e.id, employee_code: e.employee_code, days_present: 0, days_late: 0, days_absent: 0, days_on_leave: 0, late_minutes: 0, undertime_minutes: 0, hours_worked: 0 };
    for (const log of logs) {
      if (Number(log.employee_id) !== Number(e.id) || log.log_date < start || log.log_date > end || log.log_date < e.hire_date) continue;
      if (["present", "late"].includes(log.status)) result.days_present++;
      if (log.status === "late") result.days_late++;
      if (log.status === "absent") result.days_absent++;
      if (log.status === "on_leave") result.days_on_leave++;
      result.late_minutes += Number(log.late_minutes || 0);
      result.undertime_minutes += Number(log.undertime_minutes || 0);
      result.hours_worked += Number(log.hours_worked || 0);
    }
    result.hours_worked = Math.round(result.hours_worked * 100) / 100;
    return result;
  });
}
// Attendance-owned service contract. HR controllers never create or correct punches.
// Injecting the database boundary permits contract tests without contacting a real ERP.
export function createAttendanceService(db = { rows, execute, transaction: callback => sequelize.transaction(callback) }, clock = manilaToday) {
  async function closeDays(upToDate = previousDate(clock())) {
    if (!validDate(upToDate)) throw Error("Invalid attendance closing date.");
    const end = upToDate < clock() ? upToDate : previousDate(clock());
    return db.transaction(async t => {
      const employees = await db.rows("SELECT id,employee_code,hire_date FROM employees WHERE status='active' AND hire_date<=:end ORDER BY id FOR UPDATE", { end }, t);
      const holidays = await db.rows("SELECT holiday_date FROM holidays WHERE holiday_date<=:end", { end }, t);
      const leaves = await db.rows("SELECT employee_id,start_date,end_date FROM leave_requests WHERE status='approved' AND start_date<=:end", { end }, t);
      const frozen = await db.rows("SELECT period_start,period_end FROM payroll_runs WHERE status='approved'", {}, t);
      let created = 0;
      for (const employee of employees) {
        const existing = await db.rows("SELECT log_date FROM attendance_logs WHERE employee_id=:id AND log_date<=:end", { id: employee.id, end }, t);
        const seen = new Set(existing.map(l => l.log_date));
        // Process one year at a time to preserve the date-range validation limit.
        let start = employee.hire_date;
        while (start <= end) {
          const chunkEnd = new Date(Math.min(Date.parse(end), Date.parse(start) + 365 * 86400000)).toISOString().slice(0, 10);
          for (const date of dateRange(start, chunkEnd)) {
            if (seen.has(date) || !isWorkDay(date, holidays) || frozen.some(p => p.period_start <= date && p.period_end >= date)) continue;
            const status = leaves.some(l => Number(l.employee_id) === Number(employee.id) && l.start_date <= date && l.end_date >= date) ? "on_leave" : "absent";
            // Unique(employee_id,log_date) makes repeated closure safe and preserves real punches.
            await db.execute("INSERT INTO attendance_logs (employee_id,log_date,status,hours_worked,late_minutes,undertime_minutes,created_at,updated_at) VALUES (:id,:date,:status,0,0,0,NOW(),NOW()) ON DUPLICATE KEY UPDATE id=id", { id: employee.id, date, status }, t);
            await db.execute("UPDATE attendance_logs SET log_code=CONCAT('ATT-',LPAD(id,GREATEST(4,CHAR_LENGTH(id)),'0')) WHERE employee_id=:id AND log_date=:date AND log_code IS NULL", { id: employee.id, date }, t);
            created++;
          }
          start = new Date(Date.parse(chunkEnd) + 86400000).toISOString().slice(0, 10);
        }
      }
      return { closed_through: end, missing_days_processed: created };
    });
  }
  async function getSummary(dateFrom, dateTo) {
    dateRange(dateFrom, dateTo);
    await closeDays(dateTo);
    const employees = await db.rows("SELECT id,employee_code,hire_date FROM employees WHERE status='active' ORDER BY id");
    const logs = await db.rows("SELECT employee_id,log_date,status,late_minutes,undertime_minutes,hours_worked FROM attendance_logs WHERE log_date BETWEEN :start AND :end", { start: dateFrom, end: dateTo });
    return summarizeRecords(employees, logs, dateFrom, dateTo);
  }
  return { closeDays, getSummary };
}
export const { closeDays, getSummary } = createAttendanceService();
