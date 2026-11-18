import { rows } from "../models/db.js";
import { dateRange } from "../services/dates.js";
import { manilaToday, getSummary, summarizeRecords } from "../services/attendanceService.js";
import { getWorkspaceData } from "../services/workspaceService.js";

export const attendancePage = async (req, res, next) => {
  try {
    const today = manilaToday();
    const month = String(req.query.month || today.slice(0, 7));
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw Error("Select a valid month.");
    const cutoff = String(req.query.cutoff || (Number(today.slice(8, 10)) <= 15 ? "1" : "2"));
    if (!["1", "2"].includes(cutoff)) throw Error("Select a valid cutoff.");
    const [year, monthNumber] = month.split("-").map(Number);
    const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
    const start = month + (cutoff === "1" ? "-01" : "-16");
    const end = month + "-" + (cutoff === "1" ? "15" : String(lastDay));
    dateRange(start, end);
    const employeeId = req.query.employee_id ? Number(req.query.employee_id) : null;
    if (employeeId !== null && (!Number.isInteger(employeeId) || employeeId < 1)) throw Error("Select a valid employee.");
    const summaries = await getSummary(start, end);
    const data = await getWorkspaceData(req.user);
    const employees = data.employees.filter(e => e.hire_date <= end).sort((a, b) =>
      a.last_name.localeCompare(b.last_name, "en", { sensitivity: "base" }) ||
      a.first_name.localeCompare(b.first_name, "en", { sensitivity: "base" }) || Number(a.id) - Number(b.id));
    if (employeeId !== null && !employees.some(e => Number(e.id) === employeeId)) throw Error("Employee not found for this cutoff.");
    const summaryById = new Map(summaries.map(s => [Number(s.employee_id), s]));
    // getSummary in this project returns active employees. Preserve historical DTRs too.
    const historical = employees.filter(e => !summaryById.has(Number(e.id)));
    if (historical.length) {
      const logs = await rows("SELECT employee_id,log_date,status,late_minutes,undertime_minutes,overtime_minutes,hours_worked FROM attendance_logs WHERE log_date BETWEEN :start AND :end", { start, end });
      for (const summary of summarizeRecords(historical, logs, start, end)) summaryById.set(Number(summary.employee_id), summary);
    }
    const attendanceGroups = employees.filter(e => employeeId === null || Number(e.id) === employeeId).map(e => {
      const summary = summaryById.get(Number(e.id));
      const ot = Number(summary.overtime_minutes || 0);
      return { ...e, ...summary, overtime_display: Math.floor(ot / 60) + " h " + (ot % 60) + " m",
        hours_worked_display: Number(summary.hours_worked || 0).toFixed(2) };
    });
    res.render("attendance", { ...data, title: "Attendance", activeAttendance: true,
      month, start, end, firstCutoff: cutoff === "1", secondCutoff: cutoff === "2",
      employeesForFilter: employees.map(e => ({ ...e, selected: Number(e.id) === employeeId })), attendanceGroups });
  } catch (error) { next(error); }
};

export const reportsPage = async (req, res, next) => {
  try {
    const data = await getWorkspaceData(req.user);
    for (const department of data.departments)
      department.headcount = data.employees.filter(
        (employee) => employee.department_id === department.id,
      ).length;
    data.totalGross = data.runs.reduce(
      (sum, run) => sum + Number(run.total_gross),
      0,
    );
    data.totalNet = data.runs.reduce(
      (sum, run) => sum + Number(run.total_net),
      0,
    );
    res.render("reports", { title: "Reports", activeReports: true, ...data });
  } catch (error) {
    next(error);
  }
};

export const exportReport = async (req, res, next) => {
  try {
    const data = await getWorkspaceData(req.user);
    const collections = {
      employees: data.employees.map((employee) => ({
        employee_code: employee.employee_code,
        name: employee.full_name,
        department: employee.department,
        position: employee.position,
        status: employee.status,
        daily_rate: employee.daily_rate,
      })),
      leaves: data.leaves.map((leave) => ({
        leave_code: leave.leave_code,
        employee: leave.employee_name,
        type: leave.leave_type,
        start: leave.start_date,
        end: leave.end_date,
        days: leave.days,
        status: leave.status,
      })),
      payroll: data.runs.map((run) => ({
        payroll_code: run.payroll_code,
        start: run.period_start,
        end: run.period_end,
        employees: run.employee_count,
        gross: run.total_gross,
        deductions: run.total_deductions,
        net: run.total_net,
        status: run.display_status,
      })),
    };
    const collection = collections[req.params.type];
    if (!collection)
      return res
        .status(404)
        .render("error", {
          title: "Report not found",
          message: "Unknown report type.",
        });
    const escape = (value) => {
      let text = String(value ?? "");
      if (/^[=+@\-\t\r]/.test(text)) text = "'" + text;
      return '"' + text.replaceAll('"', '""') + '"';
    };
    const keys = Object.keys(collection[0] || { message: "" });
    const csv = [
      keys.map(escape).join(","),
      ...collection.map((row) => keys.map((key) => escape(row[key])).join(",")),
    ].join("\r\n");
    res.set("Content-Type", "text/csv; charset=utf-8");
    res.attachment("peoplepay-" + req.params.type + ".csv");
    res.send("\uFEFF" + csv);
  } catch (error) {
    next(error);
  }
};

export const connectionsPage = (req, res) => {
  res.render("connections", {
    title: "ERP connections",
    activeConnections: true,
  });
};

export const settingsPage = (req, res) => {
  res.render("settings", { title: "Settings", activeSettings: true });
};
