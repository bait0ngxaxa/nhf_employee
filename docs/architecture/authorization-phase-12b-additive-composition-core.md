# NHF Employee — Authorization Phase 12B: Additive Authorization Composition Core

Status: CLOSED — reusable composition primitive and contract tests

Starting commit: `8e975a5c10d4df57566e18ceab639369afad523a`
(`docs(auth): clarify Team origin and TEAM scope constraints`)

Phase 12A contract:
[authorization-phase-12a-additive-policy-contract.md](./authorization-phase-12a-additive-policy-contract.md)

Date: 2026-09-16

## 1. Scope

Phase 12B implements and proves the generic additive composition primitive
required by the Phase 12A contract. It does not migrate a production domain
adapter. The implementation is deliberately limited to:

- a pure application-layer composition function;
- a public type/result seam for future domain adapters;
- default-scope validation against the code-owned capability registry;
- additive scope normalization using the existing canonical normalizer;
- preservation of configured resolver decisions and grant provenance; and
- focused contract tests for USER, ADMIN, structural denial, configuration,
  capability, TEAM-origin, and immutability behavior.

The implementation does not query Prisma, Teams, Departments, managers,
resources, requests, query parameters, HTTP bodies, or domain repositories.

## 2. Composition primitive

The public application seam is:

```ts
composeAuthorizationAuthority(
    actor,
    capability,
    defaultScopes,
    configuredDecision,
    registry?,
): ComposedAuthorizationAuthority
```

`configuredDecision` must already be the result of the central resolver (or a
valid equivalent from its evaluator test seam). The optional registry exists
for the same narrow testability seam as the resolver; production code uses the
code-owned `CAPABILITY_REGISTRY`.

The result contains:

```ts
interface ComposedAuthorizationAuthority {
    readonly capability: string;
    readonly allowed: boolean;
    readonly scopes: readonly AuthorizationScope[];
    readonly defaultScopes: readonly AuthorizationScope[];
    readonly configuredDecision: AuthorizationDecision;
    readonly configuredGrants: readonly EffectiveAuthorizationGrant[];
}
```

`defaultScopes` is the normalized domain-provided baseline. `scopes` is the
normalized final authority. `configuredDecision` is retained as the exact
resolver result, and `configuredGrants` is a read-only copy of its grant
collection. No grant is manufactured for Default Domain Policy.

## 3. Resolver boundary remains unchanged

The central resolver continues to mean configured/system-role authority:

```text
SYSTEM_ROLE authority for ADMIN
    OR
applicable TEAM grants
    OR
applicable TEAM_ROLE grants
    OR
applicable direct USER grants
```

It does not receive domain default scopes and does not know Employee,
Department, Routine, Stock, Leave, Notification, relationship, resource,
workflow, query, or transaction policy. In particular, a normal USER with no
configured grants still receives resolver-level:

```text
allowed: false
reason: NO_APPLICABLE_GRANT
```

That result is not changed into a final domain denial inside the resolver. A
future migrated domain adapter composes it with its own trusted default policy.

The Phase 12B public seam is therefore:

```text
domain derives trusted default scopes/context
        |
        v
authorization.resolve(...)
        |
        v
composeAuthorizationAuthority(...)
        |
        v
domain resource/query/relationship/workflow policy
```

No `DEFAULT_POLICY` value was added to `AuthorizationGrantSource`, and no
fake `EffectiveAuthorizationGrant` represents default authority.

## 4. USER truth table

For a normal USER, the composer validates the registered capability and its
default scopes, then applies:

```text
effective authority
= normalized(default policy scopes UNION configured decision scopes)
```

The exact contract cases are:

| Default scopes | Resolver decision | Effective result |
| --- | --- | --- |
| empty | `NO_APPLICABLE_GRANT` | denied, empty scopes |
| `OWN` | `NO_APPLICABLE_GRANT` | allowed, `OWN` |
| empty | configured `ALL` | allowed, `ALL` |
| `CREATED + ASSIGNED` | configured `CREATED` | `CREATED + ASSIGNED` |
| `CREATED` | configured `ASSIGNED` | `CREATED + ASSIGNED` |
| `OWN` | configured `ALL` | `ALL` |
| `ALL` | configured narrower scope | `ALL` |
| any valid default | multiple Team/TeamRole/User grants | additive normalized union |

The existing `normalizeAuthorizationScopes()` function remains the single
scope-ordering implementation. It removes duplicates, preserves canonical
ordering, and gives `ALL` subsuming semantics. A narrower configured grant can
never narrow a non-empty default.

## 5. Configured provenance and TEAM safety

The composer carries every configured grant through unchanged. This keeps the
following distinctions available to downstream domain policy:

```text
TEAM source:
{ type: "TEAM", teamId }

TEAM_ROLE source:
{ type: "TEAM_ROLE", teamId, teamRoleId }
```

A configured grant whose scope is `TEAM` already has the trusted originating
Team constraint from the evaluator:

```text
constraint: { teamId: originatingTeamId }
```

Scope normalization can reduce multiple TEAM grants to one normalized `TEAM`
scope, or reduce `ALL` plus narrower scopes to `ALL`; it never removes the
configured grant collection or its provenance.

For a non-TEAM Team or TeamRole grant, Team source/origin remains descriptive
provenance only. Composition does not synthesize `constraint.teamId`. A grant
such as Team 10 / `ALL` therefore remains Team-sourced `ALL` without a Team
resource predicate. Only the actual configured `TEAM` scope carries that
constraint.

Default Domain Policy cannot create origin-bound TEAM authority. An input
containing originless default `TEAM` is rejected with
`AuthorizationConfigurationError` code
`DEFAULT_TEAM_SCOPE_REQUIRES_ORIGIN`. No default Team, Department mapping,
manager mapping, or membership lookup is introduced.

## 6. Structural denial and configuration behavior

Only a valid USER resolver result with reason `NO_APPLICABLE_GRANT` may allow
the default policy to contribute authority. The composer never treats
`!configuredDecision.allowed` as equivalent to that reason.

These remain denied even with non-empty default scopes:

- `UNKNOWN_CAPABILITY`;
- `CHANNEL_NOT_SUPPORTED`;
- an unqualified/other denial; and
- any invalid registered-capability boundary.

The composer does not catch evaluator/resolver failures. Existing
`AuthorizationConfigurationError` values such as unknown persisted
capabilities, unsupported persisted scopes, direct User TEAM without origin,
Team origin mismatch, TeamRole origin mismatch, and membership mismatch still
propagate before composition. Default scope/capability invariant failures
introduced at this seam use:

- `CAPABILITY_MISMATCH` when the requested and configured decision identities
  differ;
- `UNSUPPORTED_DEFAULT_SCOPE` when a default scope is not registered for the
  capability; and
- `DEFAULT_TEAM_SCOPE_REQUIRES_ORIGIN` for originless default TEAM.

No structural failure is recovered as an allow.

## 7. ADMIN behavior

ADMIN is not composed as USER default policy plus configured grants. After the
existing resolver has validated capability and channel, the composer branches
to ADMIN before any USER-only default-scope validation, preserves the
resolver's system-role authority, and ignores USER default policy. A valid
ADMIN result remains sourced from `SYSTEM_ROLE / ADMIN`; Team membership and
persisted TeamRole/User grants are neither required nor used. Structural
channel/capability denial remains denied, and existing lifecycle, resource,
workflow, validation, transaction, and concurrency boundaries remain outside
this primitive.

The composer does not manufacture a Default Domain Policy grant for ADMIN.

## 8. Capability and catalog readiness

Default scopes are checked against the supplied registered capability
definition. The composer does not duplicate capability definitions or alter
execution-channel validation. The resolver's channel decision remains
authoritative before composition.

Phase 12B does not activate any capability for administration and does not
change the catalog classification:

| Classification | Count | Readiness |
| --- | ---: | --- |
| `CENTRAL_WITH_COMPATIBILITY` | 22 | `POLICY_ACTIVATION_REQUIRED` |
| `CENTRAL_ONLY` | 13 | `GRANTABLE` |
| `DEFERRED` | 5 | `DEFERRED` |

The existence of the generic composer does not prove that a domain adapter,
query policy, relationship policy, workflow, or presentation surface has
migrated. Authorization Administration remains resolver-level and does not
claim to display final composed domain access.

## 9. Phase boundary and non-goals

No production adapter in any of these files was migrated:

```text
modules/employee/application/authorization.ts
modules/department/application/authorization.ts
modules/routine/application/authorization.ts
modules/stock/application/authorization.ts
modules/leave/application/authorization.ts
modules/notification/application/authorization.ts
```

There is no Employee, Department, Routine, Stock, Leave, Notification, Email
Request, or future IT behavior change; no schema/migration/seed/backfill;
no default Team; no Department-to-Team inference; no explicit DENY, ABAC,
wildcard, policy DSL, grant priority, or administration UX redesign.

## 10. Tests and verification

Focused contract coverage is in
`modules/authorization/application/composition.test.ts`. It covers the USER
truth table, multiple configured sources, Team/TeamRole/User provenance,
TEAM-origin constraints, non-TEAM Team grants, ALL normalization, structural
denial, configuration propagation, capability mismatch, unsupported defaults,
originless default TEAM, ADMIN separation, and immutable results.

Existing resolver contract coverage remains in
`modules/authorization/application/resolver.test.ts`; it continues to test
resolver-level `NO_APPLICABLE_GRANT`, grant union, lifecycle filtering,
configuration errors, TEAM origin constraints, ADMIN system-role authority,
unknown capabilities, and unsupported channels.

Executed verification:

- `npx.cmd vitest run modules/authorization/application/composition.test.ts` —
  passed, 1 file and 23 tests.
- `npx.cmd vitest run modules/authorization/application/resolver.test.ts` —
  passed, 1 file and 30 tests.
- `npm.cmd run architecture:check` — passed, 1,123 repository source files
  checked.
- `npm.cmd run lint:strict` — passed with zero warnings.
- `npm.cmd run typecheck` — passed.
- `npm.cmd run test:run` — passed, 317 files and 2,809 tests.
- `git diff --check` — passed.

No development server or production build was run. PowerShell execution policy
blocked the `npx` shim, so the equivalent checked-in executable `npx.cmd` was
used for the Vitest commands.

## 11. Exact handoff to Phase 12C.1

Phase 12C.1 — Department + Notification additive migration — may begin by
deriving each domain's trusted default policy/context, calling the unchanged
central resolver, and passing that decision plus validated default scopes to
`composeAuthorizationAuthority()`. It must then preserve each domain's
resource/query and actor-derived OWN behavior, revalidate transaction-time
identity where required, and regression-test both no-grant baseline and
configured additive authority.

Phase 12B stops at the reusable, fail-closed composition core. No 12C runtime
migration is included in this change.
