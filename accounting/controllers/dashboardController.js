// accounting/controllers/dashboardController.js
import { JournalEntry, SalaryRelease, Remittance } from "../models/index.js";
import { countPending, postNewTransactions } from "../services/postingService.js";
import { incomeStatement, cashPosition } from "../services/reportService.js";
import { manilaDate } from "../utils/dates.js";
import { handle } from "./handle.js";

export const home = (req, res) => res.redirect(req.session.user ? "/dashboard" : "/login");

export const dashboardPage = handle(async (req, res) => {
  const today = manilaDate();
  const monthStart = today.slice(0, 8) + "01";
  // Blueprint v2.4 flow G: Post new transactions also runs when the dashboard opens
  const auto = await postNewTransactions(req.session.user.employee_id);
  if (auto.done.length) res.locals.success_msg = [`${auto.done.length} new transaction(s) posted automatically.`];
  if (auto.failed.length) res.locals.error_msg = [`${auto.failed.length} could not be posted. Open Post transactions to see why.`];
  const [pending, month, cash, recent, releases, remits] = await Promise.all([
    countPending(),
    incomeStatement(monthStart, today),
    cashPosition(today),
    JournalEntry.findAll({ order: [["id", "DESC"]], limit: 8 }),
    SalaryRelease.count({ where: { status: "pending" } }),
    Remittance.count({ where: { status: "pending" } })
  ]);
  res.render("dashboard", {
    title: "Dashboard", today, monthStart, pending, month, cash, releases, remits,
    recent: recent.map((e) => e.get({ plain: true }))
  });
});
