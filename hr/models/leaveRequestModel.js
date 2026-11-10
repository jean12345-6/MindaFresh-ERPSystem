import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";

const id = {
  type: DataTypes.INTEGER.UNSIGNED,
  primaryKey: true,
  autoIncrement: true,
};

export const LeaveRequest = sequelize.define("leave_requests", {
  id,
  leave_code: DataTypes.STRING(20),
  employee_id: DataTypes.INTEGER.UNSIGNED,
  leave_type: DataTypes.STRING(20),
  start_date: DataTypes.DATEONLY,
  end_date: DataTypes.DATEONLY,
  days: DataTypes.INTEGER,
  reason: DataTypes.STRING(255),
  status: DataTypes.STRING(20),
  approved_by_id: DataTypes.INTEGER.UNSIGNED,
});

LeaveRequest.afterCreate(async (row, options) => {
  row.leave_code = `LVE-${String(row.id).padStart(4, "0")}`;
  await row.save({ hooks: false, transaction: options.transaction });
});

export { sequelize };
