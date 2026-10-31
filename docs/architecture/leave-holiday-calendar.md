# Organization holiday calendar (Phase B)

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

## Persistence and versioning

`HolidayCalendar.year` identifies the single organization calendar for a Gregorian
year. Its composite active-version FK cannot refer to another year. Versions are
numbered monotonically; one draft is allowed by the serialized application flow.
A new revision copies the active snapshot. Draft writes use a revision number;
publication also compares the expected active version. All operations lock the
annual calendar in a serializable transaction, and publication and Audit commit
together. An empty calendar requires separate explicit confirmation. Publication
requires ADMIN verification and a note; no reference data is seeded or published.

Date-only entries have a unique version/date key, same-year composite FK and
`YEAR(date) = year` CHECK. MySQL triggers reject edits, inserts and deletes against
published snapshots. Superseded versions retain their publication metadata and
remain readable. A superseded state is derived by comparing the active pointer;
no historical snapshot needs updating.

Tests use explicitly labeled synthetic dates only in a dedicated `_test` or
`_integration` database. Immutable calendar fixtures remain in that disposable
database, using fresh years 8000–8999; they are never production reference data.

## Dashboard administration and initial setup

Open `/dashboard/holidays` (ปฏิทินวันหยุดองค์กร). All authenticated users can
read published dates; only current ADMIN sessions can load drafts and publication
history or mutate. `/api/leave/calendar/manage` is Dashboard session only, uses
trusted-origin/AJAX CSRF protection, bounded JSON and existing process-local
rate limiting. `/api/leave/calendar` projects published date/name/category only.
Neither endpoint accepts a client role as authority.

For 2026 or 2027, select the Gregorian year, create a draft, and add verified dates
with source citations and optional notes. Bulk input accepts UTF-8 TSV copied from
a reviewed source: `YYYY-MM-DD<TAB>name<TAB>OFFICIAL|ORGANIZATION<TAB>citation<TAB>optional note`.
It validates all rows before adding any. Review and correct the draft, save,
preview the complete list and added/removed dates, enter a publication note,
confirm verification, then publish. An empty calendar needs its own confirmation.
Future years use the same workflow without redeployment. Published dates are
displayed in Thai/Buddhist Era while storage and API years remain Gregorian.
