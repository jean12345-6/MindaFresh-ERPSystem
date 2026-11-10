import test from "node:test";
import assert from "node:assert/strict";
import { computePay, totals } from "../services/payrollMath.js";
import {
  dateRange,
  validatePeriod,
  isWorkDay,
} from "../services/dates.js";
test("salary includes paid leave and holidays, deducts tardiness once", () => {
  const p = computePay({
    daily_rate: 650,
    days_worked: 10,
    paid_leave_days: 1,
    paid_holiday_days: 1,
    late_minutes: 30,
    undertime_minutes: 30,
  });
  assert.equal(p.basic_pay, 7800);
  assert.equal(p.tardiness_deduction, 81.25);
  assert.equal(p.gross_pay, 7718.75);
  assert.equal(p.sss, 347.34);
  assert.equal(p.philhealth, 192.97);
  assert.equal(p.pagibig, 100);
  assert.equal(p.withholding_tax, 0);
  assert.equal(p.net_pay, 7078.44);
});
test("zero attendance produces zero pay, never negative net", () =>
  assert.equal(computePay({ daily_rate: 650, days_worked: 0 }).net_pay, 0));
test("tax applies only above academic threshold after contributions", () => {
  const p = computePay({ daily_rate: 2000, days_worked: 13 });
  assert.equal(p.withholding_tax, 1366.3);
  assert.equal(p.net_pay, 22713.7);
});
test("tardiness cannot exceed basic salary", () => {
  const p = computePay({ daily_rate: 650, days_worked: 1, late_minutes: 960 });
  assert.equal(p.gross_pay, 0);
  assert.equal(p.net_pay, 0);
});
test("rejects invalid amounts", () => {
  assert.throws(() => computePay({ daily_rate: -1, days_worked: 1 }));
  assert.throws(() => computePay({ daily_rate: 650, days_worked: NaN }));
});
test("run totals equal sum of immutable payslips", () => {
  const a = computePay({ daily_rate: 650, days_worked: 12 }),
    b = computePay({ daily_rate: 800, days_worked: 13 });
  const r = totals([a, b]);
  assert.equal(r.total_net, Math.round((a.net_pay + b.net_pay) * 100) / 100);
  assert.equal(r.employee_count, 2);
  assert.equal(
    Math.round(
      (r.total_gross - r.total_contributions - r.total_withholding_tax) * 100,
    ) / 100,
    r.total_net,
  );
});
test("half-month periods include leap-year end date", () => {
  validatePeriod("2028-02-16", "2028-02-29");
  validatePeriod("2026-11-01", "2026-11-15");
  assert.throws(() => validatePeriod("2026-11-02", "2026-11-15"));
  assert.throws(() => validatePeriod("2026-02-16", "2026-02-29"));
});
test("working days exclude Sundays and holidays", () => {
  assert.equal(isWorkDay("2026-11-01"), false);
  assert.equal(
    isWorkDay("2026-11-02", [{ holiday_date: "2026-11-02" }]),
    false,
  );
  assert.equal(isWorkDay("2026-11-03"), true);
});
test("date ranges reject reversed, impossible, or excessive periods", () => {
  assert.equal(dateRange("2026-10-01", "2026-10-15").length, 15);
  assert.throws(() => dateRange("2026-10-15", "2026-10-01"));
  assert.throws(() => dateRange("2026-02-30", "2026-03-01"));
  assert.throws(() => dateRange("2025-01-01", "2026-11-01"));
});
