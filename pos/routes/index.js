// pos/routes/index.js — every page and the roles that may open it.
// cashier: sell + sales. inventory_staff: stock, suppliers, purchase orders. admin: everything + products.
import express from "express";
import { imageField } from "../utils/upload.js";
import { checkDb } from "../utils/dbStatus.js";
import { loginLimiter } from "../middleware/security.js";
import { requireRole } from "../middleware/requireRole.js";
import { loginPage, loginUser, logoutUser, homeFor } from "../controllers/authController.js";
import { dashboard } from "../controllers/dashboardController.js";
import { cashierPage, checkoutSale, listSales, showSale, voidSaleAction } from "../controllers/saleController.js";
import { listProducts, newProduct, createProduct, editProduct, updateProduct, toggleProduct, listCategories, saveCategory } from "../controllers/productController.js";
import { logRemoval, auditPage } from "../controllers/auditController.js";
import { settingsPage, saveSettingsAction, resetSettingsAction, refreshImageLinksAction } from "../controllers/settingsController.js";
import { stockList, adjustForm, adjustSave, movements } from "../controllers/inventoryController.js";
import { listSuppliers, newSupplier, createSupplier, editSupplier, updateSupplier, toggleSupplier } from "../controllers/supplierController.js";
import { listOrders, newOrder, createOrderAction, showOrder, editOrder, updateOrderAction, placeOrderAction, cancelOrderAction, receiveOrderAction } from "../controllers/purchaseController.js";

const router = express.Router();
// Express 4 does not catch rejected promises: pass them to the error page.
const a = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const ANY = requireRole("admin", "cashier", "inventory_staff");
const SELL = requireRole("admin", "cashier");
const STOCK = requireRole("admin", "inventory_staff");
const ADMIN = requireRole("admin");

router.get("/", (req, res) => res.redirect(req.session.user ? homeFor(req.session.user.role) : "/login"));
router.get("/login", loginPage);
router.get("/health/db", async (req, res) => { res.set("Cache-Control", "no-store"); res.json({ ok: await checkDb() }); });
router.post("/login", loginLimiter, a(loginUser));
router.get("/logout", logoutUser);
router.post("/logout", logoutUser);

router.get("/dashboard", ANY, a(dashboard));

// Sales (cashier)
router.get("/cashier", SELL, a(cashierPage));
router.post("/cashier/checkout", SELL, a(checkoutSale));
router.post("/cashier/removal", SELL, a(logRemoval));
router.get("/sales", SELL, a(listSales));
router.get("/sales/:id", SELL, a(showSale));
router.post("/sales/:id/void", SELL, a(voidSaleAction));

// Products and categories (admin)
router.get("/products", ADMIN, a(listProducts));
router.get("/products/new", ADMIN, a(newProduct));
router.post("/products", ADMIN, imageField("image"), a(createProduct));
router.get("/products/:id/edit", ADMIN, a(editProduct));
router.post("/products/:id", ADMIN, imageField("image"), a(updateProduct));
router.post("/products/:id/toggle", ADMIN, a(toggleProduct));
router.get("/categories", ADMIN, a(listCategories));
router.post("/categories", ADMIN, a(saveCategory));
router.post("/categories/:id", ADMIN, a(saveCategory));

// Audit log (admin)
router.get("/audit-log", ADMIN, auditPage);

// Settings (admin)
router.get("/settings", ADMIN, a(settingsPage));
router.post("/settings", ADMIN, imageField("storeImage"), saveSettingsAction);
router.post("/settings/reset", ADMIN, resetSettingsAction);
router.post("/settings/refresh-image-links", ADMIN, a(refreshImageLinksAction));

// Inventory
router.get("/stock", STOCK, a(stockList));
router.get("/stock/adjust", STOCK, a(adjustForm));
router.post("/stock/adjust", STOCK, a(adjustSave));
router.get("/stock/movements", STOCK, a(movements));

// Suppliers
router.get("/suppliers", STOCK, a(listSuppliers));
router.get("/suppliers/new", STOCK, newSupplier);
router.post("/suppliers", STOCK, a(createSupplier));
router.get("/suppliers/:id/edit", STOCK, a(editSupplier));
router.post("/suppliers/:id", STOCK, a(updateSupplier));
router.post("/suppliers/:id/toggle", STOCK, a(toggleSupplier));

// Purchase orders
router.get("/purchase-orders", STOCK, a(listOrders));
router.get("/purchase-orders/new", STOCK, a(newOrder));
router.post("/purchase-orders", STOCK, a(createOrderAction));
router.get("/purchase-orders/:id", STOCK, a(showOrder));
router.get("/purchase-orders/:id/edit", STOCK, a(editOrder));
router.post("/purchase-orders/:id", STOCK, a(updateOrderAction));
router.post("/purchase-orders/:id/place", STOCK, a(placeOrderAction));
router.post("/purchase-orders/:id/receive", STOCK, a(receiveOrderAction));
router.post("/purchase-orders/:id/cancel", STOCK, a(cancelOrderAction));

// Old addresses (before the pages were renamed to match the sidebar) still work.
const OLD = { pos: "cashier", inventory: "stock", purchases: "purchase-orders", audit: "audit-log" };
router.all(/^\/(pos|inventory|purchases|audit)(\/.*)?$/, (req, res) => {
  const [, head] = req.path.match(/^\/(\w+)/);
  res.redirect(307, req.originalUrl.replace(/^\/\w+/, "/" + OLD[head]));
});

export default router;
