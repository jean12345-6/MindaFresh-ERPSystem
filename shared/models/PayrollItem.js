import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

const id = {
  type: DataTypes.INTEGER.UNSIGNED,
  primaryKey: true,
  autoIncrement: true,
};

export const PayrollItem = sequelize.define("PayrollItem", {
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
  overtime_minutes: { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 0 },
  overtime_pay: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  basic_pay: DataTypes.DECIMAL(12, 2),
  tardiness_deduction: DataTypes.DECIMAL(12, 2),
  gross_pay: DataTypes.DECIMAL(12, 2),
  sss: DataTypes.DECIMAL(12, 2),
  philhealth: DataTypes.DECIMAL(12, 2),
  pagibig: DataTypes.DECIMAL(12, 2),
  withholding_tax: DataTypes.DECIMAL(12, 2),
  net_pay: DataTypes.DECIMAL(12, 2),
}, { tableName: "payroll_items" });

export { sequelize };
