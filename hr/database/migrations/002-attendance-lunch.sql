-- Accepted blueprint v2.4 migration. DB host only, ONLY if both lunch columns are absent.
-- Back up mindafresh_db first. Do not run against an already upgraded database.
USE mindafresh_db;
ALTER TABLE attendance_logs
  ADD COLUMN lunch_out DATETIME NULL AFTER time_in,
  ADD COLUMN lunch_in DATETIME NULL AFTER lunch_out,
  ADD CONSTRAINT chk_attendance_lunch CHECK (
    (lunch_in IS NULL OR lunch_out IS NOT NULL)
    AND (lunch_out IS NULL OR time_in IS NULL OR lunch_out >= time_in)
    AND (lunch_in IS NULL OR lunch_in >= lunch_out)
    AND (lunch_in IS NULL OR time_out IS NULL OR time_out >= lunch_in)
  );
