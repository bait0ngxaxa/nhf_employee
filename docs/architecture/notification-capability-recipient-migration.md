# Phase 13A / 13A.1 / 13A.2 — Capability-Based Notification Recipient Policy Migration

Phase 13A aligns notification audiences with the post-12H role-neutral business
authorization model. Phase 13A.1 hardens that implementation for production
rollout and malformed persisted authorization configuration. Phase 13A.2
contracts the Routine reminder recipient persistence vocabulary.

The capability-based recipient policy and Routine enum contraction are
implemented. H2B / Phase 13A.2 is CLOSED in the repository. Production rollout
still requires the read-only collision preflight below to return zero rows.

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

During Phase 13A.1 the Prisma/MySQL persistence enum intentionally accepted both
the canonical values and the two legacy persisted values:

```text
ADMINS
ASSIGNEES_AND_ADMINS
```

The historical expand migration only widened the MySQL enum. It did not rewrite
rows. The H2A.1-compatible production runtime writes and reads canonical values
and does not require legacy values to remain present.

H2B / Phase 13A.2 is CLOSED. Migration
`20260923120000_contract_routine_reminder_recipient_scope` maps persisted rows:

```text
ADMINS                  → ALL_READERS
ASSIGNEES_AND_ADMINS    → ASSIGNEES_AND_ALL_READERS
```

The migration first inserts every current unique key into a temporary table
using the canonical mapping. Its unique key matches
`(taskId, daysBefore, channel, recipientScope)`, so any synonym collision fails
before reminder rows change. After backfill, a second temporary-table guard
fails if any legacy value remains. Only then does MySQL contract the enum to
exactly `ASSIGNEES`, `ALL_READERS`, and `ASSIGNEES_AND_ALL_READERS`. The
migration updates only `recipientScope`; it does not recreate or delete rules,
tasks, occurrences, assignees, or audit rows.

Prisma and application reads/writes now use exactly the canonical values.
`recipient-scope-compatibility.ts` and its tests were removed. The request
schema continues to reject both legacy strings. Reminder semantics are
unchanged: `ASSIGNEES` follows Routine relationships, `ALL_READERS` resolves
explicit `routine.task.read / ALL` grants, and the combined scope is their
deduplicated union. No Routine reminder audience is inferred from `Role.ADMIN`.

### H2B production preflight and deployment

Run these read-only queries on production before `prisma migrate deploy`:

```sql
SELECT
    @@GLOBAL.sql_mode AS `globalSqlMode`,
    @@SESSION.sql_mode AS `sessionSqlMode`;
```

Confirm both results include `STRICT_TRANS_TABLES` or `STRICT_ALL_TABLES`.
MySQL 8 defaults to strict mode; with strict mode disabled, an invalid ENUM
write can be coerced to MySQL's special empty error value instead of rejected.
See the [MySQL 8.0 ENUM](https://dev.mysql.com/doc/refman/8.0/en/enum.html)
and [SQL mode](https://dev.mysql.com/doc/refman/8.0/en/sql-mode.html)
references. Do not deploy if the application sessions do not use strict mode.

```sql
SELECT
    `recipientScope`,
    COUNT(*) AS `count`
FROM `routine_reminder_rules`
GROUP BY `recipientScope`
ORDER BY `recipientScope`;
```

```sql
SELECT
    `taskId`,
    `daysBefore`,
    `channel`,
    CASE `recipientScope`
        WHEN 'ADMINS' THEN 'ALL_READERS'
        WHEN 'ASSIGNEES_AND_ADMINS' THEN 'ASSIGNEES_AND_ALL_READERS'
        ELSE `recipientScope`
    END AS `canonicalScope`,
    COUNT(*) AS `cnt`
FROM `routine_reminder_rules`
GROUP BY `taskId`, `daysBefore`, `channel`, `canonicalScope`
HAVING COUNT(*) > 1;
```

The deployment gate is zero collision rows. If collisions exist, STOP: do not
migrate or automatically reconcile them. Review the rule IDs and all rule
fields for each colliding `(taskId, daysBefore, channel, canonicalScope)` group
and make an explicit production data decision first. Legacy row counts may be
non-zero; H2B backfills them after the migration guard passes.

To list the conflicting rule identities and data for review:

```sql
WITH canonicalized AS (
    SELECT
        `id`,
        `taskId`,
        `daysBefore`,
        `sendHour`,
        `channel`,
        `recipientScope`,
        CASE `recipientScope`
            WHEN 'ADMINS' THEN 'ALL_READERS'
            WHEN 'ASSIGNEES_AND_ADMINS' THEN 'ASSIGNEES_AND_ALL_READERS'
            ELSE `recipientScope`
        END AS `canonicalScope`,
        `isActive`,
        `createdAt`,
        `updatedAt`
    FROM `routine_reminder_rules`
), collisions AS (
    SELECT `taskId`, `daysBefore`, `channel`, `canonicalScope`
    FROM canonicalized
    GROUP BY `taskId`, `daysBefore`, `channel`, `canonicalScope`
    HAVING COUNT(*) > 1
)
SELECT
    rules.`id`,
    rules.`taskId`,
    rules.`daysBefore`,
    rules.`sendHour`,
    rules.`channel`,
    rules.`recipientScope`,
    rules.`canonicalScope`,
    rules.`isActive`,
    rules.`createdAt`,
    rules.`updatedAt`
FROM canonicalized AS rules
INNER JOIN collisions
    USING (`taskId`, `daysBefore`, `channel`, `canonicalScope`)
ORDER BY
    rules.`taskId`,
    rules.`daysBefore`,
    rules.`channel`,
    rules.`canonicalScope`,
    rules.`id`;
```

The deployed H2A.1-compatible process writes only canonical scopes, reads
canonical scopes, and does not need legacy rows. The deployment order is:

```text
existing H2A.1-compatible process
        ↓
prisma migrate deploy (H2B backfill and enum contraction)
        ↓
build / reload the application
```

This invariant applies to the deployed compatible process, not arbitrary older
application versions. H2A remains CLOSED. The rollback floor remains
`099dc0ade8b114c40096cebe0e63c92b1ffc00e9` or a newer H2A.1-compatible release
that does not consume removed Routine Import persistence and writes canonical
recipient scopes. Do not lower that floor.

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
