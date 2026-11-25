import { rows } from "../models/db.js";
import { dateRange } from "../services/dates.js";
import {
  manilaToday,
  getSummary,
  summarizeRecords,
} from "../services/attendanceService.js";
import { getWorkspaceData } from "../services/workspaceService.js";

export const attendancePage = async (req, res, next) => {
  try {
    const today = manilaToday();
    const month = String(req.query.month || today.slice(0, 7));

    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      throw Error("Select a valid month.");
    }

    const cutoff = String(
      req.query.cutoff ||
        (Number(today.slice(8, 10)) <= 15 ? "1" : "2"),
    );

    if (!["1", "2"].includes(cutoff)) {
      throw Error("Select a valid cutoff.");
    }

    const [year, monthNumber] = month.split("-").map(Number);
    const lastDay = new Date(
      Date.UTC(year, monthNumber, 0),
    ).getUTCDate();

    const start = month + (cutoff === "1" ? "-01" : "-16");
    const end =
      month + "-" + (cutoff === "1" ? "15" : String(lastDay));

    dateRange(start, end);

    const employeeId = req.query.employee_id
      ? Number(req.query.employee_id)
      : null;

    if (
      employeeId !== null &&
      (!Number.isInteger(employeeId) || employeeId < 1)
    ) {
      throw Error("Select a valid employee.");
    }

    const summaries = await getSummary(start, end);
    const data = await getWorkspaceData(req.user);

    const employees = data.employees
      .filter(employee => employee.hire_date <= end)
      .sort(
        (a, b) =>
          a.last_name.localeCompare(b.last_name, "en", {
            sensitivity: "base",
          }) ||
          a.first_name.localeCompare(b.first_name, "en", {
            sensitivity: "base",
          }) ||
          Number(a.id) - Number(b.id),
      );

    if (
      employeeId !== null &&
      !employees.some(employee => Number(employee.id) === employeeId)
    ) {
      throw Error("Employee not found for this cutoff.");
    }

    const summaryById = new Map(
      summaries.map(summary => [
        Number(summary.employee_id),
        summary,
      ]),
    );

    // getSummary returns active employees. Preserve historical DTRs too.
    const historical = employees.filter(
      employee => !summaryById.has(Number(employee.id)),
    );

    if (historical.length) {
      const logs = await rows(
        "SELECT employee_id,log_date,status,late_minutes,undertime_minutes,overtime_minutes,hours_worked FROM attendance_logs WHERE log_date BETWEEN :start AND :end",
        { start, end },
      );

      for (const summary of summarizeRecords(
        historical,
        logs,
        start,
        end,
      )) {
        summaryById.set(Number(summary.employee_id), summary);
      }
    }

    const attendanceGroups = employees
      .filter(
        employee =>
          employeeId === null ||
          Number(employee.id) === employeeId,
      )
      .map(employee => {
        const summary = summaryById.get(Number(employee.id));
        const ot = Number(summary.overtime_minutes || 0);

        return {
          ...employee,
          ...summary,
          overtime_display:
            Math.floor(ot / 60) + " h " + (ot % 60) + " m",
          hours_worked_display: Number(
            summary.hours_worked || 0,
          ).toFixed(2),
        };
      });

    const departmentsById = new Map(
      data.departments.map(department => [
        Number(department.id),
        department.name,
      ]),
    );

    const groupedDepartments = new Map();

    for (const employee of attendanceGroups) {
      const departmentId = Number(employee.department_id) || null;

      const departmentName =
        departmentsById.get(departmentId) ||
        employee.department ||
        "Unassigned";

      // Group by ID so departments with similar names stay separate.
      const key =
        departmentId === null ? "unassigned" : departmentId;

      if (!groupedDepartments.has(key)) {
        groupedDepartments.set(key, {
          department_id: departmentId,
          department_name: departmentName,
          employees: [],
        });
      }

      groupedDepartments.get(key).employees.push(employee);
    }

    const compareNames = (a, b) =>
      String(a || "").localeCompare(String(b || ""), "en", {
        sensitivity: "base",
      });

    const attendanceDepartments = Array.from(
      groupedDepartments.values(),
    ).sort(
      (a, b) =>
        compareNames(a.department_name, b.department_name) ||
        Number(a.department_id) - Number(b.department_id),
    );

    for (const department of attendanceDepartments) {
      department.employees.sort(
        (a, b) =>
          compareNames(a.last_name, b.last_name) ||
          compareNames(a.first_name, b.first_name) ||
          Number(a.id) - Number(b.id),
      );

      department.employee_count = department.employees.length;
    }

    // Render only after attendanceDepartments has been built.
    res.render("attendance", {
      ...data,
      title: "Attendance",
      activeAttendance: true,
      month,
      start,
      end,
      firstCutoff: cutoff === "1",
      secondCutoff: cutoff === "2",
      employeesForFilter: employees.map(employee => ({
        ...employee,
        selected: Number(employee.id) === employeeId,
      })),
      attendanceGroups,
      attendanceDepartments,
    });
  } catch (error) {
    next(error);
  }
};

export const reportsPage = async (req, res, next) => {
  try {
    const data = await getWorkspaceData(req.user);

    for (const department of data.departments) {
      department.headcount = data.employees.filter(
        employee => employee.department_id === department.id,
      ).length;
    }

    data.totalGross = data.runs.reduce(
      (sum, run) => sum + Number(run.total_gross),
      0,
    );

    data.totalNet = data.runs.reduce(
      (sum, run) => sum + Number(run.total_net),
      0,
    );

    res.render("reports", {
      title: "Reports",
      activeReports: true,
      ...data,
    });
  } catch (error) {
    next(error);
  }
};

export const exportReport = async (req, res, next) => {
  try {
    const data = await getWorkspaceData(req.user);

    const collections = {
      employees: data.employees.map(employee => ({
        employee_code: employee.employee_code,
        name: employee.full_name,
        department: employee.department,
        position: employee.position,
        status: employee.status,
        daily_rate: employee.daily_rate,
      })),

      leaves: data.leaves.map(leave => ({
        leave_code: leave.leave_code,
        employee: leave.employee_name,
        type: leave.leave_type,
        start: leave.start_date,
        end: leave.end_date,
        days: leave.days,
        status: leave.status,
      })),

      payroll: data.runs.map(run => ({
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

    if (!collection) {
      return res.status(404).render("error", {
        title: "Report not found",
        message: "Unknown report type.",
      });
    }

    const escape = value => {
      let text = String(value ?? "");

      if (/^[=+@\-\t\r]/.test(text)) {
        text = "'" + text;
      }

      return '"' + text.replaceAll('"', '""') + '"';
    };

    const keys = Object.keys(
      collection[0] || { message: "" },
    );

    const csv = [
      keys.map(escape).join(","),
      ...collection.map(row =>
        keys.map(key => escape(row[key])).join(","),
      ),
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
  res.render("settings", {
    title: "Settings",
    activeSettings: true,
  });
};