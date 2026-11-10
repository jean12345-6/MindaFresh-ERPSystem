import { rows } from "../models/db.js";
import { dateRange } from "../services/dates.js";
import { manilaToday } from "../services/attendanceService.js";
import { getWorkspaceData } from "../services/workspaceService.js";

export const attendancePage = async (req, res, next) => {
  try {
    const data = await getWorkspaceData(req.user);
    const today = manilaToday();
    const start = String(req.query.start || today.slice(0, 8) + "01");
    const end = String(req.query.end || today);
    dateRange(start, end);
    const employeeId = req.query.employee_id ? Number(req.query.employee_id) : null;
    if (employeeId !== null && (!Number.isInteger(employeeId) || employeeId < 1)) throw Error("Select a valid employee.");
    data.attendance = await rows("SELECT a.*,CONCAT(e.first_name,' ',e.last_name) AS employee_name FROM attendance_logs a JOIN employees e ON e.id=a.employee_id WHERE a.log_date BETWEEN :start AND :end" + (employeeId ? " AND a.employee_id=:employeeId" : "") + " ORDER BY a.log_date,e.last_name,e.first_name", { start, end, employeeId });
    const time = value => value ? (typeof value === "string" ? value.replace("T", " ").slice(11, 16) : new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit" }).format(value)) : "—";
    for (const log of data.attendance) for (const key of ["time_in", "lunch_out", "lunch_in", "time_out"]) log[key + "_display"] = time(log[key]);
    const employees = data.employees.map(e => ({...e, selected: e.id === employeeId}));
    res.render("attendance", { start, end, employeesForFilter: employees,
      title: "Attendance",
      activeAttendance: true,
      ...data,
    });
  } catch (error) {
    next(error);
  }
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
