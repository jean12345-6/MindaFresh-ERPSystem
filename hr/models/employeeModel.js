import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";

const id = {
  type: DataTypes.INTEGER.UNSIGNED,
  primaryKey: true,
  autoIncrement: true,
};

export const Employee = sequelize.define("employees", {
  id,
  employee_code: DataTypes.STRING(20),
  first_name: DataTypes.STRING(50),
  middle_name: DataTypes.STRING(50),
  last_name: DataTypes.STRING(50),
  email: DataTypes.STRING(100),
  phone: DataTypes.STRING(20),
  address: DataTypes.STRING(255),
  birth_date: DataTypes.DATEONLY,
  hire_date: DataTypes.DATEONLY,
  department_id: DataTypes.INTEGER.UNSIGNED,
  position: DataTypes.STRING(100),
  employment_type: DataTypes.STRING(20),
  daily_rate: DataTypes.DECIMAL(12, 2),
  vacation_leave_balance: DataTypes.INTEGER,
  sick_leave_balance: DataTypes.INTEGER,
  status: DataTypes.STRING(20),
});

Employee.afterCreate(async (row, options) => {
  row.employee_code = `EMP-${String(row.id).padStart(4, "0")}`;
  await row.save({ hooks: false, transaction: options.transaction });
});

export { sequelize };
