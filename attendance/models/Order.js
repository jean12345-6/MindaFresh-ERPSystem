// shared/models/Order.js  (owner: Ali, Shop) — table: orders
import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";
import { addCodeHook } from "./codeHook.js";

export const Order = sequelize.define("Order", {
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  order_code: { type: DataTypes.STRING(20), unique: true },
  customer_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  subtotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  shipping_fee: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  total_amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  total_cost: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  payment_method: { type: DataTypes.STRING(20), allowNull: false },
  payment_status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "unpaid" },
  order_status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "pending" },
  delivery_address: { type: DataTypes.STRING(255), allowNull: false },
  ordered_at: { type: DataTypes.DATE, allowNull: false },
  delivered_at: DataTypes.DATE
}, { tableName: "orders" });

addCodeHook(Order, "order_code", "ORD");

// State machine (Figure 11): the one-step moves allowed from each status.
// The first entry is the next delivery step; cancelled / returned are the side exits.
export const ORDER_FLOW = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["out_for_delivery", "cancelled"],
  out_for_delivery: ["delivered", "cancelled"],
  delivered: ["returned"],
  cancelled: [],
  returned: []
};
// Who may cancel at which status: customers only while pending, the admin until delivery
export const CANCEL_RULES = { customer: ["pending"], admin: ["pending", "confirmed", "out_for_delivery"] };

// Class diagram (Figure 2): +nextStatuses(): OrderStatus[]
Order.prototype.nextStatuses = function () {
  return ORDER_FLOW[this.order_status] ?? [];
};

// Class diagram (Figure 2): +canCancel(role): boolean   (role = "customer" | "admin")
Order.prototype.canCancel = function (role) {
  return (CANCEL_RULES[role] ?? []).includes(this.order_status);
};
