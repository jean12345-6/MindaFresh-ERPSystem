import "dotenv/config";
import { sequelize, rows } from "../models/db.js";
const tables = [
  "departments",
  "employees",
  "users",
  "leave_requests",
  "payroll_runs",
  "payroll_items",
  "attendance_logs",
  "holidays",
  "salary_releases",
  "journal_entries",
];
try {
  if (process.env.DB_NAME !== "mindafresh_db")
    throw Error("Set DB_NAME=mindafresh_db in .env");
  await sequelize.authenticate();
  const found = await rows("SHOW TABLES");
  const names = found.map((r) => Object.values(r)[0]);
  const missing = tables.filter((t) => !names.includes(t));
  if (missing.length)
    throw Error(
      "Missing tables: " +
        missing.join(", ") +
        ". Use the agreed master schema on a new database only; do not reimport it over existing data.",
    );
  const identity = await rows("SELECT DATABASE() AS database_name,@@hostname AS database_host,@@port AS database_port,CURRENT_USER() AS authenticated_account");
  console.table(identity);
  const columns = await rows("SHOW COLUMNS FROM attendance_logs");
  const namesOfColumns = columns.map(c => c.Field);
  if (!["lunch_out", "lunch_in"].every(c => namesOfColumns.includes(c))) throw Error("Attendance schema is older than v2.4. Ask the database host to review migration 002; do not reimport the schema.");
  console.table(await rows("SELECT COUNT(*) AS attendance_records,MIN(log_date) AS earliest_log,MAX(log_date) AS latest_log FROM attendance_logs"));
  console.table(await rows("SELECT COUNT(*) AS employees,SUM(status='active') AS active_employees FROM employees"));
  console.log(
    "PeoplePay is connected to mindafresh_db. All 10 required HR and integration tables exist. No data was changed.",
  );
} catch (e) {
  console.error("Connection check failed: " + e.message);
  console.error(
    "Check Laragon MySQL, DB_HOST, Wi-Fi/LAN, database credentials and schema.",
  );
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
