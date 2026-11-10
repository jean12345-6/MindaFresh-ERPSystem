// accounting/services/reportService.js  (owner: Jean, Accounting)
// Every report reads only Accounting's own tables (journal_entries, journal_lines, accounts),
// so reports still work even when no other module is running. Voided entries are left out.
import { QueryTypes } from "sequelize";
import { sequelize } from "../models/index.js";
import { round2 } from "../utils/money.js";

const select = (sql, replacements = {}) => sequelize.query(sql, { type: QueryTypes.SELECT, replacements });

// Signed balance on the account's normal side (a positive number is the usual case)
const sideBalance = (a) => round2(a.normal_balance === "debit" ? a.debit - a.credit : a.credit - a.debit);

// Totals per account for entries in [from, to]. from = null means "since the beginning".
export async function accountTotals(from, to) {
  const rows = await select(
    `SELECT a.id, a.account_code, a.account_name, a.account_type, a.normal_balance, a.is_active,
            COALESCE(SUM(CASE WHEN je.id IS NOT NULL THEN jl.debit END), 0) AS debit,
            COALESCE(SUM(CASE WHEN je.id IS NOT NULL THEN jl.credit END), 0) AS credit
     FROM accounts a
     LEFT JOIN journal_lines jl ON jl.account_id = a.id
     LEFT JOIN journal_entries je ON je.id = jl.journal_entry_id AND je.status = 'posted'
          AND je.entry_date <= :to ${from ? "AND je.entry_date >= :from" : ""}
     GROUP BY a.id ORDER BY a.account_code`, { from, to });
  return rows.map((r) => ({ ...r, debit: round2(r.debit), credit: round2(r.credit), balance: sideBalance(r) }));
}

export async function trialBalance(asOf) {
  const rows = (await accountTotals(null, asOf)).map((a) => {
    const net = round2(a.debit - a.credit);
    return { ...a, tb_debit: net > 0 ? net : 0, tb_credit: net < 0 ? -net : 0 };
  }).filter((a) => a.debit || a.credit);
  const total_debit = round2(rows.reduce((s, r) => s + r.tb_debit, 0));
  const total_credit = round2(rows.reduce((s, r) => s + r.tb_credit, 0));
  return { rows, total_debit, total_credit, balanced: total_debit === total_credit };
}

export async function incomeStatement(from, to) {
  const all = await accountTotals(from, to);
  const revenue = all.filter((a) => a.account_type === "revenue" && (a.debit || a.credit));
  const expenses = all.filter((a) => a.account_type === "expense" && (a.debit || a.credit));
  const total_revenue = round2(revenue.reduce((s, a) => s + a.balance, 0));
  const total_expenses = round2(expenses.reduce((s, a) => s + a.balance, 0));
  const cogs = expenses.filter((a) => a.account_code === "5010").reduce((s, a) => s + a.balance, 0);
  return {
    revenue, expenses, total_revenue, total_expenses,
    gross_profit: round2(total_revenue - cogs),
    net_income: round2(total_revenue - total_expenses)
  };
}

export async function balanceSheet(asOf) {
  const all = await accountTotals(null, asOf);
  const pick = (type) => all.filter((a) => a.account_type === type && (a.debit || a.credit));
  const assets = pick("asset"), liabilities = pick("liability"), equity = pick("equity");
  const earnings = round2(pick("revenue").reduce((s, a) => s + a.balance, 0) - pick("expense").reduce((s, a) => s + a.balance, 0));
  const total_assets = round2(assets.reduce((s, a) => s + a.balance, 0));
  const total_liabilities = round2(liabilities.reduce((s, a) => s + a.balance, 0));
  const total_equity = round2(equity.reduce((s, a) => s + a.balance, 0) + earnings);
  return {
    assets, liabilities, equity, earnings, total_assets, total_liabilities, total_equity,
    total_le: round2(total_liabilities + total_equity),
    balanced: total_assets === round2(total_liabilities + total_equity)
  };
}

export async function ledger(account_id, from, to) {
  const [account] = await select(`SELECT * FROM accounts WHERE id = :account_id`, { account_id });
  if (!account) return null;
  const [open] = await select(
    `SELECT COALESCE(SUM(jl.debit), 0) AS debit, COALESCE(SUM(jl.credit), 0) AS credit
     FROM journal_lines jl JOIN journal_entries je ON je.id = jl.journal_entry_id
     WHERE jl.account_id = :account_id AND je.status = 'posted' AND je.entry_date < :from`, { account_id, from });
  const opening = sideBalance({ ...account, debit: Number(open.debit), credit: Number(open.credit) });
  const lines = await select(
    `SELECT je.id AS entry_id, je.entry_code, DATE_FORMAT(je.entry_date, '%Y-%m-%d') AS entry_date, je.description,
            je.reference_code, jl.debit, jl.credit, jl.memo
     FROM journal_lines jl JOIN journal_entries je ON je.id = jl.journal_entry_id
     WHERE jl.account_id = :account_id AND je.status = 'posted' AND je.entry_date BETWEEN :from AND :to
     ORDER BY je.entry_date, je.id, jl.id`, { account_id, from, to });
  let running = opening;
  const rows = lines.map((l) => {
    const d = Number(l.debit), c = Number(l.credit);
    running = round2(running + (account.normal_balance === "debit" ? d - c : c - d));
    return { ...l, debit: d, credit: c, balance: running };
  });
  return {
    account, opening, closing: running, rows,
    total_debit: round2(rows.reduce((s, r) => s + r.debit, 0)),
    total_credit: round2(rows.reduce((s, r) => s + r.credit, 0))
  };
}

// POS vs Online, from the posted sale and sale_reversal entries
export async function salesSummary(from, to) {
  const rows = await select(
    `SELECT je.source_module, je.entry_type, COUNT(DISTINCT je.id) AS entries,
            COALESCE(SUM(CASE WHEN a.account_code IN ('4010','4020','4030') THEN jl.credit - jl.debit END), 0) AS revenue,
            COALESCE(SUM(CASE WHEN a.account_code = '5010' THEN jl.debit - jl.credit END), 0) AS cogs
     FROM journal_entries je JOIN journal_lines jl ON jl.journal_entry_id = je.id JOIN accounts a ON a.id = jl.account_id
     WHERE je.status = 'posted' AND je.entry_type IN ('sale', 'sale_reversal') AND je.entry_date BETWEEN :from AND :to
     GROUP BY je.source_module, je.entry_type`, { from, to });
  const channel = (src, name) => {
    const sale = rows.find((r) => r.source_module === src && r.entry_type === "sale") || { entries: 0, revenue: 0, cogs: 0 };
    const rev = rows.find((r) => r.source_module === src && r.entry_type === "sale_reversal") || { entries: 0, revenue: 0, cogs: 0 };
    const net_sales = round2(Number(sale.revenue) + Number(rev.revenue));
    const cogs = round2(Number(sale.cogs) + Number(rev.cogs));
    return {
      name, transactions: Number(sale.entries), reversals: Number(rev.entries),
      gross_sales: round2(sale.revenue), returns: round2(-Number(rev.revenue)),
      net_sales, cogs, gross_profit: round2(net_sales - cogs)
    };
  };
  const pos = channel("pos", "POS (in-store)");
  const shop = channel("shop", "Online Shop");
  const total = {
    name: "Total",
    transactions: pos.transactions + shop.transactions, reversals: pos.reversals + shop.reversals,
    gross_sales: round2(pos.gross_sales + shop.gross_sales), returns: round2(pos.returns + shop.returns),
    net_sales: round2(pos.net_sales + shop.net_sales), cogs: round2(pos.cogs + shop.cogs),
    gross_profit: round2(pos.gross_profit + shop.gross_profit)
  };
  return { channels: [pos, shop], total };
}

export async function cashPosition(asOf) {
  const all = await accountTotals(null, asOf);
  const get = (code) => all.find((a) => a.account_code === code)?.balance || 0;
  return { cash: get("1010"), bank: get("1020"), inventory: get("1200"), payables: round2(get("2010") + get("2100") + get("2110") + get("2120")) };
}
