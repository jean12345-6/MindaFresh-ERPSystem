import bcrypt from "bcryptjs";
import { sequelize, rows } from "../models/db.js";
import { Employee } from "../models/employeeModel.js";
import { Department } from "../models/departmentModel.js";
import { User } from "../models/userModel.js";
import { employeeInput, need } from "../services/validation.js";

export const saveEmployee = async (req, res, next) => {
  try {
    const values = employeeInput(req.body);
    await sequelize.transaction(async (transaction) => {
      const department = await Department.findByPk(values.department_id, {
        transaction,
      });
      need(department, "Department not found.");
      if (req.params.id) {
        const employee = await Employee.findByPk(req.params.id, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        need(employee, "Employee not found.");
        need(
          employee.id !== req.user.employee_id || values.status === "active",
          "You cannot deactivate your own employee record.",
        );
        await employee.update(values, { transaction });
        if (values.status !== "active") {
          await User.update(
            { status: "disabled" },
            { where: { employee_id: employee.id }, transaction },
          );
        }
      } else {
        await Employee.create(
          { ...values, vacation_leave_balance: 5, sick_leave_balance: 5 },
          { transaction },
        );
      }
    });
    req.flash("success_msg", "Employee saved.");
    res.redirect("/employees");
  } catch (error) {
    next(error);
  }
};

export const createUser = async (req, res, next) => {
  try {
    const { username, password, role } = req.body;
    const employee_id = Number(req.body.employee_id);
    need(
      typeof username === "string" && /^[A-Za-z0-9_.-]{3,50}$/.test(username),
      "Use a username with 3–50 letters, numbers, dots, underscores or hyphens.",
    );
    need(
      typeof password === "string" &&
        password.length >= 10 &&
        Buffer.byteLength(password) <= 72,
      "Password must be 10–72 bytes.",
    );
    need(
      [
        "admin",
        "hr_staff",
        "accountant",
        "cashier",
        "inventory_staff",
        "employee",
      ].includes(role),
      "Invalid role.",
    );
    need(
      req.user.role === "admin" || role !== "admin",
      "Only an administrator can create admin accounts.",
    );
    need(Number.isInteger(employee_id), "Select an employee.");
    const hashed = await bcrypt.hash(password, 12);
    await sequelize.transaction(async (transaction) => {
      const employee = await Employee.findByPk(employee_id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      need(
        employee && employee.status === "active",
        "An active employee is required.",
      );
      await User.create(
        { employee_id, username, password: hashed, role, status: "active" },
        { transaction },
      );
    });
    req.flash("success_msg", "Staff account created.");
    res.redirect("/users");
  } catch (error) {
    next(error);
  }
};

export const saveDepartment = async (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim();
    need(
      name && name.length <= 100,
      "Department name is required (maximum 100 characters).",
    );
    await sequelize.transaction(async (transaction) => {
      if (req.params.id) {
        const department = await Department.findByPk(req.params.id, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        need(department, "Department not found.");
        await department.update({ name }, { transaction });
      } else {
        await Department.create({ name }, { transaction });
      }
    });
    req.flash("success_msg", "Department saved.");
    res.redirect("/departments");
  } catch (error) {
    next(error);
  }
};

export const updateUser = async (req, res, next) => {
  try {
    const { status, role } = req.body;
    need(["active", "disabled"].includes(status), "Invalid account status.");
    need(
      [
        "admin",
        "hr_staff",
        "accountant",
        "cashier",
        "inventory_staff",
        "employee",
      ].includes(role),
      "Invalid role.",
    );
    await sequelize.transaction(async (transaction) => {
      const user = await User.findByPk(req.params.id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      need(user, "Account not found.");
      need(
        req.user.role === "admin" ||
          (user.role !== "admin" && role !== "admin"),
        "Administrator access required.",
      );
      need(
        user.id !== req.user.id || (status === "active" && role === user.role),
        "You cannot disable or change the role of your own account.",
      );
      const employee = await Employee.findByPk(user.employee_id, {
        transaction,
      });
      need(
        status !== "active" || employee.status === "active",
        "Activate the employee before enabling this account.",
      );
      await user.update({ role, status }, { transaction });
    });
    req.flash("success_msg", "Account updated.");
    res.redirect("/users");
  } catch (error) {
    next(error);
  }
};

export const employeesPage = async (req, res, next) => {
  try {
    const { getWorkspaceData } = await import(
      "../services/workspaceService.js"
    );
    const data = await getWorkspaceData(req.user);
    const search = String(req.query.search || "").trim();
    const status = ["active", "inactive", "resigned"].includes(req.query.status)
      ? req.query.status
      : "";
    data.employees = data.employees.filter(
      (employee) =>
        (!status || employee.status === status) &&
        (
          employee.full_name +
          " " +
          employee.employee_code +
          " " +
          employee.position +
          " " +
          employee.department
        )
          .toLowerCase()
          .includes(search.toLowerCase()),
    );
    res.render("employees", {
      title: "Employees",
      activeEmployees: true,
      search,
      status,
      ...data,
    });
  } catch (error) {
    next(error);
  }
};

export const employeeFormPage = async (req, res, next) => {
  try {
    const departments = await rows("SELECT * FROM departments ORDER BY name");
    let employee = {
      status: "active",
      employment_type: "regular",
      daily_rate: 650,
      hire_date: new Date().toLocaleDateString("en-CA", {
        timeZone: "Asia/Manila",
      }),
    };
    if (req.params.id) {
      [employee] = await rows("SELECT * FROM employees WHERE id=:id", {
        id: Number(req.params.id),
      });
      need(employee, "Employee not found.");
    }
    res.render("employee-form", {
      title: req.params.id ? "Edit employee" : "Add employee",
      activeEmployees: true,
      employee,
      departments,
      formAction: req.params.id
        ? "/employees/" + req.params.id + "/update"
        : "/employees",
    });
  } catch (error) {
    next(error);
  }
};

export const departmentsPage = async (req, res, next) => {
  try {
    const departments = await rows("SELECT * FROM departments ORDER BY name");
    res.render("departments", {
      title: "Departments",
      activeDepartments: true,
      departments,
    });
  } catch (error) {
    next(error);
  }
};

export const usersPage = async (req, res, next) => {
  try {
    const { getWorkspaceData } = await import(
      "../services/workspaceService.js"
    );
    const data = await getWorkspaceData(req.user);
    const availableEmployees = data.employees.filter(
      (employee) =>
        employee.status === "active" &&
        !data.users.some((account) => account.employee_id === employee.id),
    );
    const roles =
      req.user.role === "admin"
        ? [
            "admin",
            "hr_staff",
            "accountant",
            "cashier",
            "inventory_staff",
            "employee",
          ]
        : ["hr_staff", "accountant", "cashier", "inventory_staff", "employee"];
    for (const account of data.users)
      account.can_manage =
        req.user.role === "admin" || account.role !== "admin";
    res.render("users", {
      title: "Staff accounts",
      activeUsers: true,
      availableEmployees,
      roles,
      ...data,
    });
  } catch (error) {
    next(error);
  }
};
