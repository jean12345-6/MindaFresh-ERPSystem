// shared/models/Sale.js  (owner: Bren, POS) — table: sales (in-store checkouts)
// total_cost is the cost of goods sold, taken from stock movements. Accounting posts "sale" and,
// for voided sales, "sale_reversal" entries from this table.
import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";
import { addCodeHook } from "./codeHook.js";

// A function, so each column gets its own object (Sequelize changes the object it is given).
const money = () => ({ type: DataTypes.DECIMAL(12, 2), allowNull: false });

export const Sale = sequelize.define(
  "Sale",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    sale_code: { type: DataTypes.STRING(20), unique: true },
    employee_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    subtotal: money(),
    discount_amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
    },
    total_amount: money(),
    total_cost: money(),
    amount_paid: money(),
    change_amount: money(),
    payment_method: { type: DataTypes.STRING(20), allowNull: false },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "completed",
    },
    void_reason: DataTypes.STRING(255),
    sold_at: { type: DataTypes.DATE, allowNull: false },
  },
  { tableName: "sales" },
);

addCodeHook(Sale, "sale_code", "SAL");
