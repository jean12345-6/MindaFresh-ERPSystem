import express from "express";
import { STAFF_ROLES, SELF_SERVICE_ROLES } from "../utils/roles.js";
import rateLimit from "express-rate-limit";
import {
  loginPage,
  loginUser,
  dashboardPage,
  logoutUser,
} from "../controllers/authController.js";
import {
  employeesPage,
  employeeFormPage,
  saveEmployee,
  departmentsPage,
  saveDepartment,
  usersPage,
  createUser,
  updateUser,
} from "../controllers/employeeController.js";
import {
  leavesPage,
  storeLeave,
  updateLeave,
} from "../controllers/leaveController.js";
import {
  payrollPage,
  payrollDetailsPage,
  storePayroll,
  recalculatePayroll,
  approvePayrollRun,
  payslipsPage,
  payslipPage,
} from "../controllers/payrollController.js";
import {
  attendancePage,
  reportsPage,
  exportReport,
  connectionsPage,
  settingsPage,
} from "../controllers/reportController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

import { profilePage } from "../controllers/profileController.js";

const router = express.Router();
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
});

router.get("/login", loginPage);
router.post("/login", loginLimiter, loginUser);

router.use(requireAuth);
router.use(requireRole(...STAFF_ROLES));

router.get("/", dashboardPage);
router.get("/dashboard", dashboardPage);
router.get("/profile", profilePage);
router.post("/logout", logoutUser);

router.get(
  "/employees",
  requireRole("admin", "hr_staff", "accountant"),
  employeesPage,
);
router.get(
  "/employees/create",
  requireRole("admin", "hr_staff"),
  employeeFormPage,
);
router.get(
  "/employees/:id/edit",
  requireRole("admin", "hr_staff"),
  employeeFormPage,
);
router.post("/employees", requireRole("admin", "hr_staff"), saveEmployee);
router.post(
  "/employees/:id/update",
  requireRole("admin", "hr_staff"),
  saveEmployee,
);

router.get("/departments", requireRole("admin", "hr_staff"), departmentsPage);
router.post("/departments", requireRole("admin", "hr_staff"), saveDepartment);
router.post(
  "/departments/:id/update",
  requireRole("admin", "hr_staff"),
  saveDepartment,
);

router.get("/users", requireRole("admin", "hr_staff"), usersPage);
router.post("/users", requireRole("admin", "hr_staff"), createUser);
router.post("/users/:id/update", requireRole("admin", "hr_staff"), updateUser);

router.get("/leaves", requireRole("admin", "hr_staff", ...SELF_SERVICE_ROLES), leavesPage);
router.post(
  "/leaves",
  requireRole("admin", "hr_staff", ...SELF_SERVICE_ROLES),
  storeLeave,
);
router.post(
  "/leaves/:id/update",
  requireRole("admin", "hr_staff", ...SELF_SERVICE_ROLES),
  updateLeave,
);

router.get("/attendance", requireRole("admin", "hr_staff"), attendancePage);
router.get(
  "/payroll",
  requireRole("admin", "hr_staff", "accountant"),
  payrollPage,
);
router.get(
  "/payroll/:id",
  requireRole("admin", "hr_staff", "accountant"),
  payrollDetailsPage,
);
router.post("/payroll", requireRole("admin", "hr_staff"), storePayroll);
router.post(
  "/payroll/:id/recompute",
  requireRole("admin", "hr_staff"),
  recalculatePayroll,
);
router.post("/payroll/:id/approve", requireRole("admin"), approvePayrollRun);

router.get("/payslips", payslipsPage);
router.get("/payslips/:runId/:employeeId", payslipPage);
router.get(
  "/reports",
  requireRole("admin", "hr_staff", "accountant"),
  reportsPage,
);
router.get(
  "/reports/:type/export",
  requireRole("admin", "hr_staff", "accountant"),
  exportReport,
);
router.get(
  "/connections",
  requireRole("admin", "hr_staff", "accountant"),
  connectionsPage,
);
router.get("/settings", settingsPage);

export default router;
