import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";

const id = {
  type: DataTypes.INTEGER.UNSIGNED,
  primaryKey: true,
  autoIncrement: true,
};

export const Department = sequelize.define("departments", {
  id,
  department_code: DataTypes.STRING(20),
  name: DataTypes.STRING(100),
});

Department.afterCreate(async (row, options) => {
  row.department_code = `DEP-${String(row.id).padStart(4, "0")}`;
  await row.save({ hooks: false, transaction: options.transaction });
});

export { sequelize };
