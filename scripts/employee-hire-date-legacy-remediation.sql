-- Run only in a reviewed, persistent MySQL session after the schema migration.
-- This script does not change data unless the explicit apply gate is set to 1.
-- Stage only employee IDs approved for clearing in the signed HR review record.

SET @apply_employee_hire_date_remediation = 0;
SET @operator_user_id = NULL;
SET @operator_email = NULL;
SET @approved_clear_count = NULL;
SET @audited_clear_count = NULL;
SET @updated_clear_count = NULL;

CREATE TEMPORARY TABLE approved_employee_hire_date_clears (
    employee_id INT NOT NULL PRIMARY KEY,
    expected_hire_date DATE NOT NULL,
    approval_reference VARCHAR(191) NOT NULL
);

-- Add only individually reviewed and approved rows to clear, for example:
-- INSERT INTO approved_employee_hire_date_clears
--     (employee_id, expected_hire_date, approval_reference)
-- VALUES (123, '2020-01-01', 'approved HR review reference');

-- Read-only preview. Resolve every mismatch before enabling the apply gate.
SELECT
    r.employee_id,
    e.firstName,
    e.lastName,
    r.expected_hire_date,
    e.hireDate AS current_hire_date,
    r.approval_reference,
    CASE
        WHEN e.id IS NULL THEN 'EMPLOYEE_NOT_FOUND'
        WHEN e.hireDate = r.expected_hire_date THEN 'READY_FOR_APPROVED_CLEAR'
        ELSE 'DATE_CHANGED_REVIEW_REQUIRED'
    END AS review_status
FROM approved_employee_hire_date_clears AS r
LEFT JOIN employees AS e ON e.id = r.employee_id
ORDER BY r.employee_id;

-- Verify the acting account before execution. Use NULL only when the approved
-- operator has no User row; always supply the operator email.
-- SET @operator_user_id = <existing users.id or NULL>;
-- SET @operator_email = '<approved operator email>';
-- SET @apply_employee_hire_date_remediation = 1;

START TRANSACTION;

SELECT
    e.id,
    e.firstName,
    e.lastName,
    e.hireDate,
    r.approval_reference
FROM employees AS e
INNER JOIN approved_employee_hire_date_clears AS r
    ON r.employee_id = e.id
   AND r.expected_hire_date = e.hireDate
WHERE @apply_employee_hire_date_remediation = 1
  AND @operator_email IS NOT NULL
FOR UPDATE;

SELECT COUNT(*) INTO @approved_clear_count
FROM approved_employee_hire_date_clears;

INSERT INTO audit_logs
    (action, entityType, entityId, userId, userEmail, details)
SELECT
    'EMPLOYEE_UPDATE',
    'Employee',
    e.id,
    @operator_user_id,
    @operator_email,
    JSON_OBJECT(
        'before', JSON_OBJECT('hireDate', DATE_FORMAT(e.hireDate, '%Y-%m-%d')),
        'after', JSON_OBJECT('hireDate', NULL),
        'metadata', JSON_OBJECT(
            'employeeName', CONCAT_WS(' ', e.firstName, e.lastName),
            'reason', 'legacy_hire_date_review',
            'approvalReference', r.approval_reference
        )
    )
FROM employees AS e
INNER JOIN approved_employee_hire_date_clears AS r
    ON r.employee_id = e.id
   AND r.expected_hire_date = e.hireDate
WHERE @apply_employee_hire_date_remediation = 1
  AND @operator_email IS NOT NULL;
SET @audited_clear_count = ROW_COUNT();

UPDATE employees AS e
INNER JOIN approved_employee_hire_date_clears AS r
    ON r.employee_id = e.id
   AND r.expected_hire_date = e.hireDate
SET e.hireDate = NULL
WHERE @apply_employee_hire_date_remediation = 1
  AND @operator_email IS NOT NULL;
SET @updated_clear_count = ROW_COUNT();

SELECT
    @apply_employee_hire_date_remediation AS apply_gate,
    @approved_clear_count AS approved_clear_count,
    @audited_clear_count AS audited_clear_count,
    @updated_clear_count AS updated_clear_count;

-- Keep the transaction open. COMMIT only when the apply gate is 1 and all
-- three counts match the approved clear list; otherwise issue ROLLBACK.
