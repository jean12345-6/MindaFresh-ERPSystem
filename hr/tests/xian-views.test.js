import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
process.env.DB_NAME = "mindafresh_db";
process.env.DB_USER = "test";
process.env.SESSION_SECRET = "local-test-session-secret-32-characters-long";
process.env.NODE_ENV = "test";
const { default: app } = await import("../index.js");
const { sampleData } = await import("../dist/js/sample-data.js");
const employees = sampleData.employees.map((e) => ({
  ...e,
  full_name: e.first_name + " " + e.last_name,
}));
const items = [
  {
    employee_id: 2,
    employee_name: "Marco Reyes",
    days_worked: 12,
    paid_leave_days: 1,
    paid_holiday_days: 0,
    daily_rate: 650,
    basic_pay: 8450,
    tardiness_deduction: 0,
    gross_pay: 8450,
    sss: 380.25,
    philhealth: 211.25,
    pagibig: 100,
    withholding_tax: 0,
    net_pay: 7758.5,
  },
];
const run = {
  id: 1,
  payroll_code: "PAY-0001",
  period_start: "2026-10-01",
  period_end: "2026-10-15",
  employee_count: 1,
  total_net: 7758.5,
  is_draft: true,
  status: "draft",
  display_status: "draft",
  items,
};
const context = {
  title: "Test page",
  csrf: "test-token",
  currentUser: { username: "admin", role: "admin" },
  isAdmin: true,
  canManageHR: true,
  canReadPayroll: true,
  employees,
  departments: sampleData.departments,
  users: [
    {
      id: 1,
      username: "example",
      employee_name: "Liza Santos",
      role: "hr_staff",
      status: "active",
      can_manage: true,
    },
  ],
  availableEmployees: employees,
  roles: ["admin", "hr_staff", "employee"],
  leaves: [
    { ...sampleData.leaves[0], can_review: true, employee_name: "Marco Reyes" },
  ],
  pendingLeaves: [],
  runs: [run],
  attendance: [],
  employee: employees[1],
  run,
  item: items[0],
  formAction: "/employees",
  success_msg: [],
  error_msg: [],
  message: "Example error",
};

test("all .xian pages render through the actual XianFire hbs engine", async () => {
  const files = (
    await fs.readdir(new URL("../views/", import.meta.url))
  ).filter((file) => file.endsWith(".xian"));
  for (const file of files) {
    const html = await new Promise((resolve, reject) =>
      app.render(file.replace(".xian", ""), context, (error, result) =>
        error ? reject(error) : resolve(result),
      ),
    );
    assert.ok(html.includes("<html"), file + " has a document");
    assert.ok(
      !html.includes("window.PEOPLEPAY_SERVER"),
      file + " does not boot a client-side app",
    );
    if (html.includes("<form"))
      assert.ok(html.includes("test-token"), file + " has a CSRF token");
  }
});

test("login uses memory sessions and rejects invalid form tokens without duplicate responses", async () => {
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const origin = "http://127.0.0.1:" + server.address().port;
  try {
    const first = await fetch(origin + "/login");
    assert.equal(first.status, 200);
    const cookie = first.headers.get("set-cookie").split(";")[0];
    const firstHtml = await first.text();
    const token = firstHtml.match(/name="_csrf" value="([^"]+)"/)[1];
    const again = await fetch(origin + "/login", { headers: { cookie } });
    assert.ok((await again.text()).includes(token));
    const invalid = await fetch(origin + "/login", {
      method: "POST",
      headers: { cookie, "Content-Type": "application/x-www-form-urlencoded" },
      body: "_csrf=wrong&return_to=%2Flogin",
      redirect: "manual",
    });
    assert.equal(invalid.status, 302);
    assert.equal(invalid.headers.get("location"), "/login");
    const flash = await fetch(origin + "/login", { headers: { cookie } });
    assert.ok((await flash.text()).includes("Your form expired"));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('Sequelize owner hooks assign display codes inside the existing transaction', async () => {
  const { Employee, Department, User } = await import('../models/index.js');
  for (const [Model, field, prefix] of [[Employee,'employee_code','EMP'],[Department,'department_code','DEP'],[User,'user_code','USR']]) {
    const transaction = { testTransaction: true };
    let saved;
    const row = { id: 8, save: async options => { saved = options; } };
    await Model.runHooks('afterCreate', row, { transaction });
    assert.equal(row[field], prefix + '-0008');
    assert.equal(saved.transaction, transaction);
    assert.equal(saved.hooks, false);
  }
});
