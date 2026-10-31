# Phase B verification evidence

This document records the B1–B4 baseline at `a645d37a`. The initial manual setup
instructions in this historical record are superseded by
[B5/B6 annual defaults](leave-holiday-defaults.md); see that document for the
current workflow and activation sequence.

All database checks used `integration.env` and the repository runner against the
dedicated local MySQL integration database. No production/staging deployment,
calendar seed, migration, or reconciliation was performed.

## Final command results (31 October 2026)

| Command | Result |
| --- | --- |
| `npm run typecheck` | PASS, including final fixture cleanup guard types |
| `npm run lint` | PASS; focused ESLint also passed for the subsequent Audit and test-runner/fixture changes |
| `npm run architecture:check` | PASS, 1,394 source files |
| `npm test` (final confirmation) | PASS, 415 files; 4,137 tests passed and 1 existing Windows skip (4,138 total) |
| `npm run test:integration:mysql` (final confirmation) | PASS, 27 files / 226 tests; migration SQL coverage and `migrate deploy` verification included |
| `npx prisma validate` / `npx prisma generate` | PASS for the final schema |
| Impeccable mechanical detector | PASS, no findings on the changed UI targets |
| `git diff --check` and staged UTF-8 validation | PASS; no replacement characters in the 51 staged implementation/test/documentation files |

## Behavior evidence

| Requirement | Executed coverage |
| --- | --- |
| Annual drafts, add/edit/remove, duplicates, invalid/wrong-year dates, required citations | `modules/leave/domain/holiday-calendar.test.ts`, `modules/leave/presentation/calendar/import.test.ts`, `modules/leave/__tests__/integration/holiday-calendar.integration.test.ts` |
| Current active ADMIN, USER/unauthenticated denial, deleted/inactive accounts, LIFF separation | `modules/leave/application/calendar/authorization.test.ts`, `__tests__/api/leave-calendar.test.ts`, real MySQL calendar tests |
| Immutable versions and ledger, same-year FKs, SQL CHECK/unique enforcement, concurrent publication | `holiday-calendar.integration.test.ts`, `calendar-reconciliation.integration.test.ts`; actual direct forbidden database writes are rejected |
| Weekday/weekend/holiday, boundaries, full/half days, cross-year, Bangkok instants, Thai year display | `modules/leave/domain/calendar-calculation.test.ts`, calendar Dashboard tests, `calendar-calculation.integration.test.ts` |
| Fail-closed enforced mode and explicit legacy setup mode | `modules/leave/application/calendar/calculation.test.ts`, `calendar-calculation.integration.test.ts` |
| Same Dashboard/LIFF projection and server-only final calculation | `calendar-projection.test.tsx`, shared application previews compared with real MySQL in `calendar-calculation.integration.test.ts` |
| Publication/submission race, stored calculation/approval versions, idempotent replay and unchanged outbox event counts | `calendar-calculation.integration.test.ts` runs concurrent real transactions and checks the persisted version/duration pair |
| Phase A complementary half days, same-slot/full-day conflicts, cancellation-requested occupancy | Existing `leave-overlap-cancellation.integration.test.ts` plus calendar-enforced complementary-period regression; domain overlap tests unchanged |
| Unaffected pending approval, changed duration/invalid endpoints block approval, owner cancel/resubmit | `calendar-calculation.integration.test.ts`; original request facts are asserted unchanged |
| Draft impact without writes, full-range impact, keyset pagination, terminal adjustment history | `calendar-reconciliation.integration.test.ts`, `CalendarImpactReview.test.tsx` |
| Added/removed holidays, stale charge/version, explicit reason/confirmation, two-ADMIN concurrency, hash-safe retry | `calendar-reconciliation.integration.test.ts`; one ledger row persists and the second identical confirmation replays |
| No over-refund | A 6-unit approved request becomes 4 units; cancellation and not-taken each restore only 4. Sequential revisions reconcile 6→4→0, then cancellation restores zero. `charged-units.test.ts` also covers the 4→2 example and invalid/negative units |
| Preserve original request details/duration/approval/version and support legacy NULL charges | Real MySQL assertions in `calendar-reconciliation.integration.test.ts`; no backfill modifies legacy business facts |
| Forward carry and over-quota rules | PERSONAL/VACATION refunds increase existing future carry by the refund while preserving future usage; SICK stays zero carry. Both current-year and future-only extra exposure require special ADMIN justification |
| Atomic rollback | An injected final Audit persistence failure rolls back current usage, future carry, net request charge and ledger; actual MySQL assertions verify all persisted values |
| Published-only USER reads, ADMIN-only history even through generic Audit | Published projection tests, Audit query/API tests, and real MySQL generic Audit reads show zero calendar-control rows for USER while ADMIN can read them |
| Reports/export and user history | Report model tests compare original requested days with adjusted effective charge; existing report/export, Dashboard and LIFF tests pass their focused runs |
| Test cleanup safety | `calendar-cleanup-guard.test.ts` rejects production runtime, non-test database names, real calendar years and external references before opening the cleanup connection; combined Calendar/Stock/system-role tests verify fixture isolation |

There is no submitted-request Edit endpoint. New writes are calendar drafts,
publication and charge reconciliation only. Existing leave decision/cancellation/
not-taken resource authorization remains in place; ADMIN is not a business grant.

## Verification process and resolved failures

The first full `npm test` run returned **413 files passed / 1 failed**, with
**4,130 tests passed / 1 failed / 1 skipped**. The failure was the exhaustive Audit
registry test: the three new actions lacked presentation/filter metadata. The
registry was fixed without changing the test expectation. Audit query privacy
was additionally enforced for calendar events; the focused Audit selection
passed **18 tests**, and real MySQL verified the USER/ADMIN read distinction.

The first full MySQL run returned **23 files passed / 4 failed**, with
**184 tests passed / 42 failed**. Root causes were persisted calendar fixture
accounts affecting global cleanup/last-ADMIN tests and draft-source validation
being added during that run. Calendar fixtures now have guarded per-file disposal,
and publication validates persisted entries again. The combined Calendar, Stock,
and system-role selection then passed **5 files / 71 tests**; Routine/Calendar
isolation also passed. The final full MySQL run passed **27 files / 226 tests**,
including the existing migration SQL coverage and `migrate deploy` verification
with 85 migrations registered and no pending migrations.

The initial B1 development migration attempt also caught MySQL error 3823:
`YEAR(date) = year` CHECK cannot coexist with that FK's UPDATE CASCADE. RESTRICT
was verified directly, the verified-empty new test tables were recovered, and
the corrected migration successfully deployed before B1 was committed.

Full suites were used after stabilization. Failures were grouped and reproduced
with focused commands; no business assertion, authorization check or database
immutability trigger was weakened. A second full confirmation was justified by
the corrected shared Audit read boundary and the integration fixture isolation
change. `npm run test:integration:mysql -- <file.integration.test.ts> ...` now
supports focused files while retaining the same environment and safety guards.

## Operational limits

- One existing IT attachment symlink test is skipped on Windows by its existing
  `skipIf(process.platform === "win32")` condition.
- No production build, development server, browser E2E, physical LINE-device
  acceptance or production deployment was run. UI behavior was checked with DOM
  tests; persistence, transactions and concurrency were checked against MySQL.
- No real holiday dates were imported. ADMIN must supply/review verified dates
  and publish the organization calendar before enabling enforcement on all
  application instances. See `leave-holiday-calendar.md` for activation,
  correction, monitoring and the charge-aware rollback floor.
- Prisma emits its existing `package.json#prisma` deprecation warning. No Prisma
  or unrelated dependency upgrade was performed.
