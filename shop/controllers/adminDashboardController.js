// adminDashboardController — use case "View dashboard" (Admin, Accountant)
import * as dashboardService from "../services/dashboardService.js";

// GET /admin
export const index = async (req, res, next) => {
  try {
    const d = await dashboardService.today();
    res.render("admin-dashboard", { title: "Dashboard", nav: "dashboard", d });
  } catch (err) {
    next(err);
  }
};
