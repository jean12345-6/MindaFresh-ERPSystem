// shared/models/Supplier.js  (owner: Bren, POS) — table: suppliers
import { DataTypes } from "sequelize";
import { sequelize } from "../config/database.js";
import { addCodeHook } from "./codeHook.js";

export const Supplier = sequelize.define("Supplier", {
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  supplier_code: { type: DataTypes.STRING(20), unique: true },
  name: { type: DataTypes.STRING(150), allowNull: false },
  contact_person: DataTypes.STRING(100),
  phone: DataTypes.STRING(20),
  email: DataTypes.STRING(100),
  address: DataTypes.STRING(255),
  status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "active" }
}, { tableName: "suppliers" });

addCodeHook(Supplier, "supplier_code", "SUP");
