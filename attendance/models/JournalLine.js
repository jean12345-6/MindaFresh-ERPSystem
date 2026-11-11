// shared/models/JournalLine.js  (owner: Jean, Accounting) — table: journal_lines
// Each line is either a debit or a credit, never both (CHECK chk_line_one_side).
import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

export const JournalLine = sequelize.define("JournalLine", {
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  journal_entry_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  account_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  debit: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  credit: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  memo: DataTypes.STRING(255)
}, { tableName: "journal_lines" });
