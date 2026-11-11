// shared/models/SalaryRelease.js  (owner: Jean, Accounting) — table: salary_releases
// Accounting creates one row per approved payroll run; HR reads it to see if salaries were paid.
import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";
import { addCodeHook } from "./codeHook.js";

export const SalaryRelease = sequelize.define("SalaryRelease", {
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  release_code: { type: DataTypes.STRING(20), unique: true },
  payroll_run_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, unique: true },
  release_method: DataTypes.STRING(20),   // bank_transfer, cash (set when released)
  status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "pending" }, // pending, released
  released_at: DataTypes.DATE,
  released_by_id: DataTypes.INTEGER.UNSIGNED
}, { tableName: "salary_releases" });

addCodeHook(SalaryRelease, "release_code", "REL");
