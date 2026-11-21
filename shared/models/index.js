// shared/models/index.js — all models and their associations.
// This file has the 11 models the Online Shop uses. Each owner adds the rest of the 26
// (departments, leave_requests, payroll, suppliers, purchase orders, sales, attendance, accounting).
import { sequelize } from "../config/database.js";
import { Employee } from "./Employee.js";
import { User } from "./User.js";
import { Category } from "./Category.js";
import { Product } from "./Product.js";
import { StockLevel } from "./StockLevel.js";
import { StockMovement } from "./StockMovement.js";
import { Customer } from "./Customer.js";
import { CartItem } from "./CartItem.js";
import { Order } from "./Order.js";
import { OrderItem } from "./OrderItem.js";
import { ProductReview } from "./ProductReview.js";
// POS (Bren)
import { Supplier } from "./Supplier.js";
import { PurchaseOrder } from "./PurchaseOrder.js";
import { PurchaseOrderItem } from "./PurchaseOrderItem.js";
import { Sale } from "./Sale.js";
import { SaleItem } from "./SaleItem.js";
// Accounting (Jean)
import { Account } from "./Account.js";
import { JournalEntry } from "./JournalEntry.js";
import { JournalLine } from "./JournalLine.js";
import { SalaryRelease } from "./SalaryRelease.js";
import { Remittance } from "./Remittance.js";

// HR (Fate)
import { Department } from "./Department.js";
import { LeaveRequest } from "./LeaveRequest.js";
import { PayrollRun } from "./PayrollRun.js";
import { PayrollItem } from "./PayrollItem.js";

Department.hasMany(Employee, { foreignKey: "department_id" });
Employee.belongsTo(Department, { foreignKey: "department_id" });

Employee.hasMany(LeaveRequest, { foreignKey: "employee_id" });
LeaveRequest.belongsTo(Employee, { foreignKey: "employee_id" });

PayrollRun.hasMany(PayrollItem, { foreignKey: "payroll_run_id" });
PayrollItem.belongsTo(PayrollRun, { foreignKey: "payroll_run_id" });

Employee.hasMany(PayrollItem, { foreignKey: "employee_id" });
PayrollItem.belongsTo(Employee, { foreignKey: "employee_id" });

User.belongsTo(Employee, { foreignKey: "employee_id" });
Employee.hasOne(User, { foreignKey: "employee_id" });

// POS (Bren)
Product.hasMany(StockMovement, { foreignKey: "product_id" });
StockMovement.belongsTo(Sale, { foreignKey: "sale_id" });
StockMovement.belongsTo(PurchaseOrder, {
  foreignKey: "purchase_order_id",
});

Supplier.hasMany(PurchaseOrder, { foreignKey: "supplier_id" });
PurchaseOrder.belongsTo(Supplier, { foreignKey: "supplier_id" });
PurchaseOrder.belongsTo(Employee, { foreignKey: "employee_id" });

PurchaseOrder.hasMany(PurchaseOrderItem, {
  foreignKey: "purchase_order_id",
});
PurchaseOrderItem.belongsTo(PurchaseOrder, {
  foreignKey: "purchase_order_id",
});
PurchaseOrderItem.belongsTo(Product, { foreignKey: "product_id" });

Sale.belongsTo(Employee, { foreignKey: "employee_id" });
Sale.hasMany(SaleItem, { foreignKey: "sale_id" });
SaleItem.belongsTo(Sale, { foreignKey: "sale_id" });
SaleItem.belongsTo(Product, { foreignKey: "product_id" });

// POS
Product.belongsTo(Category, { foreignKey: "category_id" });
Category.hasMany(Product, { foreignKey: "category_id" });
Product.hasOne(StockLevel, { foreignKey: "product_id" });
StockLevel.belongsTo(Product, { foreignKey: "product_id" });
StockMovement.belongsTo(Product, { foreignKey: "product_id" });
StockMovement.belongsTo(Employee, { foreignKey: "employee_id" });
StockMovement.belongsTo(Order, { foreignKey: "order_id" });

// Shop
CartItem.belongsTo(Customer, { foreignKey: "customer_id" });
CartItem.belongsTo(Product, { foreignKey: "product_id" });
Customer.hasMany(CartItem, { foreignKey: "customer_id" });
Order.belongsTo(Customer, { foreignKey: "customer_id" });
Customer.hasMany(Order, { foreignKey: "customer_id" });
Order.hasMany(OrderItem, { foreignKey: "order_id" });
Order.belongsTo(Employee, { foreignKey: "delivered_by_id", as: "DeliveredBy" });
OrderItem.belongsTo(Order, { foreignKey: "order_id" });
OrderItem.belongsTo(Product, { foreignKey: "product_id" });
ProductReview.belongsTo(Customer, { foreignKey: "customer_id" });
ProductReview.belongsTo(Product, { foreignKey: "product_id" });
ProductReview.belongsTo(Order, { foreignKey: "order_id" });
Product.hasMany(ProductReview, { foreignKey: "product_id" });
Customer.hasMany(ProductReview, { foreignKey: "customer_id" });

// Accounting (Jean)
JournalEntry.hasMany(JournalLine, { foreignKey: "journal_entry_id" });
JournalLine.belongsTo(JournalEntry, { foreignKey: "journal_entry_id" });
JournalLine.belongsTo(Account, { foreignKey: "account_id" });
Account.hasMany(JournalLine, { foreignKey: "account_id" });
JournalEntry.belongsTo(Employee, { as: "PostedBy", foreignKey: "posted_by_id" });
SalaryRelease.belongsTo(Employee, { as: "ReleasedBy", foreignKey: "released_by_id" });
Remittance.belongsTo(Employee, { as: "RecordedBy", foreignKey: "recorded_by_id" });

export {
  sequelize,
  Employee, User, Department, LeaveRequest, PayrollRun, PayrollItem,
  Category, Product, StockLevel, StockMovement,
  Supplier, PurchaseOrder, PurchaseOrderItem, Sale, SaleItem,
  Customer, CartItem, Order, OrderItem, ProductReview,
  Account, JournalEntry, JournalLine, SalaryRelease, Remittance
};
