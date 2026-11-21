import test from 'node:test';
import assert from 'node:assert/strict';
import { computePay, totals } from '../services/payrollMath.js';
import { summarizeRecords } from '../services/attendanceService.js';
import { decideLeave } from '../services/leaveService.js';
import { getPayrollDays } from '../services/payrollAttendance.js';
import { sequelize } from '../models/db.js';

test('overtime increases gross, deductions and run totals using cutoff minutes', () => {
  for (const minutes of [0, 45, 105, 120, 240, 480]) {
    const pay = computePay({ daily_rate: 800, days_worked: 2, overtime_minutes: minutes });
    const expected = Math.round(800 / 480 * 1.25 * minutes * 100) / 100;
    assert.equal(pay.overtime_pay, expected);
    assert.equal(pay.gross_pay, 1600 + expected);
    assert.equal(pay.sss, Math.round(pay.gross_pay * 0.045 * 100) / 100);
    assert.equal(totals([pay]).total_gross, pay.gross_pay);
  }
  assert.throws(() => computePay({daily_rate:800, days_worked:1, overtime_minutes:-1}));
});

test('summary keeps overtime separate from regular hours and excludes other dates/employees', () => {
  const summary = summarizeRecords([{id:1, employee_code:'EMP-0001', hire_date:'2026-01-01'}], [
    {employee_id:1,log_date:'2026-10-20',status:'present',hours_worked:8,overtime_minutes:120},
    {employee_id:1,log_date:'2026-10-24',status:'late',hours_worked:7.5,overtime_minutes:105,late_minutes:30},
    {employee_id:1,log_date:'2026-11-01',status:'present',overtime_minutes:240},
    {employee_id:2,log_date:'2026-10-20',status:'present',overtime_minutes:240},
  ], '2026-10-16', '2026-10-31')[0];
  assert.equal(summary.overtime_minutes,225);
  assert.equal(summary.hours_worked,15.5);
  assert.equal(summary.days_present,2);
  assert.equal(summary.days_late,1);
});

test('leave rejection refuses missing, blank, oversized or non-text reasons', async () => {
  const user={role:'hr_staff',employee_id:1};
  for (const remarks of [undefined,'','   ','x'.repeat(256),{}]) {
    await assert.rejects(() => decideLeave(1,'rejected',user,remarks));
  }
});

test('leave decisions persist trimmed remarks and reviewer in the transaction', async t => {
  const transaction = {};
  const decisions = [];
  t.mock.method(sequelize, 'transaction', async callback => callback(transaction));
  t.mock.method(sequelize, 'query', async (sql, options) => {
    assert.equal(options.transaction,transaction);
    if (sql.startsWith('SELECT employee_id')) return [{employee_id:2}];
    if (sql.includes('FROM employees')) return [{id:2}];
    if (sql.includes('FROM leave_requests')) return [{id:1,employee_id:2,status:'pending',leave_type:'unpaid',start_date:'2026-10-20',end_date:'2026-10-20'}];
    if (sql.includes('FROM payroll_runs')) return [];
    if (sql.startsWith('UPDATE leave_requests')) { decisions.push(options.replacements); return [[],{}]; }
    throw Error('Unexpected query: '+sql);
  });
  await decideLeave(1,'rejected',{role:'hr_staff',employee_id:1},'  Staffing shortage  ');
  await decideLeave(1,'approved',{role:'hr_staff',employee_id:1},'  Approved by HR  ');
  assert.equal(decisions[0].remarks,'Staffing shortage');
  assert.equal(decisions[0].actor,1);
  assert.equal(decisions[1].remarks,'Approved by HR');
});

test('payroll adapter consumes saved overtime minutes from attendance', async t => {
  t.mock.method(sequelize,'query',async sql => {
    if(sql.includes('FROM holidays') || sql.includes('FROM leave_requests')) return [];
    if(sql.includes('FROM attendance_logs')) return [{employee_id:1,log_date:'2026-10-20',status:'present',time_out:'2026-10-20 19:00:00',late_minutes:0,undertime_minutes:0,overtime_minutes:120}];
    throw Error('Unexpected query: '+sql);
  });
  const result=await getPayrollDays({id:1,employee_code:'EMP-0001',hire_date:'2026-01-01'},'2026-10-20','2026-10-20',{});
  assert.equal(result.overtime_minutes,120);
  assert.equal(result.days_worked,1);
});
