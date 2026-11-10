import { initializeSidebar } from './sidebar.js';
// Hosted demonstration only. The downloadable XianFire app renders these same
// .xian views on the server and persists records in MySQL.
import { templates, partials } from "./templates.js";
import { sampleData } from "./sample-data.js";
import { computePay, totals } from "./payrollMath.js";
const hbs = window.Handlebars;
Object.entries(partials).forEach(([name, value]) =>
  hbs.registerPartial(name, value),
);
hbs.registerHelper(
  "money",
  (value) =>
    "₱" +
    Number(value || 0).toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
);
hbs.registerHelper("date", (value) =>
  value
    ? new Date(String(value).slice(0, 10) + "T00:00:00").toLocaleDateString(
        "en-US",
        { month: "short", day: "numeric", year: "numeric" },
      )
    : "—",
);
hbs.registerHelper("eq", (a, b) => a === b);
hbs.registerHelper("selected", (a, b) =>
  String(a) === String(b) ? "selected" : "",
);
let state;
try {
  state =
    JSON.parse(localStorage.getItem("peoplepay-xian-demo")) ||
    structuredClone(sampleData);
} catch {
  state = structuredClone(sampleData);
}
let user = { id: 1, employee_id: 1, username: "liza.hr", role: "admin" };
let message = "",
  error = "";
const save = () =>
  localStorage.setItem("peoplepay-xian-demo", JSON.stringify(state));
const code = (p, n) => p + "-" + String(n).padStart(4, "0");
const nextId = (items) => Math.max(0, ...items.map((i) => i.id)) + 1;
const full = (e) => e.first_name + " " + e.last_name;
const selfService = () => ["employee", "cashier", "inventory_staff"].includes(user.role);
const canManage = () => ["admin", "hr_staff"].includes(user.role);
const require = (condition, text) => {
  if (!condition) throw Error(text);
};
function dates(start, end) {
  require(/^\d{4}-\d{2}-\d{2}$/.test(start || "") &&
    /^\d{4}-\d{2}-\d{2}$/.test(end || "") &&
    end >= start, "Choose a valid date range.");
  require((Date.parse(end) - Date.parse(start)) / 86400000 <=
    366, "Choose a range within one year.");
  const values = [];
  for (
    let d = new Date(start + "T00:00:00Z");
    d <= new Date(end + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + 1)
  )
    values.push(d.toISOString().slice(0, 10));
  return values;
}
const working = (date) =>
  new Date(date + "T00:00:00Z").getUTCDay() !== 0 &&
  !state.holidays.some((h) => h.holiday_date === date);
function data() {
  const employee = selfService();
  const employees = state.employees
    .filter((e) => !employee || e.id === user.employee_id)
    .map((e) => ({
      ...e,
      full_name: full(e),
      department:
        state.departments.find((d) => d.id === e.department_id)?.name || "—",
    }));
  const leaves = (
    user.role === "accountant"
      ? []
      : state.leaves.filter(
          (l) => !employee || l.employee_id === user.employee_id,
        )
  ).map((l) => ({
    ...l,
    leave_code: l.leave_code || code("LVE", l.id),
    employee_name: full(state.employees.find((e) => e.id === l.employee_id)),
    can_review: canManage() && l.status === "pending",
    can_cancel:
      employee && l.status === "pending" && l.employee_id === user.employee_id,
  }));
  const runs = state.runs
    .filter((r) =>
      employee
        ? r.release_status === "released"
        : user.role === "accountant"
          ? r.status === "approved"
          : true,
    )
    .map((r) => ({
      ...r,
      display_status:
        r.release_status === "released"
          ? "paid"
          : r.is_posted
            ? "posted"
            : r.status,
      is_draft: r.status === "draft",
      total_deductions: r.total_contributions + r.total_withholding_tax,
      items: r.items
        .filter((i) => !employee || i.employee_id === user.employee_id)
        .map((i) => ({
          ...i,
          employee_name: full(
            state.employees.find((e) => e.id === i.employee_id),
          ),
        })),
    }))
    .reverse();
  if (selfService()) {
    for (let i = runs.length - 1; i >= 0; i--) {
      if (!runs[i].items.length) { runs.splice(i, 1); continue; }
      const r = runs[i]; r.employee_count = r.items.length;
      r.total_net = r.items.reduce((s, i) => s + Number(i.net_pay), 0);
      r.total_gross = r.items.reduce((s, i) => s + Number(i.gross_pay), 0);
    }
  }
  const users = canManage()
    ? state.users.map((u) => ({
        ...u,
        employee_name: full(
          state.employees.find((e) => e.id === u.employee_id),
        ),
        can_manage: user.role === "admin" || u.role !== "admin",
      }))
    : [];
  return {
    employees,
    departments: state.departments.map((d) => ({
      ...d,
      headcount: employees.filter((e) => e.department_id === d.id).length,
    })),
    leaves,
    runs,
    users,
    attendance: [],
    holidays: state.holidays,
    pendingLeaves: leaves.filter((l) => l.status === "pending"),
    activeCount: employees.filter((e) => e.status === "active").length,
    latestRun: runs[0] || null,
    totalGross: runs.reduce((s, r) => s + r.total_gross, 0),
    totalNet: runs.reduce((s, r) => s + r.total_net, 0),
  };
}
function navigate(path) {
  if (location.hash === "#" + path) render();
  else location.hash = path;
}
function render() {
  const raw = location.hash.slice(1) || "/dashboard";
  const url = new URL(raw.startsWith("/") ? raw : "/" + raw, location.origin);
  const path = url.pathname;
  let view = "dashboard",
    title = "Dashboard",
    active = "Dashboard";
  const context = data();
  const routes = {
    "/dashboard": ["dashboard", "Dashboard", "Dashboard"],
    "/profile": ["profile", "My profile", "Profile"],
    "/employees": ["employees", "Employees", "Employees"],
    "/departments": ["departments", "Departments", "Departments"],
    "/users": ["users", "Staff accounts", "Users"],
    "/leaves": ["leaves", "Leave requests", "Leaves"],
    "/attendance": ["attendance", "Attendance", "Attendance"],
    "/payroll": ["payroll", "Payroll", "Payroll"],
    "/payslips": ["payslips", "Payslips", "Payslips"],
    "/reports": ["reports", "Reports", "Reports"],
    "/connections": ["connections", "ERP connections", "Connections"],
    "/settings": ["settings", "Settings", "Settings"],
    "/login": ["login", "Sign in", "Login"],
  };
  if (routes[path]) [view, title, active] = routes[path];
  else if (
    path === "/employees/create" ||
    /^\/employees\/\d+\/edit$/.test(path)
  ) {
    view = "employee-form";
    title = path.includes("create") ? "Add employee" : "Edit employee";
    active = "Employees";
    const id = Number(path.split("/")[2]);
    context.employee = state.employees.find((e) => e.id === id) || {
      status: "active",
      employment_type: "regular",
      daily_rate: 650,
      hire_date: "2026-11-02",
    };
    context.formAction = id ? "/employees/" + id + "/update" : "/employees";
  } else if (/^\/payroll\/\d+$/.test(path)) {
    view = "payroll-detail";
    active = "Payroll";
    context.run = context.runs.find((r) => r.id === Number(path.split("/")[2]));
    title = context.run?.payroll_code || "Payroll not found";
  } else if (/^\/payslips\/\d+\/\d+$/.test(path)) {
    view = "payslip";
    title = "Employee payslip";
    active = "Payslips";
    context.run = context.runs.find((r) => r.id === Number(path.split("/")[2]));
    context.item = context.run?.items.find(
      (i) => i.employee_id === Number(path.split("/")[3]),
    );
    context.employee = context.employees.find(
      (e) => e.id === context.item?.employee_id,
    );
    if (!context.item) {
      view = "error";
      context.message = "This payslip is not available to your role.";
    }
  } else if (/^\/reports\/.+\/export$/.test(path)) {
    exportCSV(path.split("/")[2]);
    navigate("/reports");
    return;
  }
  const privileged = [
    "/employees",
    "/departments",
    "/users",
    "/attendance",
    "/payroll",
    "/reports",
    "/connections",
  ];
  if (
    (selfService() &&
      privileged.some((p) => path === p || path.startsWith(p + "/"))) ||
    (!canManage() && ["/departments", "/users", "/attendance"].includes(path))
  ) {
    view = "error";
    title = "Access restricted";
    context.message = "This page is unavailable for the selected demo role.";
  }
  if (view === "profile") context.employee = context.employees.find(e => e.id === user.employee_id);
  context.start = url.searchParams.get("start") || "2026-10-01";
  context.end = url.searchParams.get("end") || "2026-10-31";
  context.employeesForFilter = context.employees;
  context.search = url.searchParams.get("search") || "";
  context.status = url.searchParams.get("status") || "";
  if (view === "employees")
    context.employees = context.employees.filter(
      (e) =>
        (!context.status || e.status === context.status) &&
        (
          e.full_name +
          " " +
          e.employee_code +
          " " +
          e.position +
          " " +
          e.department
        )
          .toLowerCase()
          .includes(context.search.toLowerCase()),
    );
  context.availableEmployees = context.employees.filter(
    (e) =>
      e.status === "active" && !state.users.some((u) => u.employee_id === e.id),
  );
  context.roles = (user.role === "admin" ? ["admin"] : []).concat([
    "hr_staff",
    "accountant",
    "cashier",
    "inventory_staff",
    "employee",
  ]);
  Object.assign(context, {
    title,
    currentUser: user,
    csrf: "demo-token",
    isAdmin: user.role === "admin",
    canManageHR: canManage(),
    canReadPayroll: ["admin", "hr_staff", "accountant"].includes(user.role),
    isEmployee: selfService(),
    success_msg: message ? [message] : [],
    error_msg: error ? [error] : [],
    ["active" + active]: true,
  });
  message = "";
  error = "";
  const html = hbs.compile(templates[view])(context);
  const doc = new DOMParser().parseFromString(html, "text/html");
  document.title = title + " | MindaFresh PeoplePay";
  document.body.innerHTML = doc.body.innerHTML;
  document.body.classList.remove("sidebar-open");
  document.body.insertAdjacentHTML(
    "afterbegin",
    '<div class="demo-banner">INTERACTIVE DEMO · Sample browser data · Attendance and Accounting are not connected</div>',
  );
  document
    .querySelectorAll('a[href^="/"]')
    .forEach((a) => a.setAttribute("href", "#" + a.getAttribute("href")));
  document
    .querySelectorAll("[data-open]")
    .forEach((b) =>
      b.addEventListener("click", () =>
        document.getElementById(b.dataset.open).showModal(),
      ),
    );
  document
    .querySelectorAll("[data-close]")
    .forEach((b) =>
      b.addEventListener("click", () => b.closest("dialog").close()),
    );
  document
    .querySelectorAll("[data-print]")
    .forEach((b) => b.addEventListener("click", () => window.print()));
  document.querySelectorAll("form").forEach((form) =>
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      submit(form, event.submitter);
    }),
  );
  initializeSidebar();
  document.querySelector(".skip-link")?.addEventListener("click", event => {
    event.preventDefault();
    document.getElementById("main-content")?.focus();
  });
  if (view === "settings") {
    const controls = document.createElement("div");
    controls.className = "demo-role";
    controls.innerHTML =
      '<label>Preview role <select id="demoRole">' +
      ["admin", "hr_staff", "accountant", "employee"]
        .map(
          (role) =>
            "<option " +
            (role === user.role ? "selected" : "") +
            ">" +
            role +
            "</option>",
        )
        .join("") +
      '</select></label><button class="btn" id="resetDemo">Reset sample data</button><a class="btn primary preview-download" href="/peoplepay-source.zip" download>Download XianFire project</a>';
    document.querySelector("main").prepend(controls);
    document.getElementById("demoRole").onchange = (e) => {
      user.role = e.target.value;
      render();
    };
    document.getElementById("resetDemo").onclick = () => {
      if (confirm("Reset browser demo changes?")) {
        state = structuredClone(sampleData);
        save();
        message = "Sample data restored.";
        render();
      }
    };
  }
}
function itemPay(employee, run) {
  const workingDates = dates(run.period_start, run.period_end).filter(
    (d) => d >= employee.hire_date && working(d),
  );
  const paid = workingDates.filter((d) =>
    state.leaves.some(
      (l) =>
        l.employee_id === employee.id &&
        l.status === "approved" &&
        l.leave_type !== "unpaid" &&
        l.start_date <= d &&
        l.end_date >= d,
    ),
  ).length;
  const holidays = state.holidays.filter(
    (h) =>
      h.holiday_type === "regular" &&
      h.holiday_date >= run.period_start &&
      h.holiday_date <= run.period_end &&
      h.holiday_date >= employee.hire_date,
  ).length;
  return {
    employee_id: employee.id,
    ...computePay({
      daily_rate: Number(employee.daily_rate),
      days_worked: 0,
      paid_leave_days: paid,
      paid_holiday_days: holidays,
      unpaid_days: workingDates.length - paid,
    }),
  };
}
function submit(form, button) {
  const action = form.getAttribute("action") || "/dashboard";
  const v = Object.fromEntries(new FormData(form));
  if (button?.name) v[button.name] = button.value;
  if ((form.getAttribute("method") || "get").toLowerCase() === "get") {
    navigate(action + "?" + new URLSearchParams(v));
    return;
  }
  let target = v.return_to || "/dashboard";
  try {
    if (form.dataset.confirm && !confirm(form.dataset.confirm)) return;
    if (action === "/logout") {
      navigate("/login");
      return;
    }
    if (action === "/login") {
      require(v.username && v.password, "Enter a demo username and password.");
      message =
        "Demo workspace opened. This does not authenticate a real account.";
      navigate("/dashboard");
      return;
    }
    if (action === "/employees" || /^\/employees\/\d+\/update$/.test(action)) {
      require(canManage(), "HR access required.");
      require(v.first_name?.trim() &&
        v.last_name?.trim() &&
        v.position?.trim(), "Complete the required employee details.");
      require(Number(v.daily_rate) > 0, "Daily rate must be positive.");
      const id = Number(action.split("/")[2]);
      const e = state.employees.find((e) => e.id === id);
      v.department_id = Number(v.department_id);
      v.daily_rate = Number(v.daily_rate);
      delete v._csrf;
      delete v.return_to;
      if (e) {
        require(e.id !== user.employee_id ||
          v.status === "active", "You cannot deactivate your own record.");
        Object.assign(e, v);
        if (e.status !== "active")
          state.users
            .filter((u) => u.employee_id === e.id)
            .forEach((u) => (u.status = "disabled"));
      } else {
        const id = nextId(state.employees);
        state.employees.push({
          ...v,
          id,
          employee_code: code("EMP", id),
          vacation_leave_balance: 5,
          sick_leave_balance: 5,
        });
      }
      target = "/employees";
      message = "Employee saved.";
    } else if (
      action === "/departments" ||
      /^\/departments\/\d+\/update$/.test(action)
    ) {
      require(canManage(), "HR access required.");
      const id = Number(action.split("/")[2]);
      require(v.name?.trim(), "Enter a department name.");
      require(!state.departments.some(
        (d) =>
          d.id !== id && d.name.toLowerCase() === v.name.trim().toLowerCase(),
      ), "Department already exists.");
      const d = state.departments.find((d) => d.id === id);
      if (d) d.name = v.name.trim();
      else {
        const id = nextId(state.departments);
        state.departments.push({
          id,
          name: v.name.trim(),
          department_code: code("DEP", id),
        });
      }
      target = "/departments";
      message = "Department saved.";
    } else if (action === "/users") {
      require(canManage(), "HR access required.");
      require(v.employee_id, "Choose an employee without an account.");
      require(!state.users.some(
        (u) =>
          u.employee_id === Number(v.employee_id) ||
          u.username.toLowerCase() === v.username.toLowerCase(),
      ), "Account already exists.");
      require(v.password.length >= 10, "Use at least 10 characters.");
      require(user.role === "admin" ||
        v.role !== "admin", "Administrator access required.");
      state.users.push({
        id: nextId(state.users),
        employee_id: Number(v.employee_id),
        username: v.username,
        role: v.role,
        status: "active",
      });
      message =
        "Demo account added. Password discarded; no real login created.";
      target = "/users";
    } else if (/^\/users\/\d+\/update$/.test(action)) {
      const account = state.users.find(
        (u) => u.id === Number(action.split("/")[2]),
      );
      require(canManage() &&
        (user.role === "admin" ||
          (account.role !== "admin" &&
            v.role !== "admin")), "Administrator access required.");
      require(account.id !== user.id ||
        (v.role === account.role &&
          v.status === "active"), "You cannot remove your own access.");
      Object.assign(account, { role: v.role, status: v.status });
      message = "Account updated.";
      target = "/users";
    } else if (action === "/leaves") {
      const eid =
        selfService() ? user.employee_id : Number(v.employee_id);
      const covered = dates(v.start_date, v.end_date).filter(working);
      require(covered.length, "Select at least one working day.");
      require(!state.runs.some(
        (r) =>
          r.status === "approved" &&
          r.period_start <= v.end_date &&
          r.period_end >= v.start_date,
      ), "Leave cannot change approved payroll.");
      require(!state.leaves.some(
        (l) =>
          l.employee_id === eid &&
          ["pending", "approved"].includes(l.status) &&
          l.start_date <= v.end_date &&
          l.end_date >= v.start_date,
      ), "Leave overlaps an existing request.");
      const id = nextId(state.leaves);
      state.leaves.push({
        id,
        leave_code: code("LVE", id),
        employee_id: eid,
        leave_type: v.leave_type,
        start_date: v.start_date,
        end_date: v.end_date,
        days: covered.length,
        reason: v.reason,
        status: "pending",
      });
      target = "/leaves";
      message = "Leave request submitted.";
    } else if (/^\/leaves\/\d+\/update$/.test(action)) {
      const l = state.leaves.find((l) => l.id === Number(action.split("/")[2]));
      require(l.status === "pending", "Request already reviewed.");
      require(canManage() ||
        (v.status === "cancelled" &&
          l.employee_id ===
            user.employee_id), "You can only cancel your own pending leave.");
      require(!state.runs.some(
        (r) =>
          r.status === "approved" &&
          r.period_start <= l.end_date &&
          r.period_end >= l.start_date,
      ), "Decision would change approved payroll.");
      if (v.status === "approved" && l.leave_type !== "unpaid") {
        const e = state.employees.find((e) => e.id === l.employee_id);
        const key =
          l.leave_type === "sick"
            ? "sick_leave_balance"
            : "vacation_leave_balance";
        require(e[key] >= l.days, "Insufficient leave balance.");
        e[key] -= l.days;
      }
      l.status = v.status;
      message = "Leave request " + v.status + ".";
      target = "/leaves";
    } else if (action === "/payroll") {
      require(canManage(), "HR access required.");
      dates(v.period_start, v.period_end);
      const [year, month, day] = v.period_start.split("-").map(Number);
      const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
      require((day === 1 &&
        v.period_end === v.period_start.slice(0, 8) + "15") ||
        (day === 16 &&
          v.period_end ===
            v.period_start.slice(0, 8) +
              last), "Use a half-month period: 1–15 or 16–month end.");
      require(!state.runs.some(
        (r) => r.period_start <= v.period_end && r.period_end >= v.period_start,
      ), "Payroll overlaps an existing run.");
      const run = {
        id: nextId(state.runs),
        period_start: v.period_start,
        period_end: v.period_end,
        status: "draft",
      };
      run.payroll_code = code("PAY", run.id);
      run.items = state.employees
        .filter((e) => e.status === "active" && e.hire_date <= run.period_end)
        .map((e) => itemPay(e, run));
      Object.assign(run, totals(run.items));
      state.runs.push(run);
      target = "/payroll/" + run.id;
      message =
        "Demo draft prepared with zero worked days. Attendance is not connected.";
    } else if (/^\/payroll\/\d+\/(recompute|approve)$/.test(action)) {
      const run = state.runs.find((r) => r.id === Number(action.split("/")[2]));
      require(run.status === "draft", "Approved payroll is locked.");
      const fresh = state.employees
        .filter((e) => e.status === "active" && e.hire_date <= run.period_end)
        .map((e) => itemPay(e, run));
      if (action.endsWith("approve")) {
        require(user.role === "admin", "Only an administrator can approve.");
        require(JSON.stringify(fresh) ===
          JSON.stringify(
            run.items,
          ), "Inputs changed. Recompute and review first.");
        run.status = "approved";
        message = "Payroll approved and locked. No salary has been released.";
      } else {
        require(canManage(), "HR access required.");
        run.items = fresh;
        Object.assign(run, totals(fresh));
        message = "Draft recomputed.";
      }
      target = "/payroll/" + run.id;
    }
    save();
    navigate(target);
  } catch (e) {
    error = e.message;
    render();
  }
}
function exportCSV(type) {
  const d = data();
  const rows =
    type === "employees"
      ? d.employees
      : type === "leaves"
        ? d.leaves
        : d.runs.map(({ items, ...r }) => r);
  if (!rows.length) {
    error = "No records to export.";
    return;
  }
  const keys = Object.keys(rows[0]);
  const escape = (v) => {
    let s = String(v ?? "");
    if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  const csv = [
    keys.map(escape).join(","),
    ...rows.map((r) => keys.map((k) => escape(r[k])).join(",")),
  ].join("\r\n");
  const url = URL.createObjectURL(
    new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "peoplepay-" + type + ".csv";
  a.click();
  URL.revokeObjectURL(url);
}
window.addEventListener("hashchange", render);
render();
