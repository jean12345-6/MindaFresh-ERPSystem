import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";

const id = {
  type: DataTypes.INTEGER.UNSIGNED,
  primaryKey: true,
  autoIncrement: true,
};

export const PayrollItem = sequelize.define("payroll_items", {
  id,
  payroll_run_id: DataTypes.INTEGER.UNSIGNED,
  employee_id: DataTypes.INTEGER.UNSIGNED,
  daily_rate: DataTypes.DECIMAL(12, 2),
  days_worked: DataTypes.INTEGER,
  paid_leave_days: DataTypes.INTEGER,
  paid_holiday_days: DataTypes.INTEGER,
  unpaid_days: DataTypes.INTEGER,
  late_minutes: DataTypes.INTEGER,
  undertime_minutes: DataTypes.INTEGER,
  basic_pay: DataTypes.DECIMAL(12, 2),
  tardiness_deduction: DataTypes.DECIMAL(12, 2),
  gross_pay: DataTypes.DECIMAL(12, 2),
  sss: DataTypes.DECIMAL(12, 2),
  philhealth: DataTypes.DECIMAL(12, 2),
  pagibig: DataTypes.DECIMAL(12, 2),
  withholding_tax: DataTypes.DECIMAL(12, 2),
  net_pay: DataTypes.DECIMAL(12, 2),
});

export { sequelize };
