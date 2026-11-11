// pos/utils/publicUrl.js — the web address other laptops (the Online Shop, customers' browsers) use to load this POS's uploaded images.
// Set PUBLIC_URL in .env (for example http://10.250.24.30:3002). If it is empty, the POS uses this laptop's own Wi-Fi address.
import os from "os";

export function lanAddress() {
  const dbPrefix = String(process.env.DB_HOST || "").split(".").slice(0, 2).join(".");
  const all = Object.values(os.networkInterfaces()).flat().filter((n) => n && n.family === "IPv4" && !n.internal).map((n) => n.address);
  const privateOnes = all.filter((a) => /^(10\.|192\.168\.)/.test(a));
  return privateOnes.find((a) => dbPrefix && a.startsWith(dbPrefix + ".")) || privateOnes[0] || all[0] || "localhost";
}

export function publicBase() {
  const set = String(process.env.PUBLIC_URL || "").trim().replace(/\/+$/, "");
  if (/^https?:\/\/[^\s/]+/.test(set)) return set;
  return `http://${lanAddress()}:${process.env.PORT || 3002}`;
}
