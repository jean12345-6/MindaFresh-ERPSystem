// pos/scripts/smoke-test.js — end-to-end check of the POS services against the real database.
// SOLO MODE ONLY (DB_HOST=127.0.0.1). It saves real records: one voided sale, one received PO, one adjustment.
// Stock ends where it started. Afterwards, re-import schema.sql + seed.sql if you want clean data.
//   cd pos && node scripts/smoke-test.js
import "dotenv/config";
import { sequelize, Product, StockLevel, StockMovement, Supplier, Sale } from "../models/index.js";
import { checkout, voidSale } from "../services/saleService.js";
import { createOrder, placeOrder, receiveOrder } from "../services/purchaseService.js";
import { adjustStock } from "../services/stockService.js";

if (!["127.0.0.1", "localhost"].includes(process.env.DB_HOST)) {
  console.log(`Refusing to run: DB_HOST is ${process.env.DB_HOST}. Run this only on your own database (DB_HOST=127.0.0.1).`);
  process.exit(1);
}

let failed = 0;
const check = (ok, msg) => { console.log(`  ${ok ? "✓" : "✗"} ${msg}`); if (!ok) failed++; };
const qty = async (product_id) => (await StockLevel.findOne({ where: { product_id } })).quantity_on_hand;
const EMP = 2; // Maria Santos (cashier) from the seed

const product = await Product.findOne({ where: { status: "active" }, order: [["id", "ASC"]] });
const start = await qty(product.id);
console.log(`\nPOS smoke test on ${product.product_code} ${product.name} (on hand ${start})\n`);

console.log("1. Checkout (sale + stock deduction in one transaction)");
const sale = await checkout({ cart: [{ product_id: product.id, quantity: 2 }], payment_method: "cash", amount_paid: 1000, employee_id: EMP });
check(/^SAL-\d{4}$/.test(sale.sale_code), `Sale saved as ${sale.sale_code}`);
check((await qty(product.id)) === start - 2, "Stock went down by 2");
check(Number(sale.total_cost) === Number(product.cost_price) * 2, `Cost of goods ${sale.total_cost} saved on the sale`);
check(Number(sale.change_amount) === 1000 - Number(sale.total_amount), `Change ${sale.change_amount}`);

console.log("\n2. TC-P1: a short item deducts nothing");
const before = await StockMovement.count();
try {
  await checkout({ cart: [{ product_id: product.id, quantity: 1 }, { product_id: product.id + 1, quantity: 999999 }], payment_method: "gcash", employee_id: EMP });
  check(false, "Checkout should have been refused");
} catch (e) {
  check(e.code === "INSUFFICIENT_STOCK", `Refused: ${e.message}`);
}
check((await qty(product.id)) === start - 2 && (await StockMovement.count()) === before, "No stock and no movement changed");

console.log("\n3. Void (stock goes back)");
await voidSale({ sale_id: sale.id, reason: "smoke test", employee_id: EMP });
check((await Sale.findByPk(sale.id)).status === "voided", "Sale is voided");
check((await qty(product.id)) === start, "Stock is back to the start");
try { await voidSale({ sale_id: sale.id, reason: "again", employee_id: EMP }); check(false, "Second void should fail"); }
catch (e) { check(e.code === "DUPLICATE", "A second void is refused"); }

console.log("\n4. TC-P4: purchase order received → stock and weighted average cost");
const supplier = await Supplier.findOne({ where: { status: "active" } });
const oldCost = Number(product.cost_price);
const newUnit = oldCost + 10;
const po = await createOrder({ supplier_id: supplier.id, payment_method: "on_account", items: [{ product_id: product.id, quantity: 10, unit_cost: newUnit }], employee_id: 3 });
check(po.status === "draft" && /^PUR-\d{4}$/.test(po.purchase_order_code), `${po.purchase_order_code} saved as draft`);
await placeOrder(po.id);
await receiveOrder(po.id, 3);
await product.reload();
const expected = Math.round(((start * oldCost + 10 * newUnit) / (start + 10)) * 100) / 100;
check((await qty(product.id)) === start + 10, "Stock went up by 10");
check(Number(product.cost_price) === expected, `Cost price ${oldCost} → ${product.cost_price} (expected ${expected})`);
try { await receiveOrder(po.id, 3); check(false, "Second receive should fail"); }
catch (e) { check(e.name === "AppError", "A second receive is refused"); }

console.log("\n5. Adjustment back to the starting stock");
await sequelize.transaction((t) => adjustStock({ product_id: product.id, quantity_change: -10, remarks: "smoke test: undo PO quantity", employee_id: 3 }, t));
check((await qty(product.id)) === start, "Stock is back to the start");

console.log("\n6. TC-P2: movements add up to quantity on hand (every product)");
const [rows] = await sequelize.query(
  `SELECT p.product_code, s.quantity_on_hand AS qoh, COALESCE(SUM(m.quantity_change), 0) AS total
     FROM products p JOIN stock_levels s ON s.product_id = p.id LEFT JOIN stock_movements m ON m.product_id = p.id
    GROUP BY p.id, p.product_code, s.quantity_on_hand`);
const off = rows.filter((r) => Number(r.qoh) !== Number(r.total));
check(!off.length, off.length ? `Mismatch: ${off.map((r) => `${r.product_code} ${r.qoh}≠${r.total}`).join(", ")}` : `${rows.length} products match their movements`);

console.log(failed ? `\n✗ ${failed} check(s) failed.` : "\n✓ POS services work against the shared database.");
await sequelize.close();
process.exit(failed ? 1 : 0);
