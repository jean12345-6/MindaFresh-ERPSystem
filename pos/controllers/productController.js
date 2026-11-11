// pos/controllers/productController.js — products, prices and categories (admin).
// Stock is never typed here: new products get opening stock through stockService.openStock.
import { Op } from "sequelize";
import { sequelize, Product, Category, StockLevel } from "../models/index.js";
import { openStock } from "../services/stockService.js";
import { AppError } from "../utils/appError.js";
import { round2 } from "../utils/money.js";
import { removeUpload } from "../utils/upload.js";
import { ensureBarcode } from "../utils/barcode.js";

// An optional internet link for the photo. Only https links are accepted.
const imageLink = (v) => { const t = String(v || "").trim(); return /^https:\/\/[^\s]{4,240}$/.test(t) ? t : null; };

const UNITS = ["pc", "kg", "pack", "box", "tray"];

function readProduct(body, hasBarcode = false) {
  const data = {
    name: String(body.name || "").trim(),
    description: String(body.description || "").trim() || null,
    category_id: Number(body.category_id),
    unit: body.unit,
    cost_price: round2(body.cost_price),
    selling_price: round2(body.selling_price),
    reorder_level: Number(body.reorder_level),
    is_online: body.is_online === "1" || body.is_online === "on"
  };
  if (hasBarcode) data.barcode = String(body.barcode || "").trim().slice(0, 50) || null;
  if (!data.name) throw new AppError("VALIDATION_ERROR", "Enter the product name.");
  if (!UNITS.includes(data.unit)) throw new AppError("VALIDATION_ERROR", "Choose a unit.");
  if (!(data.cost_price >= 0) || !(data.selling_price >= 0)) throw new AppError("VALIDATION_ERROR", "Prices must be ₱0.00 or more.");
  if (data.selling_price < data.cost_price) throw new AppError("VALIDATION_ERROR", "The selling price is below the cost price.");
  if (!Number.isInteger(data.reorder_level) || data.reorder_level < 0) throw new AppError("VALIDATION_ERROR", "Reorder level must be a whole number, 0 or more.");
  return data;
}

const categoryOptions = () => Category.findAll({ order: [["name", "ASC"]], raw: true });

export const listProducts = async (req, res) => {
  const where = {};
  const q = String(req.query.q || "").trim();
  if (q) where[Op.or] = [{ name: { [Op.like]: `%${q}%` } }, { product_code: { [Op.like]: `%${q}%` } }];
  if (req.query.category_id) where.category_id = req.query.category_id;
  if (["active", "inactive"].includes(req.query.status)) where.status = req.query.status;
  const products = await Product.findAll({
    where, include: [{ model: Category, attributes: ["name"] }, { model: StockLevel, attributes: ["quantity_on_hand"] }],
    order: [["product_code", "ASC"]], raw: true, nest: true
  });
  res.render("products/index", { title: "Products", products, categories: await categoryOptions(), q, category_id: req.query.category_id || "", status: req.query.status || "" });
};

export const newProduct = async (req, res) => {
  const hasBarcode = await ensureBarcode();
  res.render("products/form", { hasBarcode, title: "New product", product: { unit: res.locals.cfg.defaultUnit, reorder_level: res.locals.cfg.defaultReorder, is_online: false }, categories: await categoryOptions(), units: UNITS, isNew: true });
};

export const createProduct = async (req, res, next) => {
  try {
    const hasBarcode = await ensureBarcode();
    const data = readProduct(req.body, hasBarcode);
    const opening = Number(req.body.opening_stock || 0);
    const product = await sequelize.transaction(async (t) => {
      if (!(await Category.findByPk(data.category_id, { transaction: t }))) throw new AppError("VALIDATION_ERROR", "Choose a category.");
      const p = await Product.create({ ...data, image_url: req.uploadedImageUrl || imageLink(req.body.image_link) || null, status: "active" }, { transaction: t });
      await openStock({ product_id: p.id, quantity: opening, employee_id: req.session.user.employee_id }, t);
      return p;
    });
    req.flash("success_msg", `${product.product_code} ${product.name} added.`);
    res.redirect("/products");
  } catch (e) {
    if (e.name !== "AppError") return next(e);
    res.status(422).render("products/form", { hasBarcode: await ensureBarcode(), title: "New product", product: { ...req.body, is_online: req.body.is_online === "1" }, categories: await categoryOptions(), units: UNITS, isNew: true, error_msg: [e.message] });
  }
};

export const editProduct = async (req, res) => {
  const hasBarcode = await ensureBarcode();
  const product = await Product.findByPk(req.params.id, { raw: true });
  if (!product) return res.redirect("/products");
  res.render("products/form", { hasBarcode, title: `Edit ${product.product_code}`, product, categories: await categoryOptions(), units: UNITS });
};

export const updateProduct = async (req, res, next) => {
  const product = await Product.findByPk(req.params.id);
  if (!product) return res.redirect("/products");
  try {
    const hasBarcode = await ensureBarcode();
    const data = readProduct(req.body, hasBarcode);
    if (!(await Category.findByPk(data.category_id))) throw new AppError("VALIDATION_ERROR", "Choose a category.");
    const old = product.image_url;
    if (req.uploadedImageUrl) data.image_url = req.uploadedImageUrl;
    else if (imageLink(req.body.image_link)) data.image_url = imageLink(req.body.image_link);
    else if (req.body.remove_image === "1") data.image_url = null;
    await product.update(data);
    if (data.image_url !== undefined && data.image_url !== old) removeUpload(old);
    req.flash("success_msg", `${product.product_code} saved.`);
    res.redirect("/products");
  } catch (e) {
    if (e.name !== "AppError") return next(e);
    res.status(422).render("products/form", { hasBarcode: await ensureBarcode(), title: `Edit ${product.product_code}`, product: { ...req.body, id: product.id, product_code: product.product_code, is_online: req.body.is_online === "1" }, categories: await categoryOptions(), units: UNITS, error_msg: [e.message] });
  }
};

export const toggleProduct = async (req, res) => {
  const product = await Product.findByPk(req.params.id);
  if (product) {
    await product.update({ status: product.status === "active" ? "inactive" : "active" });
    req.flash("success_msg", `${product.product_code} is now ${product.status}.`);
  }
  res.redirect("/products");
};

export const listCategories = async (req, res) => {
  const [categories] = await sequelize.query(
    `SELECT c.id, c.category_code, c.name, COUNT(p.id) AS products
       FROM categories c LEFT JOIN products p ON p.category_id = c.id
      GROUP BY c.id, c.category_code, c.name ORDER BY c.name`);
  res.render("categories/index", { title: "Categories", categories });
};

export const saveCategory = async (req, res) => {
  const name = String(req.body.name || "").trim().slice(0, 100);
  if (!name) req.flash("error_msg", "Enter a category name.");
  else if (req.params.id) {
    const c = await Category.findByPk(req.params.id);
    if (c) { await c.update({ name }); req.flash("success_msg", `${c.category_code} renamed to ${name}.`); }
  } else {
    const c = await Category.create({ name });
    req.flash("success_msg", `${c.category_code} ${name} added.`);
  }
  res.redirect("/categories");
};
