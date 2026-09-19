# NHF Employee — Phase 12H-B: Role-Neutral Resolver / Composition Core

Status: **COMPLETE**

Baseline: `d959fbaf0064c5cb75092bb7c4a89bcc99ac2110`

This phase implements the first runtime layer of the Phase 12H-A
role-neutral authorization contract. It deliberately does not cut current
domain enforcement over to the target semantics.

The phase status is therefore:

```text
Role-neutral core: IMPLEMENTED
Role-neutral production enforcement: NOT CUT OVER
Legacy ADMIN business compatibility: TEMPORARILY ACTIVE
Next: Phase 12H-C — Domain Default Policy Rebaseline
```

## 1. Boundary from Phase 12H-A

Phase 12H-A defined the target pipeline:

```text
trusted actor/context
  -> role-neutral Default Domain Policy
  + configured Team / TeamRole / exceptional User grants
  -> effective business authority
```

The pre-12H runtime still gave many registered capabilities an implicit
`SYSTEM_ROLE / ADMIN` grant and allowed some domain paths to use an ADMIN
compatibility branch. Phase 12H-B does not reinterpret those existing domain
defaults, route guards, lifecycle helpers, presentation projections, readiness
checks, or production grant data.

## 2. Role-neutral configured evaluator

`evaluateConfiguredAuthorization()` in
`modules/authorization/application/evaluator.ts` is the pure configured-grant
path. It evaluates the supplied resolution snapshot using only:

- active Team membership and its Team grants;
- an active TeamRole through an active Team membership and its TeamRole grants;
- exceptional direct User grants for the trusted actor user ID.

The evaluator does not inspect `systemRole`, call `isAdminRole()`, derive a
scope from ADMIN, or construct `SYSTEM_ROLE` grants. Consequently, equivalent
USER and ADMIN actors receive equivalent configured decisions, including
`NO_APPLICABLE_GRANT`, source provenance, scope normalization, inactive-source
filtering, Team origin constraints, and persisted-configuration failures.

Unknown capabilities and unsupported channels are rejected before persistence
is loaded. Persisted capability/scope validation and Team/TeamRole origin
validation remain fail-closed.

## 3. Resolver paths

`createRoleNeutralAuthorizationResolver()` is an application-internal target
factory. It reuses the same resolver pipeline as the production resolver:

```text
registry/channel validation
  -> load / loadMany / transaction-bound resolution data
  -> capability-specific data slice for batches
  -> evaluateConfiguredAuthorization()
  -> can / require / getScopes projections
```

The target path loads configured persistence for both USER and ADMIN. Its
single, batch, and transaction methods therefore have the same configured
semantics for both roles.

The exported `authorization` singleton and the existing
`createAuthorizationResolver()` factory remain on the pre-12H compatibility
strategy. For that strategy, ADMIN continues to skip configured persistence
and receives the existing legacy system-role authority; USER continues through
the existing configured-grant loading path.

## 4. Explicit legacy ADMIN compatibility boundary

`modules/authorization/application/legacy-admin-business-authority-compatibility.ts`
is a temporary migration seam. It is the only application seam introduced in
this phase that:

- recognizes the legacy ADMIN system role for business compatibility;
- constructs the legacy `SYSTEM_ROLE / ADMIN` grant;
- preserves legacy ADMIN no-persistence behavior; and
- wraps the role-neutral composition primitive to preserve the old ADMIN
  default projection for current domain adapters.

The compatibility wrapper delegates validation, additive union, normalization,
configured provenance, and fail-closed behavior to
`composeAuthorizationAuthority()`. The primitive itself has no ADMIN branch:

```text
validated defaultScopes UNION configuredDecision scopes
```

for either actor role. Current domain adapters explicitly import the temporary
compatibility wrapper so removing the ADMIN branch from the primitive does not
change current production/domain behavior while Phase 12H-C through 12H-G are
pending.

`SYSTEM_ROLE` remains in the source/projection unions because Administration,
historical provenance, production-readiness, and the compatibility path still
consume it. It is not produced by the role-neutral configured evaluator.

## 5. Why enforcement is not cut over

The current domain default functions and several domain-specific ADMIN/lifecycle
behaviors are still pre-12H. Cutting the target resolver into those callers now
would turn some existing ADMIN paths into a deny when no production Team,
TeamRole, or User grant has yet been prepared. It could also change domain
default scope baselines before they are rebaselined.

Accordingly this phase makes the target core executable and testable beside the
legacy path, but does not change:

- domain default policy;
- route authorization guards or presentation visibility;
- workforce/lifecycle helper semantics;
- Email Request, Leave recovery, or future IT capability registration;
- production grant data, seed/backfill behavior, Prisma schema, or migrations.

## 6. Remaining 12H-C through 12H-I debt

- **12H-C — Domain Default Policy Rebaseline:** make the approved Employee,
  Department, Routine, Stock, Leave, Audit, and Notification defaults explicit
  and role-neutral, including the recorded Routine narrowing.
- **12H-D — Missing/deferred capability completion:** implement only reviewed
  capability additions such as Leave recovery and Email Request, while keeping
  domain workflow and data invariants authoritative.
- **12H-E — Production grant/effective-access reconciliation:** prepare and
  validate Team, TeamRole, and exceptional User grants and rebase readiness and
  inspection evidence on effective configured authority.
- **12H-F — Presentation/route role-authority removal:** replace business
  `requiredRole: ADMIN`, recovery gates, and role-derived projections with
  trusted capability and relationship projections.
- **12H-G — Enforcement cutover:** switch approved production paths to the
  role-neutral target resolver and complete the security/regression audit.
- **12H-H — Production snapshot/live rollout validation:** validate effective
  access and operational/audit evidence against the approved snapshot.
- **12H-I — Compatibility debt removal:** delete the temporary legacy
  `SYSTEM_ROLE` business-authority seam and obsolete readiness/fallback logic
  only after cutover evidence is accepted.

No Phase 12H-C work is included in this change.
