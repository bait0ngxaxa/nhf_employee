# Employee Hire Date Migration Assessment

## Decision

The schema migration is prepared, but production cutover is **not ready** until an
authorized HR operator reviews every populated legacy hire date against a
trusted employment record and approves the resulting keep or clear decisions.
The application has no verification flag, so any non-null value exposed by the
new UI is treated as a known hire date.

No production database was inspected or changed for this implementation.

## Evidence found

- The Employee model has used hireDate DateTime @default(now()) since the
  initial Employee schema migration. The database migration created it as
  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3).
- Before this feature, manual creation and CSV import persistence omitted
  hireDate. MySQL therefore filled it from the database default.
- Historical application revisions contain the same database default and use
  hireDate for display/export, but no historical Employee create or import
  path was found that explicitly supplied a genuine employment date.
- The edit form contained an empty hireDate value, but its API mutation did not
  persist it. Existing Employee create/update audit producers also omitted
  hireDate.
- Consequently, application history and current audit records cannot establish
  which populated values are genuine. Matching hireDate to createdAt is a
  useful candidate signal, not proof; differing values are not proof of
  verification either.

## Migration behavior

The migration changes only employees.hireDate from DATETIME to nullable DATE.
It removes the implicit creation-time default and preserves each existing
calendar date as stored, while discarding its time component. It does not clear
or rewrite employee rows. New application create and import paths explicitly
write NULL when no date is supplied.

Apply the migration through the normal Prisma migration workflow. Do not use
db push. The schema remains compatible with the prior application for the
short cutover window: old creates omit the field, and a nullable column with no
default receives NULL.

## Application contract

- `POST /api/employees` accepts `hireDate` as an optional `YYYY-MM-DD` string
  or `null`. Omitting it stores `NULL`; the server never substitutes
  `createdAt` or the current date.
- `PATCH /api/employees/:id` treats an omitted field as unchanged, `null` as an
  explicit clear, and a valid `YYYY-MM-DD` string as a set or replacement.
- Invalid calendar dates and non-ISO date strings are rejected by the shared
  validation schema. CSV import accepts `วันที่เริ่มงาน`, `hireDate`, and
  `hire_date`; its sample leaves dates blank, and the upload guidance documents
  `YYYY-MM-DD` as the sole accepted format.
- Tenure is calculated when presented from the date-only hire date to the
  current Thailand calendar date. It is not stored. Unknown dates display as
  unknown; future dates display zero elapsed tenure until their calendar date.
  Employee status does not imply an employment end date.
- Dashboard and CSV export share the same tenure calculation. Displayed dates
  use the Thai calendar; CSV import remains Gregorian ISO date-only.

## Required operator procedure

1. Take and verify a restorable database backup. Freeze changes to employee hire
   dates for the review window.
2. Run the read-only report in
   scripts/employee-hire-date-legacy-assessment.sql against the target database.
   Retain its output in the approved change record. Restrict access because it
   contains employee names and dates.
3. Have an authorized HR reviewer compare every non-null date with an
   authoritative employment record. Record employee ID, current date, evidence
   reference, reviewer, and the approved decision. Preserve only dates supported
   by that evidence. Approve clearing uncertain or system-generated values to
   NULL. Do not classify records solely by whether hireDate equals createdAt.
4. Apply the Prisma migration. Review the affected column definition and verify
   the migration did not alter employee IDs or relationships.
5. Before deploying the new UI, apply only the individually approved clear
   decisions in one transaction using
   scripts/employee-hire-date-legacy-remediation.sql. Populate its temporary
   table from the approved review record, set the acting operator, and inspect
   the preview while leaving the apply gate disabled. For execution, enable the
   gate in the same database session, start the transaction, and lock the
   reviewed rows. The script inserts one existing EMPLOYEE_UPDATE audit row per
   approved clear with before.hireDate, after.hireDate = null, the acting
   operator, and the approval reference. It updates only rows whose current
   date still equals the staged expected date. Compare staged, audited, and
   affected row counts; commit only when all counts match, otherwise roll back.
   Never run a table-wide clear.
6. Confirm all remaining non-null values have approved evidence, then deploy
   the application. At that point the UI may treat non-null values as known.
   New manual and CSV imports without a date will persist NULL.

If complete review is not possible, keep the feature cutover blocked. The final
schema cannot distinguish verified from unverified values after deployment.

## Rollback and recovery

The migration is backward compatible with the prior application, but data
clears cannot be reconstructed from the new schema. Preserve the backup and
approved review record until the cutover is accepted. Prefer rolling back the
application while leaving the nullable DATE column in place. Reverting to
NOT NULL would fail after NULL values exist and restoring the prior timestamp
precision would require the backup; never manufacture dates to make a schema
rollback succeed.
