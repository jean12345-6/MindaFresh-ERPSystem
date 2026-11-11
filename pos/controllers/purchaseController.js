// pos/controllers/purchaseController.js — purchase orders (inventory staff, admin).
import { sequelize, Product, Supplier, PurchaseOrder, PurchaseOrderItem, Employee, StockMovement } from "../models/index.js";
import { createOrder, updateDraft, placeOrder, cancelOrder, receiveOrder } from "../services/purchaseService.js";

const STATUSES = ["draft", "ordered", "received", "cancelled"];

const formOptions = async () => ({
  suppliers: await Supplier.findAll({ where: { status: "active" }, order: [["name", "ASC"]], raw: true }),
  products: (await Product.findAll({ where: { status: "active" }, order: [["name", "ASC"]], raw: true }))
    .map((p) => ({ id: p.id, code: p.product_code, name: p.name, unit: p.unit, cost: Number(p.cost_price) }))
});

// The form posts items[0][product_id], items[0][quantity], items[0][unit_cost] ...
const linesFrom = (body) => (Array.isArray(body.items) ? body.items : Object.values(body.items || {}));

export const listOrders = async (req, res) => {
  const where = STATUSES.includes(req.query.status) ? { status: req.query.status } : {};
  const orders = await PurchaseOrder.findAll({
    where, include: [{ model: Supplier, attributes: ["name"] }], order: [["id", "DESC"]], raw: true, nest: true
  });
  res.render("purchases/index", { title: "Purchase orders", orders, status: req.query.status || "", statuses: STATUSES });
};

export const newOrder = async (req, res) => {
  let items = [{}];
  if (req.query.low === "1") {
    // Restock: every active product at or below its reorder level, suggested up to twice the reorder level.
    const [low] = await sequelize.query(
      `SELECT p.id AS product_id, p.cost_price AS unit_cost, p.reorder_level, COALESCE(s.quantity_on_hand, 0) AS qty
         FROM products p LEFT JOIN stock_levels s ON s.product_id = p.id
        WHERE p.status = 'active' AND COALESCE(s.quantity_on_hand, 0) <= p.reorder_level ORDER BY p.name`);
    if (low.length) items = low.map((r) => ({ product_id: r.product_id, unit_cost: Number(r.unit_cost), quantity: Math.max(r.reorder_level * 2 - Number(r.qty), 1) }));
  }
  res.render("purchases/form", { title: "New purchase order", po: { payment_method: "on_account", items }, isNew: true, ...(await formOptions()) });
};

export const createOrderAction = async (req, res, next) => {
  try {
    const po = await createOrder({
      supplier_id: Number(req.body.supplier_id), payment_method: req.body.payment_method, expected_date: req.body.expected_date,
      items: linesFrom(req.body), status: req.body.action === "order" ? "ordered" : "draft", employee_id: req.session.user.employee_id
    });
    req.flash("success_msg", `${po.purchase_order_code} saved as ${po.status}.`);
    res.redirect(`/purchase-orders/${po.id}`);
  } catch (e) {
    if (e.name !== "AppError") return next(e);
    res.status(422).render("purchases/form", { title: "New purchase order", po: { ...req.body, items: linesFrom(req.body) }, isNew: true, error_msg: [e.message], ...(await formOptions()) });
  }
};

export const showOrder = async (req, res) => {
  const po = await PurchaseOrder.findByPk(req.params.id, {
    include: [
      { model: Supplier },
      { model: Employee, attributes: ["first_name", "last_name"] },
      { model: PurchaseOrderItem, include: [{ model: Product, attributes: ["product_code", "name", "unit"] }] }
    ]
  });
  if (!po) return res.status(404).render("error", { title: "Not found", heading: "Purchase order not found", message: "That purchase order does not exist." });
  const movements = await StockMovement.findAll({ where: { purchase_order_id: po.id }, raw: true });
  const [acct] = await sequelize.query(
    `SELECT entry_code FROM journal_entries WHERE source_module = 'pos' AND entry_type = 'purchase' AND reference_code = :code AND status = 'posted'`,
    { replacements: { code: po.purchase_order_code } });
  res.render("purchases/show", { title: po.purchase_order_code, po: po.get({ plain: true }), movements, acctEntry: acct[0]?.entry_code || null });
};

export const editOrder = async (req, res) => {
  const po = await PurchaseOrder.findByPk(req.params.id, { include: [PurchaseOrderItem] });
  if (!po) return res.redirect("/purchase-orders");
  if (po.status !== "draft") { req.flash("error_msg", "Only drafts can be edited."); return res.redirect(`/purchase-orders/${po.id}`); }
  const plain = po.get({ plain: true });
  res.render("purchases/form", {
    title: `Edit ${po.purchase_order_code}`,
    po: { ...plain, items: plain.PurchaseOrderItems.map((i) => ({ product_id: i.product_id, quantity: i.quantity, unit_cost: Number(i.unit_cost) })) },
    ...(await formOptions())
  });
};

export const updateOrderAction = async (req, res, next) => {
  try {
    const po = await updateDraft(req.params.id, {
      supplier_id: Number(req.body.supplier_id), payment_method: req.body.payment_method, expected_date: req.body.expected_date,
      items: linesFrom(req.body), status: req.body.action === "order" ? "ordered" : "draft"
    });
    req.flash("success_msg", `${po.purchase_order_code} saved as ${po.status}.`);
    res.redirect(`/purchase-orders/${po.id}`);
  } catch (e) {
    if (e.name !== "AppError") return next(e);
    const po = await PurchaseOrder.findByPk(req.params.id, { raw: true });
    res.status(422).render("purchases/form", { title: "Edit purchase order", po: { ...po, ...req.body, items: linesFrom(req.body) }, error_msg: [e.message], ...(await formOptions()) });
  }
};

const transition = (fn, done) => async (req, res, next) => {
  try {
    const out = await fn(req);
    req.flash("success_msg", done(out));
  } catch (e) {
    if (e.name !== "AppError") return next(e);
    req.flash("error_msg", e.message);
  }
  res.redirect(`/purchase-orders/${req.params.id}`);
};

export const placeOrderAction = transition((req) => placeOrder(req.params.id), (po) => `${po.purchase_order_code} placed with the supplier.`);
export const cancelOrderAction = transition((req) => cancelOrder(req.params.id), (po) => `${po.purchase_order_code} cancelled. No stock was changed.`);
export const receiveOrderAction = transition(
  (req) => receiveOrder(req.params.id, req.session.user.employee_id),
  ({ po, result }) => `${po.purchase_order_code} received. ${result.length} product(s) restocked and costs updated.`
);
