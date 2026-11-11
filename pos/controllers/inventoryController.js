// pos/controllers/inventoryController.js — stock levels, low-stock list, adjustments, movement history.
import { sequelize, Product, StockMovement, Employee, Sale, Order, PurchaseOrder } from "../models/index.js";
import { adjustStock } from "../services/stockService.js";

export const stockList = async (req, res) => {
  const lowOnly = req.query.low === "1";
  const q = String(req.query.q || "").trim();
  const [rows] = await sequelize.query(
    `SELECT p.id, p.product_code, p.name, p.unit, p.reorder_level, p.cost_price, p.status, c.name AS category,
            COALESCE(s.quantity_on_hand, 0) AS qty,
            COALESCE(s.quantity_on_hand, 0) * p.cost_price AS value
       FROM products p
       JOIN categories c ON c.id = p.category_id
       LEFT JOIN stock_levels s ON s.product_id = p.id
      WHERE (:q = '' OR p.name LIKE :like OR p.product_code LIKE :like)
        ${lowOnly ? "AND p.status = 'active' AND COALESCE(s.quantity_on_hand, 0) <= p.reorder_level" : ""}
      ORDER BY p.product_code`,
    { replacements: { q, like: `%${q}%` } });
  const items = rows.map((r) => ({ ...r, qty: Number(r.qty), value: Number(r.value), low: r.status === "active" && Number(r.qty) <= r.reorder_level }));
  const totalValue = items.reduce((s, r) => s + r.value, 0);
  res.render("inventory/index", { title: "Stock", items, lowOnly, q, totalValue, lowCount: items.filter((r) => r.low).length });
};

export const adjustForm = async (req, res) => {
  const products = await Product.findAll({ order: [["name", "ASC"]], raw: true });
  res.render("inventory/adjust", { title: "Adjust stock", products, product_id: req.query.product_id || "" });
};

export const adjustSave = async (req, res, next) => {
  const sign = req.body.direction === "remove" ? -1 : 1;
  try {
    const r = await sequelize.transaction((t) => adjustStock({
      product_id: Number(req.body.product_id),
      quantity_change: sign * Number(req.body.quantity),
      remarks: req.body.remarks,
      employee_id: req.session.user.employee_id
    }, t));
    req.flash("success_msg", `${r.movement_code} saved. On hand now: ${r.quantity_after}.`);
    res.redirect("/stock");
  } catch (e) {
    if (e.name !== "AppError") return next(e);
    req.flash("error_msg", e.message);
    res.redirect(`/stock/adjust?product_id=${encodeURIComponent(req.body.product_id || "")}`);
  }
};

const TYPES = ["opening", "stock_in", "sale", "online_order", "adjustment", "return"];

export const movements = async (req, res) => {
  const where = {};
  if (req.query.product_id) where.product_id = req.query.product_id;
  if (TYPES.includes(req.query.type)) where.movement_type = req.query.type;
  const rows = await StockMovement.findAll({
    where,
    include: [
      { model: Product, attributes: ["product_code", "name"] },
      { model: Employee, attributes: ["first_name", "last_name"] },
      { model: Sale, attributes: ["id", "sale_code"] },
      { model: Order, attributes: ["order_code"] },
      { model: PurchaseOrder, attributes: ["id", "purchase_order_code"] }
    ],
    order: [["id", "DESC"]], limit: 300, raw: true, nest: true
  });
  const products = await Product.findAll({ attributes: ["id", "product_code", "name"], order: [["name", "ASC"]], raw: true });
  res.render("inventory/movements", { title: "Stock movements", rows, products, types: TYPES, product_id: req.query.product_id || "", type: req.query.type || "" });
};
