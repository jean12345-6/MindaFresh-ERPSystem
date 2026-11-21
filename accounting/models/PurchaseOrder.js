// shared/models/PurchaseOrder.js  (owner: Bren, POS) — table: purchase_orders
// status: draft → ordered → received, or cancelled. Accounting posts a "purchase" entry once it is received.
import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";
import { addCodeHook } from "./codeHook.js";

export const PurchaseOrder = sequelize.define("PurchaseOrder", {
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  purchase_order_code: { type: DataTypes.STRING(20), unique: true },
  supplier_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  employee_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  order_date: { type: DataTypes.DATEONLY, allowNull: false },
  expected_date: DataTypes.DATEONLY,
  total_cost: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  payment_method: { type: DataTypes.STRING(20), allowNull: false },
  status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "draft" },
  received_at: DataTypes.DATE
}, { tableName: "purchase_orders" });

addCodeHook(PurchaseOrder, "purchase_order_code", "PUR");
