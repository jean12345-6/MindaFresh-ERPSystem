import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";

const id = {
  type: DataTypes.INTEGER.UNSIGNED,
  primaryKey: true,
  autoIncrement: true,
};

export const User = sequelize.define(
  "users",
  {
    id,
    user_code: DataTypes.STRING(20),
    employee_id: DataTypes.INTEGER.UNSIGNED,
    username: DataTypes.STRING(50),
    password: DataTypes.STRING(255),
    role: DataTypes.STRING(20),
    status: DataTypes.STRING(20),
    last_login_at: DataTypes.DATE,
  },
  { defaultScope: { attributes: { exclude: ["password"] } } },
);

User.afterCreate(async (row, options) => {
  row.user_code = `USR-${String(row.id).padStart(4, "0")}`;
  await row.save({ hooks: false, transaction: options.transaction });
});

export { sequelize };
