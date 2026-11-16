// deliveryController — use cases "Mark delivered with proof of delivery" (Rider only) and "View delivery history" (Rider, Admin)
import multer from "multer";
import * as orderService from "../services/orderService.js";
import * as deliveryPhotoService from "../services/deliveryPhotoService.js";
import { MAX_BYTES, uploadMessage } from "../utils/imageFile.js";
import { AppError } from "../utils/appError.js";
import { manilaDate } from "../utils/dates.js";

// The photo stays in memory until deliveryPhotoService checks it and saves it
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES, files: 1 } }).single("photo");

// GET /rider — orders out for delivery, and what was delivered today
export const riderPage = async (req, res, next) => {
  try {
    res.render("rider", { title: "Deliveries", nav: "deliveries", ...(await orderService.listForRider()) });
  } catch (err) {
    next(err);
  }
};

// GET /rider/history?from=&to=&rider= — past deliveries. A rider sees their own; the admin can pick any rider.
const DAY = /^\d{4}-\d{2}-\d{2}$/;
export const history = async (req, res, next) => {
  try {
    const today = manilaDate(new Date());
    const monthAgo = manilaDate(new Date(Date.now() - 29 * 24 * 3600 * 1000));
    let from = DAY.test(req.query.from || "") ? req.query.from : monthAgo;
    let to = DAY.test(req.query.to || "") ? req.query.to : today;
    if (from > to) [from, to] = [to, from];
    const isRider = req.session.user.role === "rider";
    const riders = isRider ? [] : await orderService.riders();
    const picked = isRider ? req.session.user.employee_id : (Number(req.query.rider) || null);
    const data = await orderService.riderHistory({ riderId: picked, from, to });
    res.render("rider-history", {
      title: "Delivery history", nav: "history", from, to, isRider,
      riders: riders.map((r) => ({ ...r, selected: r.id === picked })), allRiders: !picked, ...data
    });
  } catch (err) {
    next(err);
  }
};

// POST /rider/orders/:code/deliver (multipart form, field "photo"). Only a rider: the proof comes from whoever is at the door.
export const riderDeliver = (req, res, next) => {
  upload(req, res, async (uploadErr) => {
    try {
      if (uploadErr) throw new AppError("VALIDATION_ERROR", uploadMessage(uploadErr));
      const order = await orderService.markDelivered(req.params.code, req.file, { employeeId: req.session.user.employee_id });
      req.flash("success_msg", `${order.order_code} is delivered. The proof-of-delivery photo is saved${order.payment_method === "cod" ? " and the cash payment is marked paid" : ""}.`);
    } catch (err) {
      if (!(err instanceof AppError)) return next(err);
      req.flash("error_msg", err.message);
    }
    res.redirect("/rider");
  });
};

// GET /delivery-photos/:code — only staff, or the customer who owns the order
export const photo = async (req, res, next) => {
  try {
    const code = req.params.code;
    const staff = req.session.user && ["admin", "accountant", "rider"].includes(req.session.user.role);
    const own = req.session.customer && (await orderService.getForCustomer(req.session.customer.id, code));
    const file = (staff || own) && deliveryPhotoService.photoFile(code);
    if (!file) return res.status(404).end();
    res.set("Cache-Control", "private, no-cache");
    res.sendFile(file);
  } catch (err) {
    next(err);
  }
};
