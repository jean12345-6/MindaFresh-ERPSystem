// pos/controllers/auditController.js — removed-line log (cashier) and the audit page (admin).
import { Product } from "../models/index.js";
import { logEvent, readEvents, EVENT_LABELS } from "../utils/audit.js";
import { manilaDate } from "../utils/dates.js";

const KINDS = ["line_removed", "line_reduced", "sale_cleared"];

// Called by the cashier screen when an item leaves the basket. Names and prices come from the database, not from the browser.
export const logRemoval = async (req, res) => {
  const kind = KINDS.includes(req.body?.kind) ? req.body.kind : "line_removed";
  const raw = Array.isArray(req.body?.items) ? req.body.items.slice(0, 100) : [];
  const ids = raw.map((i) => Number(i.product_id)).filter(Number.isInteger);
  if (!ids.length) return res.status(204).end();
  const products = await Product.findAll({ where: { id: ids }, attributes: ["id", "name", "product_code", "selling_price"], raw: true });
  const items = raw.map((i) => {
    const p = products.find((x) => x.id === Number(i.product_id));
    const quantity = Math.max(1, Math.min(Math.round(Number(i.quantity)) || 1, 100000));
    return p ? { product_code: p.product_code, name: p.name, quantity, price: Number(p.selling_price), value: Number(p.selling_price) * quantity } : null;
  }).filter(Boolean);
  if (items.length) {
    logEvent({
      type: kind, employee_id: req.session.user.employee_id, employee: req.session.user.full_name, role: req.session.user.role,
      items, total: Math.round(items.reduce((s, i) => s + i.value, 0) * 100) / 100
    });
  }
  res.status(204).end();
};

export const auditPage = (req, res) => {
  const type = Object.hasOwn(EVENT_LABELS, req.query.type) ? req.query.type : "";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(req.query.date || "") ? req.query.date : "";
  const events = readEvents({ type, date }).slice(0, 300);
  const types = Object.entries(EVENT_LABELS).map(([key, label]) => ({ key, label, selected: key === type }));
  res.render("audit/index", { title: "Audit log", events, types, date, today: manilaDate(), type });
};
