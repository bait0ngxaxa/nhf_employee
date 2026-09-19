# NHF Employee — Centralized Authorization Resolver

> **Current repository state (Phase 12H-G):** the normal resolver factory and
> `authorization` singleton use the role-neutral configured strategy. USER and
> ADMIN load the same direct User, Team, and TeamRole persistence; ADMIN does
> not manufacture ordinary business authority. The legacy resolver/evaluator
> and composition wrapper are retained only for Phase 12H-H comparison and
> Phase 12H-I deletion. Earlier current-target notes in this historical
> document describe their original phase boundary and are not the live
> enforcement state.

Current-target note: Phase 12H-B implemented the role-neutral configured
evaluator and composition primitive, and Phase 12H-C rebaselined the covered
domain Default Domain Policies. The production-facing resolver singleton
remains on the temporary pre-12H `SYSTEM_ROLE / ADMIN` compatibility strategy;
the role-neutral target factory is application-internal and is not the
production enforcement path yet. See
[authorization-phase-12ha-role-neutral-contract.md](./authorization-phase-12ha-role-neutral-contract.md),
[authorization-phase-12hb-role-neutral-core.md](./authorization-phase-12hb-role-neutral-core.md),
and
[authorization-phase-12hc-domain-default-policy-rebaseline.md](./authorization-phase-12hc-domain-default-policy-rebaseline.md).

Phase 12H-D completed the registered deferred business capabilities without
changing the production enforcement target: `leave.recovery.manage` is a
Dashboard-only centralized recovery-entry capability, and Email Request now
uses centralized configured `OWN`/`ALL` read and `ALL` create decisions. The
production singleton still retains temporary legacy ADMIN compatibility, and
the remaining presentation/route role gates are intentionally scheduled for
Phase 12H-F. The completion record is in
[authorization-phase-12hd-missing-deferred-capability-completion.md](./authorization-phase-12hd-missing-deferred-capability-completion.md).

Status: Phase 3 complete. This document describes the resolver introduced
after the Phase 1 capability contract and Phase 2 authorization persistence.
It extends, and does not replace, the current behavior record in
[authorization-current-state.md](./authorization-current-state.md), the
capability contract in [authorization-contract.md](./authorization-contract.md),
the persistence boundary in [authorization-persistence.md](./authorization-persistence.md),
or the repository module rules in [module-boundaries.md](./module-boundaries.md).

Phase 12A permanently locks the existing no-grant USER domain behavior as
Default Domain Policy and defines future configured grants as additive
authority. The detailed inventory and historical Phase 12B composition
contract are in
[authorization-phase-12a-additive-policy-contract.md](./authorization-phase-12a-additive-policy-contract.md).
The current pure application-layer composition seam described by that contract
is in
[authorization-phase-12b-additive-composition-core.md](./authorization-phase-12b-additive-composition-core.md).
Phase 12H-B now makes that composition primitive role-neutral and adds
`createRoleNeutralAuthorizationResolver()` beside the legacy production
factory; the default resolver-level production semantics remain unchanged.
Phase 12C.1 uses that seam for Department and Notification, Phase 12C.2 uses
it for Employee, Phase 12C.3 uses it for the enforced Routine capabilities,
Phase 12C.4 uses it for the complete Stock surface, Phase 12C.5 uses it for
the complete registered Leave surface, and Phase 12D uses it for the three
remaining Routine capabilities. Phase 12H-C now rebaselines the domain
defaults, including the Routine task-read, summary, export, reference, and
LIFF narrowing rules. The remaining compatibility-backed migration set is now
empty, but the legacy ADMIN compatibility seam remains active until the
documented later cutover lifecycle.

Phase 3 made authorization resolution operational and independently testable.
The historical Phase 4 Routine pilot established the server-side seam; current
Routine policy is recorded historically in the Phase 12C.3 and Phase 12D
closures and currently in the Phase 12H-C closure. This document continues to
describe the generic resolver contract rather than Routine policy.

## Public API

The server/application entry point is `@/modules/authorization`:

```ts
import {
    authorization,
    composeAuthorizationAuthority,
} from "@/modules/authorization";

const decision = await authorization.resolve(actor, "routine.task.read");
const decisions = await authorization.resolveMany(actor, [
    "routine.task.read",
    "routine.task.create",
]);
const allowed = await authorization.can(actor, "routine.task.read");
const required = await authorization.require(actor, "routine.task.read");
const scopes = await authorization.getScopes(actor, "routine.task.read");
```

Department, Notification, Employee, Routine, Stock, Leave, Audit, and Email
Request adapters compose through the role-neutral primitive used by production
enforcement:

```ts
const configuredDecision = await authorization.resolve(actor, capability);
const authority = composeAuthorizationAuthority(
    actor,
    capability,
    defaultScopes,
    configuredDecision,
);
```

`composeAuthorizationAuthority()` is pure and has no persistence, Team,
Department, request, resource, workflow, or system-role dependency. It validates
default scopes against the supplied code-owned registry, returns normalized
effective scopes, and preserves configured grants separately from Default Domain
Policy. The legacy composition wrapper remains available only to the explicit
Phase 12H-H comparison path and is scheduled for Phase 12H-I deletion.

These methods use the same authoritative resolution implementation.
`require()` returns the successful `AuthorizationDecision`; on denial it
throws `AuthorizationDeniedError`. The error has no HTTP status or transport
behavior. `AuthorizationConfigurationError` is reserved for invalid persisted
configuration or an unsupported resolver contract and is allowed to propagate
from detailed resolution.

`resolveMany()` returns a read-only map of decisions keyed by the requested
capability. The normal production factory loads one shared resolution snapshot
for both USER and ADMIN through `repository.loadMany()` and evaluates each
capability against the relevant slice of that snapshot. Unknown capabilities
and channel denials do not trigger persistence reads. The explicitly named
legacy comparison factory retains the old ADMIN no-persistence behavior only
for Phase 12H-H snapshots. Both paths preserve single-capability evaluator
validation by isolating persisted grants per capability before evaluation.

For transaction-sensitive mutations, the public resolver also exposes
`resolveInTransaction(actor, capability, persistenceContext)`. It uses the
same registry, evaluator, grant validation, and default-deny behavior while
reading authorization persistence through the supplied transaction context.
The context is a narrow composition seam; the raw evaluator and persistence
adapter remain private.

The module exposes `createAuthorizationResolver()` and the `authorization`
singleton for the production role-neutral registry/persistence-port seam.
`createRoleNeutralAuthorizationResolver()` remains an explicit alias, while
`createLegacyAdminCompatibleAuthorizationResolver()` is comparison-only and
scheduled for Phase 12H-I deletion. The default instance uses the code-owned
`CAPABILITY_REGISTRY` and the internal Prisma resolution adapter. Raw Prisma
delegates and the adapter are not part of the public module API.

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

A grant whose scope is `TEAM` carries both `source.teamId` and
`constraint.teamId`. Team- and TeamRole-sourced grants retain their
source/origin metadata for every scope, but a non-TEAM scope does not receive
an implicit `constraint.teamId`. A TeamRole grant carries its owning Team and
role IDs. No Routine, Stock, Leave, Employee, workflow, or resource object is
included.

## Resolution algorithm

Resolution proceeds in this order:

1. Look up the requested capability in `CAPABILITY_REGISTRY` (or the injected
   registry). An unknown key returns deny with `UNKNOWN_CAPABILITY` and does
   not query persistence.
2. Check the actor's `DASHBOARD`, `LIFF_SELF_SERVICE`, or `SYSTEM` channel
   against the registered capability. A mismatch returns deny with
   `CHANNEL_NOT_SUPPORTED`, for both `USER` and `ADMIN`.
3. On the role-neutral target path, load authorization configuration for the
   actor and requested capability for both `USER` and `ADMIN`.
4. Validate each applicable persisted grant against the registry and form the
   additive union of Team, TeamRole, and direct User sources.
5. Sort grants by source type and stable numeric IDs, normalize scopes, and
   default to deny when no valid applicable grant remains.

The current production-compatible path is an explicit exception to steps 3–4:
it preserves the pre-12H ADMIN system-role decision and no-persistence behavior
until enforcement cutover. That exception is isolated in
`legacy-admin-business-authority-compatibility.ts`; it is not part of the
role-neutral evaluator.

The resolver never performs authentication or account/workforce lifecycle
checks. Its caller must provide an `AuthorizationActor` after the appropriate
authentication and account/workforce boundary. This precondition does not
mean a grant can revive an invalid actor. Domain modules must still enforce
resource relationships, workflow state, business rules, transactions, and
concurrency protection after this decision.

The no-valid-grant result above is a resolver-level result. For a normal USER
in the locked Phase 12 target, a valid resolver result is configured
authority, not a replacement for the domain's Default Domain Policy. Phase
12B must compose:

~~~text
domainDefaultPolicy + centralResolverConfiguredAuthority
~~~

as an additive union after trusted identity, registered capability, supported
channel, and valid-configuration checks. A narrower configured grant must not
narrow the default behavior. Phase 12C.1 applies this composition to Department
and Notification, Phase 12C.2 applies it to Employee, Phase 12C.3 applies it to
the enforced Routine surfaces, Phase 12C.4 applies it to Stock, and Phase
12C.5 applies it to Leave. Phase 12H-C rebaselines these domain defaults for
the current role-neutral target; its Routine narrowing decisions are recorded
in [authorization-phase-12hc-domain-default-policy-rebaseline.md](./authorization-phase-12hc-domain-default-policy-rebaseline.md).

For Employee, the permanent default is `ALL` for `employee.read`,
`employee.stats.read`, and `employee.export`, and empty for
`employee.create`, `employee.update`, `employee.delete`, and `employee.import`.
The Employee adapter uses this same composition after both the regular
resolver and `resolveInTransaction()`; ADMIN remains the resolver's
`SYSTEM_ROLE / ADMIN` authority. Routine adds a context-sensitive default policy
and a post-composition LIFF self-service channel policy while keeping this
resolver contract unchanged. Stock adds its permanent requester/catalog
defaults without the Routine LIFF ADMIN clamp. Leave adds its permanent
request/approval/cancellation/not-taken defaults without changing the
resolver's system-role or channel semantics. The next runtime handoff is
Phase 12H-D — Missing/deferred capability completion; production enforcement
still intentionally remains on the legacy compatibility path until Phase
12H-G.

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

On the role-neutral target path, ADMIN has no implicit configured authority.
With no applicable persisted grant it receives `NO_APPLICABLE_GRANT`; with the
same trusted identity/resource context and persisted data as USER it receives
the same decision and source provenance. A target ADMIN decision never contains
a `SYSTEM_ROLE` grant.

The existing `SYSTEM_ROLE / ADMIN` decision, including its registered-scope
calculation and `UNSUPPORTED_ADMIN_TEAM_SCOPE` validation, is retained only in
the explicitly named temporary compatibility seam. It remains authority only
within the current production path and does not bypass authentication,
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

The existing scope-array projection is not sufficient for the future composed
result when a domain resource predicate needs the originating Team. Phase 12B
retains source/origin metadata for every Team/TeamRole-sourced grant and
retains a Team resource constraint only when the grant scope is TEAM, alongside
normalized scope semantics.

The Phase 12B composition result therefore exposes the exact resolver decision
and a read-only configured-grant collection alongside `defaultScopes` and the
final normalized `scopes`. Scope normalization may collapse several configured
grants to one `ALL` or `TEAM` scope, but it never removes their source, origin,
or trusted Team constraint metadata.

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
narrow read adapter. Single-capability resolution performs a bounded set of
Prisma reads, and `loadMany()` performs the same set once for all requested
capabilities:

- direct User grants filtered by `userId` and capability key;
- memberships filtered by `userId` and active Team, selecting only Team IDs,
  Team lifecycle/role metadata, and matching Team grants; and
- matching TeamRole grants filtered to active roles belonging to an active
  Team with a membership for the actor.

For a batch request, each grant query uses the requested capability-key set,
so a USER projection needs one direct-grant read, one membership read, and at
most one TeamRole-grant read rather than one set per capability.

The first two reads run concurrently. The role-grant read uses the active
role IDs from the membership result, so inactive roles are excluded at query
time without excluding the membership's Team-level grants. No per-Team or
per-grant query, cache, business-resource query, Department lookup, or raw
Prisma delegate is exposed.

## Phase 12A and later boundary

Phase 12A adds no resolver or domain runtime behavior. It records the
permanent Default Domain Policy and the current inventory. Phase 12B provides
additive composition. Phase 12C.1 has migrated Department + Notification,
Phase 12C.2 has migrated Employee, Phase 12C.3 has migrated the enforced
Routine capabilities, Phase 12C.4 has migrated all seven Stock capabilities,
Phase 12C.5 has migrated all eight registered Leave capabilities, and Phase
12D has migrated Routine export, summary, and reference to that composition.
Email Request and the future IT module remain outside that roadmap.

## Phase boundary

The Phase 4 pilot is historical; current Routine, Stock, and Leave server-side
capability composition is recorded in the Phase 12C.3, Phase 12C.4, Phase
12C.5, and Phase 12D closure records. The existing
`requireAdminSession`, `requireApiSession`, `isAdminRole`, Dashboard guards,
and LIFF guards outside the migrated Routine/Stock/Leave call chains remain
unchanged. No Team/grant administration API or UI,
explicit deny model, authorization cache, or audit mutation workflow is
introduced. Routine-specific scope translation, channel/resource policy, and
transaction composition are documented in
[authorization-phase-12c3-routine-additive-migration.md](./authorization-phase-12c3-routine-additive-migration.md);
Stock composition, requested-view semantics, LIFF processor behavior and
transaction lifecycle are documented in
[authorization-phase-12c4-stock-additive-migration.md](./authorization-phase-12c4-stock-additive-migration.md);
Leave default composition, effective-approver semantics, and transaction
lifecycle are documented in
[authorization-phase-12c5-leave-additive-migration.md](./authorization-phase-12c5-leave-additive-migration.md);
Routine deferred capability migration is recorded in
[authorization-phase-12d-routine-deferred-migration.md](./authorization-phase-12d-routine-deferred-migration.md);
the pilot remains the historical record of the earlier deferred boundaries.

## Phase 12H-G production cutover

The previous phase-boundary notes in this document are historical. The live
repository semantics are now:

- `createAuthorizationResolver()` and `authorization` use the role-neutral
  configured evaluator and load persistence for USER and ADMIN alike;
- normal adapters use `composeAuthorizationAuthority()` and retain default
  policy, configured source, Team origin, channel, and fail-closed semantics;
- `createLegacyAdminCompatibleAuthorizationResolver()`,
  `evaluateLegacyAuthorization()`, and
  `composeLegacyAdminCompatibleAuthorizationAuthority()` are comparison-only
  Phase 12H-H debt scheduled for Phase 12H-I deletion; and
- the resolver does not infer authority from `systemRole`, Team name, Role
  name, Department, or an implicit ADMIN bundle.

The production resolver/evaluator/composition regression and the remaining
comparison debt are recorded in
[authorization-phase-12hg-enforcement-cutover-security-regression.md](authorization-phase-12hg-enforcement-cutover-security-regression.md).
