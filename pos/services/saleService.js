// pos/services/saleService.js — in-store checkout and voids (POS only).
// A sale and its stock deduction are saved in ONE transaction: both happen or neither does.
// Accounting reads the sales table on its "Post new transactions" (sale, and sale_reversal for voids).
import { sequelize, Product, Sale, SaleItem } from "../models/index.js";
import { deductStock, returnStock } from "./stockService.js";
import { AppError } from "../utils/appError.js";
import { round2 } from "../utils/money.js";

const METHODS = ["cash", "gcash", "card"];

// Merges duplicate lines and checks every quantity is a whole number above 0.
export function normaliseItems(raw) {
  if (!Array.isArray(raw) || !raw.length) throw new AppError("VALIDATION_ERROR", "The cart is empty.");
  const map = new Map();
  for (const line of raw) {
    const product_id = Number(line.product_id);
    const quantity = Number(line.quantity);
    if (!Number.isInteger(product_id) || product_id <= 0 || !Number.isInteger(quantity) || quantity <= 0)
      throw new AppError("VALIDATION_ERROR", "Every item needs a whole-number quantity above 0.");
    map.set(product_id, (map.get(product_id) || 0) + quantity);
  }
  return [...map].map(([product_id, quantity]) => ({ product_id, quantity }));
}

// cart: [{ product_id, quantity }], discount: pesos off the subtotal, amount_paid: cash tendered.
export async function checkout({ cart, discount = 0, payment_method, amount_paid, employee_id }) {
  const items = normaliseItems(cart);
  if (!METHODS.includes(payment_method)) throw new AppError("VALIDATION_ERROR", "Choose cash, GCash or card.");

  return sequelize.transaction(async (t) => {
    const products = await Product.findAll({ where: { id: items.map((i) => i.product_id) }, transaction: t });
    const byId = new Map(products.map((p) => [p.id, p]));

    let subtotal = 0;
    for (const i of items) {
      const p = byId.get(i.product_id);
      if (!p || p.status !== "active") throw new AppError("PRODUCT_UNAVAILABLE", `Product ${p?.product_code ?? i.product_id} is not available.`);
      subtotal += Number(p.selling_price) * i.quantity;
    }
    subtotal = round2(subtotal);

    const discount_amount = round2(discount || 0);
    if (!(discount_amount >= 0) || discount_amount > subtotal)
      throw new AppError("VALIDATION_ERROR", "The discount must be between ₱0.00 and the subtotal.");
    const total_amount = round2(subtotal - discount_amount);

    // GCash and card are paid exactly; cash may need change.
    const paid = payment_method === "cash" ? round2(amount_paid) : total_amount;
    if (!(paid >= total_amount))
      throw new AppError("VALIDATION_ERROR", `Amount paid is short. The total is ₱${total_amount.toFixed(2)}.`);
    const change_amount = round2(paid - total_amount);

    const sale = await Sale.create({
      employee_id, subtotal, discount_amount, total_amount, total_cost: 0,
      amount_paid: paid, change_amount, payment_method, status: "completed", sold_at: new Date()
    }, { transaction: t });

    // Locks each stock row, refuses the whole sale if one item is short, writes a "sale" movement per item.
    const taken = await deductStock({ items, sale_id: sale.id, employee_id }, t);
    const costOf = new Map(taken.map((r) => [r.product_id, Number(r.unit_cost)]));

    let total_cost = 0;
    await SaleItem.bulkCreate(items.map((i) => {
      const p = byId.get(i.product_id);
      const unit_cost = costOf.get(i.product_id);
      total_cost += unit_cost * i.quantity;
      return {
        sale_id: sale.id, product_id: p.id, product_name: p.name, quantity: i.quantity,
        unit_price: p.selling_price, unit_cost, line_total: round2(Number(p.selling_price) * i.quantity)
      };
    }), { transaction: t });

    sale.total_cost = round2(total_cost);
    await sale.save({ transaction: t });
    return sale;
  });
}

// Puts the stock back (a "return" movement per item, at the original cost) and marks the sale voided.
export async function voidSale({ sale_id, reason, employee_id }) {
  const void_reason = String(reason || "").trim();
  if (!void_reason) throw new AppError("VALIDATION_ERROR", "Give a reason for the void.");
  return sequelize.transaction(async (t) => {
    const sale = await Sale.findByPk(sale_id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!sale) throw new AppError("VALIDATION_ERROR", "Sale not found.");
    if (sale.status === "voided") throw new AppError("DUPLICATE", `${sale.sale_code} is already voided.`);
    await returnStock({ sale_id: sale.id, employee_id }, t);
    sale.status = "voided";
    sale.void_reason = void_reason.slice(0, 255);
    await sale.save({ transaction: t });
    return sale;
  });
}
