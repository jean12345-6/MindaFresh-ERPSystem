// shared/services/stockService.js  (owner: Bren, POS)
// The ONLY place stock changes. deductStock and returnStock must run inside the caller's transaction,
// so the order or sale and its stock change succeed or fail together (blueprint Section 5).
// POS also uses receiveStock (purchase orders, weighted average cost), adjustStock (counts, spoilage)
// and openStock (first stock of a new product). checkStock only reads, for carts and the cashier screen.
import { Product, StockLevel, StockMovement } from "../models/index.js";
import { AppError } from "../utils/appError.js";
import { round2 } from "../utils/money.js";

const isPositiveInt = (n) => Number.isInteger(n) && n > 0;

// items: [{ product_id, quantity }]. Pass sale_id (POS) OR order_id (Shop), never both.
export async function deductStock({ items, sale_id = null, order_id = null, employee_id = null }, t) {
  if (!t) throw new Error("deductStock must run inside a transaction");
  if (!sale_id === !order_id) throw new Error("Pass exactly one of sale_id or order_id");
  const movement_type = sale_id ? "sale" : "online_order";
  const source = sale_id ? { sale_id } : { order_id };
  const already = await StockMovement.count({ where: { ...source, movement_type }, transaction: t });
  if (already) throw new AppError("DUPLICATE", "Stock for this sale or order was already deducted.");

  const sorted = [...items].sort((a, b) => a.product_id - b.product_id); // same lock order everywhere
  const results = [];
  for (const { product_id, quantity } of sorted) {
    const product = await Product.findByPk(product_id, { transaction: t });
    if (!product || product.status !== "active")
      throw new AppError("PRODUCT_UNAVAILABLE", `Product ${product?.product_code ?? product_id} is not available.`);

    const level = await StockLevel.findOne({ where: { product_id }, transaction: t, lock: t.LOCK.UPDATE });
    if (!level || level.quantity_on_hand < quantity)
      throw new AppError("INSUFFICIENT_STOCK", `Only ${level ? level.quantity_on_hand : 0} left of ${product.name}.`);

    const before = level.quantity_on_hand;
    level.quantity_on_hand = before - quantity;
    await level.save({ transaction: t });

    const movement = await StockMovement.create({
      product_id, movement_type, quantity_change: -quantity,
      quantity_before: before, quantity_after: level.quantity_on_hand,
      unit_cost: product.cost_price, ...source, employee_id
    }, { transaction: t });
    results.push({ product_id, unit_cost: product.cost_price, movement_code: movement.movement_code });
  }
  return results; // the caller saves unit_cost into its sale_items / order_items
}

// Puts back exactly what deductStock took for this sale or order, at the same unit_cost.
export async function returnStock({ sale_id = null, order_id = null, employee_id = null }, t) {
  if (!t) throw new Error("returnStock must run inside a transaction");
  if (!sale_id === !order_id) throw new Error("Pass exactly one of sale_id or order_id");
  const source = sale_id ? { sale_id } : { order_id };
  const deductType = sale_id ? "sale" : "online_order";

  const returned = await StockMovement.count({ where: { ...source, movement_type: "return" }, transaction: t });
  if (returned) throw new AppError("DUPLICATE", "Stock for this sale or order was already returned.");

  const taken = await StockMovement.findAll({ where: { ...source, movement_type: deductType }, transaction: t });
  const sorted = [...taken].sort((a, b) => a.product_id - b.product_id);
  const results = [];
  for (const m of sorted) {
    const quantity = -m.quantity_change;
    const level = await StockLevel.findOne({ where: { product_id: m.product_id }, transaction: t, lock: t.LOCK.UPDATE });
    const before = level.quantity_on_hand;
    level.quantity_on_hand = before + quantity;
    await level.save({ transaction: t });

    const movement = await StockMovement.create({
      product_id: m.product_id, movement_type: "return", quantity_change: quantity,
      quantity_before: before, quantity_after: level.quantity_on_hand,
      unit_cost: m.unit_cost, ...source, employee_id
    }, { transaction: t });
    results.push({ product_id: m.product_id, quantity, movement_code: movement.movement_code });
  }
  return results;
}

// Read-only check, no lock: [{ product_id, quantity }] → shortages [{ product_id, name, wanted, available }].
// Use it to warn early (cart, cashier screen). The real guard is deductStock inside the transaction.
export async function checkStock(items) {
  const shortages = [];
  for (const { product_id, quantity } of items) {
    const product = await Product.findByPk(product_id, { include: StockLevel });
    const available = product?.status === "active" ? (product.StockLevel?.quantity_on_hand ?? 0) : 0;
    if (available < quantity) shortages.push({ product_id, name: product?.name ?? `#${product_id}`, wanted: quantity, available });
  }
  return shortages;
}

// Received purchase order: adds stock and updates each product's cost_price to the weighted average.
// items: [{ product_id, quantity, unit_cost }]
export async function receiveStock({ items, purchase_order_id, employee_id = null }, t) {
  if (!t) throw new Error("receiveStock must run inside a transaction");
  if (!purchase_order_id) throw new Error("receiveStock needs purchase_order_id");
  const already = await StockMovement.count({ where: { purchase_order_id, movement_type: "stock_in" }, transaction: t });
  if (already) throw new AppError("DUPLICATE", "This purchase order was already received.");

  const sorted = [...items].sort((a, b) => a.product_id - b.product_id);
  const results = [];
  for (const { product_id, quantity, unit_cost } of sorted) {
    if (!isPositiveInt(quantity)) throw new AppError("VALIDATION_ERROR", "Received quantity must be a whole number above 0.");
    // Lock the stock row first (same order as deductStock), then read the product: no deadlock with the Shop.
    let level = await StockLevel.findOne({ where: { product_id }, transaction: t, lock: t.LOCK.UPDATE });
    const product = await Product.findByPk(product_id, { transaction: t });
    if (!product) throw new AppError("PRODUCT_UNAVAILABLE", `Product ${product_id} does not exist.`);
    if (!level) level = await StockLevel.create({ product_id, quantity_on_hand: 0 }, { transaction: t });

    const before = level.quantity_on_hand;
    level.quantity_on_hand = before + quantity;
    await level.save({ transaction: t });

    // Weighted average: (old qty × old cost + new qty × new cost) / total qty
    const oldCost = Number(product.cost_price);
    const newCost = before > 0 ? round2((before * oldCost + quantity * Number(unit_cost)) / (before + quantity)) : round2(unit_cost);
    product.cost_price = newCost;
    await product.save({ transaction: t });

    const movement = await StockMovement.create({
      product_id, movement_type: "stock_in", quantity_change: quantity,
      quantity_before: before, quantity_after: level.quantity_on_hand,
      unit_cost: round2(unit_cost), purchase_order_id, employee_id
    }, { transaction: t });
    results.push({ product_id, quantity, cost_price: newCost, movement_code: movement.movement_code });
  }
  return results;
}

// Stock count correction, spoilage, damage. quantity_change is + or -, never 0. remarks is required.
export async function adjustStock({ product_id, quantity_change, remarks, employee_id = null }, t) {
  if (!t) throw new Error("adjustStock must run inside a transaction");
  if (!Number.isInteger(quantity_change) || quantity_change === 0)
    throw new AppError("VALIDATION_ERROR", "The adjustment must be a whole number, not 0.");
  if (!remarks || !String(remarks).trim()) throw new AppError("VALIDATION_ERROR", "Give a reason for the adjustment.");

  const product = await Product.findByPk(product_id, { transaction: t });
  if (!product) throw new AppError("PRODUCT_UNAVAILABLE", `Product ${product_id} does not exist.`);
  let level = await StockLevel.findOne({ where: { product_id }, transaction: t, lock: t.LOCK.UPDATE });
  if (!level) level = await StockLevel.create({ product_id, quantity_on_hand: 0 }, { transaction: t });

  const before = level.quantity_on_hand;
  if (before + quantity_change < 0)
    throw new AppError("INSUFFICIENT_STOCK", `Only ${before} on hand of ${product.name}; cannot remove ${-quantity_change}.`);
  level.quantity_on_hand = before + quantity_change;
  await level.save({ transaction: t });

  const movement = await StockMovement.create({
    product_id, movement_type: "adjustment", quantity_change,
    quantity_before: before, quantity_after: level.quantity_on_hand,
    unit_cost: product.cost_price, remarks: String(remarks).trim().slice(0, 255), employee_id
  }, { transaction: t });
  return { product_id, quantity_after: level.quantity_on_hand, movement_code: movement.movement_code };
}

// First stock of a new product. Creates its stock_levels row; quantity may be 0 (no movement then).
export async function openStock({ product_id, quantity = 0, employee_id = null }, t) {
  if (!t) throw new Error("openStock must run inside a transaction");
  if (!Number.isInteger(quantity) || quantity < 0) throw new AppError("VALIDATION_ERROR", "Opening stock must be 0 or more.");
  const exists = await StockLevel.count({ where: { product_id }, transaction: t });
  if (exists) throw new AppError("DUPLICATE", "This product already has a stock level.");

  const product = await Product.findByPk(product_id, { transaction: t });
  await StockLevel.create({ product_id, quantity_on_hand: quantity }, { transaction: t });
  if (!quantity) return null;
  const movement = await StockMovement.create({
    product_id, movement_type: "opening", quantity_change: quantity,
    quantity_before: 0, quantity_after: quantity,
    unit_cost: product.cost_price, remarks: "Opening stock", employee_id
  }, { transaction: t });
  return { product_id, movement_code: movement.movement_code };
}
