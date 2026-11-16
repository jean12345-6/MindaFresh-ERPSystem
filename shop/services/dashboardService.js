// shop/services/dashboardService.js — use case "View dashboard" (Admin, Accountant)
// Today's numbers for the admin home page. A sale counts on the day it is delivered,
// the same rule as the sales report and Accounting.
import { Op } from "sequelize";
import { Product, StockLevel, Order, OrderItem, Customer } from "../models/index.js";
import { round2 } from "../utils/money.js";
import { manilaDate } from "../utils/dates.js";

const dayRange = (date) => [new Date(`${date}T00:00:00+08:00`), new Date(`${date}T23:59:59.999+08:00`)];
const sum = (list, f) => round2(list.reduce((s, o) => s + Number(o[f] || 0), 0));

// +today(): everything the dashboard shows
export async function today() {
  const date = manilaDate();
  const range = dayRange(date);

  const [delivered, placed, toConfirm, onTheWay, products, recent] = await Promise.all([
    Order.findAll({ where: { order_status: "delivered", delivered_at: { [Op.between]: range } }, include: OrderItem }),
    Order.findAll({ where: { ordered_at: { [Op.between]: range }, order_status: { [Op.ne]: "cancelled" } }, include: OrderItem }),
    Order.count({ where: { order_status: "pending" } }),
    Order.count({ where: { order_status: { [Op.in]: ["confirmed", "out_for_delivery"] } } }),
    Product.findAll({ where: { status: "active", is_online: true }, include: StockLevel }),
    Order.findAll({ include: [{ model: Customer, attributes: ["first_name", "last_name"] }], order: [["ordered_at", "DESC"], ["id", "DESC"]], limit: 5 })
  ]);

  // Top products from orders delivered today
  const byProduct = {};
  for (const o of delivered) for (const i of o.OrderItems) {
    byProduct[i.product_name] ??= { name: i.product_name, quantity: 0, sales: 0 };
    byProduct[i.product_name].quantity += i.quantity;
    byProduct[i.product_name].sales = round2(byProduct[i.product_name].sales + Number(i.line_total));
  }

  const lowStock = products
    .map((p) => ({ name: p.name, unit: p.unit, qty: p.StockLevel?.quantity_on_hand ?? 0, reorder: p.reorder_level }))
    .filter((p) => p.qty <= p.reorder)
    .sort((a, b) => a.qty - b.qty);

  return {
    date,
    salesToday: sum(delivered, "total_amount"),
    deliveredToday: delivered.length,
    profitToday: round2(sum(delivered, "subtotal") - sum(delivered, "total_cost")),
    toConfirm,
    onTheWay,
    ordersToday: placed.length,
    unitsToday: placed.reduce((n, o) => n + o.OrderItems.reduce((m, i) => m + i.quantity, 0), 0),
    methods: [
      { label: "Cash on delivery", amount: sum(delivered.filter((o) => o.payment_method === "cod"), "total_amount") },
      { label: "GCash", amount: sum(delivered.filter((o) => o.payment_method === "gcash"), "total_amount") }
    ],
    topProducts: Object.values(byProduct).sort((a, b) => b.sales - a.sales).slice(0, 5),
    lowStock: lowStock.slice(0, 5),
    lowStockCount: lowStock.length,
    recent: recent.map((o) => ({
      order_code: o.order_code,
      customer: `${o.Customer.first_name} ${o.Customer.last_name}`,
      total_amount: o.total_amount,
      order_status: o.order_status,
      ordered_at: o.ordered_at
    }))
  };
}
