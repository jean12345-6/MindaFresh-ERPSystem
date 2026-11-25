import { getWorkspaceData } from "../services/workspaceService.js";
import {
  preparePayroll,
  recomputePayroll,
  approvePayroll,
} from "../services/payrollService.js";
import { need } from "../services/validation.js";
import { groupByDepartment } from "../utils/groupByDepartment.js";

export const payrollPage = async (req, res, next) => {
  try {
    const data = await getWorkspaceData(req.user);
    res.render("payroll", { title: "Payroll", activePayroll: true, ...data });
  } catch (error) {
    next(error);
  }
};

export const storePayroll = async (req, res, next) => {
  try {
    const id = await preparePayroll(req.body, req.user);
    req.flash(
      "success_msg",
      "Payroll draft prepared. Review all employee calculations.",
    );
    res.redirect("/payroll/" + id);
  } catch (error) {
    next(error);
  }
};

export const payrollDetailsPage = async (req, res, next) => {
  try {
    const data = await getWorkspaceData(req.user);

    const run = data.runs.find(
      run => Number(run.id) === Number(req.params.id),
    );

    need(run, "Payroll run not found or unavailable for your role.");

    const employeesById = new Map(
      data.employees.map(employee => [
        Number(employee.id),
        employee,
      ]),
    );

    // Add display metadata only; preserve saved payroll amounts.
    const displayItems = run.items.map(item => {
      const employee = employeesById.get(
        Number(item.employee_id),
      );

      return {
        ...item,
        department_id: employee?.department_id ?? null,
        department: employee?.department || "Unassigned",
        first_name: employee?.first_name || "",
        last_name: employee?.last_name || "",
        employee_code: employee?.employee_code || "",
        employee_name:
          item.employee_name ||
          employee?.full_name ||
          "Unknown employee",
      };
    });

    res.render("payroll-detail", {
      title: run.payroll_code,
      activePayroll: true,
      run,
      payrollDepartments: groupByDepartment(
        displayItems,
        data.departments,
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const recalculatePayroll = async (req, res, next) => {
  try {
    await recomputePayroll(req.params.id, req.user);
    req.flash(
      "success_msg",
      "Payroll draft recomputed. Review it before approval.",
    );
    res.redirect("/payroll/" + req.params.id);
  } catch (error) {
    next(error);
  }
};

export const approvePayrollRun = async (req, res, next) => {
  try {
    await approvePayroll(req.params.id, req.user);
    req.flash(
      "success_msg",
      "Payroll approved and locked. Ready for Accounting.",
    );
    res.redirect("/payroll/" + req.params.id);
  } catch (error) {
    next(error);
  }
};

export const payslipsPage = async (req, res, next) => {
  try {
    const data = await getWorkspaceData(req.user);
    res.render("payslips", {
      title: "Payslips",
      activePayslips: true,
      ...data,
    });
  } catch (error) {
    next(error);
  }
};

export const payslipPage = async (req, res, next) => {
  try {
    const data = await getWorkspaceData(req.user);
    const run = data.runs.find((run) => run.id === Number(req.params.runId));
    const item = run?.items.find(
      (item) => item.employee_id === Number(req.params.employeeId),
    );
    need(item, "Payslip not found or not released for your account.");
    const employee = data.employees.find(
      (employee) => employee.id === item.employee_id,
    );
    res.render("payslip", {
      title: "Employee payslip",
      activePayslips: true,
      run,
      item,
      employee,
    });
  } catch (error) {
    next(error);
  }
};
