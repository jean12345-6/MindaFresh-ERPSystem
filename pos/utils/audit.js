// pos/utils/audit.js — POS audit trail kept on THIS computer (pos/data/audit-log.jsonl, one JSON event per line).
// Not in the shared database, so nothing here can affect the other modules. If the file cannot be written the POS keeps working.
import fs from "fs";
import path from "path";

const FILE = path.join(process.cwd(), "data", "audit-log.jsonl");
const MAX_READ = 2000;

export const EVENT_LABELS = {
  line_removed: "Item removed from basket",
  line_reduced: "Quantity reduced in basket",
  sale_cleared: "Basket cleared",
  sale_voided: "Sale voided",
  void_refused: "Void refused"
};

export function logEvent(event) {
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.appendFileSync(FILE, JSON.stringify({ at: new Date().toISOString(), ...event }) + "\n");
  } catch (e) { console.error("Audit log write failed:", e.message); }
}

// Newest first. type: one key of EVENT_LABELS or "" for all. date: "YYYY-MM-DD" in Manila time or "".
export function readEvents({ type = "", date = "" } = {}) {
  let lines;
  try { lines = fs.readFileSync(FILE, "utf8").split("\n").filter(Boolean).slice(-MAX_READ); } catch { return []; }
  const out = [];
  for (const line of lines) {
    try {
      const e = JSON.parse(line);
      if (type && e.type !== type) continue;
      if (date && new Date(e.at).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }) !== date) continue;
      out.push({ ...e, label: EVENT_LABELS[e.type] || e.type });
    } catch { /* skip a damaged line */ }
  }
  return out.reverse();
}
