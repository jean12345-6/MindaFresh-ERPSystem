import { payrollConfig as c } from "./payrollConfig.js";
export const round = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
export function computePay({
  daily_rate,
  days_worked,
  paid_leave_days = 0,
  paid_holiday_days = 0,
  unpaid_days = 0,
  late_minutes = 0,
  undertime_minutes = 0,
}) {
  for (const n of [
    daily_rate,
    days_worked,
    paid_leave_days,
    paid_holiday_days,
    unpaid_days,
    late_minutes,
    undertime_minutes,
  ])
    if (!Number.isFinite(n) || n < 0) throw Error("Invalid payroll input");
  const basic_pay = round(
    (days_worked + paid_leave_days + paid_holiday_days) * daily_rate,
  );
  const tardiness_deduction = Math.min(
    basic_pay,
    round((daily_rate / c.minutesPerDay) * (late_minutes + undertime_minutes)),
  );
  const gross_pay = round(basic_pay - tardiness_deduction),
    sss = round(gross_pay * c.sssRate),
    philhealth = round(gross_pay * c.philhealthRate),
    pagibig = Math.min(c.pagibigHalfMonthCap, round(gross_pay * c.pagibigRate));
  const withholding_tax = round(
    Math.max(
      0,
      gross_pay - sss - philhealth - pagibig - c.taxHalfMonthThreshold,
    ) * c.taxRate,
  );
  return {
    daily_rate,
    days_worked,
    paid_leave_days,
    paid_holiday_days,
    unpaid_days,
    late_minutes,
    undertime_minutes,
    basic_pay,
    tardiness_deduction,
    gross_pay,
    sss,
    philhealth,
    pagibig,
    withholding_tax,
    net_pay: round(gross_pay - sss - philhealth - pagibig - withholding_tax),
  };
}
export function totals(items) {
  return {
    employee_count: items.length,
    total_gross: round(items.reduce((s, i) => s + i.gross_pay, 0)),
    total_contributions: round(
      items.reduce((s, i) => s + i.sss + i.philhealth + i.pagibig, 0),
    ),
    total_withholding_tax: round(
      items.reduce((s, i) => s + i.withholding_tax, 0),
    ),
    total_net: round(items.reduce((s, i) => s + i.net_pay, 0)),
  };
}
