import test from "node:test";
import assert from "node:assert/strict";
import { pageWindow } from "../public/js/table-pagination.js";
import { getWorkspaceData } from "../services/workspaceService.js";

test("empty tables, exact pages and partial final pages have valid ranges", () => {
 assert.deepEqual(pageWindow(0),{page:1,size:10,pages:1,offset:0,end:0,first:0,total:0});
 assert.equal(pageWindow(20).pages,2);
 assert.deepEqual(pageWindow(23,3),{page:3,size:10,pages:3,offset:20,end:23,first:21,total:23});
 assert.equal(pageWindow(23,99).page,3);
 assert.equal(pageWindow(23,-1).page,1);
});
test("page size changes keep ranges valid and table states independent", () => {
 const first = pageWindow(63,3,10);
 const second = pageWindow(7,1,10);
 const resized = pageWindow(63,1,25);
 assert.equal(first.first,21);assert.equal(first.end,30);
 assert.equal(resized.end,25);assert.equal(resized.pages,3);
 assert.equal(second.pages,1);assert.equal(second.end,7);
 assert.equal(pageWindow(63,1,100).end,63);
 assert.equal(pageWindow(63,1,"bad").size,10);
});
test("legacy Accounting fixture falls back without treating journals as posted", async () => {
 const sqls=[];
 const data = await getWorkspaceData({role:"admin",employee_id:1}, async sql => {
  sqls.push(sql);
  if (sql.includes("j.status='posted'")) throw {parent:{code:"ER_BAD_FIELD_ERROR",sqlMessage:"Unknown column 'j.status' in 'where clause'"}};
  return [];
 });
 assert.equal(data.accountingStatusUnavailable,true);
 assert.ok(sqls.some(sql=>sql.includes("0 AS is_posted")));
});
test("unrelated database failures remain visible", async () => {
 await assert.rejects(getWorkspaceData({role:"admin",employee_id:1}, async sql => {
  if(sql.includes("FROM payroll_runs"))throw Object.assign(Error("Connection failed"),{code:"ETIMEDOUT"});
  return [];
 }),/Connection failed/);
});
