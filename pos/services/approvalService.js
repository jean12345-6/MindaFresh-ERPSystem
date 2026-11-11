// pos/services/approvalService.js — an admin approves a cashier's action (such as a void) by typing their own password.
// Checks the shared users table read-only: no last_login_at update and no change to any shared data.
import bcrypt from "bcrypt";
import { User, Employee } from "../models/index.js";
import { AppError } from "../utils/appError.js";

const fails = new Map(); // cashier employee_id -> { count, first }
const MAX = 5, WINDOW = 10 * 60 * 1000;

export async function verifyAdminApproval(requesterId, username, password) {
  const now = Date.now();
  const rec = fails.get(requesterId);
  if (rec && now - rec.first > WINDOW) fails.delete(requesterId);
  if ((fails.get(requesterId)?.count || 0) >= MAX) throw new AppError("VALIDATION_ERROR", "Too many wrong approvals. Wait a few minutes and ask the admin again.");

  const fail = () => {
    const r = fails.get(requesterId) || { count: 0, first: now };
    r.count += 1; fails.set(requesterId, r);
    throw new AppError("VALIDATION_ERROR", "Approval refused: wrong admin username or password.");
  };
  username = String(username || "").trim();
  if (!username || !password) throw new AppError("VALIDATION_ERROR", "An admin must enter their username and password to approve a void.");
  const user = await User.findOne({ where: { username }, include: Employee });
  if (!user || !(await bcrypt.compare(String(password), user.password))) fail();
  if (user.role !== "admin" || user.status !== "active" || user.Employee?.status !== "active") fail();
  if (user.employee_id === requesterId) fail(); // the admin approving must be a different person than the requester
  fails.delete(requesterId);
  return { employee_id: user.employee_id, name: `${user.Employee.first_name} ${user.Employee.last_name}`, username: user.username };
}
