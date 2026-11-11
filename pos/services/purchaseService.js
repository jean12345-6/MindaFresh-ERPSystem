// pos/services/purchaseService.js — purchase orders (POS only).
// Life cycle: draft → ordered → received, or draft/ordered → cancelled.
// Receiving adds the stock and updates each product's cost (stockService.receiveStock) in one transaction.
// Accounting reads received purchase orders on its "Post new transactions" (payment cash or on_account).
import { sequelize, Product, Supplier, PurchaseOrder, PurchaseOrderItem } from "../models/index.js";
import { receiveStock } from "./stockService.js";
import { AppError } from "../utils/appError.js";
import { round2 } from "../utils/money.js";
import { manilaDate } from "../utils/dates.js";

const PAYMENT = ["cash", "on_account"];

function cleanLines(raw) {
  const lines = (Array.isArray(raw) ? raw : [])
    .filter((l) => l && String(l.product_id || "").trim() !== "")
    .map((l) => ({ product_id: Number(l.product_id), quantity: Number(l.quantity), unit_cost: round2(l.unit_cost) }));
  if (!lines.length) throw new AppError("VALIDATION_ERROR", "Add at least one item.");
  const seen = new Set();
  for (const l of lines) {
    if (!Number.isInteger(l.quantity) || l.quantity <= 0) throw new AppError("VALIDATION_ERROR", "Each quantity must be a whole number above 0.");
    if (!(l.unit_cost >= 0)) throw new AppError("VALIDATION_ERROR", "Each unit cost must be ₱0.00 or more.");
    if (seen.has(l.product_id)) throw new AppError("VALIDATION_ERROR", "A product appears twice. Put it on one line.");
    seen.add(l.product_id);
  }
  return lines;
}

async function checkHeader({ supplier_id, payment_method, expected_date }, lines, t) {
  const supplier = await Supplier.findByPk(supplier_id, { transaction: t });
  if (!supplier || supplier.status !== "active") throw new AppError("VALIDATION_ERROR", "Choose an active supplier.");
  if (!PAYMENT.includes(payment_method)) throw new AppError("VALIDATION_ERROR", "Choose cash or on account.");
  if (expected_date && !/^\d{4}-\d{2}-\d{2}$/.test(expected_date)) throw new AppError("VALIDATION_ERROR", "Expected date is not a valid date.");
  const count = await Product.count({ where: { id: lines.map((l) => l.product_id) }, transaction: t });
  if (count !== lines.length) throw new AppError("PRODUCT_UNAVAILABLE", "One of the products does not exist.");
}

const totalOf = (lines) => round2(lines.reduce((s, l) => s + l.quantity * l.unit_cost, 0));
const itemRows = (poId, lines) => lines.map((l) => ({
  purchase_order_id: poId, product_id: l.product_id, quantity: l.quantity,
  unit_cost: l.unit_cost, line_total: round2(l.quantity * l.unit_cost)
}));

// status: "draft" (save only) or "ordered" (save and place the order now)
export async function createOrder({ supplier_id, payment_method, expected_date, items, status = "draft", employee_id }) {
  const lines = cleanLines(items);
  if (!["draft", "ordered"].includes(status)) status = "draft";
  return sequelize.transaction(async (t) => {
    await checkHeader({ supplier_id, payment_method, expected_date }, lines, t);
    const po = await PurchaseOrder.create({
      supplier_id, employee_id, order_date: manilaDate(), expected_date: expected_date || null,
      total_cost: totalOf(lines), payment_method, status
    }, { transaction: t });
    await PurchaseOrderItem.bulkCreate(itemRows(po.id, lines), { transaction: t });
    return po;
  });
}

// Drafts only: replaces the header and all items.
export async function updateDraft(id, { supplier_id, payment_method, expected_date, items, status = "draft" }) {
  const lines = cleanLines(items);
  return sequelize.transaction(async (t) => {
    const po = await PurchaseOrder.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!po) throw new AppError("VALIDATION_ERROR", "Purchase order not found.");
    if (po.status !== "draft") throw new AppError("VALIDATION_ERROR", `${po.purchase_order_code} is ${po.status}; only drafts can be edited.`);
    await checkHeader({ supplier_id, payment_method, expected_date }, lines, t);
    await PurchaseOrderItem.destroy({ where: { purchase_order_id: po.id }, transaction: t });
    await PurchaseOrderItem.bulkCreate(itemRows(po.id, lines), { transaction: t });
    await po.update({
      supplier_id, payment_method, expected_date: expected_date || null, total_cost: totalOf(lines),
      status: status === "ordered" ? "ordered" : "draft"
    }, { transaction: t });
    return po;
  });
}

const MOVES = { place: ["draft"], cancel: ["draft", "ordered"], receive: ["ordered"] };

async function lockFor(action, id, t) {
  const po = await PurchaseOrder.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
  if (!po) throw new AppError("VALIDATION_ERROR", "Purchase order not found.");
  if (!MOVES[action].includes(po.status))
    throw new AppError("VALIDATION_ERROR", `${po.purchase_order_code} is ${po.status}; it cannot be ${action === "place" ? "placed" : action + "d"}.`);
  return po;
}

export const placeOrder = (id) => sequelize.transaction(async (t) => {
  const po = await lockFor("place", id, t);
  return po.update({ status: "ordered", order_date: manilaDate() }, { transaction: t });
});

export const cancelOrder = (id) => sequelize.transaction(async (t) => {
  const po = await lockFor("cancel", id, t);
  return po.update({ status: "cancelled" }, { transaction: t });
});

// Receives the full ordered quantities at the ordered unit costs.
export const receiveOrder = (id, employee_id) => sequelize.transaction(async (t) => {
  const po = await lockFor("receive", id, t);
  const items = await PurchaseOrderItem.findAll({ where: { purchase_order_id: po.id }, transaction: t });
  const result = await receiveStock({
    purchase_order_id: po.id, employee_id,
    items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity, unit_cost: Number(i.unit_cost) }))
  }, t);
  await po.update({ status: "received", received_at: new Date() }, { transaction: t });
  return { po, result };
});
