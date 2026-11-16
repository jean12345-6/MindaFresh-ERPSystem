-- 005-leave-decision-remarks.sql  (Fate, HR: changes HR's own leave_requests table)
-- Panel feedback (Nov 11): rejecting a leave needs a reason, and approving can take a comment.
-- Run once on the DB host (and on solo-mode laptops): phpMyAdmin -> mindafresh_db -> Import this file.
-- Works on MySQL 8.0.16+ (Laragon MySQL 8.4) and MariaDB.
USE mindafresh_db;

ALTER TABLE leave_requests ADD COLUMN decision_remarks VARCHAR(255) NULL AFTER approved_by_id;
-- Old rejected requests (from before this change) get a placeholder, so the new rule can be added
UPDATE leave_requests SET decision_remarks = 'No reason recorded (rejected before v2.5)'
 WHERE status = 'rejected' AND (decision_remarks IS NULL OR TRIM(decision_remarks) = '');
ALTER TABLE leave_requests ADD CONSTRAINT chk_leave_reject_reason
  CHECK (status <> 'rejected' OR (decision_remarks IS NOT NULL AND TRIM(decision_remarks) <> ''));
