# Organization holiday calendar (Phase B)

Current MVP: [built-in annual defaults and customization (B5/B6)](leave-holiday-defaults.md).
Verified 2026/2027 defaults activate automatically; the manual workflow below is
for NHF overrides or years without bundled data. No holiday API/sync infrastructure
or later B7 work is planned in this scope.

## Existing behavior and boundaries

Before Phase B, `utils.ts` counted weekdays only, creation calculated before its
transaction, and approvals charged `durationHalfDays`. Cancellation and not-taken
confirmation reversed that original duration. Reports summed original durations.
These paths must use an explicit remaining charge before calendar reconciliation
can safely refund part of an approved request. Phase A occupancy (including
complementary morning/afternoon slots and cancellation-requested blocking) is
independent of calendar arithmetic and is preserved.

Calendar administration is an Auth/control-plane operation. It uses the existing
web session ADMIN boundary and rechecks persisted role, active account and active
linked Employee under Employee-then-User locks. No business capability is added;
ADMIN gains no approval, cancellation, or recovery authority. LIFF has no
administrative calendar adapter. Submitted requests remain immutable.
The generic Audit read query also excludes all three calendar-control actions
for non-ADMIN viewers (including a USER granted `audit.read / ALL`); its viewer
comes only from the trusted server session. Omitted viewer context fails closed
for these events. ADMIN's generic Audit access still requires the existing Audit
capability; calendar-owned impact/ledger views use their independent ADMIN gate.

## Persistence and versioning

`HolidayCalendar.year` identifies the single organization calendar for a Gregorian
year. Its composite active-version FK cannot refer to another year. Versions are
numbered monotonically; one draft is allowed by the serialized application flow.
A new revision copies the active snapshot. Draft writes use a revision number;
publication also compares the expected active version. All operations lock the
annual calendar in a serializable transaction, and publication and Audit commit
together. An empty calendar requires separate explicit confirmation. Publication
requires ADMIN verification and a note. SYSTEM initialization of a verified bundled
year is the only automatic publication path, with explicit dataset/Audit provenance.

Date-only entries have a unique version/date key, same-year composite FK and
`YEAR(date) = year` CHECK. MySQL triggers reject edits, inserts and deletes against
published snapshots. Superseded versions retain their publication metadata and
remain readable. A superseded state is derived by comparing the active pointer;
no historical snapshot needs updating.

Tests use explicitly labeled synthetic dates only in a dedicated `_test` or
`_integration` database, using years 8000–9998; they are never production reference
data. A guarded test-only cleanup disposes these fixtures after each file so the
existing suites' global User/Employee cleanup cannot conflict with immutable
history FKs. It requires `NODE_ENV=test`, verifies synthetic years and creator
identities, refuses external references, and uses TRUNCATE on an isolated
connection to clear only fixture calendar tables without removing their triggers.
Related fixture requests/quotas/accounts are scoped by their test identities.
There is no corresponding production bypass or application reset command.

## Dashboard administration and initial setup

Open `/dashboard/holidays` (ปฏิทินวันหยุดองค์กร). All authenticated users can
read published dates; only current ADMIN sessions can load drafts and publication
history or mutate. `/api/leave/calendar/manage` is Dashboard session only, uses
trusted-origin/AJAX CSRF protection, bounded JSON and existing process-local
rate limiting. `/api/leave/calendar` projects published date/name/category only.
Neither endpoint accepts a client role as authority.

For 2026 or 2027, select the Gregorian year to see the effective default immediately.
ADMIN selects “ปรับแต่งวันหยุด” only when NHF needs different dates. A revision
copies the active immutable snapshot. For an unbundled year, create a draft and
add verified dates with source citations and optional notes. Bulk input accepts UTF-8 TSV copied from
a reviewed source: `YYYY-MM-DD<TAB>name<TAB>OFFICIAL|ORGANIZATION<TAB>citation<TAB>optional note`.
It validates all rows before adding any. Review and correct the draft, save,
preview the complete list and added/removed dates, enter a publication note,
confirm verification, then publish. An empty calendar needs its own confirmation.
Future years use the same workflow without redeployment. Published dates are
displayed in Thai/Buddhist Era while storage and API years remain Gregorian.

## Shared calculation and controlled activation

`LEAVE_HOLIDAY_CALENDAR_ENABLED` is a **server-only** rollout switch. Absent or
`false` means setup mode: existing weekday behavior continues, previews and the
calendar page label this explicitly. Only literal `true` enables enforcement;
malformed values fail rather than silently disabling it. Enable this switch on all
application instances together. Verified bundled 2026/2027 calendars initialize
on demand without an annual ADMIN publication. After activation, a year without
either an existing publication or a bundled dataset blocks new requests
and approval, with the Gregorian/Buddhist Era year and ADMIN setup instructions.
There is no automatic weekday fallback in enforced mode.

Creation and approval use `calculateEffectiveLeaveInTransaction()`. It locks the
annual calendar row with `FOR UPDATE` through mutation commit, using the same
serializable transaction/lock as publication. Thus a publication and submission
serialize in either order; no request can commit an old snapshot read outside its
final transaction. Existing P2034 bounded backoff handles deadlock retries. This
lock also protects first publication via the missing-year index gap. Request
idempotency is checked before calculation: retrying a successful original payload
returns that original request, even after a new publication.

The stored calculation/approval version FKs remain nullable for legacy/setup
requests. Original `durationHalfDays` is never recalculated on reads. Pending
approval recalculates the entire range, including endpoint validity. If duration
or validity differs it requires owner cancellation and resubmission. Unaffected
requests may be approved against the new version. Rejection, history, exports,
cancellation and not-taken do not require any current calendar.

Dashboard and LIFF expose read-only `/api/leave/calculation` and
`/api/line/leave/calculation` adapters to the same application preview. Preview
reads entitlement/carry without creating quota rows. Their shared form model
uses these results for duration and quota projections and labels initial weekday
estimates while loading. Final submission always calculates again on the server.
Weekend/holiday endpoints remain invalid; a fully holiday half-day is invalid;
interior holidays remove integer half-day units without double-counting weekends.

## Effective charged units and reconciliation

`LeaveRequest.durationHalfDays`, dates, period, reasons, approval timestamp and
original calculation/approval calendar references retain their historical meaning.
`chargedHalfDays` stores the current net quota charge. New PENDING requests store
zero; approval records the approved duration. Confirmed cancellation/not-taken
sets zero and refunds **only the previous remaining charge** under the existing
request lock and authorization. A fully refunded request therefore refunds zero.

Existing rows remain untouched by migration: `NULL` means derive the legacy
charge from status (`APPROVED`/`CANCELLATION_REQUESTED` = original duration,
everything else = zero). The first approval, reconciliation, or confirmed refund
persists an explicit charge. This lazy compatibility strategy does not invent
historical versions, timestamps, reasons, or approvals. Existing inconsistent
quota usage that would become negative is rejected for manual investigation.

`LeaveCalendarAdjustment` is an immutable ledger with a unique
`(leaveRequestId, calendarVersionId)` key, previous/resulting integer units,
reason, optional special justification, confirming ADMIN, timestamp, and a hash
of the confirmation. Every adjustment is computed against the **currently active
published** calendar over the complete original range, compared to the current
effective charge. A draft or superseded version cannot be applied. Approved
requests remain historically valid even if their endpoints are newly holidays;
their new net charge excludes those days, potentially reaching zero. No request
details are edited.

The Dashboard requires loading impact before publishing a saved draft when that
year has requests. With no requests, it skips impact review and the publication
transaction verifies the year is still empty; new history requires reloading and
review. Source verification, revision/active checks, note and empty confirmation
remain required. Impact is
ADMIN-only, keyset-paginated (25 requests), and shows all yearly statuses, including
terminal rows with adjustment history. Pending requests report a proposed
duration but no charge; affected ones require cancellation/resubmission. Approved
rows with changed charges await explicit reconciliation. Cancellation-requested
rows wait for the existing cancellation decision. Terminal rows remain auditable
and cannot be reconciled. When viewing the active version, added/removed holidays
are empty because it is compared to itself; request charge differences still show
all outstanding corrections.

Confirmation requires a reason, explicit consent, expected current charge and
active version ID. In a serializable transaction the application rechecks current
ADMIN, locks calendar then request, validates current status/version/charge,
updates usage and net charge, reconciles forward carry, writes ledger and Audit.
Concurrent identical confirmations commit one adjustment and replay one result;
same key with different confirmation content conflicts. Stale active versions
are rejected even for retries. A retry after cancellation/not-taken is rejected
rather than reopening a terminal request. Deadlocks use the existing bounded
P2034 retry mechanism. Failures roll back all quota, carry, request and audit writes.

Forward reconciliation preserves future usage and recalculates PERSONAL/VACATION
carry through existing quota records (including gaps). SICK remains zero carry.
Before committing an additional charge, the application compares negative-balance
exposure before/after in the current **and existing future years**. Any increase
requires the ADMIN's special justification; this never changes the submitted
request's special reason or grants leave approval authority. Each confirmation
has an independent durable result; there is no destructive bulk adjustment.

Reports/export sum effective charges for used/remaining and detail effective
days, while retaining original requested days. Recorded over-quota-at-approval
facts remain historical; later ADMIN justification is in the adjustment ledger.
Dashboard/LIFF history can show an approved request's adjusted current charge
separately from its original duration. Notifications/outbox and request-creation
idempotency retain their existing workflows and event keys.

## Deployment, activation, rollback and monitoring

1. Take the normal production backup and test restore procedure. Review migrations
   `20261031090000_organization_holiday_calendar`,
   `20261031100000_leave_calendar_calculation`, and
   `20261031110000_leave_calendar_reconciliation`, and
   `20261031120000_leave_calendar_defaults`. They add tables, nullable
   columns, FKs, indexes, CHECKs and immutability triggers, expand AuditAction, and
   never update/delete existing request or quota rows. MySQL must enforce CHECKs
   (8.0.16+) and the migration account must have CREATE TRIGGER permission.
2. In a release window, apply with the normal `prisma migrate deploy` process and
   generate the client for this schema. MySQL DDL can lock tables and is not
   transactionally rolled back; estimate `leave_requests` index/ALTER time on a
   restored production-sized database first. Do not use reset/db-push or seed.
3. Deploy **the complete B6 release** with
   `LEAVE_HOLIDAY_CALENDAR_ENABLED=false` (or unset for initial setup) on all
   instances. Do not enable B3 alone: B4 contains charge-aware reversal safety.
4. Verified 2026/2027 defaults need no ADMIN action. ADMIN can customize them
   or import a verified calendar for an unbundled year. An intentionally empty year is valid
   only after explicit confirmation. Confirm the ordinary USER view exposes only
   published date/name/category and default provenance, and ADMIN impact/history is inaccessible to USER
   and LIFF. Existing histories/refunds work without a published calendar.
5. Inspect impact for legacy/pending requests and inform owners of affected
   PENDING requests. Activate `LEAVE_HOLIDAY_CALENDAR_ENABLED=true` on **all
   instances together**, draining/replacing old/setup-mode processes to avoid
   mixed calculation policies. Smoke-test Dashboard and LIFF previews, missing
   future-year refusal, request creation, unaffected approval and affected approval
   rejection. Add a verified dataset for a future year before employees request it,
   or use ADMIN import/publication when no bundled dataset exists.
6. After each calendar publication, ADMIN selects the **active version** in impact,
   filters requests requiring action, loads every cursor page, reviews pending
   resubmission notices, and confirms approved corrections individually. Reload
   impact after interruption; already applied charges show no outstanding action.
   Review ledger/Audit (`LEAVE_CALENDAR_PUBLISH` / `LEAVE_CALENDAR_RECONCILE`),
   current quota usage and future carry. Investigate negative-usage/invariant
   failures rather than retrying with arbitrary manual SQL. Ordinary notifications
   and outbox processing continue through their established delivery path.
7. For a bad calendar, create and publish a **new corrected revision** and preview
   again. Reconcile from each request's latest net charge, never replay the original
   refund manually. Preserve the erroneous snapshot and ledger as audit evidence.
8. Do not down-migrate/drop these tables or erase ledger rows. After **any**
   reconciliation, the rollback floor is this B4 charge-aware implementation or a
   newer compatible release; B3/older reversal code can over-refund and is unsafe.
   Disabling enforcement is an explicit operational policy change to setup mode,
   not an accounting rollback: keep B4 code and historical charges. Prefer a
   maintenance window while correcting calendars over switching back to weekday
   rules. Recover failed DDL by inspecting `_prisma_migrations` and actual schema
   against the backup; use a reviewed forward repair and `migrate resolve` only
   after reconciling the applied statements. Never reset a production database.

Tests use repository `integration.env`/`TEST_DATABASE_URL` guards and a dedicated
MySQL database only. Calendar fixtures are disposed after each test file using
the additional ownership guards described above, while production immutability
triggers remain installed and are exercised again by subsequent test runs.
The first local B1 migration attempt exposed MySQL error 3823 (CHECK column with
ON UPDATE CASCADE). It was corrected to RESTRICT before commit, recovered only
the verified-empty newly created test tables, and successfully deployed/retested.
No production or staging schema/data was accessed by this implementation.
