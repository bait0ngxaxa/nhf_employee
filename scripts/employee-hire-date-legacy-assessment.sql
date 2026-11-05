-- Read-only dry run. Run while employee writes are paused at initial cutover.
-- Every existing employee belongs to the legacy cohort, regardless of dates.
SELECT COUNT(*) AS employee_count,
       COUNT(hireDate) AS expected_clear_count
FROM employees;

SELECT id, firstName, lastName, hireDate, updatedAt
FROM employees
ORDER BY id;

-- Run after Prisma migrations. A row means cleanup has already completed:
-- NEVER delete this receipt or repeat cleanup after normal writes resume.
SELECT id, completedAt, operatorEmail, backupReference, employeeCount, clearedCount
FROM employee_hire_date_cutover;
