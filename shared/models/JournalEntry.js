// shared/models/JournalEntry.js  (owner: Jean, Accounting) — table: journal_entries
// One row per business event. (source_module, entry_type, reference_code) is unique, so an event is never posted twice.
import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";
import { addCodeHook } from "./codeHook.js";

export const JournalEntry = sequelize.define("JournalEntry", {
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  entry_code: { type: DataTypes.STRING(20), unique: true },
  entry_date: { type: DataTypes.DATEONLY, allowNull: false },
  description: { type: DataTypes.STRING(255), allowNull: false },
  source_module: { type: DataTypes.STRING(20), allowNull: false },  // shop, pos, hr, accounting
  entry_type: { type: DataTypes.STRING(20), allowNull: false },     // opening, sale, sale_reversal, purchase, stock_adjustment, payroll, salary_release, remittance, manual
  reference_code: DataTypes.STRING(20),                             // SAL-0001, ORD-0001, PUR-0001, STK-0001, PAY-0001, REL-0001, REM-0001
  total_debit: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  total_credit: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "posted" }, // posted, voided
  posted_by_id: DataTypes.INTEGER.UNSIGNED
}, { tableName: "journal_entries" });

addCodeHook(JournalEntry, "entry_code", "TXN");
