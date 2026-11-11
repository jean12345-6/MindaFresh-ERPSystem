// pos/utils/barcode.js — barcode support that never needs a schema change.
// If products.barcode exists in the DB, the Product model learns it at runtime. If not, nothing breaks:
// scanning/typing falls back to product_code (PRD-0001), the bare number (1 / 0001) or the name.
import { DataTypes } from "sequelize";
import { sequelize, Product } from "../models/index.js";

let supported = null;
export async function ensureBarcode() {
  if (supported !== null) return supported;
  try {
    const cols = await sequelize.getQueryInterface().describeTable("products");
    supported = Boolean(cols.barcode);
    if (supported && !Product.rawAttributes.barcode) {
      Product.rawAttributes.barcode = { type: DataTypes.STRING(50), field: "barcode", fieldName: "barcode" };
      Product.refreshAttributes();
    }
    return supported;
  } catch { return false; } // DB offline: try again on the next request
}
