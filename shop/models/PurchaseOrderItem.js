// shared/models/PurchaseOrderItem.js  (owner: Bren, POS) — table: purchase_order_items
import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

export const PurchaseOrderItem = sequelize.define("PurchaseOrderItem", {
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  purchase_order_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  product_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  quantity: { type: DataTypes.INTEGER, allowNull: false },
  unit_cost: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  line_total: { type: DataTypes.DECIMAL(12, 2), allowNull: false }
}, { tableName: "purchase_order_items" });
