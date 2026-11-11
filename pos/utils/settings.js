// pos/utils/settings.js — POS-only settings kept in pos/data/settings.json (NOT in the shared DB,
// so nothing here can break the other modules). Missing or broken file = defaults.
import fs from "fs";
import path from "path";

const FILE = path.join(process.cwd(), "data", "settings.json");
export const DEFAULT_IMAGE_URL = "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1600&q=70";

// Cashier actions the admin can rebind. Keys must be one of ALLOWED_KEYS (F5 reload, F11 fullscreen, F12 devtools are left alone).
export const SHORTCUT_ACTIONS = [
  { id: "search", label: "Focus the search bar" },
  { id: "discount", label: "Discount field" },
  { id: "cash", label: "Cash received field" },
  { id: "method", label: "Change payment method" },
  { id: "clear", label: "Clear the sale" },
  { id: "pay", label: "Complete the sale" }
];
export const ALLOWED_KEYS = ["F1", "F2", "F3", "F4", "F6", "F7", "F8", "F9", "F10"];
export const DEFAULT_SHORTCUTS = { search: "F1", discount: "F2", cash: "F3", method: "F4", clear: "F8", pay: "F9" };

export const DEFAULTS = {
  // Store and receipt
  storeName: "MindaFresh Food Distribution, Inc.",
  storeAddress: "Calapan City, Oriental Mindoro",
  storePhone: "",
  storeTin: "",
  receiptFooter: "Thank you for buying fresh!",
  receiptShowCashier: true,
  autoPrint: true,
  // Cashier
  showStoreImage: true,
  storeImageUrl: DEFAULT_IMAGE_URL,
  defaultPayment: "cash",
  payCash: true, payGcash: true, payCard: true,
  allowDiscount: true,
  maxDiscountPct: 100,
  quickCash: "100,200,500,1000",
  scanSound: true,
  printSound: true,
  // Shortcuts
  shortcuts: { ...DEFAULT_SHORTCUTS },
  // Inventory
  defaultReorder: 10,
  defaultUnit: "pc",
  // Security
  sessionHours: 10
};

export function getSettings() {
  try {
    const saved = JSON.parse(fs.readFileSync(FILE, "utf8"));
    return { ...DEFAULTS, ...saved, shortcuts: { ...DEFAULT_SHORTCUTS, ...(saved.shortcuts || {}) } };
  } catch { return { ...DEFAULTS, shortcuts: { ...DEFAULT_SHORTCUTS } }; }
}

export function saveSettings(patch) {
  const next = { ...getSettings(), ...patch };
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(next, null, 2));
  return next;
}

export function resetSettings() {
  try { fs.unlinkSync(FILE); } catch { /* already defaults */ }
}

const text = (v, max) => String(v ?? "").trim().slice(0, max);
const int = (v, min, max, dflt) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : dflt; };
const on = (v) => v === "1" || v === "on" || v === true;

// Turn the settings form into a clean settings object. Throws Error(message) for something the admin must fix.
export function parseSettingsForm(b) {
  const shortcuts = {};
  for (const { id } of SHORTCUT_ACTIONS) {
    const k = String(b[`key_${id}`] || DEFAULT_SHORTCUTS[id]);
    shortcuts[id] = ALLOWED_KEYS.includes(k) ? k : DEFAULT_SHORTCUTS[id];
  }
  if (new Set(Object.values(shortcuts)).size !== SHORTCUT_ACTIONS.length) throw new Error("Each shortcut needs its own key. Two actions share the same key.");

  const pays = { payCash: on(b.payCash), payGcash: on(b.payGcash), payCard: on(b.payCard) };
  if (!pays.payCash && !pays.payGcash && !pays.payCard) throw new Error("Keep at least one payment method on.");
  const enabled = { cash: pays.payCash, gcash: pays.payGcash, card: pays.payCard };
  const first = ["cash", "gcash", "card"].find((p) => enabled[p]);
  const wanted = ["cash", "gcash", "card"].includes(b.defaultPayment) ? b.defaultPayment : "cash";

  const quick = String(b.quickCash || "").split(/[,\s]+/).map(Number).filter((n) => Number.isFinite(n) && n > 0 && n <= 100000);
  return {
    storeName: text(b.storeName, 80) || DEFAULTS.storeName,
    storeAddress: text(b.storeAddress, 120),
    storePhone: text(b.storePhone, 30),
    storeTin: text(b.storeTin, 30),
    receiptFooter: text(b.receiptFooter, 120),
    receiptShowCashier: on(b.receiptShowCashier),
    autoPrint: on(b.autoPrint),
    showStoreImage: on(b.showStoreImage),
    defaultPayment: enabled[wanted] ? wanted : first,
    ...pays,
    allowDiscount: on(b.allowDiscount),
    maxDiscountPct: int(b.maxDiscountPct, 0, 100, 100),
    quickCash: (quick.length ? [...new Set(quick)].slice(0, 6) : [100, 200, 500, 1000]).join(","),
    scanSound: on(b.scanSound),
    printSound: on(b.printSound),
    shortcuts,
    defaultReorder: int(b.defaultReorder, 0, 100000, 10),
    defaultUnit: ["pc", "kg", "pack", "box", "tray"].includes(b.defaultUnit) ? b.defaultUnit : "pc",
    sessionHours: int(b.sessionHours, 1, 24, 10)
  };
}
