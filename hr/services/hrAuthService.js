import { AppError } from "../utils/appError.js";
import bcrypt from "bcryptjs";
import { rows, execute } from "../models/db.js";
const dummy = "$2a$10$A0OH5GHGvHmTxMG7BvUOJuf3jTIvMgoO1ytITW.gGILuEaLD4pQQq";
export function createAuthService(db = { rows, execute }) {
  async function login(username, password) {
    const [u] = await db.rows(
      "SELECT u.*,e.status AS employee_status,e.employee_code,e.first_name,e.last_name FROM users u JOIN employees e ON e.id=u.employee_id WHERE u.username=:username LIMIT 1",
      { username },
    );
    const match = await bcrypt.compare(password, u?.password || dummy);
    if (!u || !match) throw new AppError("INVALID_LOGIN", "Wrong username or password.");
    if (u.status !== "active" || u.employee_status !== "active")
      throw new AppError("ACCOUNT_DISABLED", "This account or employee record is disabled.");
    await db.execute("UPDATE users SET last_login_at=NOW(),updated_at=NOW() WHERE id=:id", { id: u.id });
    return {
      id: u.id, user_id: u.id, employee_id: u.employee_id,
      employee_code: u.employee_code, full_name: `${u.first_name} ${u.last_name}`,
      username: u.username, role: u.role,
    };
  }
  async function sessionUser(id) {
    const [u] = await db.rows(
      "SELECT u.id,u.id AS user_id,u.employee_id,u.username,u.role,e.employee_code,CONCAT(e.first_name,' ',e.last_name) AS full_name FROM users u JOIN employees e ON e.id=u.employee_id WHERE u.id=:id AND u.status='active' AND e.status='active'",
      { id },
    );
    return u;
  }
  return { login, sessionUser };
}
export const { login, sessionUser } = createAuthService();
