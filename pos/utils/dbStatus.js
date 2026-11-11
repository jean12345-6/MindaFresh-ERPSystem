// pos/utils/dbStatus.js — is the shared database reachable? Used by the login page and the error handler.
import { sequelize } from "../config/database.js";

const OFFLINE = /Sequelize(Connection|ConnectionRefused|HostNotFound|HostNotReachable|ConnectionTimedOut|ConnectionAcquireTimeout|AccessDenied)Error/;

export const isOfflineError = (err) => OFFLINE.test(err?.name || "") || /ECONNREFUSED|ETIMEDOUT|EHOSTUNREACH|ENETUNREACH/.test(err?.code || err?.parent?.code || "");
export const dbTarget = () => `${process.env.DB_HOST}:${process.env.DB_PORT}`;

// Resolves true/false within 4 seconds, never throws.
export async function checkDb() {
  try {
    await Promise.race([sequelize.authenticate(), new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 4000))]);
    return true;
  } catch { return false; }
}
