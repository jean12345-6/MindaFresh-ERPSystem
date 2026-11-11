// MindaFresh POS (with Inventory and Purchasing) — Bren — port 3002
// Shared database mindafresh_db. Never call sequelize.sync(): tables come only from shared/database/schema.sql.
import "dotenv/config";
import path from "path";
import express from "express";
import session from "express-session";
import flash from "connect-flash";
import { engine } from "express-handlebars";
import { sequelize } from "./config/database.js";
import { helpers } from "./helpers/handlebars.js";
import { getSettings } from "./utils/settings.js";
import { securityHeaders, sameOrigin } from "./middleware/security.js";
import { isOfflineError, dbTarget } from "./utils/dbStatus.js";
import router from "./routes/index.js";

const app = express();
const PROD = process.env.NODE_ENV === "production";
if (PROD && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === "pos-session-secret")) {
  console.error("Refusing to start: set a long random SESSION_SECRET in .env before running in production.");
  process.exit(1);
}
app.disable("x-powered-by");
if (process.env.TRUST_PROXY) app.set("trust proxy", Number(process.env.TRUST_PROXY) || 1); // behind nginx / a hosting proxy
const PORT = Number(process.env.PORT) || 3002;
const APP_NAME = process.env.APP_NAME || "MindaFresh POS";

app.engine("xian", engine({
  extname: ".xian",
  defaultLayout: false,
  partialsDir: path.join(process.cwd(), "views", "partials"),
  helpers
}));
app.set("view engine", "xian");
app.set("views", path.join(process.cwd(), "views"));

app.use(securityHeaders);
app.use(express.json({ limit: "200kb" }));
app.use(express.urlencoded({ extended: true, limit: "200kb" }));
app.use(express.static(path.join(process.cwd(), "public")));
app.use("/vendor/sweetalert2", express.static(path.join(process.cwd(), "node_modules", "sweetalert2", "dist")));
app.use(session({
  secret: process.env.SESSION_SECRET || "pos-session-secret",
  resave: false,
  saveUninitialized: false,
  name: "pos.sid",
  cookie: { maxAge: 1000 * 60 * 60 * 10, httpOnly: true, sameSite: "lax", secure: process.env.COOKIE_SECURE === "1" } // one store day. COOKIE_SECURE=1 only when the site runs on https
}));
app.use(flash());
app.get("/favicon.ico", (req, res) => res.status(204).end()); // so it never eats a flash message

app.use((req, res, next) => {
  const user = req.session.user || null;
  res.locals.appName = APP_NAME;
  res.locals.currentUser = user;
  res.locals.isAdmin = user?.role === "admin";
  res.locals.canSell = ["admin", "cashier"].includes(user?.role);
  res.locals.canStock = ["admin", "inventory_staff"].includes(user?.role);
  res.locals.currentPath = req.path;
  res.locals.cfg = getSettings();
  res.locals.success_msg = req.flash("success_msg");
  res.locals.error_msg = req.flash("error_msg");
  next();
});

app.use(sameOrigin);
app.use("/", router);

app.use((req, res) => res.status(404).render("error", { title: "Not found", heading: "Page not found", message: `There is no page at ${req.path}.` }));

// "Database is offline": the DB host slept or MySQL stopped. Logged-out visitors stay on the login form (it shows a modal);
// logged-in staff get a plain page with the same modal and no sidebar. Pages recover on reload once the DB is back.
app.use((err, req, res, next) => {
  console.error(err);
  if (isOfflineError(err)) {
    if (!req.session?.user) return res.redirect("/login?offline=1");
    return res.status(503).render("offline", { title: "Database is offline", dbTarget: dbTarget() });
  }
  res.status(500).render("error", {
    title: "Error", heading: "Something went wrong",
    message: PROD && err.name !== "AppError" ? "Something went wrong on our side. Please try again, and tell the admin if it keeps happening." : err.message
  });
});

// A bug in one request must never take the whole POS down: log it and keep serving.
process.on("unhandledRejection", (reason) => console.error("Unhandled rejection:", reason));

app.listen(PORT, async () => {
  console.log(`${APP_NAME} running at http://localhost:${PORT}`);
  try {
    await sequelize.authenticate();
    console.log(`✓ Connected to ${process.env.DB_NAME} on ${process.env.DB_HOST}:${process.env.DB_PORT}`);
  } catch (e) {
    console.log(`✗ Database not reachable yet (${e.message}). Run: node ../shared/check-connection.js pos`);
  }
});
