// pos/controllers/authController.js — staff login through the shared users ⨝ employees (HR).
// No sequelize.sync() and no local User model: the same account works in every staff module.
import { isOfflineError, dbTarget } from "../utils/dbStatus.js";
import { getSettings } from "../utils/settings.js";
import { login } from "../services/authService.js";

const POS_ROLES = ["admin", "cashier", "inventory_staff"];
export const homeFor = () => "/dashboard";

export const loginPage = (req, res) => {
  const offline = req.query.offline === "1";
  if (req.session.user && !offline) return res.redirect(homeFor(req.session.user.role));
  res.render("login", { title: "Log in", offline, dbTarget: dbTarget() });
};

export const loginUser = async (req, res, next) => {
  const username = String(req.body.username || "").trim();
  try {
    const user = await login(username, String(req.body.password || ""));
    if (!POS_ROLES.includes(user.role)) {
      req.flash("error_msg", "This account cannot use POS. Use the module for your role.");
      return res.redirect("/login");
    }
    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.user = user;
      req.session.cookie.maxAge = getSettings().sessionHours * 60 * 60 * 1000;
      req.session.save(() => res.redirect(homeFor(user.role)));
    });
  } catch (e) {
    if (isOfflineError(e)) return res.redirect("/login?offline=1"); // stay on the form, the page shows a modal
    if (e.code === "INVALID_LOGIN" || e.code === "ACCOUNT_DISABLED") {
      req.flash("error_msg", e.message);
      return res.redirect("/login");
    }
    next(e);
  }
};

export const logoutUser = (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
};
