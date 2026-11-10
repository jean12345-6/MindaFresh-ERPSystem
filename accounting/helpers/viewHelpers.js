// accounting/helpers/viewHelpers.js — Handlebars helpers for the Accounting views (module-only, not shared).
import { peso } from "../utils/money.js";
import { manilaDateTime } from "../utils/dates.js";

export function registerHelpers(hbs) {
  hbs.registerHelper("peso", (n) => peso(n));
  // Blank instead of ₱0.00 (for debit/credit columns)
  hbs.registerHelper("pesoOrBlank", (n) => (Number(n) ? peso(n) : ""));
  hbs.registerHelper("num", (n) => Number(n || 0).toFixed(2));
  hbs.registerHelper("dateTime", (d) => manilaDateTime(d));
  hbs.registerHelper("eq", (a, b) => String(a) === String(b));
  hbs.registerHelper("neq", (a, b) => String(a) !== String(b));
  hbs.registerHelper("gt", (a, b) => Number(a) > Number(b));
  hbs.registerHelper("lt", (a, b) => Number(a) < Number(b));
  hbs.registerHelper("or", (...args) => args.slice(0, -1).some(Boolean));
  hbs.registerHelper("and", (...args) => args.slice(0, -1).every(Boolean));
  hbs.registerHelper("upper", (s) => String(s || "").toUpperCase());
  hbs.registerHelper("label", (s) => String(s || "").replace(/_/g, " "));
  hbs.registerHelper("startsWith", (s, p) => String(s || "").startsWith(p));
  hbs.registerHelper("hasRole", (user, ...roles) => !!user && roles.slice(0, -1).includes(user.role));
  hbs.registerHelper("json", (o) => JSON.stringify(o));
  hbs.registerHelper("range", (n) => Array.from({ length: Number(n) }, (_, i) => i));
}
