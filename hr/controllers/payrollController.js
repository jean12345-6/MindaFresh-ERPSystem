import { getWorkspaceData } from "../services/workspaceService.js";
import {
  preparePayroll,
  recomputePayroll,
  approvePayroll,
} from "../services/payrollService.js";
import { need } from "../services/validation.js";

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
    const run = data.runs.find((run) => run.id === Number(req.params.id));
    need(run, "Payroll run not found or unavailable for your role.");
    res.render("payroll-detail", {
      title: run.payroll_code,
      activePayroll: true,
      run,
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
