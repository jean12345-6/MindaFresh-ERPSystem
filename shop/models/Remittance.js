// shared/models/Remittance.js  (owner: Jean, Accounting) — table: remittances
// Monthly payment to SSS, PhilHealth, Pag-IBIG or BIR. One row per agency per month.
import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";
import { addCodeHook } from "./codeHook.js";

export const Remittance = sequelize.define("Remittance", {
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  remittance_code: { type: DataTypes.STRING(20), unique: true },
  agency: { type: DataTypes.STRING(20), allowNull: false },        // sss, philhealth, pagibig, bir
  period_month: { type: DataTypes.STRING(7), allowNull: false },   // 2026-10
  amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  reference_number: DataTypes.STRING(50),
  status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "pending" }, // pending, paid
  paid_at: DataTypes.DATE,
  recorded_by_id: DataTypes.INTEGER.UNSIGNED
}, { tableName: "remittances" });

addCodeHook(Remittance, "remittance_code", "REM");
