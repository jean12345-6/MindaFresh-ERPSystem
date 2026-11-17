// accounting/controllers/payrollController.js — salary releases (HR approves payroll, Accounting pays)
import { releaseSalary, payrollReleases, releaseDetail } from "../services/postingService.js";
import { handle } from "./handle.js";

export const releasesPage = handle(async (req, res) => {
  res.render("salary-releases", { title: "Salary releases", rows: await payrollReleases() });
});

export const releaseView = handle(async (req, res) => {
  const d = await releaseDetail(req.params.id);
  res.render("salary-release", { title: d.rel.release_code, ...d });
}, "/salary-releases");

export const release = handle(async (req, res) => {
  const entry = await releaseSalary(req.params.id, req.body.release_method, req.session.user.employee_id);
  req.flash("success_msg", `Salaries released and posted as ${entry.entry_code}.`);
  res.redirect(`/salary-releases/${req.params.id}`);
}, "/salary-releases");
