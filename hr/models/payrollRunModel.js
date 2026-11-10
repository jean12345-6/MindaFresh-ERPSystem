import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";

const id = {
  type: DataTypes.INTEGER.UNSIGNED,
  primaryKey: true,
  autoIncrement: true,
};

export const PayrollRun = sequelize.define("payroll_runs", {
  id,
  payroll_code: DataTypes.STRING(20),
  period_start: DataTypes.DATEONLY,
  period_end: DataTypes.DATEONLY,
  employee_count: DataTypes.INTEGER,
  total_gross: DataTypes.DECIMAL(12, 2),
  total_contributions: DataTypes.DECIMAL(12, 2),
  total_withholding_tax: DataTypes.DECIMAL(12, 2),
  total_net: DataTypes.DECIMAL(12, 2),
  status: DataTypes.STRING(20),
  prepared_by_id: DataTypes.INTEGER.UNSIGNED,
  approved_by_id: DataTypes.INTEGER.UNSIGNED,
  approved_at: DataTypes.DATE,
});

PayrollRun.afterCreate(async (row, options) => {
  row.payroll_code = `PAY-${String(row.id).padStart(4, "0")}`;
  await row.save({ hooks: false, transaction: options.transaction });
});

export { sequelize };
