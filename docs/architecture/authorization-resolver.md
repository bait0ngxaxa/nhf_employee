# NHF Employee — Centralized Authorization Resolver

Status: Phase 3 complete. This document describes the resolver introduced
after the Phase 1 capability contract and Phase 2 authorization persistence.
It extends, and does not replace, the current behavior record in
[authorization-current-state.md](./authorization-current-state.md), the
capability contract in [authorization-contract.md](./authorization-contract.md),
the persistence boundary in [authorization-persistence.md](./authorization-persistence.md),
or the repository module rules in [module-boundaries.md](./module-boundaries.md).

Phase 3 makes authorization resolution operational and independently testable.
It does not migrate any existing route, service, Dashboard guard, or LIFF
guard. Routine remains the planned Phase 4 pilot.

## Public API

The server/application entry point is `@/modules/authorization`:

```ts
import { authorization } from "@/modules/authorization";

const decision = await authorization.resolve(actor, "routine.task.read");
const allowed = await authorization.can(actor, "routine.task.read");
const required = await authorization.require(actor, "routine.task.read");
const scopes = await authorization.getScopes(actor, "routine.task.read");
```

All four methods use the same authoritative resolution implementation.
`require()` returns the successful `AuthorizationDecision`; on denial it
throws `AuthorizationDeniedError`. The error has no HTTP status or transport
behavior. `AuthorizationConfigurationError` is reserved for invalid persisted
configuration or an unsupported resolver contract and is allowed to propagate
from detailed resolution.

The module also exposes `createAuthorizationResolver()` for a narrow registry
and persistence-port test seam. The default `authorization` instance uses the
code-owned `CAPABILITY_REGISTRY` and the internal Prisma resolution adapter.
Raw Prisma delegates and the adapter are not part of the public module API.

## Decision and grant contracts

`AuthorizationDecision` contains:

```ts
interface AuthorizationDecision {
    capability: string;
    allowed: boolean;
    scopes: readonly AuthorizationScope[];
    grants: readonly EffectiveAuthorizationGrant[];
    reason?:
        | "UNKNOWN_CAPABILITY"
        | "CHANNEL_NOT_SUPPORTED"
        | "NO_APPLICABLE_GRANT";
}
```

The decision carries the requested string so an unknown request can be
reported as a deterministic deny. Every grant in a successful decision has a
capability key validated by the supplied registry and a supported scope.

`EffectiveAuthorizationGrant` is:

```ts
interface EffectiveAuthorizationGrant {
    capability: CapabilityKey;
    scope: AuthorizationScope;
    source: AuthorizationGrantSource;
    constraint?: { teamId: number };
}
```

Sources are stable identity records, not display names:

```ts
type AuthorizationGrantSource =
    | { type: "SYSTEM_ROLE"; role: "ADMIN" }
    | { type: "TEAM"; teamId: number }
    | { type: "TEAM_ROLE"; teamId: number; teamRoleId: number }
    | { type: "USER"; userId: number };
```

`TEAM` grants always carry both `source.teamId` and
`constraint.teamId`. A TeamRole grant carries its owning Team and role IDs.
No Routine, Stock, Leave, Employee, workflow, or resource object is included.

## Resolution algorithm

Resolution proceeds in this order:

1. Look up the requested capability in `CAPABILITY_REGISTRY` (or the injected
   registry). An unknown key returns deny with `UNKNOWN_CAPABILITY` and does
   not query persistence.
2. Check the actor's `DASHBOARD`, `LIFF_SELF_SERVICE`, or `SYSTEM` channel
   against the registered capability. A mismatch returns deny with
   `CHANNEL_NOT_SUPPORTED`, for both `USER` and `ADMIN`.
3. For `ADMIN`, resolve from the registered capability definition only. No
   Team, TeamRole, membership, or User grant is required or consulted.
4. For `USER`, load only authorization configuration for the actor and the
   requested capability, validate each applicable persisted grant against the
   registry, and form the additive union of all applicable sources.
5. Sort grants by source type and stable numeric IDs, normalize scopes, and
   default to deny when no valid applicable grant remains.

The resolver never performs authentication or account/workforce lifecycle
checks. Its caller must provide an `AuthorizationActor` after the appropriate
authentication and account/workforce boundary. This precondition does not
mean a grant can revive an invalid actor. Domain modules must still enforce
resource relationships, workflow state, business rules, transactions, and
concurrency protection after this decision.

## USER semantics and lifecycle filtering

For a normal `USER`, effective grants are the union of:

```text
active Team membership grants
    UNION
active TeamRole grants through an active Team membership and active role
    UNION
direct User grants for actor.userId
```

Every active Team membership is considered; there is no primary-Team or
Department fallback. An inactive Team contributes neither Team nor TeamRole
authority. An inactive TeamRole contributes no role grants, but does not erase
Team-level grants from the same active Team. A direct User grant does not
require membership.

TeamRole names and keys have no authorization meaning by themselves. A role
contributes only rows in `TeamRoleCapabilityGrant`.

## ADMIN semantics

After capability registration and channel validation, `ADMIN` is allowed from
the registered capability definition and does not need persisted grants. If a
capability supports `ALL`, the resolver emits an ADMIN `ALL` grant and the
normalized scopes are `["ALL"]`. If `ALL` is not supported, it emits the
registered non-`TEAM` scopes. A capability whose only usable scope is the
origin-bound `TEAM` scope raises `AuthorizationConfigurationError` with
`UNSUPPORTED_ADMIN_TEAM_SCOPE`; the resolver never invents a Team origin.

ADMIN is authorization authority only. It does not bypass authentication,
account/workforce lifecycle, channel restrictions, resource relationships,
workflow state, domain validation, transactions, or concurrency rules.

## Scope normalization and TEAM origin

The detailed `grants` and normalized `scopes` are intentionally separate.
Scope output removes duplicates and uses the contract order. `ALL` subsumes
all narrower scopes in `scopes`, while every source grant remains in `grants`
for explanation. Thus multiple Team grants with the same scope remain
explainable by their separate Team IDs.

`getScopes()` returns only normalized scope names. It cannot represent the
different origins of multiple `TEAM` grants. Code that must build a Team
resource predicate must consume `resolve().grants` and use each grant's
`constraint.teamId`; translating a scope into a domain predicate remains the
domain module's responsibility.

The persisted direct User model has no Team-origin column. A direct User
`TEAM` grant therefore raises `AuthorizationConfigurationError` with
`DIRECT_TEAM_SCOPE_REQUIRES_ORIGIN`; it never infers a Team from membership,
Department, hierarchy, or employee data.

## Invalid configuration

The persistence adapter stores only the requested capability's rows, but the
pure evaluator validates every supplied row that is applicable to the actor
and active source. Unknown persisted capability keys and unsupported scopes
raise `AuthorizationConfigurationError`. They cannot become an allow result,
and no scope is trimmed or converted to `ALL`.

Team and TeamRole source IDs are checked against the membership origin before
an effective grant is constructed. Mismatched origin data raises a typed
configuration error rather than producing unconstrained Team authority.

## Persistence query strategy

`infrastructure/persistence/authorization-resolution-repository.ts` is a
narrow read adapter. It performs a bounded set of Prisma reads:

- direct User grants filtered by `userId` and capability key;
- memberships filtered by `userId` and active Team, selecting only Team IDs,
  Team lifecycle/role metadata, and matching Team grants; and
- matching TeamRole grants filtered to active roles belonging to an active
  Team with a membership for the actor.

The first two reads run concurrently. The role-grant read uses the active
role IDs from the membership result, so inactive roles are excluded at query
time without excluding the membership's Team-level grants. No per-Team or
per-grant query, cache, business-resource query, Department lookup, or raw
Prisma delegate is exposed.

## Phase boundary

No production feature calls this resolver in Phase 3. Existing
`requireAdminSession`, `requireApiSession`, `isAdminRole`, Routine/Stock/Leave
helpers, Dashboard guards, and LIFF guards remain unchanged. No Team/grant
administration API or UI, explicit deny model, authorization cache, or audit
mutation workflow is introduced. Phase 4 will decide how the Routine pilot
adapts existing authentication, domain predicates, and business invariants to
this resolver; it is not part of this implementation.
