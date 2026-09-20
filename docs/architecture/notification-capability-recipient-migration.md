# Phase 13A / 13A.1 — Capability-Based Notification Recipient Policy Migration

Phase 13A aligns notification audiences with the post-12H role-neutral business
authorization model. Phase 13A.1 hardens that implementation for production
rollout and malformed persisted authorization configuration.

The business recipient migration is implemented. Routine enum contraction is
intentionally deferred to a follow-up release because the production database
and all deployed application versions cannot be proven from this repository to
be ready for contraction.

## Why this changed

Routine and Stock previously used `Role.ADMIN` as a business notification
audience, while Email Request used `EMAIL_REQUEST_INAPP_RECIPIENT_EMAILS`.
Those were independent sources of truth after Phase 12H removed implicit ADMIN
business authority. Notification recipient selection now uses the configured
business capability that represents the responsibility being notified.

## Recipient mappings

| Event | Old policy | Current policy |
| --- | --- | --- |
| Stock new request | `Role.ADMIN` | `stock.request.process / ALL` |
| Stock requester cancellation | `Role.ADMIN` | `stock.request.process / ALL` |
| Stock low stock | `Role.ADMIN` | `stock.inventory.manage / ALL` |
| Routine broad reminder | `ADMINS` | `ALL_READERS` = `routine.task.read / ALL` |
| Email Request new request | `EMAIL_REQUEST_INAPP_RECIPIENT_EMAILS` | `email.request.read / ALL` |

Routine `ASSIGNEES` remains relationship-driven. `ASSIGNEES_AND_ALL_READERS`
is the deduplicated union of the relationship audience and configured broad
readers. A broad reader uses the Dashboard destination; an assignee retains the
existing LIFF/self-service destination where applicable.

## Authorization lookup boundary

Authorization exposes the narrow server-side contract
`findActiveUsersWithConfiguredCapabilityScope`. It enumerates only explicit
configured grants from:

- `TeamCapabilityGrant` through an active Team membership and active Team;
- `TeamRoleCapabilityGrant` through an active same-Team TeamRole membership,
  active TeamRole, and active Team; and
- `UserCapabilityGrant`.

The lookup also requires an active, non-deleted User, validates the capability
against the registered capability catalog, validates the requested scope, and
returns deterministic, deduplicated User IDs. The repository loads configured
resolution data in a bounded set-based operation; the application lookup then
evaluates each principal with `evaluateConfiguredAuthorization`, including
scope normalization and persisted-origin validation. A principal whose
configured state raises `AuthorizationConfigurationError` is excluded and a
warning records the capability, user, and error code. Other valid principals
remain eligible. The composite TeamRole relation continues to fail closed for
an invalid cross-Team membership.

This is not a generic “who can perform this capability?” API. It intentionally
does not evaluate Default Domain Policy, resource relationships, or the
`CREATED`/`ASSIGNED` Routine defaults. In particular, the default
`routine.task.read → CREATED + ASSIGNED` policy does not qualify a user for
`ALL_READERS`; only an explicit configured `routine.task.read / ALL` grant does.

Business modules retain ownership of the meaning of each audience. The
Notification module only persists Inbox commands, and the Outbox/provider
layers retain asynchronous delivery, retry, event-key, dedupe, and supersede
behavior.

## Routine vocabulary and lifecycle

The canonical public/business Routine enum remains:

```text
ASSIGNEES
ALL_READERS
ASSIGNEES_AND_ALL_READERS
```

During Phase 13A.1 the Prisma/MySQL persistence enum intentionally accepts both
the canonical values and the two legacy persisted values:

```text
ADMINS
ASSIGNEES_AND_ADMINS
```

The expand migration only widens the MySQL enum. It does not rewrite rows and
does not contract the enum. Prisma Client temporarily includes both sets of
members so transition code can read old rows safely. New create/update/import
boundaries accept canonical values only and therefore write only canonical
values.

At the persistence boundary, legacy values normalize immediately:

```text
ADMINS                  → ALL_READERS
ASSIGNEES_AND_ADMINS    → ASSIGNEES_AND_ALL_READERS
```

Routine scheduler, reminder dispatch, query serialization, and persisted
import-row parsing operate on the canonical values after normalization. The
legacy token is never interpreted as `User.role === ADMIN`.

The later `Phase 13A.2 — Routine Recipient Enum Contract` must, in an
explicitly controlled rollout, verify that no old process remains, backfill
remaining legacy rows, verify zero legacy rows, and only then contract the
MySQL/Prisma enum. It must not delete or recreate tasks, occurrences, or
reminder rules.

Rollback implication: the expanded database is compatible with the old client
while persisted rows remain legacy. Once a canonical-only application writes a
canonical value, rollback to an old client that knows only the legacy enum is
not supported. Deployment must therefore expand the database first, drain old
processes before canonical writes, and treat post-write rollback as a forward
compatibility decision rather than an automatic old-binary rollback.

Routine resolves the configured broad audience at enqueue time. Email and LINE
child deliveries re-check the current recipient condition inside the existing
serializable dispatch transaction. A revoked `routine.task.read / ALL` grant
therefore supersedes a stale broad-recipient child before a provider call.
Current assignee/lifecycle validation remains in place for assignee deliveries.

## Stock and Email Request boundaries

Stock per-user Inbox recipients now use the Stock responsibility capabilities.
The existing Stock LINE broadcast/provider contract is intentionally unchanged:
channel configuration, broadcast behavior, provider keys, payloads, retries,
and delivery guarantees remain separate from per-user Inbox audience lookup.

Email Request no longer reads or documents the
`EMAIL_REQUEST_INAPP_RECIPIENT_EMAILS` environment variable. Historical request
rows, ownership, persistence, and the existing Email Request outbox/processor
flow remain unchanged.

## Regression guard and evidence

The architecture check scans only the production recipient-policy surfaces for
reintroduction of `Role.ADMIN`, `role === "ADMIN"`, or `role: "ADMIN"`; other
authentication/control-plane role usage remains allowed.

Phase 13A.1 adds coverage for legacy scope normalization, canonical writes,
expanded enum state, mixed valid/malformed grants, invalid direct `TEAM` scope,
and valid peers surviving an isolated malformed principal. MySQL integration
coverage exercises actual legacy/canonical enum writes and reads, Team,
TeamRole, direct User, lifecycle, invalid relationship, scope, capability,
ADMIN-without-grant, duplicate-origin, and malformed-grant cases when the
dedicated integration database is available.

Executed evidence for this closure:

- focused Authorization/Routine tests: **11 files / 169 tests passed**;
- focused Stock/outbox regression tests: **6 files / 108 tests passed**;
- repository suite: **335 files / 3,153 tests passed**;
- MySQL migration + integration suite: **18 files / 113 tests passed**;
- `npm.cmd run lint:strict`: passed;
- `npm.cmd run typecheck`: passed;
- `npm.cmd run architecture:check`: passed, 1,163 source files checked;
- `npx.cmd prisma generate` and `npx.cmd prisma validate`: passed;
- `git diff --check`: passed.

The original Phase 13A migration was found in the current repository history,
but no production migration table, deployment pipeline record, or production
database access is present in the repository. Production deployment therefore
cannot be identified from repository evidence. The migration is kept in the
expand-only state in this release; contraction is explicitly deferred rather
than claimed safe.

Intentional role-based behavior remains only in authentication and
Authorization Administration/control-plane flows. Requester-owned Stock result
notifications and Leave notification policies are outside this migration and
retain their existing domain semantics.
