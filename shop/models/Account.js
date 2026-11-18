// shared/models/Account.js  (owner: Jean, Accounting) — table: accounts (chart of accounts)
// account_code is the 4-digit code (1010, 4010 ...). It has no PREFIX-0001 code hook.
import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

export const Account = sequelize.define("Account", {
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  account_code: { type: DataTypes.STRING(10), allowNull: false, unique: true },
  account_name: { type: DataTypes.STRING(100), allowNull: false },
  account_type: { type: DataTypes.STRING(20), allowNull: false },   // asset, liability, equity, revenue, expense
  normal_balance: { type: DataTypes.STRING(10), allowNull: false }, // debit, credit
  is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
}, { tableName: "accounts" });
