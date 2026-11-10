// accounting/controllers/reportController.js — the financial reports
import { Account } from "../models/index.js";
import { trialBalance, incomeStatement, balanceSheet, ledger, salesSummary } from "../services/reportService.js";
import { manilaDate } from "../utils/dates.js";
import { handle } from "./handle.js";

const isDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || "");
const range = (q) => {
  const today = manilaDate();
  const from = isDate(q.from) ? q.from : today.slice(0, 5) + "01-01"; // year to date
  const to = isDate(q.to) ? q.to : today;
  return from <= to ? { from, to } : { from: to, to: from };
};
const asOf = (q) => (isDate(q.as_of) ? q.as_of : manilaDate());

export const reportsIndex = (req, res) => res.render("reports", { title: "Reports" });

export const trialBalancePage = handle(async (req, res) => {
  const as_of = asOf(req.query);
  res.render("report-trial-balance", { title: "Trial balance", as_of, tb: await trialBalance(as_of) });
});

export const incomeStatementPage = handle(async (req, res) => {
  const r = range(req.query);
  res.render("report-income-statement", { title: "Income statement", ...r, is: await incomeStatement(r.from, r.to) });
});

export const balanceSheetPage = handle(async (req, res) => {
  const as_of = asOf(req.query);
  res.render("report-balance-sheet", { title: "Balance sheet", as_of, bs: await balanceSheet(as_of) });
});

export const ledgerPage = handle(async (req, res) => {
  const r = range(req.query);
  const accounts = (await Account.findAll({ order: [["account_code", "ASC"]] })).map((a) => a.get({ plain: true }));
  const account_id = req.query.account_id || accounts.find((a) => a.account_code === "1010")?.id;
  res.render("report-ledger", { title: "General ledger", ...r, accounts, account_id, gl: await ledger(account_id, r.from, r.to) });
});

export const salesSummaryPage = handle(async (req, res) => {
  const r = range(req.query);
  res.render("report-sales-summary", { title: "Sales summary", ...r, ss: await salesSummary(r.from, r.to) });
});
