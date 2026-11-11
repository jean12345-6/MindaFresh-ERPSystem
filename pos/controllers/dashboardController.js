// pos/controllers/dashboardController.js — today's numbers for the store.
import { Op } from "sequelize";
import { sequelize, Sale, PurchaseOrder } from "../models/index.js";
import { manilaDate } from "../utils/dates.js";
import { round2 } from "../utils/money.js";

export const dayRange = (date) => ({ [Op.gte]: new Date(`${date}T00:00:00+08:00`), [Op.lt]: new Date(new Date(`${date}T00:00:00+08:00`).getTime() + 86400000) });

export const dashboard = async (req, res) => {
  const today = manilaDate();
  const sales = await Sale.findAll({ where: { sold_at: dayRange(today), status: "completed" }, raw: true });
  const byMethod = { cash: 0, gcash: 0, card: 0 };
  let revenue = 0, cost = 0;
  for (const s of sales) {
    revenue += Number(s.total_amount); cost += Number(s.total_cost);
    byMethod[s.payment_method] += Number(s.total_amount);
  }

  const [low] = await sequelize.query(
    `SELECT p.id, p.product_code, p.name, p.unit, p.reorder_level, COALESCE(s.quantity_on_hand, 0) AS qty
       FROM products p LEFT JOIN stock_levels s ON s.product_id = p.id
      WHERE p.status = 'active' AND COALESCE(s.quantity_on_hand, 0) <= p.reorder_level
      ORDER BY qty ASC, p.name LIMIT 10`);
  const [top] = await sequelize.query(
    `SELECT si.product_name, SUM(si.quantity) AS qty, SUM(si.line_total) AS amount
       FROM sale_items si JOIN sales s ON s.id = si.sale_id
      WHERE s.status = 'completed' AND s.sold_at >= :from AND s.sold_at < :to
      GROUP BY si.product_name ORDER BY qty DESC LIMIT 5`,
    { replacements: { from: dayRange(today)[Op.gte], to: dayRange(today)[Op.lt] } });
  const [online] = await sequelize.query(
    `SELECT COUNT(DISTINCT order_id) AS orders, COALESCE(-SUM(quantity_change), 0) AS units
       FROM stock_movements WHERE movement_type = 'online_order' AND created_at >= :from AND created_at < :to`,
    { replacements: { from: dayRange(today)[Op.gte], to: dayRange(today)[Op.lt] } });
  const openPOs = await PurchaseOrder.count({ where: { status: ["draft", "ordered"] } });

  res.render("dashboard", {
    title: "Dashboard", today,
    stats: {
      count: sales.length, revenue: round2(revenue), profit: round2(revenue - cost),
      cash: round2(byMethod.cash), gcash: round2(byMethod.gcash), card: round2(byMethod.card),
      openPOs, onlineOrders: Number(online[0].orders), onlineUnits: Number(online[0].units)
    },
    low, top
  });
};
