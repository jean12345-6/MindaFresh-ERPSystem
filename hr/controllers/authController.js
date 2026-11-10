import { STAFF_ROLES } from "../utils/roles.js";
import { login } from "../services/authService.js";

export const loginPage = (req, res) => {
  res.render("login", { title: "Sign in" });
};

export const loginUser = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const user = await login(
      String(username || "").trim().slice(0, 50),
      String(password || "").slice(0, 1000),
    );
    if (
      !user ||
      !STAFF_ROLES.includes(user.role)
    ) {
      req.flash(
        "error_msg",
        "Check your username, password, and PeoplePay account access.",
      );
      return res.redirect("/login");
    }
    req.session.regenerate((error) => {
      if (error) return next(error);
      req.session.user = user;
      req.session.userId = user.user_id;
      req.session.save((error) => {
        if (error) return next(error);
        res.redirect("/dashboard");
      });
    });
  } catch (error) {
    if (["INVALID_LOGIN", "ACCOUNT_DISABLED"].includes(error.code)) {
      req.flash("error_msg", error.message);
      return res.redirect("/login");
    }
    next(error);
  }
};

export const logoutUser = (req, res, next) => {
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie("peoplepay.sid");
    res.redirect("/login");
  });
};

export const dashboardPage = async (req, res, next) => {
  try {
    const { getWorkspaceData } = await import(
      "../services/workspaceService.js"
    );
    const data = await getWorkspaceData(req.user);
    res.render("dashboard", {
      title: "Dashboard",
      activeDashboard: true,
      ...data,
    });
  } catch (error) {
    next(error);
  }
};
