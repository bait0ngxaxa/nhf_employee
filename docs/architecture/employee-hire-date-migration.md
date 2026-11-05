# Employee hire date cutover

## Business decision and schema

All employees present at the initial production cutover are legacy employees.
All their historical hire dates are untrusted and approved for clearing to NULL.
No individual HR review, evidence matching or keep/clear decisions are required.
Never classify the cohort using hireDate/createdAt equality. createdAt is never
an employment start date.

`Employee.hireDate` remains `DateTime? @db.Date`, without a default or persisted
tenure. The existing nullable migration preserves stored calendar dates while
discarding DATETIME time components. Its published migration file is unchanged.
The additional receipt migration creates only `employee_hire_date_cutover`.
Use normal `npx prisma migrate deploy`, never db push.

## Required release sequence

1. Create a production backup and verify it can be restored to an isolated DB.
   Retain its identifier and verification results in the release record.
2. Enter a controlled maintenance window. Stop all app instances, imports,
   integrations and other employee writers; drain in-flight requests. Restrict
   database write access to the cutover operator until step 8. A session variable
   acknowledging this pause does not enforce it; operators must actually stop
   the writers. No new real hire dates may be entered before cleanup finishes.
3. Apply Prisma migrations, including the nullable DATE and receipt migrations.
4. Execute the one-time cleanup described below, while writes remain paused.
5. Verify all legacy hire dates are NULL, counts agree, IDs/profiles/relationships
   match the backup, and the durable receipt and per-employee audits exist.
6. Deploy the new application version before exposing it to normal users.
7. Smoke test omitted/null/date creation, unrelated edits, setting/changing/
   clearing dates, tenure, and CSV import/export with an authorized test account.
   Do not rerun cleanup after entering a smoke-test hire date.
8. Resume normal operations and restore application DB access.

No production operation is performed by the coding session. Operators execute
this procedure with a verified backup and maintenance boundary.

## Dry run and execution

Run `scripts/employee-hire-date-legacy-assessment.sql` after migrations in the
paused window. It is read-only: save the employee IDs/dates and the two counts.
A populated receipt means cleanup already completed; stop, even if new dates
now exist. This is expected after cutover.

Use a dedicated MySQL 8.0+ client session with autocommit enabled and no open
transaction. Do not use `mysql --force`. Set these inputs, replacing example
values with the dry-run counts, operator and verified backup reference:

```sql
SET time_zone = '+00:00';
SET @operator_email = 'deployment-operator@example.org';
SET @verified_backup_reference = 'release-record/verified-backup-id';
SET @expected_employee_count = 123;
SET @expected_clear_count = 120;
SET @cutover_deadline_utc = UTC_TIMESTAMP(3) + INTERVAL 30 MINUTE;
SET @employee_writes_paused = 1;
SET @apply_employee_hire_date_remediation = 1;
SOURCE scripts/employee-hire-date-legacy-remediation.sql;
```

The script defaults both gates to 0 when unspecified and fails closed on missing
inputs, an expired deadline, wrong schema/engine, unexpected counts, SQL errors,
warnings or a completed receipt. On success it prints `COMPLETED`, employee,
cleared and audit counts and the UTC completion timestamp. On failure it raises
a SQL error and automatically rolls back the data transaction; there is no manual
COMMIT decision. If a failed CALL leaves the helper procedure installed, rerunning
the script replaces that helper; the durable receipt is never removed.

```sql
SELECT COUNT(*) AS employees, COUNT(hireDate) AS remaining_hire_dates
FROM employees;
SELECT id, completedAt, operatorEmail, backupReference, employeeCount, clearedCount
FROM employee_hire_date_cutover;
SELECT entityId, userEmail, createdAt, details
FROM audit_logs
WHERE entityType = 'Employee'
  AND JSON_UNQUOTE(JSON_EXTRACT(details, '$.metadata.reason')) = 'legacy_hire_date_cutover';
```

## Atomicity, audit and protection of new dates

The SERIALIZABLE transaction reserves receipt ID 1, captures all employee IDs,
original hire dates and updatedAt values, and locks the complete employee cohort
and key gaps. It clears only non-null dates from that snapshot and sets updatedAt
explicitly to one UTC timestamp. Already-null employees are untouched. No profile,
ID, createdAt or relationship is changed. Expected snapshot counts, inserted audit
counts, actual audit counts, update counts, remaining dates and total employees
are validated before COMMIT. Any validation/audit/update failure rolls back the
receipt, employee changes and audit rows together.

Each changed employee receives an existing EMPLOYEE_UPDATE audit with original
date, null result, employee identity, operator email, database actor, timestamp
and backup reference. The receipt durably retains the complete original snapshot
and operator/backup/count metadata. This small one-row record is necessary because
normal audit logs expire after 90 days. It has no application workflow. Restrict
access to its personal data and keep the backup under the normal retention policy.

Receipt ID 1 is a database primary key and singleton CHECK. Concurrent/repeated
cleanup attempts fail before modifying employees. The receipt survives audit
retention, application deployments and reinstalls of the helper procedure.
Never delete/truncate the receipt or bypass it. A retry after a genuine rollback
is safe only before normal writes resume, after another dry run.

Post-cutover dates are protected by completing cleanup before the new app accepts
dates, keeping writes paused through deployment, and permanently refusing a
second cleanup. This is a controlled release boundary, not a timestamp heuristic
or UI flag. The script cannot prove an external backup was restored or writers
were stopped; those are required operator checks.

## Rollback and recovery

Schema DDL is separate from the cleanup transaction. Prefer application rollback
with the nullable DATE column and receipt retained. Never populate dates to force
a NOT NULL rollback. The old DATETIME precision is recoverable only from backup.
If cleanup fails, verify the SQL error and unchanged rows/absence of a receipt;
resolve the failure before retrying inside maintenance.

After successful cleanup, do not rerun it or automatically restore historical
untrusted dates. For operational recovery, use the verified backup or receipt
snapshot in an isolated database first. Any approved production restoration must
preserve dates entered after cutover and must be separately audited; do not apply
a blanket restore over a running application. Retain receipt ID 1 even after an
application rollback.

## Application contract and verification

POST accepts optional `hireDate: YYYY-MM-DD | null`; omitted stores null. PATCH
omitted leaves unchanged, null clears, a valid date sets/replaces. Unchanged edit
dates are omitted. Invalid/ambiguous dates are rejected. CSV aliases are
`วันที่เริ่มงาน`, `hireDate`, `hire_date`; blank/missing dates store null.
Unknown dates display `ไม่ระบุ` / `ยังไม่ทราบ`. Calendar tenure is derived on the
Thailand date; future dates show zero elapsed tenure. Status implies no end date.
Desktop/mobile and exports use the shared calculation.

For executable cleanup regression coverage, create an empty isolated MySQL DB
whose name ends in `_hire_date_cutover_test` and run:

```powershell
$env:TEST_DATABASE_URL = 'mysql://test-user:test-password@127.0.0.1:3310/employee_hire_date_cutover_test'
node scripts/test-employee-hire-date-cutover.mjs
```

The test refuses other database names and existing fixture tables. It applies
the actual schema SQL and cleanup procedure to isolated fixtures, exercises
failure/rollback, counts, audit, identity preservation and rerun protection, then
removes only its fixture objects. It never uses the production DATABASE_URL.
