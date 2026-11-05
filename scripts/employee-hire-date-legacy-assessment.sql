-- Read-only assessment for legacy Employee hireDate provenance.
-- The equality result is a candidate signal only, never proof that a hire date
-- is genuine. Review every non-null value against an authoritative HR record.

SELECT
    COUNT(*) AS employee_count,
    SUM(CASE WHEN hireDate IS NULL THEN 1 ELSE 0 END) AS null_hire_date_count,
    SUM(CASE WHEN hireDate = createdAt THEN 1 ELSE 0 END) AS matches_creation_timestamp_count,
    SUM(CASE WHEN hireDate <> createdAt THEN 1 ELSE 0 END) AS differs_from_creation_timestamp_count
FROM employees;

SELECT
    id,
    firstName,
    lastName,
    hireDate,
    createdAt,
    CASE
        WHEN hireDate IS NULL THEN 'NULL'
        WHEN hireDate = createdAt THEN 'MATCHES_CREATION_TIMESTAMP_CANDIDATE'
        ELSE 'DIFFERS_FROM_CREATION_TIMESTAMP_REVIEW_REQUIRED'
    END AS provenance_signal
FROM employees
ORDER BY id;

-- Inspect available Employee audit evidence. Existing application audit
-- producers did not record hireDate, so this query is a search aid only.
SELECT
    id,
    entityId,
    action,
    userId,
    userEmail,
    createdAt,
    details
FROM audit_logs
WHERE entityType = 'Employee'
  AND (
      action IN ('EMPLOYEE_CREATE', 'EMPLOYEE_UPDATE', 'EMPLOYEE_IMPORT')
      OR details LIKE '%hireDate%'
  )
ORDER BY entityId, createdAt, id;
