// Handlebars helpers for the Shop's .xian views. Registered once in index.js.
import hbs from "hbs";
import { peso } from "./money.js";
import { manilaDateTime } from "./dates.js";
import { starText } from "./rating.js";

export const ORDER_STATUS = {
  pending:          { label: "Pending",          badge: "bg-[#F3E9DF] text-ink-soft" },
  confirmed:        { label: "Confirmed",        badge: "bg-sky-bg text-sky" },
  out_for_delivery: { label: "Out for delivery", badge: "bg-peach text-[#7A2E0A]" },
  delivered:        { label: "Delivered",        badge: "bg-leaf-bg text-[#2F4A12]" },
  cancelled:        { label: "Cancelled",        badge: "bg-danger-bg text-[#8A2C17]" },
  returned:         { label: "Returned",         badge: "bg-danger-bg text-[#8A2C17]" }
};

export const PAYMENT_METHOD = { cod: "Cash on delivery", gcash: "GCash" };
export const PAYMENT_STATUS = { unpaid: "Unpaid", paid: "Paid", refunded: "Refunded" };

// Soft tile colour per category, used when a product has no image_url
const CATEGORY_TINT = { "Fresh Produce": "#E9F3D9", "Frozen Goods": "#DCEAF5", "Dry Goods": "#FFF0D6" };

export function registerViewHelpers() {
  hbs.registerHelper("peso", (n) => peso(n));
  hbs.registerHelper("datetime", (d) => manilaDateTime(d));
  hbs.registerHelper("eq", (a, b) => a === b);
  hbs.registerHelper("or", (...args) => args.slice(0, -1).some(Boolean));
  hbs.registerHelper("and", (...args) => args.slice(0, -1).every(Boolean));
  hbs.registerHelper("not", (a) => !a);
  hbs.registerHelper("statusLabel", (s) => ORDER_STATUS[s]?.label ?? s);
  hbs.registerHelper("statusLower", (s) => (ORDER_STATUS[s]?.label ?? s).toLowerCase());
  hbs.registerHelper("statusBadge", (s) => ORDER_STATUS[s]?.badge ?? "bg-[#F3E9DF] text-ink-soft");
  hbs.registerHelper("payMethod", (m) => PAYMENT_METHOD[m] ?? m);
  hbs.registerHelper("payStatus", (s) => PAYMENT_STATUS[s] ?? s);
  hbs.registerHelper("tint", (category) => CATEGORY_TINT[category] ?? "#EFE9DF");
  hbs.registerHelper("plural", (n, one, many) => (Number(n) === 1 ? one : many));
  // Flash messages as JSON for the SweetAlert2 partial ("<" escaped so the text can never close the script tag)
  hbs.registerHelper("flashJson", (success, error) =>
    JSON.stringify({ success: [].concat(success || []), error: [].concat(error || []) }).replace(/</g, "\\u003c"));
  hbs.registerHelper("stars", (r) => starText(r));
  hbs.registerHelper("list", (...args) => args.slice(0, -1));
  hbs.registerHelper("concat", (...args) => args.slice(0, -1).join(""));
  hbs.registerHelper("rating1", (r) => Number(r || 0).toFixed(1));
  hbs.registerHelper("initial", (s) => String(s || "?").trim().charAt(0).toUpperCase());
  hbs.registerHelper("isoDate", (d) => (d ? new Date(d).toISOString().slice(0, 10) : ""));
}
