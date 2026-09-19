# NHF Employee — Phase 12H-E: Production Team/Grant Preparation and Effective-Access Reconciliation

Status: **COMPLETE for target-readiness implementation and repository
verification**. Production operational gates are **NOT RUN**.

Baseline: `0ac8d1bcb30e23b96c413c5166bb833954a3484b`
(`fix(auth): clear stale leave recovery assignments`)

Phase 12H-D is accepted and closed. This phase prepares and validates the
target production configuration model. It does not perform production
enforcement cutover, live canary execution, or production data mutation.

## Target authority model

The readiness report is explicitly labeled:

```text
Authority model: ROLE_NEUTRAL_TARGET
```

The target model separates authentication/system identity from business
capability authority:

```text
trusted User context + channel + domain/resource relationships
  -> role-neutral Default Domain Policy
  + active Team / TeamRole / exceptional direct User grants
  -> effective business access
```

`systemRole = ADMIN` remains trusted identity and control-plane metadata. It
does not manufacture business capability authority in this readiness model.
The preflight report also states that current production runtime may still use
the temporary ADMIN compatibility seam, so a readiness report cannot be read as
evidence that production has already cut over.

## Role-neutral configured reconciliation

An active, non-deleted persisted User participates in configured authority
regardless of whether the system role is `USER` or `ADMIN`. The readiness
accumulator uses the same rules for both roles:

- active Team membership plus an active Team grant;
- active Team membership plus an active, same-Team TeamRole and TeamRole grant;
- active direct User capability grant, except direct User `TEAM` scope remains
  invalid because it has no originating Team.

The unique configured authority identity is:

```text
userId + capabilityKey + scope
```

Each entry retains source provenance from `TEAM:<teamId>`,
`TEAM_ROLE:<teamRoleId>`, and/or `USER:<userId>`. Multiple active configured
sources for the same identity remain a `REDUNDANT_CONFIGURED_AUTHORITY`
warning; no precedence or DENY behavior was introduced. The readiness summary
also exposes `effectiveConfiguredAuthorityCount`, which is distinct from
persisted grant row counts.

The obsolete `ADMIN_PERSISTED_GRANT_REDUNDANT` finding is no longer part of the
current readiness contract. An ADMIN direct grant is a legitimate configured
business grant. Whether a proposed grant is redundant is determined from the
target effective-access result, including Default Domain Policy and all
configured sources, not from `systemRole`.

All existing fail-closed validation remains active: missing or inactive Team
and TeamRole references, Team/TeamRole origin mismatch, invalid membership or
User references, unknown capabilities, unsupported scopes, non-grantable
capabilities, malformed duplicate rows, User/Employee lifecycle findings, and
direct User `TEAM` scope remain validated with their established blocker or
warning semantics. Department is not used to infer Team membership or
capabilities.

## Target hypothetical canary resolution

The readiness/canary snapshot now uses the existing Phase 12H-B
`createRoleNeutralAuthorizationResolver()` factory. This is an in-memory
hypothetical resolver only. It does not replace:

- the exported `authorization` singleton;
- `createAuthorizationResolver()`;
- current production domain adapters;
- `composeLegacyAdminCompatibleAuthorizationAuthority()`.

For target canary inspection, configured decisions therefore contain only
Team, TeamRole, or User provenance. An ADMIN actor carries `systemRole: ADMIN`
as identity metadata, but the target resolver cannot add a `SYSTEM_ROLE`
grant. The existing Administration effective-access provider and domain-owned
inspectors remain authoritative for before/after scopes, Default Domain
Policy, context, channel, and domain clamps. No second policy engine was
created.

An ADMIN direct User canary can pass when the User is active, has an active
linked Employee, and the proposed grant adds genuinely new target effective
authority. If Default Domain Policy or another configured source already
provides equivalent or broader effective authority, the canary is blocked with
`CANARY_NO_EFFECTIVE_AUTHORITY_CHANGE`. It is not rejected because of implicit
ADMIN/SYSTEM_ROLE authority.

Direct User canaries retain `observerUserId === targetId`. Team and TeamRole
canaries still require an active member who can establish the normal workforce
session. The generic business-capability observer predicate is identical for
USER and ADMIN:

```text
active User + active linked Employee + Employee not deleted/suspended
```

Established domain-specific account-only compatibility paths remain in the
runtime adapters where required; they are not used as a generic production
canary shortcut.

## Default-policy parity and capability coverage

The target regression proof compares otherwise equivalent USER and ADMIN
actors with the same trusted context, channel, and empty configured snapshot.
Their target effective scopes are identical for representative defaults:

| Capability | USER | ADMIN |
| --- | --- | --- |
| `employee.read` | `ALL` | `ALL` |
| `stock.catalog.read` | `ALL` | `ALL` |
| `leave.request.read` | `OWN` | `OWN` |
| central-only capabilities such as `audit.read`, `leave.recovery.manage`, and `email.request.read` | unavailable | unavailable |

Routine LIFF channel/default clamping remains domain-owned and is covered by
the existing effective-access reconciliation test. The current registry has
all 41 capabilities accounted for, with no `DEFERRED` administration status
and no capability returned to `DEFERRED`.

## Control-plane boundary

Authorization Administration remains ADMIN-only. This phase does not
role-neutralize:

- `app/api/authorization/administration/**`;
- the Authorization Administration page;
- Team, TeamRole, membership, or grant mutation APIs.

Business-authority parity must not grant normal USER control-plane access.

## Production data and operational boundary

`AUTHORIZATION_SEED_CONFIGURATION` remains empty. This phase creates no
production Team, TeamRole, membership, or capability grant; it does not invent
business mappings, seed, backfill, normalize, remove, or mutate production
authorization rows; and it does not add a schema migration.

The production preflight remains read-only. The following gates remain
**NOT RUN** because no explicitly authorized production target or live canary
was supplied:

- production migration/inventory readback;
- zero-blocker production preflight decision;
- operator-approved business target and canary execution;
- production Administration mutation and audit evidence;
- post-canary effective-access/API verification;
- rollback or observation-window evidence.

The next phase is **12H-F — Presentation/route role-authority removal**.
Phase 12H-G remains responsible for the later production enforcement cutover;
12H-H/I remain responsible for live rollout validation and compatibility-debt
removal.

## Verification evidence

The focused Phase 12H-E readiness suite passed:

```text
npm.cmd run test:run -- modules/authorization/application/production-readiness.test.ts
PASS — 1 file / 67 tests
```

The related authorization/domain regression selection passed:

```text
npm.cmd run test:run -- modules/authorization/application/production-readiness.test.ts modules/authorization/application/resolver.test.ts modules/authorization/application/composition.test.ts modules/authorization/application/administration.test.ts modules/authorization/registry.test.ts modules/authorization/application/seed.test.ts modules/employee/application/authorization.test.ts modules/routine/application/authorization.test.ts modules/stock/application/authorization.test.ts modules/leave/application/authorization.test.ts modules/audit/application/authorization.test.ts __tests__/services/email-request/authorization.test.ts
PASS — 12 files / 306 tests
```

The broader repository suite also passed:

```text
npm.cmd run test:run
PASS — 326 files / 3,091 tests
```

Additional repository checks passed during implementation:

- `npm.cmd run typecheck`
- `npm.cmd run lint:strict`
- `npm.cmd run architecture:check` — 1,147 source files checked
- `git diff --check`

No development server or production build is required solely for this phase,
and no live production preflight was run.
