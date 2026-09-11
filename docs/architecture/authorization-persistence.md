# Authorization Persistence — Phase 2

Status: Phase 2 complete. This document records the persistence boundary for
the authorization configuration model. It extends, and does not replace,
[authorization-current-state.md](./authorization-current-state.md) and
[authorization-contract.md](./authorization-contract.md). Module ownership and
dependency rules remain defined by [module-boundaries.md](./module-boundaries.md).

## Scope and ownership

The database is the source of truth for Teams, TeamRoles, memberships, and the
three additive grant sources. The code-owned
`CAPABILITY_REGISTRY` remains the source of truth for capability keys, domains,
channels, and supported scopes.

`Team` is an independent authorization/work grouping. It is not a Department,
department name, employee hierarchy, job title, or system role group. Phase 2
contains no Department-to-Team mapping and no automatic membership derivation.

The persistence implementation is owned by `modules/authorization/`:

- `application/grant-validation.ts` is the registry-backed grant validation
  boundary.
- `application/seed.ts` owns the deterministic, configuration-driven seed
  orchestration.
- `infrastructure/persistence/authorization-repository.ts` owns the narrow
  Prisma upsert adapters used by that seed orchestration.

The public module entry exports the Phase 1 contracts/registry, the grant
validator, and the seed entry point. It does not expose a generic Prisma CRUD
facade or persistence delegates.

## Persisted model

The six models are mapped to dedicated tables:

| Model | Ownership and identity |
| --- | --- |
| `Team` | Global stable `key`, display fields, `isActive`, timestamps |
| `TeamRole` | Belongs to one Team; stable `key` is unique within that Team; has `isActive` and timestamps |
| `TeamMembership` | Composite identity `(teamId, userId)`; optional role from the same Team |
| `TeamCapabilityGrant` | Team-owned `(teamId, capabilityKey, scope)` grant |
| `TeamRoleCapabilityGrant` | Role-owned `(teamRoleId, capabilityKey, scope)` grant |
| `UserCapabilityGrant` | User-owned `(userId, capabilityKey, scope)` exceptional grant |

Capability keys and scopes are stored as strings. They are deliberately not
Prisma enums, so adding a registered capability does not require a database
enum migration. The grant tables contain additive ALLOW configuration only;
there is no `DENY`, effect, priority, precedence, policy JSON, wildcard, or
scope-collapsing behavior.

## Constraints and indexes

- `Team.key` is globally unique.
- `TeamRole` has `@@unique([teamId, key])`, so the same role key can exist in
  different Teams.
- `TeamMembership` has composite primary key `@@id([teamId, userId])`, which
  prevents duplicate membership in one Team.
- Each grant table has a composite primary key over its source identity,
  capability key, and scope. Different supported scopes for one capability can
  coexist.
- Membership lookup is supported by `(userId, teamId)`, `(teamId, teamRoleId)`,
  and `teamRoleId`; active Team and TeamRole lookup is supported by
  `isActive` and `(teamId, isActive)` indexes. Grant primary keys support
  source-first lookups, and role grants also have a `(capabilityKey, scope)`
  index for later registry/resolution queries.

`TeamRole` also has `@@unique([teamId, id])`. Although `id` is the primary key,
Prisma/MySQL requires a referenced composite key for the same-Team membership
foreign key.

## Referential integrity and lifecycle

The membership role relation uses the composite foreign key
`(teamId, teamRoleId) -> TeamRole(teamId, id)`. Therefore a non-null role on a
membership must belong to the same Team at the database level; a role from
another Team is rejected. The ordinary Team, User, and grant foreign keys are
also enforced.

All new authorization foreign keys use `ON DELETE RESTRICT` and
`ON UPDATE CASCADE`. This is intentionally conservative: hard deletion of a
Team, role, User, or referenced authorization source is blocked while
dependent configuration exists. Later administration flows can disable a Team
or role with `isActive = false` and preserve stable identity for audit/history.

`Team` and `TeamRole` have `createdAt`, `updatedAt`, and `isActive` because
their lifecycle includes rename/update and disable/archive behavior. Membership
and grant rows are current configuration records without invented soft-delete
columns. No broad cascade is used for authorization configuration.

## Grant validation

Every grant definition accepted by the Phase 2 application boundary passes
`validateCapabilityGrant({ capabilityKey, scope })` before persistence. The
validator:

1. checks the key with `isRegisteredCapabilityKey` and reads its definition
   from `CAPABILITY_REGISTRY`;
2. rejects an unknown key; and
3. rejects a scope that is not in that registered capability's supported
   scopes.

It does not trim, normalize, fall back to `ALL`, merge scopes, or resolve
effective permissions. The persisted repository adapters accept only the
validated grant type, so future authorization administration application code
must cross the same validator before calling them through an owned use case.

## Seed and migration compatibility

`AUTHORIZATION_SEED_CONFIGURATION` is intentionally empty because the closed
architecture/current-state records contain no approved production mapping from
Departments, users, manager relationships, positions, or existing `USER` /
`ADMIN` roles to Teams or grants. The existing `prisma/seed.ts` invokes the
authorization seed boundary, but it creates no Team, membership, role grant,
Team grant, or direct user grant today.
All seed operations use the shared `@/lib/db/prisma` client, and the seed
entrypoint disconnects that single client on completion or failure.

If an approved configuration is added later, the mechanism is deterministic and
idempotent: it validates all references and grants before writing, upserts only
explicitly configured records in stable array order, does not delete unknown
records, and does not create direct grants for every existing user. Re-running
it cannot fabricate a policy or remove manually managed records outside the
owned configuration.

The migration
`20260911100000_add_authorization_persistence` adds only the six authorization
tables, their keys/indexes, and required foreign keys. Current route
authorization continues to use the existing `ADMIN`/`USER` behavior; the new
tables are not authoritative until a later phase.

## Auditability

Phase 2 adds no administration routes and no audit workflow. Future Team,
TeamRole, membership, and grant mutation services should append events through
the existing public `modules/audit` contract, using the stable Team/TeamRole
IDs and the natural composite grant identity in event details. Transactional
authorization writes should keep the audit write in the same transaction when
the existing Audit contract requires it. No duplicate audit store or sensitive
audit columns are introduced here.

## Phase 3 boundary

Phase 3 may consume active memberships and the three grant sources together
with the Phase 1 registry. It will decide effective resolution, ADMIN
semantics, default deny, scope merging, and source explanation. None of those
behaviors, nor `authorization.can()`, `authorization.require()`,
`authorization.resolve()`, caching, feature-route migration, or Team
administration UI/API, is part of this persistence phase.
