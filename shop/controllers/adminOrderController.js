// adminOrderController — use cases "View orders" (Admin, Accountant), "Update order status",
// "Cancel order", "Record return" (Admin)
import * as orderService from "../services/orderService.js";
import { ORDER_STATUS } from "../utils/viewHelpers.js";
import { AppError } from "../utils/appError.js";

const NEXT_LABEL = { confirmed: "Confirm order", out_for_delivery: "Mark out for delivery", delivered: "Mark delivered" };

// GET /admin/orders
export const list = async (req, res, next) => {
  try {
    const status = ORDER_STATUS[req.query.status] ? req.query.status : "";
    const q = (req.query.q || "").trim();
    const data = await orderService.listForAdmin({ status, q });
    res.render("admin-orders", {
      title: "Orders",
      nav: "orders",
      status,
      q,
      stats: data.stats,
      orders: data.orders,
      filters: [{ key: "", label: "All", n: data.total, active: !status },
        ...Object.entries(ORDER_STATUS).map(([key, s]) => ({ key, label: s.label, n: data.counts[key] || 0, active: status === key }))]
    });
  } catch (err) {
    next(err);
  }
};

// GET /admin/orders/:code
export const show = async (req, res, next) => {
  try {
    const order = await orderService.getForAdmin(req.params.code);
    if (!order) {
      req.flash("error_msg", "Order not found.");
      return res.redirect("/admin/orders");
    }
    const isAdmin = req.session.user.role === "admin";
    const nextStatus = orderService.nextStep(order.order_status);
    res.render("admin-order-detail", {
      title: `Order ${order.order_code}`,
      nav: "orders",
      order,
      isAdmin,
      // Only the rider marks an order delivered (with a proof photo), so the admin gets no button for that step
      nextLabel: isAdmin && nextStatus && nextStatus !== "delivered" ? NEXT_LABEL[nextStatus] : null,
      withRider: order.order_status === "out_for_delivery",
      canCancel: isAdmin && orderService.CANCEL_RULES.admin.includes(order.order_status),
      canReturn: isAdmin && order.order_status === "delivered"
    });
  } catch (err) {
    next(err);
  }
};

// The three admin actions share one way of showing their result
const act = (action, done) => async (req, res, next) => {
  try {
    const order = await action(req.params.code, { employeeId: req.session.user.employee_id });
    req.flash("success_msg", done(order));
  } catch (err) {
    if (!(err instanceof AppError)) return next(err);
    req.flash("error_msg", err.message);
  }
  res.redirect(`/admin/orders/${req.params.code}`);
};

// POST /admin/orders/:code/status — pending → confirmed → out_for_delivery → delivered
export const updateStatus = act((code) => orderService.advanceStatus(code),
  (o) => `${o.order_code} is now ${ORDER_STATUS[o.order_status].label.toLowerCase()}.`);

// POST /admin/orders/:code/cancel
export const cancel = act((code, opts) => orderService.cancelOrder(code, "admin", opts),
  (o) => `${o.order_code} was cancelled and its stock was returned.${o.payment_status === "refunded" ? " GCash payment marked refunded." : ""}`);

// POST /admin/orders/:code/return
export const recordReturn = act((code, opts) => orderService.recordReturn(code, opts),
  (o) => `${o.order_code} was marked returned, refunded, and its stock was put back.`);
