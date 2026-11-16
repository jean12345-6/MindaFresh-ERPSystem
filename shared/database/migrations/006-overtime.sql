-- 006-overtime.sql  (Brian: attendance_logs; Fate: payroll_items. Both must agree)
-- Panel feedback (Nov 11): the DTR shows overtime hours, and overtime is paid.
-- Overtime = minutes worked after SHIFT_END (17:00) until time out, counted only when it is
-- at least 30 minutes, at most 240 minutes (4 hours) a day. Paid at 125% of the hourly rate.
-- Run once on the DB host (and on solo-mode laptops): phpMyAdmin -> mindafresh_db -> Import this file.
USE mindafresh_db;

-- Attendance (Brian): overtime per day, set at time out
ALTER TABLE attendance_logs ADD COLUMN overtime_minutes INT NOT NULL DEFAULT 0 AFTER undertime_minutes;
ALTER TABLE attendance_logs ADD CONSTRAINT chk_attendance_overtime CHECK (overtime_minutes BETWEEN 0 AND 240);

-- Fill in overtime for logs that already have a time out (SHIFT_END 17:00)
UPDATE attendance_logs
   SET overtime_minutes = LEAST(240, TIMESTAMPDIFF(MINUTE, TIMESTAMP(log_date, '17:00:00'), time_out))
 WHERE time_out IS NOT NULL
   AND TIMESTAMPDIFF(MINUTE, TIMESTAMP(log_date, '17:00:00'), time_out) >= 30;

-- HR (Fate): overtime on the payslip
ALTER TABLE payroll_items ADD COLUMN overtime_minutes INT NOT NULL DEFAULT 0 AFTER undertime_minutes;
ALTER TABLE payroll_items ADD COLUMN overtime_pay DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER tardiness_deduction;
ALTER TABLE payroll_items ADD CONSTRAINT chk_payroll_overtime CHECK (overtime_minutes >= 0 AND overtime_pay >= 0);
