// accounting/controllers/journalController.js — journal list, one entry, manual entries
import { Op } from "sequelize";
import { sequelize, JournalEntry, JournalLine, Account, Employee } from "../models/index.js";
import { createEntry } from "../services/postingService.js";
import { AppError } from "../utils/appError.js";
import { manilaDate } from "../utils/dates.js";
import { handle } from "./handle.js";

const TYPES = ["opening", "sale", "sale_reversal", "purchase", "stock_adjustment", "payroll", "salary_release", "remittance", "manual"];
const SOURCES = ["shop", "pos", "hr", "accounting"];

export const journalList = handle(async (req, res) => {
  const today = manilaDate();
  const f = {
    from: req.query.from || today.slice(0, 5) + "01-01", // year to date, so older months are not hidden
    to: req.query.to || today,
    type: TYPES.includes(req.query.type) ? req.query.type : "",
    source: SOURCES.includes(req.query.source) ? req.query.source : "",
    q: (req.query.q || "").trim()
  };
  const where = { entry_date: { [Op.between]: [f.from, f.to] } };
  if (f.type) where.entry_type = f.type;
  if (f.source) where.source_module = f.source;
  if (f.q) where[Op.or] = [{ entry_code: { [Op.like]: `%${f.q}%` } }, { reference_code: { [Op.like]: `%${f.q}%` } }, { description: { [Op.like]: `%${f.q}%` } }];
  const entries = await JournalEntry.findAll({ where, order: [["entry_date", "DESC"], ["id", "DESC"]], limit: 300 });
  const rows = entries.map((e) => e.get({ plain: true }));
  const total = rows.filter((r) => r.status === "posted").reduce((s, r) => s + Number(r.total_debit), 0);
  res.render("journal", { title: "Journal", f, rows, total, types: TYPES, sources: SOURCES });
});

export const entryPage = handle(async (req, res) => {
  const entry = await JournalEntry.findOne({
    where: { entry_code: req.params.code },
    include: [{ model: JournalLine, include: [Account] }, { model: Employee, as: "PostedBy" }],
    order: [[JournalLine, "id", "ASC"]]
  });
  if (!entry) throw new AppError("VALIDATION_ERROR", `Entry ${req.params.code} not found.`);
  res.render("entry", { title: entry.entry_code, e: entry.get({ plain: true }) });
}, "/journal");

export const newEntryPage = handle(async (req, res) => {
  const accounts = await Account.findAll({ where: { is_active: true }, order: [["account_code", "ASC"]] });
  res.render("entry-new", {
    title: "New manual entry", today: manilaDate(),
    accounts: accounts.map((a) => a.get({ plain: true })),
    old: req.session.oldEntry || null
  });
  delete req.session.oldEntry;
});

export const createManual = handle(async (req, res) => {
  const b = req.body;
  const arr = (v) => (Array.isArray(v) ? v : v === undefined ? [] : [v]);
  const codes = arr(b.account_code), debits = arr(b.debit), credits = arr(b.credit), memos = arr(b.memo);
  const lines = codes.map((code, i) => ({ code, debit: Number(debits[i] || 0), credit: Number(credits[i] || 0), memo: memos[i] }))
    .filter((l) => l.code && (l.debit || l.credit));
  req.session.oldEntry = { entry_date: b.entry_date, description: b.description, lines };
  if (!b.entry_date || !/^\d{4}-\d{2}-\d{2}$/.test(b.entry_date)) throw new AppError("VALIDATION_ERROR", "Enter a valid date.");
  if (!(b.description || "").trim()) throw new AppError("VALIDATION_ERROR", "Enter a description.");
  if (lines.some((l) => l.debit < 0 || l.credit < 0)) throw new AppError("VALIDATION_ERROR", "Amounts cannot be negative.");
  const entry = await sequelize.transaction((t) => createEntry({
    entry_date: b.entry_date, description: b.description.trim(), source_module: "accounting", entry_type: "manual",
    posted_by_id: req.session.user.employee_id, lines
  }, t));
  delete req.session.oldEntry;
  req.flash("success_msg", `${entry.entry_code} posted.`);
  res.redirect(`/journal/${entry.entry_code}`);
}, "/journal/new");

// Only manual entries can be voided. Entries from other modules are fixed by a reversal at the source (void, return).
export const voidEntry = handle(async (req, res) => {
  const entry = await JournalEntry.findOne({ where: { entry_code: req.params.code } });
  if (!entry) throw new AppError("VALIDATION_ERROR", "Entry not found.");
  if (entry.entry_type !== "manual") throw new AppError("VALIDATION_ERROR", "Only manual entries can be voided. Fix other entries at their source (void the sale, return the order).");
  if (entry.status === "voided") throw new AppError("DUPLICATE", "This entry is already voided.");
  await entry.update({ status: "voided" });
  req.flash("success_msg", `${entry.entry_code} voided. It no longer counts in any report.`);
  res.redirect(`/journal/${entry.entry_code}`);
}, (req) => `/journal/${req.params.code}`);
