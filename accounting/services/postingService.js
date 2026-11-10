// accounting/services/postingService.js  (owner: Jean, Accounting) — used only by the Accounting module.
// Turns business events from the other modules into balanced journal entries.
// Accounting only READS other modules' tables (sales, orders, purchase_orders, stock_movements, payroll_runs)
// and WRITES only its own tables (journal_entries, journal_lines, salary_releases, remittances).
// The unique key (source_module, entry_type, reference_code) makes every posting safe to repeat.
import { QueryTypes } from "sequelize";
import { sequelize, Account, JournalEntry, JournalLine, SalaryRelease, Remittance } from "../models/index.js";
import { AppError } from "../utils/appError.js";
import { round2, peso } from "../utils/money.js";
import { manilaDate } from "../utils/dates.js";

// Account codes from the seeded chart of accounts (blueprint Section 4, Accounting)
export const ACC = {
  CASH: "1010", BANK: "1020", INVENTORY: "1200",
  AP: "2010", SALARIES_PAYABLE: "2100", GOV_PAYABLE: "2110", TAX_PAYABLE: "2120",
  CAPITAL: "3010",
  SALES_POS: "4010", SALES_ONLINE: "4020", DELIVERY_INCOME: "4030",
  COGS: "5010", SALARIES_EXPENSE: "6010", INVENTORY_LOSS: "6040"
};

const select = (sql, replacements = {}, transaction) =>
  sequelize.query(sql, { type: QueryTypes.SELECT, replacements, transaction });

// ---------- creating one balanced entry ----------
// lines: [{ code: "1010", debit: 500, memo }, { code: "4010", credit: 500 }]
export async function createEntry({ entry_date, description, source_module, entry_type, reference_code = null, posted_by_id = null, lines }, t) {
  const clean = lines
    .map((l) => ({ code: String(l.code), debit: round2(l.debit || 0), credit: round2(l.credit || 0), memo: l.memo || null }))
    .filter((l) => l.debit > 0 || l.credit > 0);
  if (clean.length < 2) throw new AppError("VALIDATION_ERROR", "A journal entry needs at least two lines.");
  for (const l of clean)
    if (l.debit > 0 && l.credit > 0) throw new AppError("VALIDATION_ERROR", "A line can be a debit or a credit, not both.");

  const total_debit = round2(clean.reduce((s, l) => s + l.debit, 0));
  const total_credit = round2(clean.reduce((s, l) => s + l.credit, 0));
  if (total_debit !== total_credit)
    throw new AppError("VALIDATION_ERROR", `Debits (${peso(total_debit)}) must equal credits (${peso(total_credit)}).`);

  const codes = [...new Set(clean.map((l) => l.code))];
  const accounts = await Account.findAll({ where: { account_code: codes }, transaction: t });
  const byCode = Object.fromEntries(accounts.map((a) => [a.account_code, a]));
  for (const c of codes) {
    if (!byCode[c]) throw new AppError("VALIDATION_ERROR", `Account ${c} does not exist.`);
    if (!byCode[c].is_active) throw new AppError("VALIDATION_ERROR", `Account ${c} ${byCode[c].account_name} is inactive.`);
  }

  if (reference_code) {
    const dup = await JournalEntry.count({ where: { source_module, entry_type, reference_code }, transaction: t });
    if (dup) throw new AppError("DUPLICATE", `${reference_code} is already posted as ${entry_type}.`);
  }

  const entry = await JournalEntry.create({
    entry_date, description, source_module, entry_type, reference_code,
    total_debit, total_credit, status: "posted", posted_by_id
  }, { transaction: t });

  for (const l of clean)
    await JournalLine.create({ journal_entry_id: entry.id, account_id: byCode[l.code].id, debit: l.debit, credit: l.credit, memo: l.memo }, { transaction: t });
  return entry;
}

// Reversal = the original lines with debit and credit swapped.
async function reverseEntry({ source_module, reference_code, entry_date, description, posted_by_id }, t) {
  const original = await JournalEntry.findOne({
    where: { source_module, entry_type: "sale", reference_code, status: "posted" },
    include: [{ model: JournalLine, include: [Account] }], transaction: t
  });
  if (!original) throw new AppError("VALIDATION_ERROR", `No posted sale found for ${reference_code}.`);
  return createEntry({
    entry_date, description, source_module, entry_type: "sale_reversal", reference_code, posted_by_id,
    lines: original.JournalLines.map((l) => ({
      code: l.Account.account_code, debit: Number(l.credit), credit: Number(l.debit), memo: `Reversal of ${original.entry_code}`
    }))
  }, t);
}

// ---------- what is waiting to be posted ----------
// Each finder returns rows that have no journal entry yet.
const notPosted = (src, type, refExpr) =>
  `NOT EXISTS (SELECT 1 FROM journal_entries je WHERE je.source_module = '${src}' AND je.entry_type = '${type}' AND je.reference_code = ${refExpr})`;
const posted = (src, type, refExpr) =>
  `EXISTS (SELECT 1 FROM journal_entries je WHERE je.source_module = '${src}' AND je.entry_type = '${type}' AND je.reference_code = ${refExpr})`;

export async function findPending() {
  const [posSales, posVoids, shopSales, shopReversals, purchases, adjustments, payrolls] = await Promise.all([
    // POS sales that are completed. A sale voided before it was ever posted needs no entry.
    select(`SELECT s.id, s.sale_code AS code, DATE_FORMAT(s.sold_at, '%Y-%m-%d') AS event_date, s.payment_method,
              s.total_amount, s.total_cost, s.discount_amount
            FROM sales s WHERE s.status = 'completed' AND s.sale_code IS NOT NULL AND ${notPosted("pos", "sale", "s.sale_code")}
            ORDER BY s.sold_at, s.id`),
    // POS sales voided AFTER they were posted
    select(`SELECT s.id, s.sale_code AS code, DATE_FORMAT(s.updated_at, '%Y-%m-%d') AS event_date, s.void_reason, s.total_amount
            FROM sales s WHERE s.status = 'voided' AND ${posted("pos", "sale", "s.sale_code")} AND ${notPosted("pos", "sale_reversal", "s.sale_code")}
            ORDER BY s.updated_at, s.id`),
    // Shop orders that were delivered
    select(`SELECT o.id, o.order_code AS code, DATE_FORMAT(COALESCE(o.delivered_at, o.updated_at), '%Y-%m-%d') AS event_date,
              o.payment_method, o.subtotal, o.shipping_fee, o.total_amount, o.total_cost
            FROM orders o WHERE o.order_status = 'delivered' AND o.order_code IS NOT NULL AND ${notPosted("shop", "sale", "o.order_code")}
            ORDER BY o.delivered_at, o.id`),
    // Shop orders returned or refunded AFTER their sale was posted
    select(`SELECT o.id, o.order_code AS code, DATE_FORMAT(o.updated_at, '%Y-%m-%d') AS event_date, o.order_status, o.payment_status, o.total_amount
            FROM orders o WHERE (o.order_status = 'returned' OR o.payment_status = 'refunded')
              AND ${posted("shop", "sale", "o.order_code")} AND ${notPosted("shop", "sale_reversal", "o.order_code")}
            ORDER BY o.updated_at, o.id`),
    // Purchase orders received from suppliers
    select(`SELECT po.id, po.purchase_order_code AS code, DATE_FORMAT(COALESCE(po.received_at, po.updated_at), '%Y-%m-%d') AS event_date,
              po.payment_method, po.total_cost, sp.name AS supplier_name
            FROM purchase_orders po JOIN suppliers sp ON sp.id = po.supplier_id
            WHERE po.status = 'received' AND po.purchase_order_code IS NOT NULL AND ${notPosted("pos", "purchase", "po.purchase_order_code")}
            ORDER BY po.received_at, po.id`),
    // Stock adjustments (spoiled, damaged, counting error)
    select(`SELECT m.id, m.movement_code AS code, DATE_FORMAT(m.created_at, '%Y-%m-%d') AS event_date, m.quantity_change, m.unit_cost,
              m.remarks, p.name AS product_name
            FROM stock_movements m JOIN products p ON p.id = m.product_id
            WHERE m.movement_type = 'adjustment' AND m.movement_code IS NOT NULL AND m.quantity_change <> 0
              AND ${notPosted("pos", "stock_adjustment", "m.movement_code")}
            ORDER BY m.created_at, m.id`),
    // Payroll runs approved by HR
    select(`SELECT pr.id, pr.payroll_code AS code, DATE_FORMAT(COALESCE(pr.approved_at, pr.updated_at), '%Y-%m-%d') AS event_date,
              DATE_FORMAT(pr.period_start, '%Y-%m-%d') AS period_start, DATE_FORMAT(pr.period_end, '%Y-%m-%d') AS period_end,
              pr.employee_count, pr.total_gross, pr.total_contributions, pr.total_withholding_tax, pr.total_net
            FROM payroll_runs pr WHERE pr.status = 'approved' AND pr.payroll_code IS NOT NULL AND ${notPosted("hr", "payroll", "pr.payroll_code")}
            ORDER BY pr.approved_at, pr.id`)
  ]);
  return { posSales, posVoids, shopSales, shopReversals, purchases, adjustments, payrolls };
}

export async function countPending() {
  const p = await findPending();
  const counts = Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v.length]));
  counts.total = Object.values(counts).reduce((a, b) => a + b, 0);
  return counts;
}

// ---------- the posting rules (blueprint Section 7F) ----------
// Blueprint v2.4 flow G: cash and COD go to 1010 Cash on Hand; GCash, card and bank transfer go to 1020 Cash in Bank / E-Wallet
const cashAccount = (method) => (["gcash", "card", "bank_transfer"].includes(method) ? ACC.BANK : ACC.CASH);

const RULES = {
  posSales: (r, by) => ({
    entry_date: r.event_date, source_module: "pos", entry_type: "sale", reference_code: r.code, posted_by_id: by,
    description: `POS sale ${r.code} (${r.payment_method})`,
    lines: [
      { code: cashAccount(r.payment_method), debit: r.total_amount, memo: `Received by ${r.payment_method}` },
      { code: ACC.SALES_POS, credit: r.total_amount, memo: Number(r.discount_amount) ? `Net of discount ${Number(r.discount_amount).toFixed(2)}` : null },
      { code: ACC.COGS, debit: r.total_cost },
      { code: ACC.INVENTORY, credit: r.total_cost }
    ]
  }),
  shopSales: (r, by) => ({
    entry_date: r.event_date, source_module: "shop", entry_type: "sale", reference_code: r.code, posted_by_id: by,
    description: `Online order ${r.code} delivered (${r.payment_method})`,
    lines: [
      { code: cashAccount(r.payment_method), debit: r.total_amount, memo: r.payment_method === "cod" ? "Cash on delivery" : "GCash" },
      { code: ACC.SALES_ONLINE, credit: r.subtotal },
      { code: ACC.DELIVERY_INCOME, credit: r.shipping_fee },
      { code: ACC.COGS, debit: r.total_cost },
      { code: ACC.INVENTORY, credit: r.total_cost }
    ]
  }),
  purchases: (r, by) => ({
    entry_date: r.event_date, source_module: "pos", entry_type: "purchase", reference_code: r.code, posted_by_id: by,
    description: `Purchase ${r.code} received from ${r.supplier_name} (${r.payment_method === "on_account" ? "on account" : "cash"})`,
    lines: [
      { code: ACC.INVENTORY, debit: r.total_cost },
      { code: r.payment_method === "on_account" ? ACC.AP : ACC.CASH, credit: r.total_cost }
    ]
  }),
  adjustments: (r, by) => {
    const amount = round2(Math.abs(r.quantity_change) * Number(r.unit_cost));
    const loss = r.quantity_change < 0;
    return {
      entry_date: r.event_date, source_module: "pos", entry_type: "stock_adjustment", reference_code: r.code, posted_by_id: by,
      description: `Stock ${loss ? "loss" : "gain"} ${r.code}: ${r.product_name} (${r.quantity_change > 0 ? "+" : ""}${r.quantity_change})`,
      lines: loss
        ? [{ code: ACC.INVENTORY_LOSS, debit: amount, memo: r.remarks }, { code: ACC.INVENTORY, credit: amount }]
        : [{ code: ACC.INVENTORY, debit: amount, memo: r.remarks }, { code: ACC.INVENTORY_LOSS, credit: amount }]
    };
  },
  payrolls: (r, by) => {
    // Salaries Expense = everything owed: net pay + contributions + withholding tax
    const net = round2(r.total_net), gov = round2(r.total_contributions), tax = round2(r.total_withholding_tax);
    const expense = round2(net + gov + tax);
    return {
      entry_date: r.event_date, source_module: "hr", entry_type: "payroll", reference_code: r.code, posted_by_id: by,
      description: `Payroll ${r.code} for ${r.period_start} to ${r.period_end} (${r.employee_count} employees)`,
      lines: [
        { code: ACC.SALARIES_EXPENSE, debit: expense, memo: round2(r.total_gross) !== expense ? `HR gross ${Number(r.total_gross).toFixed(2)}` : null },
        { code: ACC.SALARIES_PAYABLE, credit: net, memo: "Net pay to release" },
        { code: ACC.GOV_PAYABLE, credit: gov, memo: "SSS, PhilHealth, Pag-IBIG" },
        { code: ACC.TAX_PAYABLE, credit: tax, memo: "Withholding tax" }
      ]
    };
  }
};

const LABELS = {
  posSales: "POS sale", posVoids: "POS void", shopSales: "Online sale", shopReversals: "Online return/refund",
  purchases: "Purchase", adjustments: "Stock adjustment", payrolls: "Payroll"
};

// Posts everything waiting. Each event has its own transaction, so one bad row never blocks the rest.
export async function postNewTransactions(posted_by_id) {
  const pending = await findPending();
  const done = [], failed = [];
  for (const [kind, rows] of Object.entries(pending)) {
    for (const r of rows) {
      try {
        const entry = await sequelize.transaction(async (t) => {
          if (kind === "posVoids")
            return reverseEntry({ source_module: "pos", reference_code: r.code, entry_date: r.event_date, posted_by_id,
              description: `POS sale ${r.code} voided${r.void_reason ? `: ${r.void_reason}` : ""}` }, t);
          if (kind === "shopReversals")
            return reverseEntry({ source_module: "shop", reference_code: r.code, entry_date: r.event_date, posted_by_id,
              description: `Online order ${r.code} ${r.order_status === "returned" ? "returned" : "refunded"}` }, t);
          const e = await createEntry(RULES[kind](r, posted_by_id), t);
          if (kind === "payrolls") {
            const has = await SalaryRelease.count({ where: { payroll_run_id: r.id }, transaction: t });
            if (!has) await SalaryRelease.create({ payroll_run_id: r.id, status: "pending" }, { transaction: t });
          }
          return e;
        });
        done.push({ kind: LABELS[kind], code: r.code, entry_code: entry.entry_code });
      } catch (err) {
        if (err.code === "DUPLICATE" || err.name === "SequelizeUniqueConstraintError") continue; // posted by someone else just now
        failed.push({ kind: LABELS[kind], code: r.code, message: err.message });
      }
    }
  }
  return { done, failed };
}

// ---------- salary release (HR approved → Accounting pays) ----------
// Payroll numbers are read with SQL (not the PayrollRun model) so Accounting always uses the exact
// values HR saved in payroll_runs.
export async function payrollReleases() {
  return select(
    `SELECT sr.id, sr.release_code, sr.status, sr.release_method, sr.released_at,
            e.first_name AS released_by, pr.payroll_code, pr.employee_count, pr.total_net,
            DATE_FORMAT(pr.period_start, '%Y-%m-%d') AS period_start, DATE_FORMAT(pr.period_end, '%Y-%m-%d') AS period_end
     FROM salary_releases sr JOIN payroll_runs pr ON pr.id = sr.payroll_run_id
     LEFT JOIN employees e ON e.id = sr.released_by_id
     ORDER BY sr.status = 'released', sr.id DESC`);
}

export async function releaseSalary(release_id, release_method, employee_id) {
  if (!["bank_transfer", "cash"].includes(release_method))
    throw new AppError("VALIDATION_ERROR", "Choose bank transfer or cash.");
  return sequelize.transaction(async (t) => {
    const rel = await SalaryRelease.findByPk(release_id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!rel) throw new AppError("VALIDATION_ERROR", "Salary release not found.");
    if (rel.status === "released") throw new AppError("DUPLICATE", `${rel.release_code} was already released.`);
    const [run] = await select(`SELECT payroll_code, total_net FROM payroll_runs WHERE id = :id`, { id: rel.payroll_run_id }, t);
    const payrollPosted = await JournalEntry.count({ where: { source_module: "hr", entry_type: "payroll", reference_code: run.payroll_code }, transaction: t });
    if (!payrollPosted) throw new AppError("VALIDATION_ERROR", `Post payroll ${run.payroll_code} first.`);

    await rel.update({ status: "released", release_method, released_at: new Date(), released_by_id: employee_id }, { transaction: t });
    return createEntry({
      entry_date: manilaDate(), source_module: "accounting", entry_type: "salary_release", reference_code: rel.release_code,
      posted_by_id: employee_id,
      description: `Salaries released for ${run.payroll_code} by ${release_method === "cash" ? "cash" : "bank transfer"}`,
      lines: [
        { code: ACC.SALARIES_PAYABLE, debit: run.total_net },
        { code: release_method === "cash" ? ACC.CASH : ACC.BANK, credit: run.total_net }
      ]
    }, t);
  });
}

// ---------- government remittances ----------
// Suggested amount: what payroll withheld for runs whose period ends in that month.
export async function suggestRemittance(agency, period_month) {
  const col = { sss: "sss", philhealth: "philhealth", pagibig: "pagibig", bir: "withholding_tax" }[agency];
  if (!col || !/^\d{4}-\d{2}$/.test(period_month)) return 0;
  const [row] = await select(
    `SELECT COALESCE(SUM(pi.${col}), 0) AS amount FROM payroll_items pi JOIN payroll_runs pr ON pr.id = pi.payroll_run_id
     WHERE pr.status = 'approved' AND DATE_FORMAT(pr.period_end, '%Y-%m') = :period_month`, { period_month });
  return round2(row.amount);
}

export async function recordRemittance({ agency, period_month, amount, reference_number }, employee_id) {
  if (!["sss", "philhealth", "pagibig", "bir"].includes(agency)) throw new AppError("VALIDATION_ERROR", "Choose an agency.");
  if (!/^\d{4}-\d{2}$/.test(period_month || "")) throw new AppError("VALIDATION_ERROR", "Period must look like 2026-10.");
  const amt = round2(amount);
  if (!(amt > 0)) throw new AppError("VALIDATION_ERROR", "Amount must be more than 0.");
  const exists = await Remittance.count({ where: { agency, period_month } });
  if (exists) throw new AppError("DUPLICATE", `A ${agency.toUpperCase()} remittance for ${period_month} already exists.`);
  return Remittance.create({ agency, period_month, amount: amt, reference_number: reference_number || null, status: "pending", recorded_by_id: employee_id });
}

export async function payRemittance(id, reference_number, employee_id) {
  return sequelize.transaction(async (t) => {
    const rem = await Remittance.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!rem) throw new AppError("VALIDATION_ERROR", "Remittance not found.");
    if (rem.status === "paid") throw new AppError("DUPLICATE", `${rem.remittance_code} is already paid.`);
    await rem.update({ status: "paid", paid_at: new Date(), reference_number: reference_number || rem.reference_number, recorded_by_id: employee_id }, { transaction: t });
    return createEntry({
      entry_date: manilaDate(), source_module: "accounting", entry_type: "remittance", reference_code: rem.remittance_code,
      posted_by_id: employee_id,
      description: `${rem.agency.toUpperCase()} remittance for ${rem.period_month}${rem.reference_number ? ` (ref ${rem.reference_number})` : ""}`,
      lines: [
        { code: rem.agency === "bir" ? ACC.TAX_PAYABLE : ACC.GOV_PAYABLE, debit: rem.amount },
        { code: ACC.BANK, credit: rem.amount }
      ]
    }, t);
  });
}
