-- MySQL 8.0+, dedicated autocommit session, after Prisma migrations.
-- Stop ALL employee writers and drain in-flight requests before sourcing.
-- Set the session inputs documented in employee-hire-date-migration.md first.
-- Defaults fail closed. Do not use mysql --force (stop on the first error).
SET @apply_employee_hire_date_remediation = COALESCE(@apply_employee_hire_date_remediation, 0);
SET @employee_writes_paused = COALESCE(@employee_writes_paused, 0);

DROP PROCEDURE IF EXISTS clear_legacy_employee_hire_dates;
DELIMITER $$
CREATE PROCEDURE clear_legacy_employee_hire_dates()
SQL SECURITY INVOKER
BEGIN
    DECLARE cohort_count INT DEFAULT 0;
    DECLARE clear_count INT DEFAULT 0;
    DECLARE audit_count INT DEFAULT 0;
    DECLARE update_count INT DEFAULT 0;
    DECLARE snapshot JSON;
    DECLARE changed_at DATETIME(3);
    DECLARE EXIT HANDLER FOR SQLEXCEPTION, SQLWARNING
    BEGIN
        ROLLBACK;
        DROP TEMPORARY TABLE IF EXISTS legacy_employee_hire_dates;
        RESIGNAL SQLSTATE '45000';
    END;

    IF COALESCE(@apply_employee_hire_date_remediation, 0) <> 1
       OR COALESCE(@employee_writes_paused, 0) <> 1
       OR @operator_email IS NULL OR CHAR_LENGTH(TRIM(@operator_email)) = 0
       OR CHAR_LENGTH(@operator_email) > 191
       OR @verified_backup_reference IS NULL
       OR CHAR_LENGTH(TRIM(@verified_backup_reference)) = 0
       OR CHAR_LENGTH(@verified_backup_reference) > 255
       OR @cutover_deadline_utc IS NULL
       OR @cutover_deadline_utc <= UTC_TIMESTAMP(3)
       OR @cutover_deadline_utc > UTC_TIMESTAMP(3) + INTERVAL 1 HOUR
       OR @expected_employee_count IS NULL OR @expected_employee_count < 0
       OR @expected_clear_count IS NULL OR @expected_clear_count < 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Cutover refused: backup, paused writes, counts and live deadline required';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'employees'
          AND column_name = 'hireDate' AND data_type = 'date'
          AND is_nullable = 'YES' AND column_default IS NULL
    ) OR (
        SELECT COUNT(*) FROM information_schema.tables
        WHERE table_schema = DATABASE()
          AND table_name IN ('employees', 'audit_logs', 'employee_hire_date_cutover')
          AND engine = 'InnoDB'
    ) <> 3 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Apply nullable DATE and receipt migrations; all target tables must use InnoDB';
    END IF;

    SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
    START TRANSACTION;
    -- The singleton PK serializes attempts and permanently rejects a second run.
    -- This reservation rolls back together with employee changes on any failure.
    INSERT INTO employee_hire_date_cutover
        (id, completedAt, operatorEmail, backupReference, employeeCount, clearedCount, originalValues)
    VALUES (1, UTC_TIMESTAMP(3), @operator_email, @verified_backup_reference, 0, 0, JSON_ARRAY());

    CREATE TEMPORARY TABLE legacy_employee_hire_dates (
        employee_id INT NOT NULL PRIMARY KEY,
        hire_date DATE NULL,
        original_updated_at DATETIME(3) NOT NULL
    ) ENGINE=InnoDB;
    -- Full primary-key scan locks the cohort, including NULL dates and gaps.
    -- The operational write pause must remain in place until the new app is live.
    INSERT INTO legacy_employee_hire_dates (employee_id, hire_date, original_updated_at)
    SELECT id, hireDate, updatedAt FROM employees ORDER BY id FOR UPDATE;

    SELECT COUNT(*), COUNT(hire_date),
           COALESCE(JSON_ARRAYAGG(JSON_OBJECT(
               'employeeId', employee_id, 'hireDate', hire_date,
               'updatedAt', original_updated_at
           )), JSON_ARRAY())
    INTO cohort_count, clear_count, snapshot
    FROM legacy_employee_hire_dates;

    IF cohort_count <> @expected_employee_count OR clear_count <> @expected_clear_count THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Cutover count mismatch; no changes committed';
    END IF;

    -- Prisma stores timestamps in UTC; raw SQL must set updatedAt explicitly.
    SET changed_at = UTC_TIMESTAMP(3);
    INSERT INTO audit_logs
        (action, entityType, entityId, userId, userEmail, details, createdAt)
    SELECT 'EMPLOYEE_UPDATE', 'Employee', e.id, NULL, @operator_email,
           JSON_OBJECT(
               'before', JSON_OBJECT('hireDate', DATE_FORMAT(s.hire_date, '%Y-%m-%d')),
               'after', JSON_OBJECT('hireDate', NULL),
               'metadata', JSON_OBJECT(
                   'employeeName', CONCAT_WS(' ', e.firstName, e.lastName),
                   'reason', 'legacy_hire_date_cutover', 'cutoverId', 1,
                   'databaseActor', CURRENT_USER(),
                   'backupReference', @verified_backup_reference
               )
           ), changed_at
    FROM employees AS e
    INNER JOIN legacy_employee_hire_dates AS s ON s.employee_id = e.id
    WHERE s.hire_date IS NOT NULL;
    SET audit_count = ROW_COUNT();

    UPDATE employees AS e
    INNER JOIN legacy_employee_hire_dates AS s ON s.employee_id = e.id
    SET e.hireDate = NULL, e.updatedAt = changed_at
    WHERE s.hire_date IS NOT NULL AND e.hireDate = s.hire_date;
    SET update_count = ROW_COUNT();

    IF audit_count <> clear_count OR update_count <> clear_count
       OR (SELECT COUNT(*) FROM employees) <> cohort_count
       OR EXISTS (
           SELECT 1 FROM employees AS e
           INNER JOIN legacy_employee_hire_dates AS s ON s.employee_id = e.id
           WHERE e.hireDate IS NOT NULL
       )
       OR (SELECT COUNT(*) FROM audit_logs
           WHERE entityType = 'Employee' AND action = 'EMPLOYEE_UPDATE'
             AND JSON_UNQUOTE(JSON_EXTRACT(details, '$.metadata.reason')) = 'legacy_hire_date_cutover'
             AND JSON_EXTRACT(details, '$.metadata.cutoverId') = 1) <> clear_count THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Cutover audit/update validation failed; transaction rolled back';
    END IF;

    UPDATE employee_hire_date_cutover
    SET completedAt = changed_at, employeeCount = cohort_count,
        clearedCount = clear_count, originalValues = snapshot
    WHERE id = 1;
    IF NOT EXISTS (
        SELECT 1 FROM employee_hire_date_cutover
        WHERE id = 1 AND employeeCount = cohort_count AND clearedCount = clear_count
          AND completedAt = changed_at AND originalValues = snapshot
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Cutover receipt validation failed';
    END IF;
    DROP TEMPORARY TABLE legacy_employee_hire_dates;
    COMMIT;
    SELECT 'COMPLETED' AS status, cohort_count AS employee_count,
           clear_count AS cleared_count, audit_count AS audit_count, changed_at AS completed_at_utc;
END$$
DELIMITER ;

CALL clear_legacy_employee_hire_dates();
DROP PROCEDURE clear_legacy_employee_hire_dates;
