// shared/models/ProductReview.js  (owner: Ali, Shop) — table: product_reviews
// One review per customer per product, only after the product was delivered to that customer.
import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";

export const REVIEW_STATUSES = ["visible", "hidden"];

export const ProductReview = sequelize.define("ProductReview", {
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  customer_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  product_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  order_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false }, // the delivered order that proves the purchase
  rating: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false },     // 1–5 (CHECK chk_review_rating)
  comment: DataTypes.STRING(500),
  status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "visible" } // visible / hidden (admin)
}, { tableName: "product_reviews" });

// Class diagram: +isVisible(): boolean
ProductReview.prototype.isVisible = function () {
  return this.status === "visible";
};
