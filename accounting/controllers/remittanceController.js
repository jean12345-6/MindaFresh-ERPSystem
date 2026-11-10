// accounting/controllers/remittanceController.js — SSS, PhilHealth, Pag-IBIG and BIR payments
import { Remittance, Employee } from "../models/index.js";
import { recordRemittance, payRemittance, suggestRemittance } from "../services/postingService.js";
import { manilaDate } from "../utils/dates.js";
import { handle } from "./handle.js";

export const remittancesPage = handle(async (req, res) => {
  const rows = await Remittance.findAll({ include: [{ model: Employee, as: "RecordedBy" }], order: [["status", "ASC"], ["period_month", "DESC"], ["agency", "ASC"]] });
  res.render("remittances", { title: "Remittances", rows: rows.map((r) => r.get({ plain: true })), month: manilaDate().slice(0, 7) });
});

export const suggest = handle(async (req, res) => {
  res.json({ amount: await suggestRemittance(req.query.agency, req.query.period_month) });
});

export const create = handle(async (req, res) => {
  const rem = await recordRemittance(req.body, req.session.user.employee_id);
  if (req.body.pay_now === "1") {
    const entry = await payRemittance(rem.id, req.body.reference_number, req.session.user.employee_id);
    req.flash("success_msg", `${rem.remittance_code} paid and posted as ${entry.entry_code}.`);
  } else {
    req.flash("success_msg", `${rem.remittance_code} recorded as pending.`);
  }
  res.redirect("/remittances");
}, "/remittances");

export const pay = handle(async (req, res) => {
  const entry = await payRemittance(req.params.id, req.body.reference_number, req.session.user.employee_id);
  req.flash("success_msg", `Remittance paid and posted as ${entry.entry_code}.`);
  res.redirect("/remittances");
}, "/remittances");
