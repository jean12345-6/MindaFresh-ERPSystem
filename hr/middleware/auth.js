import { isSelfService } from "../utils/roles.js";
import { sessionUser } from "../services/authService.js";

export const requireAuth = async (req, res, next) => {
  if (!(req.session.user?.user_id || req.session.userId)) return res.redirect("/login");
  try {
    const user = await sessionUser(req.session.user?.user_id || req.session.userId);
    if (!user) {
      delete req.session.userId;
      delete req.session.user;
      return res.redirect("/login");
    }
    req.session.user = user;
    req.user = user;
    res.locals.currentUser = user;
    res.locals.isAdmin = user.role === "admin";
    res.locals.canManageHR = ["admin", "hr_staff"].includes(user.role);
    res.locals.canReadPayroll = ["admin", "hr_staff", "accountant"].includes(
      user.role,
    );
    res.locals.isEmployee = isSelfService(user.role);
    res.set("Cache-Control", "no-store");
    next();
  } catch (error) {
    next(error);
  }
};

export const requireRole =
  (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.session.user?.role)) {
      const path = process.env.STAFF_LOGIN_PATH || "/login";
      return res.redirect(path.startsWith("/") && !path.startsWith("//") ? path : "/login");
    }
    next();
  };
