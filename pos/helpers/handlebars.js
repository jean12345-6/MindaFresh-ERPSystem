// Handlebars helpers for the POS .xian views.
import Handlebars from "handlebars";
import { peso, round2 } from "../utils/money.js";
import { manilaDateTime, manilaDate } from "../utils/dates.js";

const BADGES = {
  completed: "bg-leaf-bg text-leaf", received: "bg-leaf-bg text-leaf", active: "bg-leaf-bg text-leaf", posted: "bg-leaf-bg text-leaf",
  voided: "bg-danger-bg text-danger", cancelled: "bg-danger-bg text-danger", inactive: "bg-danger-bg text-danger", low: "bg-danger-bg text-danger",
  ordered: "bg-sky-bg text-sky", draft: "bg-peach text-ink", pending: "bg-peach text-ink",
  opening: "bg-peach text-ink", stock_in: "bg-leaf-bg text-leaf", sale: "bg-sky-bg text-sky",
  online_order: "bg-sky-bg text-sky", adjustment: "bg-peach text-ink", return: "bg-leaf-bg text-leaf"
};

// Sidebar / button icons (Lucide-style strokes). Usage: {{{icon 'cart'}}}
const ICONS = {
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  cashier: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 10h2M14 10h2M8 14h2M14 14h2M8 18h8"/>',
  receipt: '<path d="M4 2v20l3-2 3 2 3-2 3 2 3-2V2l-3 2-3-2-3 2-3-2z"/><path d="M8 8h8M8 12h8"/>',
  stock: '<path d="M21 8l-9-5-9 5 9 5z"/><path d="M3 8v8l9 5 9-5V8M12 13v8"/>',
  cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.7 12.4a2 2 0 002 1.6h8.1a2 2 0 002-1.5L21 7H6"/>',
  truck: '<path d="M2 6h11v11H2zM13 10h5l4 4v3h-9z"/><circle cx="7" cy="18" r="1.8"/><circle cx="17" cy="18" r="1.8"/>',
  box: '<path d="M21 8v8a2 2 0 01-1 1.7l-7 4a2 2 0 01-2 0l-7-4A2 2 0 013 16V8a2 2 0 011-1.7l7-4a2 2 0 012 0l7 4A2 2 0 0121 8z"/><path d="M3.3 7L12 12l8.7-5M12 22V12"/>',
  tag: '<path d="M20.6 13.4l-7.2 7.2a2 2 0 01-2.8 0L3 13V3h10l7.6 7.6a2 2 0 010 2.8z"/><circle cx="7.5" cy="7.5" r="1.2"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>',
  logout: '<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  upload: '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  keyboard: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M7 15h10"/>'
};

export const helpers = {
  icon: (name) => new Handlebars.SafeString(`<svg class="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ""}</svg>`),
  initials: (n) => String(n || "?").split(/s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join(""),
  peso: (n) => peso(n),
  money: (n) => round2(n || 0).toFixed(2),
  dateTime: (d) => manilaDateTime(d),
  date: (d) => (d && typeof d !== "object" || d instanceof Date ? manilaDate(d) : ""),
  eq: (a, b) => String(a) === String(b),
  ne: (a, b) => String(a) !== String(b),
  gt: (a, b) => Number(a) > Number(b),
  lt: (a, b) => Number(a) < Number(b),
  lte: (a, b) => Number(a) <= Number(b),
  and: (...args) => args.slice(0, -1).every(Boolean),
  or: (...args) => args.slice(0, -1).some(Boolean),
  not: (a) => !a,
  inc: (n) => Number(n) + 1,
  sub: (a, b) => Number(a) - Number(b),
  label: (s) => String(s ?? "").replace(/_/g, " "),
  badge: (s) => BADGES[s] || "bg-peach-soft text-ink",
  signed: (n) => (Number(n) > 0 ? `+${n}` : String(n)),
  startsWith: (s, prefix) => String(s ?? "").startsWith(prefix),
  // Safe JSON for <script> blocks
  json: (v) => JSON.stringify(v ?? null).replace(/</g, "\\u003c")
};
