// authController — customer accounts (customers table, CustomerService) and staff login (users ⨝ employees, shared AuthService)
// Customers live in req.session.customer, staff in req.session.user: two separate logins.
import * as customerService from "../services/customerService.js";
import { login as staffLoginService } from "../services/authService.js";
import { AppError } from "../utils/appError.js";

const SHOP_STAFF_ROLES = ["admin", "accountant", "rider"];
// Where each staff role lands after logging in
const homeFor = (role) => (role === "rider" ? "/rider" : "/admin");

function goBack(req, res) {
  const to = req.session.returnTo || "/";
  delete req.session.returnTo;
  res.redirect(to);
}

// --- Customers ---------------------------------------------------------------------

export const showLogin = (req, res) => {
  if (req.session.customer) return res.redirect("/");
  res.render("login", { title: "Log in" });
};

export const login = async (req, res, next) => {
  try {
    const customer = await customerService.login(req.body.email, req.body.password);
    req.session.customer = customerService.toSession(customer);
    req.flash("success_msg", `Welcome back, ${customer.first_name}!`);
    goBack(req, res);
  } catch (err) {
    if (!(err instanceof AppError)) return next(err);
    req.flash("error_msg", err.message);
    res.redirect("/login");
  }
};

export const showRegister = (req, res) => {
  if (req.session.customer) return res.redirect("/");
  res.render("register", { title: "Create account", form: { city: "Calapan City" } });
};

export const register = async (req, res, next) => {
  try {
    const customer = await customerService.register(req.body);
    req.session.customer = customerService.toSession(customer);
    req.flash("success_msg", `Welcome to MindaFresh, ${customer.first_name}! Your account is ${customer.customer_code}.`);
    goBack(req, res);
  } catch (err) {
    if (!(err instanceof AppError)) return next(err);
    res.status(400).render("register", { title: "Create account", form: err.form || req.body, error_msg: err.details || [err.message] });
  }
};

export const logout = (req, res) => {
  delete req.session.customer;
  delete req.session.returnTo;
  res.redirect("/");
};

// Use case "Manage profile"
export const showProfile = async (req, res, next) => {
  try {
    const profile = await customerService.getProfile(req.session.customer.id);
    res.render("profile", { title: "My profile", form: profile });
  } catch (err) {
    next(err);
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    const c = await customerService.updateProfile(req.session.customer.id, req.body);
    req.session.customer = customerService.toSession(c);
    req.flash("success_msg", "Your profile was saved.");
  } catch (err) {
    if (!(err instanceof AppError)) return next(err);
    req.flash("error_msg", err.message);
  }
  res.redirect("/profile");
};

export const changePassword = async (req, res, next) => {
  try {
    await customerService.changePassword(req.session.customer.id, req.body);
    req.flash("success_msg", "Your password was changed.");
  } catch (err) {
    if (!(err instanceof AppError)) return next(err);
    req.flash("error_msg", err.message);
  }
  res.redirect("/profile");
};

// --- Staff (Admin, Accountant) -------------------------------------------------------

export const showStaffLogin = (req, res) => {
  if (req.session.user && SHOP_STAFF_ROLES.includes(req.session.user.role)) {
    // Already logged in (e.g. sent here by requireRole): keep the message for the next page
    res.locals.error_msg.forEach((m) => req.flash("error_msg", m));
    return res.redirect(homeFor(req.session.user.role));
  }
  res.render("admin-login", { title: "Staff log in" });
};

export const staffLogin = async (req, res, next) => {
  try {
    const user = await staffLoginService((req.body.username || "").trim(), req.body.password || "");
    if (!SHOP_STAFF_ROLES.includes(user.role)) {
      req.flash("error_msg", "Your account cannot use the Shop admin. Only admin, accountant and rider accounts can.");
      return res.redirect("/admin/login");
    }
    req.session.user = user;
    res.redirect(homeFor(user.role));
  } catch (err) {
    if (!(err instanceof AppError)) return next(err);
    req.flash("error_msg", err.message);
    res.redirect("/admin/login");
  }
};

export const staffLogout = (req, res) => {
  delete req.session.user;
  res.redirect("/admin/login");
};
