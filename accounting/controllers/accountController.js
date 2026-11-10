// accounting/controllers/accountController.js — chart of accounts
import { Account } from "../models/index.js";
import { AppError } from "../utils/appError.js";
import { accountTotals } from "../services/reportService.js";
import { manilaDate } from "../utils/dates.js";
import { handle } from "./handle.js";

const TYPES = { asset: "debit", liability: "credit", equity: "credit", revenue: "credit", expense: "debit" };

export const accountsPage = handle(async (req, res) => {
  const rows = await accountTotals(null, manilaDate());
  const groups = Object.keys(TYPES).map((type) => ({ type, rows: rows.filter((r) => r.account_type === type) }));
  res.render("accounts", { title: "Chart of accounts", groups, types: Object.keys(TYPES) });
});

export const createAccount = handle(async (req, res) => {
  const code = (req.body.account_code || "").trim();
  const name = (req.body.account_name || "").trim();
  const type = req.body.account_type;
  if (!/^\d{4}$/.test(code)) throw new AppError("VALIDATION_ERROR", "Account code must be 4 digits, for example 6050.");
  if (!name) throw new AppError("VALIDATION_ERROR", "Enter the account name.");
  if (!TYPES[type]) throw new AppError("VALIDATION_ERROR", "Choose an account type.");
  if (await Account.count({ where: { account_code: code } })) throw new AppError("DUPLICATE", `Account ${code} already exists.`);
  await Account.create({ account_code: code, account_name: name, account_type: type, normal_balance: TYPES[type], is_active: true });
  req.flash("success_msg", `Account ${code} ${name} added.`);
  res.redirect("/accounts");
}, "/accounts");

export const toggleAccount = handle(async (req, res) => {
  const a = await Account.findByPk(req.params.id);
  if (!a) throw new AppError("VALIDATION_ERROR", "Account not found.");
  const SYSTEM = ["1010", "1020", "1200", "2010", "2100", "2110", "2120", "3010", "4010", "4020", "4030", "5010", "6010", "6040"];
  if (a.is_active && SYSTEM.includes(a.account_code)) throw new AppError("VALIDATION_ERROR", `${a.account_code} is used by automatic posting and cannot be turned off.`);
  await a.update({ is_active: !a.is_active });
  req.flash("success_msg", `${a.account_code} ${a.account_name} is now ${a.is_active ? "active" : "inactive"}.`);
  res.redirect("/accounts");
}, "/accounts");
