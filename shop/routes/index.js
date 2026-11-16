// MindaFresh Online Shop — routes (package diagram: routes → middleware → controllers)
import express from "express";
import { requireRole } from "../middleware/requireRole.js";
import { requireCustomer } from "../middleware/requireCustomer.js";
import * as auth from "../controllers/authController.js";
import * as catalog from "../controllers/catalogController.js";
import * as cart from "../controllers/cartController.js";
import * as checkout from "../controllers/checkoutController.js";
import * as order from "../controllers/orderController.js";
import * as adminOrder from "../controllers/adminOrderController.js";
import * as adminCustomer from "../controllers/adminCustomerController.js";
import * as report from "../controllers/reportController.js";
import * as adminProduct from "../controllers/adminProductController.js";
import * as adminDashboard from "../controllers/adminDashboardController.js";
import * as review from "../controllers/reviewController.js";
import * as delivery from "../controllers/deliveryController.js";

const router = express.Router();

// Storefront (anyone)
router.get("/", catalog.index);
router.get("/products/:code", catalog.show);
router.get("/photos/:code", catalog.photo);
router.get("/delivery-photos/:code", delivery.photo); // checks the viewer itself: staff or the order's customer

// Customer accounts
router.get("/login", auth.showLogin);
router.post("/login", auth.login);
router.get("/register", auth.showRegister);
router.post("/register", auth.register);
router.get("/logout", auth.logout);
router.get("/dashboard", requireCustomer, (req, res) => res.redirect("/orders"));
router.get("/profile", requireCustomer, auth.showProfile);
router.post("/profile", requireCustomer, auth.updateProfile);
router.post("/profile/password", requireCustomer, auth.changePassword);

// Cart and checkout (logged-in customer)
router.get("/cart", requireCustomer, cart.view);
router.post("/cart/add", requireCustomer, cart.add);
router.post("/cart/:id/update", requireCustomer, cart.update);
router.post("/cart/:id/remove", requireCustomer, cart.remove);
router.get("/checkout", requireCustomer, checkout.show);
router.post("/checkout", requireCustomer, checkout.placeOrder);

// My orders
router.get("/orders", requireCustomer, order.myOrders);
router.get("/orders/:code", requireCustomer, order.show);
router.post("/orders/:code/cancel", requireCustomer, order.cancel);
router.post("/orders/:code/reviews", requireCustomer, review.save);

// Staff (users ⨝ employees)
router.get("/admin", requireRole("admin", "accountant"), adminDashboard.index);
router.get("/admin/login", auth.showStaffLogin);
router.post("/admin/login", auth.staffLogin);
router.get("/admin/logout", auth.staffLogout);

// Admin and Accountant
router.get("/admin/orders", requireRole("admin", "accountant"), adminOrder.list);
router.get("/admin/orders/:code", requireRole("admin", "accountant"), adminOrder.show);
router.get("/admin/report", requireRole("admin", "accountant"), report.salesSummary);

// Admin only
router.post("/admin/orders/:code/status", requireRole("admin"), adminOrder.updateStatus);
router.post("/admin/orders/:code/cancel", requireRole("admin"), adminOrder.cancel);
router.post("/admin/orders/:code/return", requireRole("admin"), adminOrder.recordReturn);
router.get("/admin/customers", requireRole("admin"), adminCustomer.list);
router.post("/admin/customers/:code/status", requireRole("admin"), adminCustomer.setStatus);
router.get("/admin/products", requireRole("admin"), adminProduct.list);
router.post("/admin/products/:code/photo", requireRole("admin"), adminProduct.uploadPhoto);
router.post("/admin/products/:code/photo/remove", requireRole("admin"), adminProduct.removePhoto);
router.get("/admin/reviews", requireRole("admin"), review.list);
router.post("/admin/reviews/:id/status", requireRole("admin"), review.setStatus);

// Rider: only riders deliver, with a proof-of-delivery photo. The admin can view the history.
router.get("/rider", requireRole("rider"), delivery.riderPage);
router.get("/rider/history", requireRole("rider", "admin"), delivery.history);
router.post("/rider/orders/:code/deliver", requireRole("rider"), delivery.riderDeliver);

export default router;
