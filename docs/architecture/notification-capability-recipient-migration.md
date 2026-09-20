# Phase 13A — Capability-Based Notification Recipient Policy Migration

Phase 13A closes the remaining mismatch between the post-12H role-neutral
business authorization model and notification recipient selection.

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
returns deterministic, deduplicated User IDs. The composite TeamRole relation
continues to fail closed for an invalid cross-Team membership.

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

The persisted and public Routine enum is now:

```text
ASSIGNEES
ALL_READERS
ASSIGNEES_AND_ALL_READERS
```

The MySQL migration expands the enum, remaps existing `ADMINS` and
`ASSIGNEES_AND_ADMINS` rows, then contracts the enum. It does not delete or
recreate tasks, occurrences, or reminder rules.

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

Phase 13A verification covers the Authorization lookup, Stock audience and
dedupe behavior, Routine enum/recipient/dispatch behavior, Email Request
capability audience, and the existing outbox processor. MySQL integration
coverage exercises Team, TeamRole, direct User, lifecycle, invalid relationship,
scope, capability, ADMIN-without-grant, and duplicate-origin cases when the
dedicated integration database is available.

Executed evidence for this closure:

- focused recipient/Stock/Routine/Email/outbox tests: **137 tests passed**;
- repository suite: **334 files / 3,144 tests passed**;
- MySQL migration + integration suite: **18 files / 112 tests passed**;
- `npm.cmd run lint:strict`: passed;
- `npm.cmd run typecheck`: passed;
- `npm.cmd run architecture:check`: passed, 1,161 source files checked;
- `npx.cmd prisma generate` and `npx.cmd prisma validate`: passed;
- `git diff --check`: passed.

Intentional role-based behavior remains only in authentication and
Authorization Administration/control-plane flows. Requester-owned Stock result
notifications and Leave notification policies are outside this migration and
retain their existing domain semantics.
