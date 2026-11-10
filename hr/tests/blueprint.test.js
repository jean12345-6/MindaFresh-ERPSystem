import test from "node:test";
import assert from "node:assert/strict";
import { createAttendanceService, summarizeRecords, manilaToday } from "../services/attendanceService.js";
import { getWorkspaceData } from "../services/workspaceService.js";
import { requireRole } from "../middleware/auth.js";
import { isSelfService } from "../utils/roles.js";

const employees = [{id: 1, employee_code: "EMP-0001", hire_date: "2026-11-02"}];
test("summary matches shared blueprint fields and counts late as present", () => {
 const summary = summarizeRecords(employees, [
  {employee_id:1,log_date:"2026-11-02",status:"late",late_minutes:25,undertime_minutes:30,hours_worked:"7.08"},
  {employee_id:1,log_date:"2026-11-03",status:"present",hours_worked:"8.00"},
  {employee_id:1,log_date:"2026-11-04",status:"absent"},
  {employee_id:1,log_date:"2026-11-05",status:"on_leave"},
  {employee_id:9,log_date:"2026-11-05",status:"present"},
 ], "2026-11-01", "2026-11-05");
 assert.deepEqual(summary, [{employee_id:1,employee_code:"EMP-0001",days_present:2,days_late:1,days_absent:1,days_on_leave:1,late_minutes:25,undertime_minutes:30,hours_worked:15.08}]);
});
test("Manila calendar remains correct across the UTC date boundary", () => {
 assert.equal(manilaToday(new Date("2026-11-01T16:30:00Z")), "2026-11-02");
});
test("Attendance closing is idempotent, excludes holidays, today and approved payroll", async () => {
 const stored = [{employee_id:1,log_date:"2026-11-02",status:"present",hours_worked:8}];
 const db = {
  transaction: callback => callback({}),
  rows: async sql => {
   if (sql.includes("FROM employees")) return employees;
   if (sql.includes("FROM holidays")) return [{holiday_date:"2026-11-03"}];
   if (sql.includes("FROM leave_requests")) return [{employee_id:1,start_date:"2026-11-04",end_date:"2026-11-04"}];
   if (sql.includes("FROM payroll_runs")) return [{period_start:"2026-11-05",period_end:"2026-11-05"}];
   if (sql.includes("FROM attendance_logs")) return stored.map(x=>({...x}));
   throw Error("Unexpected read " + sql);
  },
  execute: async (sql, p) => {
   if (sql.startsWith("INSERT") && !stored.some(l=>l.log_date===p.date)) stored.push({employee_id:p.id,log_date:p.date,status:p.status});
  }
 };
 const service=createAttendanceService(db,()=>"2026-11-09");
 await service.closeDays("2026-11-10");
 const snapshot=structuredClone(stored);
 await service.closeDays("2026-11-10");
 assert.deepEqual(stored,snapshot);
 assert.deepEqual(stored.map(l=>[l.log_date,l.status]),[["2026-11-02","present"],["2026-11-04","on_leave"],["2026-11-06","absent"],["2026-11-07","absent"]]);
 const summary=await service.getSummary("2026-11-01","2026-11-08");
 assert.equal(summary[0].days_absent,2);
 assert.equal(summary[0].days_on_leave,1);
});
for (const role of ["employee", "cashier", "inventory_staff"]) {
 test(`${role} sees own released payslips and can cancel only own leave`, async () => {
  assert.ok(isSelfService(role));
  const queries=[];
  const data=await getWorkspaceData({role,employee_id:1}, async(sql,p)=>{
   queries.push(sql);
   if(sql.includes("FROM employees")) {assert.match(sql,/WHERE e.id=:id/);return [{...employees[0],first_name:"Ana",last_name:"Cruz",status:"active"}];}
   if(sql.includes("FROM departments"))return [];
   if(sql.includes("FROM leave_requests")){assert.match(sql,/WHERE employee_id=:id/);return [{employee_id:1,status:"pending"}];}
   if(sql.includes("FROM payroll_runs")){assert.match(sql,/s.status='released'/);assert.match(sql,/j.status='posted'/);return [{id:1,total_net:999999,total_gross:999999}];}
   if(sql.includes("FROM payroll_items")){assert.match(sql,/AND employee_id=:id/);return [{employee_id:1,net_pay:100,gross_pay:110,sss:5,philhealth:3,pagibig:2,withholding_tax:0}];}
   if(sql.includes("FROM holidays"))return [];
   throw Error("Unexpected or unscoped read: "+sql);
  });
  assert.equal(data.runs[0].total_net,100);
  assert.equal(data.runs[0].total_gross,110);
  assert.equal(data.runs[0].employee_count,1);
  assert.equal(data.leaves[0].can_cancel,true);
  assert.deepEqual(data.users,[]);
  assert.deepEqual(data.attendance,[]);
 });
}
test("role middleware uses canonical session user, rejecting mismatched req.user", () => {
 let target; let continued=false;
 requireRole("admin")({session:{user:{role:"employee"}},user:{role:"admin"}}, {redirect:p=>{target=p;}},()=>{continued=true;});
 assert.equal(target,"/login"); assert.equal(continued,false);
 requireRole("admin")({session:{user:{role:"admin"}}}, {},()=>{continued=true;});
 assert.equal(continued,true);
});

test("flash messages preserve arrays and are consumed once", async () => {
 const {default: flash} = await import("../middleware/flash.js");
 const req={session:{}};
 flash()(req,{},()=>{});
 req.flash("success_msg",["Saved","Ready"]);
 assert.deepEqual(req.flash("success_msg"),["Saved","Ready"]);
 assert.deepEqual(req.flash("success_msg"),[]);
});

test("shared sign-in returns canonical fields, hides hashes, and rejects disabled employees", async () => {
 const bcrypt = (await import("bcryptjs")).default;
 const {createAuthService} = await import("../services/authService.js");
 const password = await bcrypt.hash("local-test-password", 4);
 const account = { id: 9, employee_id: 1, employee_code: "EMP-0001", first_name: "Ana", last_name: "Cruz", username: "ana.cashier", role: "cashier", status: "active", employee_status: "active", password };
 let updated = 0;
 const auth = createAuthService({rows: async()=>[account],execute: async()=>{updated++;}});
 const user=await auth.login("ana.cashier", "local-test-password");
 assert.equal(user.user_id,9);assert.equal(user.full_name,"Ana Cruz");assert.equal(user.employee_code,"EMP-0001");assert.equal(user.password,undefined);assert.equal(updated,1);
 await assert.rejects(auth.login("ana.cashier","wrong"), e=>e.code==="INVALID_LOGIN");
 account.employee_status="resigned";
 await assert.rejects(auth.login("ana.cashier","local-test-password"), e=>e.code==="ACCOUNT_DISABLED");
 assert.equal(updated,1);
});
