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

1. Prepare and verify the release artifact, including this CLI, its SQL artifact,
   Node.js and installed dependencies (`mysql2` is a production dependency, with
   its existing version retained so `npm ci --omit=dev` includes the driver).
2. Create a production backup and verify it can be restored to an isolated DB.
   Retain its identifier and verification results in the release record.
3. Enter a controlled maintenance window. Stop all app instances, imports,
   scheduler jobs, integrations and other employee writers; drain in-flight requests. Restrict
   database write access to the cutover operator until step 11. A CLI flag
   acknowledging this pause does not enforce it; operators must actually stop
   the writers. No new real hire dates may be entered before cleanup finishes.
4. Apply Prisma migrations, including the nullable DATE and receipt migrations.
5. Run `npm run employee:hire-date:assess`.
6. Review the reported counts and intended `host:port/database` target.
7. Run `npm run employee:hire-date:cutover -- --apply ...` with all gates below.
8. Run `npm run employee:hire-date:verify` before entering new dates. Require
   `CUTOVER_VERIFIED` and zero current dates at this immediate boundary. Check
   IDs/profiles/relationships against the backup and retain receipt/audit evidence.
9. Deploy/start the new application version before exposing it to normal users.
10. Smoke test omitted/null/date creation, unrelated edits, setting/changing/
   clearing dates, tenure, and CSV import/export with an authorized test account.
   Do not rerun cleanup after entering a smoke-test hire date.
11. Resume normal operations and restore application DB access.

Steps 3–8 are for this initial cutover only. Do not attach cleanup to ordinary
future deployment automation. The permanent receipt prevents repeat cleanup.

No production operation is performed by the coding session. Operators execute
this procedure with a verified backup and maintenance boundary.

## Dry run and execution

```sh
npm run employee:hire-date:assess
npm run employee:hire-date:cutover
```

Both commands are read-only. Cutover without `--apply` prints a dry-run summary
and never creates a procedure or writes records. A receipt means cleanup already
completed, even if dates are now populated. Do not repeat it.

Actual execution (replace the target with the exact sanitized identifier printed
by assess; one line works in PowerShell, WSL, Linux and a Node-enabled container):

```sh
npm run employee:hire-date:cutover -- --apply --operator="deployment-operator@example.org" --backup-ref="release-record/verified-backup-id" --confirm-writers-paused --confirm-target="127.0.0.1:3308/employee_nhf"
npm run employee:hire-date:verify
```

Missing/blank operator, backup reference, paused-writers acknowledgment or target
confirmation fails nonzero before connecting. Unknown, malformed and duplicate
options are rejected; no force/skip option exists. `--help` on any command explains
the flags without connecting. The pause flag is an acknowledgment, not proof that
application instances, schedulers or integrations stopped. No individual HR review
is required.

The CLI obtains fresh counts after acquiring its setup lock, inside the same
operator-enforced paused-write window. Operators never type expected counts.
Earlier dry-run counts are advisory. SQL independently locks/snapshots the cohort
and refuses count mismatches, automatically rolling back. The CLI does not apply
migrations or retry any CALL. Its post-CALL checks validate the receipt, original
snapshot, audit evidence and zero dates before reporting success.

Verification is read-only and reports `CUTOVER_NOT_COMPLETED` (exit 1),
`CUTOVER_VERIFIED` (exit 0), `CUTOVER_VERIFIED_WITH_NEW_DATES` (exit 0) or
`VERIFICATION_FAILED` (exit 1). After normal operations resume, populated dates
are expected; a valid receipt/audit establishes historical cleanup. Current counts
need not equal receipt counts because employees can be added/deleted later.
Missing/inconsistent audits fail verification conservatively. Audit retention
deletes old rows after 90 days, so retain release evidence; an incomplete-audit
result later requires archive review, NEVER another cleanup. The durable receipt
continues to prevent reruns regardless of live audit availability.

## Connection and procedure lifecycle

The CLI loads `.env*` using the existing Next environment precedence from the
repository root, independent of the working directory. Process environment wins.
It uses `DATABASE_URL`, or `EMPLOYEE_HIRE_DATE_DATABASE_URL` when explicitly set
for a privileged cutover account. An invalid/empty dedicated value never falls
back to DATABASE_URL. Verify that this target is the same database used by Prisma
and the application; CLI target confirmation is independent of NODE_ENV. Output
contains host/port/database, never credentials or the full URL.

MySQL 8 is required. Prisma connection_limit/pool_timeout parameters are accepted
but unused by the dedicated session; connect_timeout is supported (1–60 seconds).
TLS accepts sslaccept=strict and sslcert (PEM CA), with certificate and server
identity verification enabled. Relative certificate paths resolve from the
repository. PKCS12 sslidentity/sslpassword are unsupported by this CLI/driver path;
they and other unsupported parameters, including accept_invalid_certs, fail
closed instead of silently dropping client identity or disabling TLS. Use a
compatible, explicitly selected operator URL. Omit TLS options only for an
intentionally local/protected connection.

One mysql2/promise connection sets UTC, installs the known procedure, sets all
session variables and a server-side 30-minute deadline, invokes CALL once,
validates completion and closes in finally. Multiple statements are disabled.
Only the exact known DELIMITER wrapper is accepted; the CLI extracts CREATE
PROCEDURE, never sends DELIMITER/SOURCE or splits statements on semicolons.
The SQL file remains the authoritative transaction/audit implementation.

A database-scoped MySQL advisory lock serializes CLI setup through teardown.
The CLI checks for an existing named routine and refuses to overwrite it. It
creates without OR REPLACE/IF NOT EXISTS, and drops only after this session
successfully created it. CREATE/DROP are DDL outside the data transaction and
require routine privileges. Use a short-lived privileged account with SELECT,
INSERT, UPDATE, CREATE TEMPORARY TABLES, CREATE ROUTINE, ALTER ROUTINE and EXECUTE
access to the target database. Receipt uniqueness remains the final one-time gate.

On a lost connection, the CALL may have committed without an acknowledgment.
No automatic retry occurs. Keep writers paused, run verify with a fresh session,
and have a DBA inspect any leftover routine before another apply. A CREATE whose
acknowledgment was lost may also leave a routine; the CLI will not claim ownership
or silently replace it. Errors suppress raw connection strings/SQL; safe driver
codes are included for diagnosis. Failure to remove a routine/close resources
also returns nonzero. Do not run the manual SQL wrapper concurrently with the CLI.

## SQL troubleshooting evidence

The assessment SQL is retained as an optional read-only detailed ID/date report.
The remediation SQL's session gates and handler remain available for DBA forensic
review. The npm CLI is the normal execution path; do not SOURCE the wrapper to
bypass routine ownership checks or manually commit an uncertain transaction.
The original schema migration discards time; the verified pre-migration backup
retains original DATETIME precision.

```sql
SELECT COUNT(*) AS employees, COUNT(hireDate) AS remaining_hire_dates
FROM employees;
SELECT id, completedAt, operatorEmail, backupReference, employeeCount, clearedCount
FROM employee_hire_date_cutover;
SELECT entityId, userEmail, createdAt, details
FROM audit_logs
WHERE entityType = 'Employee'
  AND CASE WHEN JSON_VALID(details) THEN JSON_UNQUOTE(JSON_EXTRACT(details, '$.metadata.reason')) END
      = 'legacy_hire_date_cutover';
-- Only if a routine remains after failure; inspect before any DBA-owned removal:
SHOW CREATE PROCEDURE clear_legacy_employee_hire_dates;
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
