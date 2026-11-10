// accounting/controllers/postingController.js — "Post new transactions"
import { findPending, postNewTransactions } from "../services/postingService.js";
import { handle } from "./handle.js";

export const pendingPage = handle(async (req, res) => {
  const p = await findPending();
  const groups = [
    { key: "posSales", title: "POS sales", from: "POS", rows: p.posSales, rule: "Dr Cash / E-Wallet, Cr Sales Revenue – POS; Dr COGS, Cr Inventory" },
    { key: "posVoids", title: "Voided POS sales", from: "POS", rows: p.posVoids, rule: "Reverses the posted sale" },
    { key: "shopSales", title: "Delivered online orders", from: "Online Shop", rows: p.shopSales, rule: "Dr Cash / E-Wallet, Cr Sales Revenue – Online and Delivery Fee Income; Dr COGS, Cr Inventory" },
    { key: "shopReversals", title: "Returned or refunded online orders", from: "Online Shop", rows: p.shopReversals, rule: "Reverses the posted sale" },
    { key: "purchases", title: "Purchase orders received", from: "POS", rows: p.purchases, rule: "Dr Inventory, Cr Cash (or Accounts Payable if on account)" },
    { key: "adjustments", title: "Stock adjustments", from: "POS", rows: p.adjustments, rule: "Loss: Dr Inventory Loss, Cr Inventory (gain is the opposite)" },
    { key: "payrolls", title: "Approved payroll runs", from: "HR", rows: p.payrolls, rule: "Dr Salaries Expense, Cr Salaries / Gov't Contributions / Withholding Tax Payable" }
  ];
  const total = groups.reduce((s, g) => s + g.rows.length, 0);
  res.render("post", { title: "Post new transactions", groups, total, result: req.session.lastPost || null });
  delete req.session.lastPost;
});

export const postNew = handle(async (req, res) => {
  const result = await postNewTransactions(req.session.user.employee_id);
  req.session.lastPost = result;
  if (result.done.length) req.flash("success_msg", `${result.done.length} transaction(s) posted to the journal.`);
  else if (!result.failed.length) req.flash("success_msg", "Nothing new to post. Everything is up to date.");
  if (result.failed.length) req.flash("error_msg", `${result.failed.length} could not be posted. See the list below.`);
  res.redirect("/post");
}, "/post");
