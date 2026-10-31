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

## Shared calculation and controlled activation

`LEAVE_HOLIDAY_CALENDAR_ENABLED` is a **server-only** rollout switch. Absent or
`false` means setup mode: existing weekday behavior continues, previews and the
calendar page label this explicitly. Only literal `true` enables enforcement;
malformed values fail rather than silently disabling it. Publish verified 2026
and any upcoming 2027 calendars before enabling this switch on all application
instances together. After activation, a missing published year blocks new requests
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
