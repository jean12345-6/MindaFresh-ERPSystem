export function validDate(s) {
  return (
    typeof s === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    !Number.isNaN(Date.parse(s)) &&
    new Date(s).toISOString().slice(0, 10) === s
  );
}
export function dateRange(start, end) {
  if (
    !validDate(start) ||
    !validDate(end) ||
    end < start ||
    (Date.parse(end) - Date.parse(start)) / 86400000 > 366
  )
    throw Error("Invalid date range (maximum 366 days).");
  let a = [];
  for (
    let d = new Date(start + "T00:00:00Z");
    d <= new Date(end + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + 1)
  )
    a.push(d.toISOString().slice(0, 10));
  return a;
}
export function isWorkDay(date, holidays = []) {
  let days = (process.env.WORK_DAYS || "1,2,3,4,5,6").split(",").map(Number);
  return (
    days.includes(new Date(date + "T00:00:00Z").getUTCDay()) &&
    !holidays.some((h) => h.holiday_date === date)
  );
}
export function validatePeriod(start, end) {
  dateRange(start, end);
  const [y, m, d] = start.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const prefix = start.slice(0, 8);
  if (
    !((d === 1 && end === prefix + "15") || (d === 16 && end === prefix + last))
  )
    throw Error("Use a half-month period: 1–15 or 16–month end.");
}
