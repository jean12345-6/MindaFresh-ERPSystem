import "dotenv/config";
import bcrypt from "bcryptjs";
import { sequelize, rows, insert } from "./models/db.js";
// Explicit first-run setup only. Will not overwrite existing users or insert demo attendance.
try {
  if (process.env.DB_NAME !== "mindafresh_db")
    throw Error("DB_NAME must be mindafresh_db");
  const username = process.env.BOOTSTRAP_USERNAME,
    password = process.env.BOOTSTRAP_PASSWORD;
  if (
    !username ||
    !password ||
    password.length < 12 ||
    Buffer.byteLength(password) > 72
  )
    throw Error(
      "Set BOOTSTRAP_USERNAME and BOOTSTRAP_PASSWORD (12–72 bytes) in .env for first-run setup.",
    );
  await sequelize.transaction(async (t) => {
    const existing = await rows("SELECT id FROM users LIMIT 1", {}, t);
    if (existing.length)
      throw Error(
        "Users already exist. Sign in with the group account; bootstrap did not change anything.",
      );
    let [d] = await rows(
      "SELECT id FROM departments WHERE name='Human Resources'",
      {},
      t,
    );
    if (!d)
      d = {
        id: await insert(
          "departments",
          { name: "Human Resources" },
          "DEP",
          "department_code",
          t,
        ),
      };
    const eid = await insert(
      "employees",
      {
        first_name: "Workspace",
        last_name: "Administrator",
        hire_date: new Date().toISOString().slice(0, 10),
        department_id: d.id,
        position: "System Administrator",
        employment_type: "regular",
        daily_rate: 650,
        vacation_leave_balance: 5,
        sick_leave_balance: 5,
        status: "active",
      },
      "EMP",
      "employee_code",
      t,
    );
    await insert(
      "users",
      {
        employee_id: eid,
        username,
        password: await bcrypt.hash(password, 12),
        role: "admin",
        status: "active",
      },
      "USR",
      "user_code",
      t,
    );
  });
  console.log(
    "Initial administrator created. Remove bootstrap credentials from .env, then start PeoplePay.",
  );
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
