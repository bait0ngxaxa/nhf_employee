# Authorization Phase 11C.1 — Security Regression Matrix

Status: Phase 11C.1 audit baseline complete; Phase 11C.2 not started.

Baseline: `main` at `963b7d76752e4a44b56facd0c463d6d28df6d89f`.

Audit point: the current production source and tests at the baseline commit.

This document is the authoritative cross-domain regression baseline for the
authorization implementation. It records what the current code enforces, what
the tests intentionally prove, and which gaps should be implemented only after
the Phase 11C.2 work is approved. A row is not considered covered merely
because a related source file or an adjacent test exists.

## Executive verdict

The current source has no unclassified authorization bypass or other blocking
security defect identified by this audit. Phase 11B's production hardening was
verified against current source and tests, including target Employee lifecycle
revalidation for Routine, approver/assignee revalidation for Leave, and the
pre-write authorization recheck for Stock uploads.

The baseline is not fully regression-complete. It contains explicit
compatibility policies and deferred surfaces, and it has missing direct tests
for current-state grant revocation, cross-domain stale-role revalidation,
transaction-time authorization revocation races, route-by-route breadth, and
deferred Email/Routine/Leave authorization. These are test and policy-scope
gaps, not silently upgraded target behavior.

Quantified matrix result:

| Metric | Count |
| --- | ---: |
| Total matrix cases | 89 |
| `DIRECT` | 74 |
| `INDIRECT` | 4 |
| `MISSING` | 8 |
| `N/A` | 3 |
| Compatibility-policy rows | 14 |
| Deferred-authorization-surface rows | 3 |
| Blocking security defects discovered in this audit | 0 |

Production authorization policy was not changed. No Team policy was activated,
no production grants were seeded, no compatibility bridge was retired, and no
deferred capability was migrated.

## Audit methodology

The audit followed the actual runtime path for each major row:

```text
request or page entry
  -> authenticated session or verified LIFF boundary
  -> server-derived AuthorizationActor
  -> central registry and resolver
  -> compatibility translation, when explicitly documented
  -> domain scope and relationship policy
  -> business/workflow validation
  -> transaction-time revalidation, where the path claims it
  -> persistence or file write
```

The following evidence was read and cross-checked rather than accepted from
closure documents alone:

- Authorization contracts and current-state documents in `docs/architecture/`.
- `modules/authorization/` contracts, registry, evaluator, resolver,
  persistence repository, administration, seed configuration, and tests.
- Session, workforce, transaction-workforce, Employee lifecycle, and LIFF
  identity implementations under `lib/auth/`, `modules/auth/`,
  `modules/employee/`, and `modules/line/`.
- Employee, Department, Routine, Stock, Leave, Audit, Notification, and
  Authorization Administration adapters, routes, services, and tests.
- Dashboard and LIFF entry points and the architecture checker/test graph.
- The repository-defined verification commands listed in the verification
  record below.

`AUTHORIZATION_DESIGN.md` is not present at the baseline. The current locked
authorization source of truth is the contract, resolver, persistence,
current-state, and phase-closure documentation listed above, checked against
the production implementation and tests.

For every matrix row, the production column names the enforcement boundary and
the test column names an intentional behavior-oriented assertion. Where the
same test touches several layers but does not make the row's invariant its
primary assertion, the row is `INDIRECT` rather than `DIRECT`.

## Coverage and classification definitions

Coverage levels:

- `DIRECT`: a test intentionally proves the exact invariant in the row.
- `INDIRECT`: the invariant is exercised by an adjacent assertion, but is not
  the primary assertion.
- `MISSING`: no adequate regression test proves the invariant.
- `N/A`: the invariant does not apply to the current surface or the code makes
  no such transactional guarantee.

Classifications are the locked categories used by this phase:

- `MIGRATED_AUTHORIZATION`: current capability resolution and server-side
  enforcement are the target authorization path.
- `COMPATIBILITY_POLICY`: an explicit legacy floor or bridge remains by policy.
- `DEFERRED_AUTHORIZATION_SURFACE`: the surface is intentionally outside the
  current migrated capability set.
- `PRESENTATION_ONLY`: a projection, navigation, or UI state is not authority.
- `DOMAIN_OR_LIFECYCLE_POLICY`: domain relationship, workflow, business, or
  lifecycle enforcement owns the invariant.
- `ARCHITECTURE_BOUNDARY`: module, browser/server, identity-provenance, or
  non-inference boundary owns the invariant.
- `NOT_APPLICABLE`: the invariant is not applicable to the row.

## Capability and migration ledger

The code-owned registry currently contains 40 capabilities. The migrated set
contains 35 capabilities. The five registered capabilities marked deferred
below are not represented as migrated authorization, even where their routes
have authentication or domain-specific checks.

| Domain | Registered capabilities | Current status | Current policy note |
| --- | --- | --- | --- |
| Employee | `employee.read`, `employee.stats.read`, `employee.create`, `employee.update`, `employee.delete`, `employee.import`, `employee.export` | MIGRATED | Broad `ALL` compatibility/read policy and an explicit ADMIN mutation floor remain documented. |
| Department | `department.read` | MIGRATED | Full-read compatibility floor remains; Team is not inferred from Department. |
| Routine | `routine.task.read`, `routine.task.create`, `routine.task.update`, `routine.task.delete`, `routine.occurrence.read`, `routine.occurrence.override`, `routine.occurrence.reassign`, `routine.occurrence.change_due_date`, `routine.import.manage` | MIGRATED | Nine capabilities are migrated. Normal USER work-item `ALL` remains only through the exact documented no-grant bridge. |
| Routine | `routine.task.export`, `routine.summary.read`, `routine.reference.read` | DEFERRED | Summary, reference, and export authorization migration is explicitly deferred. |
| Stock | `stock.catalog.read`, `stock.inventory.manage`, `stock.request.read`, `stock.request.create`, `stock.request.cancel`, `stock.request.process`, `stock.report.export` | MIGRATED | Relationship floors and the Dashboard ADMIN employee-optional seam remain explicit. |
| Leave | `leave.request.read`, `leave.approval.read`, `leave.request.create`, `leave.request.cancel`, `leave.request.approve`, `leave.cancellation.decide`, `leave.request.not_taken`, `leave.approver.manage` | MIGRATED | Relationship, workflow, recovery, and account-only ADMIN seams remain domain-owned. |
| Audit | `audit.read` | MIGRATED | Server-side central read capability; export-event metadata remains a separate concern. |
| Notification | `notification.inbox.read`, `notification.inbox.update` | MIGRATED | Actor-derived `OWN` policy prevents broad user-data access. |
| Email Request | `email.request.read`, `email.request.create` | DEFERRED | Existing route authentication/Admin handling is not a migrated central capability policy. |

The registry is code-owned in `modules/authorization/registry.ts`; seed
configuration in `modules/authorization/application/seed.ts` is empty at the
baseline. Persisted records are validated against the registry and supported
scopes. No Team grant inventory is active in production configuration.

## Security regression matrix

The matrix uses stable IDs independent of source line numbers. Test names are
included where they materially establish whether the row is direct or only
indirect.

| Matrix ID | Domain / surface | Capability or protected operation | Channel | Threat / invariant | Expected result | Production enforcement location | Existing regression test(s) | Coverage | Classification | Gap / required action | Notes / compatibility constraints |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AUTHN-01 | Auth and migrated Dashboard/API entry points | All migrated capabilities | `DASHBOARD` | Missing, invalid, or unauthenticated session must not reach protected work | Return safe `401` and do not perform the protected query or mutation | `lib/auth/api.ts:requireApiSession`; route guards before services | `__tests__/api/employees-routes.test.ts`; `__tests__/api/departments-route.test.ts`; `__tests__/api/audit-log-route.test.ts`; `__tests__/api/notifications.test.ts`; `__tests__/api/authorization-administration-mutations.test.ts` | DIRECT | MIGRATED_AUTHORIZATION | Add equivalent boundary assertions to migrated routes not represented by these suites in 11C.2 | UI visibility is not part of this proof. |
| AUTHN-02 | LIFF entry points | LIFF-protected operations | `LIFF_SELF_SERVICE` | Missing, malformed, expired, tampered, or wrong-purpose LIFF session must not establish identity | Return `401` for invalid session material before workforce access | `modules/line/application/liff.ts:requireLiffWorkforceSession`; `modules/line/infrastructure/session/liff-session.ts` | `__tests__/auth/liff.test.ts`; `__tests__/lib/line-liff-session.test.ts` | DIRECT | MIGRATED_AUTHORIZATION | None for the covered LIFF boundary | Current User, Employee, and account-link state is checked after token verification. |
| AUTHN-03 | Generic account versus workforce routes | Legacy API and workforce-required operations | `DASHBOARD` | An authenticated account without an eligible Employee must not be treated as a workforce actor | Generic account resolution may succeed only where designed; workforce-required API returns the documented failure | `modules/auth/application/sessions.ts`; `lib/auth/api.ts`; `lib/auth/workforce.ts` | `__tests__/lib/server-auth-token-version.test.ts`; `__tests__/auth/workforce.test.ts` | DIRECT | DOMAIN_OR_LIFECYCLE_POLICY | None for the documented boundary | Account-only ADMIN seams are listed separately and do not make a normal USER a workforce actor. |
| AUTHN-04 | Session lifecycle | Dashboard/API session | `DASHBOARD` | Revoked session family, token-version mismatch, or invalid current account state must not authenticate | Reject before authorization and persistence access | `modules/auth/application/sessions.ts:resolveAuthenticatedAccount`; `lib/auth/server.ts` | `__tests__/lib/server-auth-token-version.test.ts`; `__tests__/auth/auth-principal.test.ts` | DIRECT | DOMAIN_OR_LIFECYCLE_POLICY | None for covered token/session conditions | Current persisted role is returned; route-time role is not trusted. |
| LIFE-01 | User lifecycle | All account-backed capabilities | `DASHBOARD` | Inactive User must not authorize | Deny before protected operation | `modules/auth/application/sessions.ts`; `modules/authorization/application/evaluator.ts` receives only authenticated actor | `__tests__/lib/server-auth-token-version.test.ts`; `__tests__/auth/workforce.test.ts` | DIRECT | DOMAIN_OR_LIFECYCLE_POLICY | None for current User lifecycle gate | Applies before capability resolution. |
| LIFE-02 | User lifecycle | All account-backed capabilities | `DASHBOARD` | Deleted User must not authorize | Deny before protected operation | `modules/auth/application/sessions.ts`; `lib/auth/server.ts` | `__tests__/lib/server-auth-token-version.test.ts`; `__tests__/auth/workforce.test.ts` | DIRECT | DOMAIN_OR_LIFECYCLE_POLICY | None for current User deletion gate | ADMIN is not an authentication bypass. |
| LIFE-03 | Employee lifecycle | Workforce-required migrated operations | `DASHBOARD` | Inactive, suspended, or deleted Employee must not authorize a workforce operation | Return the documented workforce denial and do not mutate | `lib/auth/workforce.ts:requireActiveWorkforceSession`; `lib/auth/workforce-transaction.ts` | `__tests__/auth/workforce.test.ts`; `__tests__/auth/workforce-transaction.test.ts`; `__tests__/api/stock-items-route.test.ts` | DIRECT | DOMAIN_OR_LIFECYCLE_POLICY | None for the covered workforce and transaction gates | Target Employee lifecycle is separately covered in transaction rows. |
| LIFE-04 | Employee lifecycle and LIFF link | LIFF self-service operations | `LIFF_SELF_SERVICE` | LIFF identity must correspond to a current active User, Employee, and valid current account link | Deny invalid current lifecycle or link state; never trust stale claims alone | `modules/line/application/liff.ts`; `modules/line/infrastructure/persistence/account-link.ts` | `__tests__/auth/liff.test.ts` | DIRECT | DOMAIN_OR_LIFECYCLE_POLICY | None for current LIFF lifecycle/link cases | Claim `employeeId` is checked against current identity. |
| LIFE-05 | Explicit account-only ADMIN seams | Stock lower operations, Leave approver management, Routine Dashboard lower helper | `DASHBOARD` | Account-only ADMIN exceptions must be narrow and explicit, not a general lifecycle bypass | Allow only the documented capability/path; require active User and preserve domain rules | `lib/auth/workforce.ts:requireActiveWorkforceOrAdminSession`; Stock, Leave, and Routine transaction authorization adapters | `__tests__/auth/workforce.test.ts`; `modules/stock/application/authorization.test.ts`; `modules/leave/application/authorization.test.ts`; `modules/routine/application/authorization.test.ts` | DIRECT | COMPATIBILITY_POLICY | Keep the allowlist explicit; add a cross-domain negative test for an unlisted capability in 11C.2 | This is a compatibility seam, not a new ADMIN bypass. |
| LIFE-06 | Dashboard current-user projection | Dashboard navigation and capability projection | `DASHBOARD` | Presentation must not turn an account with no eligible Employee into a workforce authority | Projection is absent or restricted; server route still performs its own checks | `app/_lib/auth/current-user.ts` | `__tests__/auth/current-user-projection.test.ts` | DIRECT | PRESENTATION_ONLY | None for projection behavior | Projection flags are not authorization evidence. |
| ACTOR-01 | Dashboard actor construction | Migrated domain adapters | `DASHBOARD` | Actor `userId`, `employeeId`, and current role must come from authenticated server state | Build the actor from trusted session/current account; ignore client actor fields | `app/_lib/auth/current-user.ts`; domain `application/authorization.ts` adapters | `__tests__/api/employees-routes.test.ts`; `__tests__/api/authorization-administration-mutations.test.ts`; `__tests__/auth/current-user-projection.test.ts` | DIRECT | MIGRATED_AUTHORIZATION | None for the covered actor builders | Request data may select a target/filter but cannot establish the actor. |
| ACTOR-02 | API body, query, and headers | All migrated API operations | `DASHBOARD` or `LIFF_SELF_SERVICE` | Request fields cannot supply actor user ID, role, capability, scope, Team origin, or channel | Authorization result remains based on the server-derived actor and operation contract | Route handlers pass authenticated identity to adapters; central resolver accepts `AuthorizationActor`, not `Request` | `__tests__/api/employees-routes.test.ts`; `__tests__/api/authorization-administration-mutations.test.ts`; `__tests__/api/line-routine-routes.test.ts`; `__tests__/api/line-routine-self-service-routes.test.ts`; `__tests__/api/line-stock-routes.test.ts`; `__tests__/api/line-leave-routes.test.ts` | DIRECT | MIGRATED_AUTHORIZATION | Add the same negative assertion to any migrated route lacking it in 11C.2 | Headers are transport metadata only where the route explicitly derives a fixed channel. |
| ACTOR-03 | Dynamic route parameters | Employee, Routine, Stock, Leave, and Admin resource routes | `DASHBOARD` | Route IDs identify a target only and cannot supply an authorization role or capability | Use the authenticated actor with the route ID as resource input; reject unauthorized target access | Route handlers and service command contexts; Admin route auth | `__tests__/api/authorization-administration-mutations.test.ts`; `__tests__/api/routines-occurrence-by-id.test.ts`; `__tests__/api/routines-task-by-id.test.ts`; `__tests__/api/stock-requests-routes.test.ts` | DIRECT | MIGRATED_AUTHORIZATION | Expand to any remaining dynamic migrated route in 11C.2 | A target ID is not actor provenance. |
| ACTOR-04 | LIFF identity boundary | LIFF self-service capabilities | `LIFF_SELF_SERVICE` | LIFF identity must come from a verified LIFF/session boundary and current link, not request data | Use the verified `sub`, current User/Employee, and current account link; reject mismatch | `modules/line/application/liff.ts:requireLiffWorkforceSession`; LIFF route handlers | `__tests__/auth/liff.test.ts`; `__tests__/api/line-routine-routes.test.ts`; `__tests__/api/line-stock-routes.test.ts`; `__tests__/api/line-leave-routes.test.ts` | DIRECT | MIGRATED_AUTHORIZATION | None for covered LIFF identity paths | LIFF Admin remains a LIFF actor and does not inherit Dashboard Admin semantics. |
| ACTOR-05 | Employee transaction authorization | Employee update/delete and related mutation commands | `DASHBOARD` | A stale route-time role must not override the current persisted role when revalidation is required | Lock and re-read current User/Employee, rebuild actor from current state, then resolve | `modules/employee/application/authorization.ts:resolveEmployeeCapabilityInTransaction` | `modules/employee/application/authorization.test.ts`; `__tests__/auth/workforce-transaction.test.ts` | DIRECT | DOMAIN_OR_LIFECYCLE_POLICY | None for the Employee path | This evidence is specific to Employee and must not be generalized to every mutation path. |
| ACTOR-06 | Cross-domain transaction actor state | Routine, Stock, and Leave mutation transactions | `DASHBOARD` | Current persisted role must replace stale route-time role across every path that claims transaction-time revalidation | Re-read the current account actor before the final authorization decision | Domain transaction adapters do this path-by-path, but no cross-domain direct regression matrix test proves stale-role replacement | `modules/stock/application/authorization.test.ts`; `modules/routine/application/authorization.test.ts`; `modules/leave/application/authorization.test.ts` cover adjacent lifecycle/re-resolution cases | MISSING | DOMAIN_OR_LIFECYCLE_POLICY | `11C2-ACTOR-01`: add deterministic cross-domain current-role revalidation cases without weakening route contracts | Do not infer complete coverage from the Employee test. |
| ACTOR-07 | Channel derivation boundary | Dashboard and LIFF adapters | `DASHBOARD` / `LIFF_SELF_SERVICE` | Request-controlled channel must not change authorization semantics | Adapter constructs a fixed channel from the entry point; unsupported channel fails closed | Domain actor builders; `modules/authorization/contracts.ts`; route composition | `modules/employee/application/authorization.test.ts`; `modules/routine/application/authorization.test.ts`; `modules/stock/application/authorization.test.ts`; `modules/leave/application/authorization.test.ts`; `__tests__/api/line-routine-routes.test.ts` | DIRECT | ARCHITECTURE_BOUNDARY | None for the covered builders | API entry point is not itself an actor channel; route composition chooses the fixed channel. |
| CAP-01 | Central resolver | Any requested capability key | Any | Unknown capability must fail closed | Deny with `UNKNOWN_CAPABILITY`; do not consult persistence as if the key were valid | `modules/authorization/application/evaluator.ts:getAuthorizationEvaluationContext`; `modules/authorization/registry.ts` | `modules/authorization/application/resolver.test.ts`; `modules/authorization/registry.test.ts` | DIRECT | MIGRATED_AUTHORIZATION | None | Registry lookup precedes grant evaluation. |
| CAP-02 | Central resolver | Registered capability on unsupported channel | Any | Unsupported channel must fail closed | Deny with `CHANNEL_NOT_SUPPORTED` | `modules/authorization/application/evaluator.ts:getAuthorizationEvaluationContext` | `modules/authorization/application/resolver.test.ts`; `modules/authorization/registry.test.ts` | DIRECT | MIGRATED_AUTHORIZATION | None | No compatibility fallback is allowed for a channel error. |
| CAP-03 | Central resolver and domain adapters | Registered capability with no applicable grant | `DASHBOARD` / `LIFF_SELF_SERVICE` | Default authorization is additive ALLOW plus default DENY | Deny with `NO_APPLICABLE_GRANT`, except for the exact documented compatibility bridge | `modules/authorization/application/evaluator.ts`; each migrated domain authorization adapter | `modules/authorization/application/resolver.test.ts`; domain `application/authorization.test.ts` suites | DIRECT | MIGRATED_AUTHORIZATION | None for the central default-deny decision | Compatibility translation is recorded in separate rows and cannot mask structural errors. |
| CAP-04 | Central resolver grant union | Team, TeamRole, and direct User grants | `DASHBOARD` / `LIFF_SELF_SERVICE` | Valid active grant sources are additive; direct User grant does not require membership | Union active valid grants and normalize scopes; deny when union is empty | `modules/authorization/application/evaluator.ts`; `modules/authorization/infrastructure/persistence/authorization-resolution-repository.ts` | `modules/authorization/application/resolver.test.ts` (`unions active Team, TeamRole, and direct User grants`; direct User grant without membership) | DIRECT | MIGRATED_AUTHORIZATION | None | There is no general explicit DENY policy. |
| CAP-05 | Central resolver current grant state | Direct User grants | Any supported channel | Revoking a direct User grant must take effect on the next evaluation | No deleted/inactive grant may authorize a subsequent request | Repository filters current records; evaluator filters active grants | No test directly removes a direct User grant and then resolves the same capability | MISSING | MIGRATED_AUTHORIZATION | `11C2-CAP-01`: add repository-backed revoke-then-resolve coverage | Administration delete-command tests prove the mutation command, not its next authorization result. |
| CAP-06 | Central resolver membership state | Team grants | Any supported channel | Removing or deactivating a User's Team membership must revoke the Team grant | Exclude the Team grant on the next evaluation | `authorization-resolution-repository.ts` queries active membership and active Team; evaluator requires matching origin | `modules/authorization/application/resolver.test.ts` (`does not use grants from an inactive Team`); repository query tests | INDIRECT | MIGRATED_AUTHORIZATION | `11C2-CAP-02`: add a membership-removal/re-resolve integration case | Inactive Team is directly covered; membership removal itself is not. |
| CAP-07 | Central resolver TeamRole state | TeamRole grants | Any supported channel | Revoking a TeamRole grant or deactivating the role/membership must revoke that source | Exclude the TeamRole grant on the next evaluation | `authorization-resolution-repository.ts`; evaluator active role and membership checks | `modules/authorization/application/resolver.test.ts` (`does not use TeamRole grants from an inactive role`); `modules/authorization/application/administration-mutations.test.ts` | INDIRECT | MIGRATED_AUTHORIZATION | `11C2-CAP-02`: add a delete-grant/re-resolve case for TeamRole grants | The administration test proves removal behavior at its command boundary, not resolver effect. |
| CAP-08 | Persisted grant/configuration validation | Any persisted capability and scope | Any | Unknown persisted key or unsupported scope must fail closed rather than normalize or broaden | Return typed invalid-configuration failure; never allow the row | `modules/authorization/application/evaluator.ts:validatePersistedGrant`; grant validation and administration | `modules/authorization/application/grant-validation.test.ts`; `modules/authorization/application/resolver.test.ts`; `modules/authorization/application/administration.test.ts` | DIRECT | MIGRATED_AUTHORIZATION | None | No trim, wildcard, fallback, or second capability list is accepted. |
| CAP-09 | Grant origin validation | Team, TeamRole, and User grants | Any | Invalid Team/TeamRole origin and direct User `TEAM` scope must fail closed | Reject missing/mismatched origin with typed structural/configuration error | `modules/authorization/application/evaluator.ts:toEffectiveGrant`; origin checks in persistence and administration | `modules/authorization/application/resolver.test.ts`; `modules/authorization/application/grant-validation.test.ts`; `modules/authorization/application/administration.test.ts` | DIRECT | MIGRATED_AUTHORIZATION | None | Domain modules do not invent Team origin. |
| CAP-10 | Role semantics | TeamRole and system role | Any | A TeamRole name has no intrinsic authority; only registered active grants and system role semantics matter | A role without a matching grant is denied | `modules/authorization/application/evaluator.ts`; `lib/ssot/permissions.ts:isAdminRole` | `modules/authorization/application/resolver.test.ts` (`role with no grant is denied`); `modules/authorization/registry.test.ts` | DIRECT | MIGRATED_AUTHORIZATION | None | TeamRole is an origin/source, not a hierarchy or inherited authority. |
| CAP-11 | Registry and seed boundary | All registered capabilities | Any | Capability vocabulary is code-owned and production seed configuration cannot silently activate policy | Registry is the only capability source; empty seed remains empty unless explicitly configured and validated | `modules/authorization/registry.ts`; `modules/authorization/application/seed.ts`; `prisma/seed.ts` | `modules/authorization/registry.test.ts`; `modules/authorization/application/seed.test.ts`; `modules/authorization/application/administration.test.ts` | DIRECT | ARCHITECTURE_BOUNDARY | None for the baseline configuration | Persisted configuration may reference only registered keys and supported scopes. |
| CAP-12 | Authorization model | ALLOW aggregation | Any | No general explicit DENY, wildcard capability, policy DSL, or priority override may enter the evaluator | Only valid additive grants contribute to the decision; default remains deny | `modules/authorization/contracts.ts`; evaluator grant union and normalized scopes | `modules/authorization/application/resolver.test.ts` (union and default-deny cases) | INDIRECT | MIGRATED_AUTHORIZATION | `11C2-CAP-03`: add a schema/contract regression assertion if the persistence model changes | Current source inspection confirms the absence; the existing tests primarily prove additive behavior. |
| SCOPE-01 | Stock, Leave, and Notification relationships | `OWN` | `DASHBOARD` / `LIFF_SELF_SERVICE` | A resource owned by another User must not be returned or mutated under `OWN` | Query is actor-owned or operation is denied before disclosure | Stock query predicates; Leave owner/participant policy; Notification actor-derived user filter | `__tests__/api/line-stock-routes.test.ts`; `__tests__/api/stock-requests-routes.test.ts`; `__tests__/api/leave-cancel.test.ts`; `__tests__/api/leave-me.test.ts`; `__tests__/api/notifications.test.ts` | DIRECT | DOMAIN_OR_LIFECYCLE_POLICY | None for covered owner paths | Notification intentionally supports only actor-derived `OWN`. |
| SCOPE-02 | Routine task mutations and queries | `CREATED` | `DASHBOARD` / `LIFF_SELF_SERVICE` | Created-by relationship must be evaluated against the authenticated Employee | Creator may access only where the capability/scope permits; unrelated creator is denied | `modules/routine/application/authorization.ts:buildRoutineTaskScope`; Routine services | `modules/routine/application/authorization.test.ts`; `__tests__/api/routines-tasks.test.ts`; `__tests__/api/routines-task-by-id.test.ts` | DIRECT | DOMAIN_OR_LIFECYCLE_POLICY | None for covered creator predicates | `CREATED` is not an alias for `OWN` unless the domain explicitly maps it. |
| SCOPE-03 | Routine assignee and Leave approver workload | `ASSIGNED` | `DASHBOARD` / `LIFF_SELF_SERVICE` | Assignment relationship must be checked against the current actor/Employee | Only assigned work is visible or actionable where the scope requires it | `modules/routine/application/authorization.ts`; Leave approval/approver domain policies | `modules/routine/application/authorization.test.ts`; `__tests__/api/line-routine-routes.test.ts`; `__tests__/api/leave-approvals.test.ts`; `__tests__/api/leave-decision.test.ts` | DIRECT | DOMAIN_OR_LIFECYCLE_POLICY | None for covered assignment paths | Assignment changes are re-read in transaction rows where mutation semantics require it. |
| SCOPE-04 | Central Team grant origins | `TEAM` | Any | A Team-scoped grant must retain the Team that supplied the grant | Effective grant carries the valid originating `teamId` | `modules/authorization/application/evaluator.ts:toEffectiveGrant`; repository origin mapping | `modules/authorization/application/resolver.test.ts` (`preserves originating Team constraint`); `modules/authorization/application/administration.test.ts` | DIRECT | MIGRATED_AUTHORIZATION | None for current synthetic/origin validation | No migrated registry capability currently enables active Team policy in production. |
| SCOPE-05 | Team resource semantics across domain modules | `TEAM` | Any | Team cannot broaden into another Team, and Team is not Department | No cross-Team authorization is claimed until domain Team policy is activated | No active domain Team scope adapter; architecture and persistence contracts prohibit Department inference | `modules/authorization/application/resolver.test.ts` origin tests; architecture/documentation checks | N/A | ARCHITECTURE_BOUNDARY | Do not add Team policy in 11C.1; require a separately approved migration and domain tests | This is an inactive/deferred architectural boundary, not a missing active-domain test. |
| SCOPE-06 | Structural Team origin | `TEAM` and direct User grants | Any | Missing Team origin must fail closed | Reject direct User `TEAM` and malformed Team/TeamRole origins | `modules/authorization/application/evaluator.ts`; persistence validation | `modules/authorization/application/resolver.test.ts` (`direct User TEAM scope requires origin` and origin preservation) | DIRECT | MIGRATED_AUTHORIZATION | None | A domain must never fabricate a Team origin from Department, manager, position, or Employee metadata. |
| SCOPE-07 | ALL-scoped domain operations | `ALL` | `DASHBOARD` / `LIFF_SELF_SERVICE` | `ALL` removes only the relationship restriction represented by the scope | It does not bypass authentication, lifecycle, workflow, validation, locks, or concurrency | Domain query/mutation policies; transaction authorization adapters | `modules/stock/application/authorization.test.ts`; `modules/routine/application/authorization.test.ts`; `modules/leave/application/authorization.test.ts`; `modules/employee/application/mutations.test.ts` | DIRECT | DOMAIN_OR_LIFECYCLE_POLICY | None for covered domain paths | This invariant is repeated in the Admin rows because ADMIN receives authority through the same boundaries. |
| SCOPE-08 | Requested scope handling | Request `scope=all` and narrower grants | `DASHBOARD` / `LIFF_SELF_SERVICE` | A request cannot widen a narrower effective grant | Requested scope is a filter/selector only; effective scopes decide | Stock and Routine authorization/query builders | `__tests__/api/stock-requests-routes.test.ts`; `__tests__/api/line-stock-routes.test.ts`; `modules/routine/application/authorization.test.ts` | DIRECT | DOMAIN_OR_LIFECYCLE_POLICY | None for covered requested-scope cases | The Routine work-item bridge is an exact compatibility exception documented in COMPAT-06. |
| SCOPE-09 | Query-level relationship enforcement | Employee, Routine, Stock, Leave, Notification | `DASHBOARD` / `LIFF_SELF_SERVICE` | Unauthorized resources must not be returned before a later UI check | Apply actor/resource predicates before the query or return a safe denial | Domain query builders and route authorization gates | `__tests__/api/departments-route.test.ts`; `__tests__/api/notifications.test.ts`; `__tests__/api/stock-requests-routes.test.ts`; `__tests__/api/line-stock-routes.test.ts`; `__tests__/api/leave-me.test.ts`; `__tests__/api/routines-task-by-id.test.ts` | DIRECT | DOMAIN_OR_LIFECYCLE_POLICY | Extend query-before-return assertions to any migrated reader not represented in 11C.2 | UI filtering is not a substitute for query scoping. |
| CHANNEL-01 | Dashboard migrated domains | Employee, Department, Routine, Stock, Leave, Audit, Notification | `DASHBOARD` | Dashboard operations use the Dashboard channel and current server actor | Resolve the registered capability for `DASHBOARD`, then apply domain policy | Domain authorization adapters and Dashboard route handlers | Employee, Department, Audit, Notification, Stock, Routine, and Leave authorization test suites; corresponding API suites | DIRECT | MIGRATED_AUTHORIZATION | None for covered Dashboard adapters | Broad compatibility floors are separate from central target policy. |
| CHANNEL-02 | LIFF migrated/self-service domains | Routine, Stock, Leave | `LIFF_SELF_SERVICE` | LIFF must use the same authoritative model while retaining self-service restrictions | Resolve with verified LIFF actor and LIFF channel; clamp operation/resource to self-service contract | `modules/line/application/liff.ts`; LIFF route handlers; domain adapters | `__tests__/api/line-routine-routes.test.ts`; `__tests__/api/line-stock-routes.test.ts`; `__tests__/api/line-leave-routes.test.ts`; LIFF session tests | DIRECT | MIGRATED_AUTHORIZATION | None for covered LIFF routes | LIFF is not a client-supplied role or unrestricted Dashboard channel. |
| CHANNEL-03 | Routine LIFF Admin | Routine task and summary self-service entry points | `LIFF_SELF_SERVICE` | ADMIN through LIFF must not inherit unrestricted Dashboard administrative semantics | Force mine/self-service scope and current LIFF Employee context | `app/api/line/routine/tasks/route.ts`; Routine LIFF actor/mode adapter; LIFF summary route | `__tests__/api/line-routine-routes.test.ts`; `modules/routine/application/authorization.test.ts` | DIRECT | COMPATIBILITY_POLICY | None for the explicit LIFF Admin clamp | Summary remains a deferred central capability surface even though the route is self-service scoped. |
| CHANNEL-04 | Stock LIFF processing | `stock.request.process` | `LIFF_SELF_SERVICE` | LIFF Admin must not obtain Dashboard-only account-only employee omission or unrelated administrative reach | Require verified LIFF workforce identity and the LIFF operation contract | `modules/stock/presentation/liff-stock-auth.ts`; LIFF stock route | `__tests__/api/line-stock-routes.test.ts`; `modules/stock/application/authorization.test.ts` | DIRECT | COMPATIBILITY_POLICY | None for covered processor route | The Dashboard ADMIN employee-optional seam is channel-specific. |
| CHANNEL-05 | Leave recovery and cancellation | `leave.cancellation.decide` and related recovery paths | `DASHBOARD` / `LIFF_SELF_SERVICE` | Explicit Dashboard recovery authority must not leak into LIFF | Enforce the documented Dashboard-only recovery exception; LIFF uses ordinary self-service/domain path | `modules/leave/application/authorization.ts:canUseLeaveAdminRecoveryOverride`; Leave route composition | `__tests__/api/leave-cancel.test.ts`; `__tests__/api/line-leave-routes.test.ts`; `modules/leave/application/authorization.test.ts` | DIRECT | COMPATIBILITY_POLICY | None for current channel restriction | No generic `ALL` bypass is created by the recovery exception. |
| CHANNEL-06 | Dashboard and LIFF projections | Capability and navigation projections | `DASHBOARD` / `LIFF_SELF_SERVICE` | Presentation projections must not change server authority | Projection may hide/show affordances, but direct route calls are independently authorized | `app/_lib/auth/current-user.ts`; `modules/line/application/liff.ts:getLiffCapabilities` | `__tests__/auth/current-user-projection.test.ts`; `__tests__/api/line-routine-routes.test.ts`; direct API denial tests | DIRECT | PRESENTATION_ONLY | None for the projection boundary | A hidden button is not evidence of protection. |
| CHANNEL-07 | Cross-channel model parity | Same capability model with explicit channel constraints | `DASHBOARD` / `LIFF_SELF_SERVICE` | Dashboard and LIFF must share registry/resolver semantics without sharing unrestricted channel authority | Same central decision model; channel-specific adapters constrain operation/resource | Domain adapters use the same resolver API with fixed channels | Cross-domain authorization adapter tests and LIFF route suites | INDIRECT | MIGRATED_AUTHORIZATION | `11C2-CHANNEL-01`: add a paired Dashboard/LIFF assertion for each capability that is intentionally available in both channels | Existing tests establish the two paths separately, not one exhaustive parity table. |
| API-01 | Employee API | Seven Employee capabilities | `DASHBOARD` | Direct HTTP invocation must enforce authentication, capability, target relationship, lifecycle, and business rules | Unauthorized calls fail before service mutation/query; authorized calls still pass domain invariants | `app/api/employees/route.ts`; `app/api/employees/[id]/route.ts`; Employee authorization/service/transaction layer | `__tests__/api/employees-routes.test.ts`; `modules/employee/application/authorization.test.ts`; `modules/employee/application/mutations.test.ts` | DIRECT | MIGRATED_AUTHORIZATION | Add explicit direct assertions for any remaining Employee import/export edge not covered by the route suite in 11C.2 | Broad Employee read/stat/export behavior is compatibility policy, not evidence of narrower target policy. |
| API-02 | Department API | `department.read` | `DASHBOARD` | Direct API access cannot bypass authentication or the central read capability | Deny before query unless the current actor is authorized; return scoped/full data only per current policy | `app/api/departments/route.ts`; Department authorization adapter | `__tests__/api/departments-route.test.ts`; `modules/department/application/authorization.test.ts` | DIRECT | MIGRATED_AUTHORIZATION | None for the current route | Department is reference data and is not a Team source. |
| API-03 | Routine migrated API | Nine migrated task/occurrence/import capabilities | `DASHBOARD` / `LIFF_SELF_SERVICE` | Direct task, occurrence, and import calls must enforce auth, central capability, resource scope, lifecycle, workflow, and transaction rules | Deny before unauthorized disclosure/write; authorized mutation revalidates claimed invariants | `app/api/routines/tasks/**`; `app/api/routines/occurrences/**`; import routes; Routine authorization/mutations | `__tests__/api/routines-tasks.test.ts`; `__tests__/api/routines-task-by-id.test.ts`; `__tests__/api/routines-occurrences.test.ts`; `__tests__/api/routines-occurrence-by-id.test.ts`; `__tests__/api/routine-import-preview.test.ts`; Routine application tests | DIRECT | MIGRATED_AUTHORIZATION | Add route coverage for any migrated operation lacking a direct negative assertion in 11C.2 | Summary/reference/export are explicitly excluded and listed as deferred. |
| API-04 | Stock migrated API | Seven Stock capabilities | `DASHBOARD` / `LIFF_SELF_SERVICE` | Direct catalog, inventory, request, and report calls must enforce auth, capability, relationship, lifecycle, workflow, and idempotency/concurrency rules | Unauthorized resources are not returned and unauthorized writes do not occur | `app/api/stock/**`; `app/api/uploads/image/route.ts`; Stock authorization/mutations/queries | `__tests__/api/stock-requests-routes.test.ts`; `__tests__/api/stock-items-route.test.ts`; `__tests__/api/stock-reports-export-route.test.ts`; `__tests__/api/uploads-image-route.test.ts`; `__tests__/api/line-stock-routes.test.ts`; Stock application tests | DIRECT | MIGRATED_AUTHORIZATION | None for the covered migrated operations | File-system writes retain the documented non-atomic residual race; see TX-08. |
| API-05 | Leave migrated API | Eight Leave capabilities | `DASHBOARD` / `LIFF_SELF_SERVICE` | Direct Leave calls must enforce auth, capability, relationship, lifecycle, workflow, quota, and transaction rules | Unauthorized request/approval/cancellation actions fail without disclosure or mutation | `app/api/leave/**`; Leave authorization and workflow services | `__tests__/api/leave-request.test.ts`; `__tests__/api/leave-decision.test.ts`; `__tests__/api/leave-cancel.test.ts`; `__tests__/api/leave-not-taken.test.ts`; `__tests__/api/leave-approvers.test.ts`; `__tests__/api/line-leave-routes.test.ts`; Leave application tests | DIRECT | MIGRATED_AUTHORIZATION | Deferred report/export and participant surfaces are tracked separately | Explicit domain recovery is not a generic capability bypass. |
| API-06 | Audit API | `audit.read` | `DASHBOARD` | Direct audit log access must use the server actor and central capability before query | Deny ungranted access before query; preserve safe audit response | `app/api/audit-logs/route.ts`; Audit authorization adapter | `__tests__/api/audit-log-route.test.ts`; `modules/audit/application/authorization.test.ts` | DIRECT | MIGRATED_AUTHORIZATION | Audit export-event metadata policy remains a separate review item | The actual route is `audit-logs`, not `app/api/audit/route.ts`. |
| API-07 | Notification API | `notification.inbox.read`, `notification.inbox.update` | `DASHBOARD` | Direct inbox read/update must use actor-derived User ownership and separate mutation capability | Read and update are independently authorized; no client user ID broadens access | `app/api/notifications/**`; Notification authorization adapter | `__tests__/api/notifications.test.ts`; `modules/notification/application/authorization.test.ts` | DIRECT | MIGRATED_AUTHORIZATION | None for covered inbox operations | The adapter intentionally rejects broad non-`OWN` notification scopes. |
| API-08 | Authorization Administration API | Team, TeamRole, membership, and User grant administration | `DASHBOARD` | Admin management must authenticate and authorize the trusted server principal; body role/user fields cannot elevate | Unauthenticated/non-ADMIN callers fail before persistence; valid Admin commands retain validation and audit rules | `app/api/authorization/administration/_lib/route-auth.ts`; `modules/authorization/application/administration.ts` | `__tests__/api/authorization-administration.test.ts`; `__tests__/api/authorization-administration-mutations.test.ts`; `modules/authorization/application/administration-mutations.test.ts` | DIRECT | MIGRATED_AUTHORIZATION | None for covered Admin administration boundaries | Administration mutates configuration but does not activate Team policy by itself. |
| API-09 | Direct API versus presentation | All migrated protected actions | `DASHBOARD` / `LIFF_SELF_SERVICE` | A hidden UI control or absent navigation must not be the only protection | Direct HTTP call still hits server auth, authorization, relationship, lifecycle, and domain/workflow checks | Route handlers, service command boundaries, and transaction adapters | Employee, Routine, Stock, Leave, Notification, Admin, and LIFF route denial tests | DIRECT | MIGRATED_AUTHORIZATION | Keep adding direct API negative tests when new UI-only flows are introduced | Presentation rows cannot be counted as API enforcement. |
| API-10 | Migrated route breadth | Every migrated capability and entry point | `DASHBOARD` / `LIFF_SELF_SERVICE` | Each migrated route/capability pair should have a direct regression assertion for its own boundary | Matrix should prove the exact route, actor, capability, relationship, and lifecycle contract rather than relying on adjacent suites | Source inventory is broad; test inventory is uneven by operation and channel | No single route-by-route contract suite covers every migrated capability/channel/resource combination | MISSING | MIGRATED_AUTHORIZATION | `11C2-API-01`: build a finite route/capability coverage ledger and add only missing behavior tests | This is a coverage gap, not evidence of a production bypass. |
| TX-01 | Mutation-sensitive migrated operations | Authorization grant, membership, or role revocation during an in-flight transaction | `DASHBOARD` / `LIFF_SELF_SERVICE` | Authorization revoked after initial read but before write must be rejected where the path claims transaction-time authorization | Final decision must use current authorization state or a documented atomic boundary | `resolveInTransaction` and domain transaction authorization adapters exist; no general transaction spans the external revocation commit | No direct deterministic test changes a grant/membership/role between initial read and final write and asserts denial | MISSING | MIGRATED_AUTHORIZATION | `11C2-TX-01`: add database-backed or deterministic transaction-race tests for each claimed revalidation path | Do not claim this guarantee for read-only, Employee import, or other explicitly unsupported paths. |
| TX-02 | Current actor lifecycle in mutation transactions | User and Employee lifecycle | `DASHBOARD` / `LIFF_SELF_SERVICE` | User/Employee deactivation, deletion, or suspension while a mutation waits must fail closed | Lock/re-read current actor lifecycle before final authorization and write | `lib/auth/workforce-transaction.ts`; Employee, Stock, Routine, and Leave transaction adapters | `__tests__/auth/workforce-transaction.test.ts`; `modules/employee/application/authorization.test.ts`; `modules/stock/application/authorization.test.ts`; `modules/leave/application/authorization.test.ts`; Routine mutation tests | DIRECT | DOMAIN_OR_LIFECYCLE_POLICY | None for covered lifecycle races | The exact supported transaction paths are domain-specific. |
| TX-03 | Routine assignee and Employee target state | Routine task/occurrence mutation | `DASHBOARD` / `LIFF_SELF_SERVICE` | Target Employee lifecycle changes or an invalid assignee must not be committed | Lock and re-read target Employees; reject inactive/deleted targets before write | `modules/routine/application/authorization.ts:assertActiveEmployeesInTransaction`; Routine mutation services | `modules/routine/application/mutations.test.ts`; `modules/routine/application/authorization.test.ts`; `__tests__/api/routines-task-by-id.test.ts` | DIRECT | DOMAIN_OR_LIFECYCLE_POLICY | None for the verified Routine target path | This is one of the Phase 11B.3 hardening fixes. |
| TX-04 | Routine assignment and Leave approval relationships | Assignee/approver/resource relationship | `DASHBOARD` / `LIFF_SELF_SERVICE` | A stale or changed relationship must not authorize the final mutation | Re-read relationship under the domain transaction and reject invalid current assignment/approver state | Routine mutation transaction; Leave approval/approver transaction services | `modules/routine/application/mutations.test.ts`; `modules/leave/application/approvals/*.test.ts`; `__tests__/api/leave-decision.test.ts`; `__tests__/api/leave-cancel.test.ts` | DIRECT | DOMAIN_OR_LIFECYCLE_POLICY | None for covered relationship races | Relationship semantics remain owned by the domain module. |
| TX-05 | Lock and re-read ordering | Employee, Routine, Stock, Leave mutation paths | `DASHBOARD` / `LIFF_SELF_SERVICE` | A lock must precede the final current-state check where the path claims protection | Wait for relevant row locks, then re-read current state and decide; no stale pre-lock snapshot may authorize | `lib/auth/workforce-transaction.ts`; per-domain transaction authorization functions | `__tests__/auth/workforce-transaction.test.ts`; Employee/Stock/Routine/Leave authorization and mutation tests | DIRECT | DOMAIN_OR_LIFECYCLE_POLICY | None for the covered lock/re-read implementations | This proves only paths that actually implement the helper/transaction contract. |
| TX-06 | Cross-domain stale authorization state | Current role or grant state in final mutation decision | `DASHBOARD` / `LIFF_SELF_SERVICE` | A mutation must not use stale authorization state after current role/grant changes | Final authorization uses current trusted state, or the row is documented as unsupported | Employee explicitly rebuilds actor; other domains have path-specific checks but no complete direct proof | Employee tests are direct; Stock/Routine/Leave tests cover adjacent re-resolution and lifecycle cases | MISSING | DOMAIN_OR_LIFECYCLE_POLICY | `11C2-TX-02`: pair current-role and current-grant stale-state tests with each claimed transaction adapter | Keep unsupported paths classified rather than inventing a guarantee. |
| TX-07 | Workflow and concurrency invariants | Version checks, idempotency, overlap, state transitions, and serializable operations | `DASHBOARD` / `LIFF_SELF_SERVICE` | ADMIN and ordinary actors cannot bypass domain concurrency or invalid-state rules | Reject stale versions, duplicate/replayed effects, overlap, processed-state changes, or conflicting writes | Domain mutation transactions and workflow services | `modules/routine/application/mutations.test.ts`; `modules/stock/__tests__/mutations.test.ts`; `__tests__/api/leave-request.test.ts`; `__tests__/api/leave-not-taken.test.ts`; Leave integration concurrency test | DIRECT | DOMAIN_OR_LIFECYCLE_POLICY | None for covered domain invariants | Authorization `ALL` never removes these checks. |
| TX-08 | Stock upload boundary | `stock.inventory.manage` plus image/file write | `DASHBOARD` | Stale authority must not reach a file-system write after preflight | Require capability before parsing/file work and immediately before the write | `app/api/uploads/image/route.ts`; Stock authorization adapter | `__tests__/api/uploads-image-route.test.ts` | DIRECT | DOMAIN_OR_LIFECYCLE_POLICY | Documented residual file-system TOCTOU remains accepted; address only if atomic file authorization is later required | Database authorization and file-system write are not one atomic transaction. |
| TX-09 | Read-only and explicitly non-transactional paths | Reads, Employee create/import, and other paths without a transaction-time claim | `DASHBOARD` / `LIFF_SELF_SERVICE` | Do not invent transaction guarantees that the current path does not claim | Apply route preflight and the documented domain/lifecycle policy; classify stronger guarantees as future work | Per-route authorization and service boundaries; no `resolveInTransaction` claim for these paths | Existing read/import tests cover their documented behavior, not a transaction race | N/A | DOMAIN_OR_LIFECYCLE_POLICY | No action in 11C.1; require an explicit policy decision before adding a guarantee | N/A means the transaction-time invariant is not claimed, not that the route is unauthenticated. |
| TX-10 | Routine import | `routine.import.manage` | `DASHBOARD` | Partial import semantics do not claim a transaction-wide authorization re-read | Keep the documented preflight/parse/validation behavior; do not label it transactionally revalidated | Routine import route and service | `__tests__/api/routine-import-preview.test.ts`; Routine import application tests | N/A | DOMAIN_OR_LIFECYCLE_POLICY | Defer stronger atomic/revalidation semantics to a separately scoped Routine decision | This surface is migrated for capability gating but has no transaction-wide re-read claim. |
| TX-11 | Resolver transaction context | Any migrated capability used inside a supported transaction | `DASHBOARD` / `LIFF_SELF_SERVICE` | Transactional callers must use the supplied current context and central resolver rather than a request-controlled actor | `resolveInTransaction` preserves central registry/channel/grant semantics | `modules/authorization/application/resolver.ts:resolveInTransaction`; transaction adapters | `modules/authorization/application/resolver.test.ts`; domain authorization transaction tests | DIRECT | MIGRATED_AUTHORIZATION | None for the resolver context contract | Domain locks and business rules remain outside the resolver. |
| ADMIN-01 | Central ADMIN resolution | All registered capabilities supported by system role | `DASHBOARD` / `LIFF_SELF_SERVICE` | ADMIN is the highest system authorization role within registered capability/channel semantics | Registered capability resolves to intended ADMIN authority and supported scopes | `modules/authorization/application/evaluator.ts`; `lib/ssot/permissions.ts:isAdminRole` | `modules/authorization/application/resolver.test.ts`; domain authorization tests; Admin route tests | DIRECT | MIGRATED_AUTHORIZATION | None for central ADMIN authority | ADMIN does not mean unrestricted execution. |
| ADMIN-02 | Authentication boundary | Any ADMIN operation | `DASHBOARD` / `LIFF_SELF_SERVICE` | ADMIN must not bypass authentication or session validity | Missing/invalid/inactive/deleted account fails before ADMIN resolution | `lib/auth/api.ts:requireAdminSession`; `modules/line/application/liff.ts` for LIFF | `__tests__/api/authorization-administration.test.ts`; `__tests__/api/authorization-administration-mutations.test.ts`; `__tests__/lib/server-auth-token-version.test.ts`; LIFF auth tests | DIRECT | MIGRATED_AUTHORIZATION | None | A request body role or route role cannot create ADMIN. |
| ADMIN-03 | ADMIN workforce lifecycle | Stock, Routine, Leave, and lower-level ADMIN paths | `DASHBOARD` / `LIFF_SELF_SERVICE` | ADMIN cannot bypass required active workforce lifecycle except explicit account-only paths | Require active Employee where the operation requires it; allow only the documented Dashboard account-only exceptions | Stock, Routine, and Leave transaction authorization adapters; workforce helpers | `modules/stock/application/authorization.test.ts`; `modules/routine/application/authorization.test.ts`; `modules/leave/application/authorization.test.ts`; `__tests__/auth/workforce.test.ts` | DIRECT | COMPATIBILITY_POLICY | Add a negative cross-domain allowlist test in 11C.2 | Account-only exceptions do not generalize to all capabilities or LIFF. |
| ADMIN-04 | Domain and workflow invariants | All ADMIN mutations | `DASHBOARD` / `LIFF_SELF_SERVICE` | ADMIN cannot bypass invalid state transitions, resource relationships, business rules, or validation | Domain command remains subject to current state, ownership/assignment semantics, and validation | Domain services and transaction adapters after authorization | Employee mutation tests; Routine mutation tests; Stock mutation tests; Leave decision/cancel/not-taken tests | DIRECT | DOMAIN_OR_LIFECYCLE_POLICY | None for covered domain invariants | `ALL` removes only a relationship restriction represented by the scope. |
| ADMIN-05 | ADMIN transaction/concurrency boundary | Mutation-sensitive ADMIN operations | `DASHBOARD` / `LIFF_SELF_SERVICE` | ADMIN cannot bypass locks, re-reads, expected-version, idempotency, or serializable constraints | Same transaction/concurrency outcome as the domain contract requires | Employee, Routine, Stock, and Leave transaction services | `__tests__/auth/workforce-transaction.test.ts`; Routine/Stock/Leave mutation and concurrency tests | DIRECT | DOMAIN_OR_LIFECYCLE_POLICY | None for covered mutation paths | No claim is made for unsupported non-transactional paths. |
| ADMIN-06 | ADMIN Team origin | `TEAM` scope | Any | ADMIN cannot fabricate a Team origin or turn Team into an implicit broad scope | Team-only ADMIN configuration fails closed unless a valid origin is present; current registry has no active Team ADMIN policy | `modules/authorization/application/evaluator.ts` ADMIN branch; registry scope validation | `modules/authorization/application/resolver.test.ts` (`ADMIN Team-only configuration fails`); `modules/authorization/application/administration.test.ts` | DIRECT | MIGRATED_AUTHORIZATION | None | ADMIN is not a reason to invent a Team. |
| ADMIN-07 | Channel restriction | LIFF-visible Admin operations and Dashboard-only recovery | `LIFF_SELF_SERVICE` | ADMIN through LIFF must remain channel-restricted | Apply LIFF operation/resource restrictions and reject Dashboard-only recovery semantics | LIFF route composition; Routine, Stock, and Leave channel adapters | `__tests__/api/line-routine-routes.test.ts`; `__tests__/api/line-stock-routes.test.ts`; `__tests__/api/line-leave-routes.test.ts`; `__tests__/api/leave-cancel.test.ts` | DIRECT | COMPATIBILITY_POLICY | None for covered channel restrictions | LIFF Admin is not a Dashboard Admin session. |
| ADMIN-08 | Current ADMIN role | Admin routes and mutation transactions | `DASHBOARD` | A stale route-time or client-supplied role must not remain authoritative after persisted role changes | Re-authenticate/re-read current role at the applicable boundary; non-ADMIN is denied | `modules/auth/application/sessions.ts`; Admin route auth; Employee transaction adapter | `__tests__/auth/auth-principal.test.ts`; `__tests__/lib/server-auth-token-version.test.ts`; `modules/employee/application/authorization.test.ts`; Admin mutation tests | DIRECT | DOMAIN_OR_LIFECYCLE_POLICY | Cross-domain mutation breadth is tracked in ACTOR-06 and TX-06 | Current role comes from persistence, not the request. |
| COMPAT-01 | Employee compatibility | Employee read, stats, and export | `DASHBOARD` | Broad legacy read policy must remain explicit and must not be mistaken for narrow relationship policy | Current documented broad floor may allow the operation; no claim of migrated fine-grained PII policy is made | `modules/employee/application/authorization.ts` legacy read/stats/export mapping | `modules/employee/application/authorization.test.ts`; `__tests__/api/employees-routes.test.ts` | DIRECT | COMPATIBILITY_POLICY | Revisit only through an explicit Employee broad-data policy decision | Employee PII/broad-data policy is out of scope for 11C.1. |
| COMPAT-02 | Employee compatibility | Employee create/update/delete/import ADMIN floor | `DASHBOARD` | Legacy Admin floor must not be read as a central User grant or as an ADMIN lifecycle bypass | Explicit trusted ADMIN floor may authorize the adapter; lifecycle, validation, and transaction rules remain | `modules/employee/application/authorization.ts`; Employee mutation service | `modules/employee/application/authorization.test.ts`; `__tests__/api/employees-routes.test.ts`; `modules/employee/application/mutations.test.ts` | DIRECT | COMPATIBILITY_POLICY | Keep floor until a separately approved Employee migration replaces it | Exact structural/configuration denials do not bridge. |
| COMPAT-03 | Department compatibility | `department.read` | `DASHBOARD` | Full-read floor is a documented compatibility policy, not Team authorization | Current compatible full response may be returned after auth; no Department-to-Team inference | `modules/department/application/authorization.ts` | `modules/department/application/authorization.test.ts`; `__tests__/api/departments-route.test.ts` | DIRECT | COMPATIBILITY_POLICY | None for the accepted floor | Department remains independent reference data. |
| COMPAT-04 | Notification compatibility | `notification.inbox.read` and `notification.inbox.update` | `DASHBOARD` | Legacy default must remain actor-owned and cannot broaden to all users | Exact no-grant compatibility may resolve to `OWN`; non-OWN broad scopes are rejected by the adapter | `modules/notification/application/authorization.ts` | `modules/notification/application/authorization.test.ts`; `__tests__/api/notifications.test.ts` | DIRECT | COMPATIBILITY_POLICY | None | This is a deliberately narrow compatibility floor. |
| COMPAT-05 | Stock compatibility | Stock catalog/request floors and Dashboard ADMIN employee-optional branch | `DASHBOARD` / `LIFF_SELF_SERVICE` | Legacy floors must not broaden requested scope or bypass the applicable workforce/channel rules | Preserve explicit Stock mapping; employee-optional behavior is Dashboard ADMIN-only for the allowlist | `modules/stock/application/authorization.ts`; `modules/stock/presentation/liff-stock-auth.ts` | `modules/stock/application/authorization.test.ts`; `__tests__/api/stock-requests-routes.test.ts`; `__tests__/api/line-stock-routes.test.ts` | DIRECT | COMPATIBILITY_POLICY | None for current mappings | LIFF requires verified workforce identity; request `scope` cannot promote a User. |
| COMPAT-06 | Routine compatibility bridge | Routine work-item read with requested `scope=all` | `DASHBOARD` | The NO_APPLICABLE_GRANT to `ALL` bridge must apply only to the exact historical work-item case | Normal USER, `routine.task.read`, exact resolver denial reason, work-item view, and requested all may bridge; all other denials remain denials | `modules/routine/application/authorization.ts`; task occurrence route/service | `modules/routine/application/authorization.test.ts`; `__tests__/api/routines-occurrences.test.ts`; `__tests__/api/routine-summary.test.ts` for contrast | DIRECT | COMPATIBILITY_POLICY | Do not retire or broaden this bridge in 11C.1 | Explicit grants, structural errors, unsupported channels, and non-work-item operations do not bridge. |
| COMPAT-07 | Routine deferred surfaces | `routine.summary.read`, `routine.reference.read`, `routine.task.export` | `DASHBOARD` / `LIFF_SELF_SERVICE` | Deferred surfaces must not be reported as migrated central authorization | Preserve current route authentication, self-service/resource behavior, and explicit deferred status until policy is selected | `app/api/routines/summary/route.ts`; `app/api/routines/reference/route.ts`; `app/api/routines/export/route.ts` | `__tests__/api/routine-summary.test.ts`; `__tests__/api/routines-reference.test.ts`; `__tests__/api/routine-export.test.ts` test legacy/deferred route behavior, not target central capability policy | MISSING | DEFERRED_AUTHORIZATION_SURFACE | `11C2-DEFERRED-01`: decide target policy and then add regression coverage; do not migrate automatically | Summary/reference/export are excluded from the 35 migrated capabilities. |
| COMPAT-08 | Routine LIFF Admin compatibility | Routine task self-service | `LIFF_SELF_SERVICE` | LIFF Admin compatibility must remain Employee-scoped and cannot inherit Dashboard all-view | Clamp task access to the linked/current Employee and preserve self-service mutation rules | Routine actor mode and LIFF route composition | `__tests__/api/line-routine-routes.test.ts`; `modules/routine/application/authorization.test.ts`; `__tests__/api/line-routine-self-service-routes.test.ts` | DIRECT | COMPATIBILITY_POLICY | None for current clamp | This is separate from deferred Dashboard summary/export policy. |
| COMPAT-09 | Leave compatibility | Leave request/approval ownership and explicit account-only Admin mapping | `DASHBOARD` / `LIFF_SELF_SERVICE` | Legacy relationship floors and narrow Admin exception must remain explicit | Apply `OWN`/`ASSIGNED`/documented Admin mapping; preserve workflow and lifecycle rules | `modules/leave/application/authorization.ts`; Leave workflow services | `modules/leave/application/authorization.test.ts`; `__tests__/api/leave-decision.test.ts`; `__tests__/api/leave-cancel.test.ts`; `__tests__/api/leave-approvers.test.ts` | DIRECT | COMPATIBILITY_POLICY | None for current migrated Leave mapping | No generic `ALL` compatibility is introduced. |
| COMPAT-10 | Leave deferred report/export | Leave report/export operations | `DASHBOARD` | Report/export must not be represented as a migrated capability merely because the route authenticates | Preserve current route/domain checks and explicit deferred status | `app/api/leave/export/route.ts`; report services | `__tests__/api/leave-export.test.ts` covers current route/report behavior but not a migrated central capability contract | MISSING | DEFERRED_AUTHORIZATION_SURFACE | `11C2-DEFERRED-02`: select report/export policy and add a dedicated authorization matrix | Employee broad-data and Leave reporting decisions remain out of scope. |
| COMPAT-11 | Leave participant and attachment access | Leave participant/detail/attachment operations | `DASHBOARD` / `LIFF_SELF_SERVICE` | Domain participant and file ownership rules must not be relabeled as generic capability coverage | Enforce current participant/approver/owner/admin domain relationship and safe file/path rules | Leave attachment/detail routes and domain policy | `__tests__/api/leave-attachment.test.ts`; `__tests__/api/line-leave-routes.test.ts`; Leave participant/attachment tests | DIRECT | DOMAIN_OR_LIFECYCLE_POLICY | Keep as domain policy until a dedicated capability is approved | This row is not part of the eight migrated Leave capabilities. |
| COMPAT-12 | Leave recovery and LIFF cancellation exceptions | Recovery/admin decision and self-service cancellation | `DASHBOARD` / `LIFF_SELF_SERVICE` | Explicit recovery/domain exceptions must not become generic authorization bypasses | Dashboard Admin recovery remains domain-gated; LIFF cannot use recovery override; ordinary cancellation remains relationship/workflow gated | `modules/leave/application/authorization.ts`; recovery and cancellation route/service boundaries | `__tests__/api/leave-admin-recovery.test.ts`; `__tests__/api/leave-cancel.test.ts`; `__tests__/api/line-leave-routes.test.ts`; `__tests__/api/leave-not-taken.test.ts` | DIRECT | DOMAIN_OR_LIFECYCLE_POLICY | None for current exception boundaries | The exception is channel- and operation-specific. |
| COMPAT-13 | Email Request deferred surface | `email.request.read`, `email.request.create` | `DASHBOARD` | Existing Admin/API session handling must not be mistaken for a migrated central capability | Preserve current explicit route behavior and deferred status; no capability registry migration in this phase | `app/api/email-request/route.ts`; outbox/email service; existing session guards | No dedicated central authorization regression suite proves the target capability policy | MISSING | DEFERRED_AUTHORIZATION_SURFACE | `11C2-DEFERRED-03`: decide Email Request authorization, then add route/service tests | Do not force deferred Email into the migrated count. |
| COMPAT-14 | Presentation-only policy | Dashboard and LIFF navigation, tabs, buttons, and projections | `DASHBOARD` / `LIFF_SELF_SERVICE` | UI visibility can be stale, absent, or permissive without changing server authority | Direct server invocation remains the security test; projections are informative only | `app/_lib/auth/current-user.ts`; `modules/line/application/liff.ts:getLiffCapabilities` | `__tests__/auth/current-user-projection.test.ts`; direct API denial suites | DIRECT | PRESENTATION_ONLY | None for the boundary; add UI tests only for UX, not security authority | Do not count a hidden control as an authorization regression test. |
| COMPAT-15 | Team and organization architecture | Future Team policy; Department reference data | Any | Team is not Department, TeamRole names do not imply authority, and no Team origin may be inferred from employee metadata | Keep Team policy inactive and require explicit origin/configuration before migration | `docs/architecture/dependency-rules.md`; `docs/architecture/module-boundaries.md`; authorization persistence and resolver contracts | Architecture checker tests; registry/resolver origin tests; administration tests | DIRECT | ARCHITECTURE_BOUNDARY | No action in 11C.1; a future Team migration needs its own domain/resource matrix | This explicitly excludes Team activation and Department inference. |

## Coverage summary grouped by invariant

Counts below are derived from the matrix rows above. `N/A` is included rather
than silently counted as a gap because the current implementation explicitly
does not claim that invariant for those paths.

| Invariant dimension | Total | DIRECT | INDIRECT | MISSING | N/A |
| --- | ---: | ---: | ---: | ---: | ---: |
| `AUTHN-*` Authentication boundary | 4 | 4 | 0 | 0 | 0 |
| `LIFE-*` Identity lifecycle | 6 | 6 | 0 | 0 | 0 |
| `ACTOR-*` Trusted actor provenance | 7 | 6 | 0 | 1 | 0 |
| `CAP-*` Capability resolution | 12 | 8 | 3 | 1 | 0 |
| `SCOPE-*` Resource scopes | 9 | 8 | 0 | 0 | 1 |
| `CHANNEL-*` Channel isolation and projections | 7 | 6 | 1 | 0 | 0 |
| `API-*` Direct API enforcement | 10 | 9 | 0 | 1 | 0 |
| `TX-*` Transaction-time revalidation | 11 | 7 | 0 | 2 | 2 |
| `ADMIN-*` ADMIN invariants | 8 | 8 | 0 | 0 | 0 |
| `COMPAT-*` Compatibility and deferred surfaces | 15 | 12 | 0 | 3 | 0 |
| **Total** | **89** | **74** | **4** | **8** | **3** |

Required dimensions A through J are represented as follows: authentication and
lifecycle in `AUTHN-*` and `LIFE-*`; actor provenance in `ACTOR-*`; resolver
decisions in `CAP-*`; scopes in `SCOPE-*`; channel boundaries in `CHANNEL-*`;
direct API enforcement in `API-*`; transaction-time behavior in `TX-*`;
ADMIN behavior in `ADMIN-*`; and compatibility/deferred classification in
`COMPAT-*`. Presentation and architecture constraints are deliberately
separate rows rather than being counted as server authorization.

## Coverage summary grouped by domain and surface

The following is a non-overlapping ownership view: each matrix row is counted
once in the bucket where its primary evidence was audited. Cross-domain rows
are assigned to the shared boundary bucket, so the table totals exactly 89.

| Primary domain/surface bucket | Matrix rows | Total | DIRECT | INDIRECT | MISSING | N/A |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Auth/session and lifecycle | `AUTHN-*`, `LIFE-*` | 10 | 10 | 0 | 0 | 0 |
| Central actor/resolver/registry | `ACTOR-*`, `CAP-*` | 19 | 14 | 3 | 2 | 0 |
| Cross-domain scope semantics | `SCOPE-*` | 9 | 8 | 0 | 0 | 1 |
| Dashboard, LIFF, and presentation boundary | `CHANNEL-*` | 7 | 6 | 1 | 0 | 0 |
| Employee API and migrated policy | `API-01` | 1 | 1 | 0 | 0 | 0 |
| Department API and migrated policy | `API-02` | 1 | 1 | 0 | 0 | 0 |
| Routine migrated API | `API-03` | 1 | 1 | 0 | 0 | 0 |
| Stock migrated API | `API-04` | 1 | 1 | 0 | 0 | 0 |
| Leave migrated API | `API-05` | 1 | 1 | 0 | 0 | 0 |
| Audit API | `API-06` | 1 | 1 | 0 | 0 | 0 |
| Notification API | `API-07` | 1 | 1 | 0 | 0 | 0 |
| Authorization Administration API | `API-08` | 1 | 1 | 0 | 0 | 0 |
| Cross-domain direct API breadth | `API-09`, `API-10` | 2 | 1 | 0 | 1 | 0 |
| Transaction and concurrency enforcement | `TX-*` | 11 | 7 | 0 | 2 | 2 |
| ADMIN cross-domain invariants | `ADMIN-*` | 8 | 8 | 0 | 0 | 0 |
| Employee compatibility | `COMPAT-01`, `COMPAT-02` | 2 | 2 | 0 | 0 | 0 |
| Department compatibility | `COMPAT-03` | 1 | 1 | 0 | 0 | 0 |
| Notification compatibility | `COMPAT-04` | 1 | 1 | 0 | 0 | 0 |
| Stock compatibility | `COMPAT-05` | 1 | 1 | 0 | 0 | 0 |
| Routine compatibility/deferred | `COMPAT-06` to `COMPAT-08` | 3 | 2 | 0 | 1 | 0 |
| Leave compatibility/deferred/domain | `COMPAT-09` to `COMPAT-12` | 4 | 3 | 0 | 1 | 0 |
| Email deferred surface | `COMPAT-13` | 1 | 0 | 0 | 1 | 0 |
| Presentation-only surface | `COMPAT-14` | 1 | 1 | 0 | 0 | 0 |
| Team/Department architecture boundary | `COMPAT-15` | 1 | 1 | 0 | 0 | 0 |
| **Total** |  | **89** | **74** | **4** | **8** | **3** |

All currently migrated domain surfaces are represented: central Authorization,
Authorization Administration, Employee, Department, Routine, Stock, Leave,
Audit, Notification, Dashboard, and LIFF. The registry's Email capabilities
and the non-migrated Routine and Leave surfaces remain explicitly deferred.

## Existing strong coverage to reuse

The following tests are the strongest current regression building blocks and
should be extended rather than replaced by a giant synthetic test:

| Security boundary | Existing evidence to reuse | Why it is strong |
| --- | --- | --- |
| Central resolver semantics | `modules/authorization/application/resolver.test.ts`; `modules/authorization/application/grant-validation.test.ts`; `modules/authorization/registry.test.ts` | Intentionally asserts registry lookup, channel failure, default deny, active grant union, scope normalization, ADMIN semantics, origin validation, and invalid persisted configuration. |
| Current account/session identity | `__tests__/auth/auth-principal.test.ts`; `__tests__/lib/server-auth-token-version.test.ts`; `__tests__/auth/workforce.test.ts` | Proves current persisted role, token/session lifecycle, User/Employee lifecycle, and the explicit account-only Admin seam. |
| LIFF provenance | `__tests__/auth/liff.test.ts`; `__tests__/lib/line-liff-session.test.ts` | Proves verified claims, current lifecycle/link state, token rejection, and safe cookie/session behavior. |
| Transactional workforce revalidation | `__tests__/auth/workforce-transaction.test.ts` | Proves lock/re-read ordering and detects lifecycle changes while waiting for a lock. |
| Routine target and assignment hardening | `modules/routine/application/mutations.test.ts`; `modules/routine/application/authorization.test.ts`; `__tests__/api/routines-task-by-id.test.ts`; `__tests__/api/routines-occurrence-by-id.test.ts` | Proves current assignee/creator semantics, target Employee lifecycle, actor/capability separation, expected versions, and workflow invariants. |
| Stock authorization and write boundary | `modules/stock/application/authorization.test.ts`; `modules/stock/__tests__/mutations.test.ts`; `__tests__/api/uploads-image-route.test.ts`; `__tests__/api/stock-requests-routes.test.ts` | Proves compatibility mapping, requested-scope non-broadening, transaction revalidation, and auth immediately before file write. |
| Leave workflow and exception paths | `modules/leave/application/authorization.test.ts`; `modules/leave/application/approvals/*.test.ts`; `__tests__/api/leave-decision.test.ts`; `__tests__/api/leave-cancel.test.ts`; `__tests__/api/leave-not-taken.test.ts` | Proves relationship/workflow/lifecycle rules, approver locking, fallback candidate re-read, recovery limits, and concurrency behavior. |
| Direct API and Admin boundaries | `__tests__/api/employees-routes.test.ts`; `__tests__/api/departments-route.test.ts`; `__tests__/api/audit-log-route.test.ts`; `__tests__/api/notifications.test.ts`; `__tests__/api/authorization-administration-mutations.test.ts` | Proves server-side gates, query-before-return behavior, ignored authority-shaped input, and safe denial before persistence. |
| Architecture boundary | `scripts/check-architecture.mjs`; `__tests__/architecture/check-architecture.test.ts`; Routine browser graph tests | Proves browser/server and module-boundary rules relevant to trusted actor and authorization ownership. |

## Missing DIRECT regression coverage

These are the eight `MISSING` rows. They are not all production defects; each
is a finite Phase 11C.2 candidate with a precise reason for being absent.

| Work item | Matrix rows | Missing proof | Recommended Phase 11C.2 action |
| --- | --- | --- | --- |
| `11C2-CAP-01` | `CAP-05` | Direct User grant deletion/revocation followed by a fresh resolver decision | Add repository-backed revoke-then-resolve tests for read and mutation capability paths. |
| `11C2-CAP-02` | `CAP-06`, `CAP-07` | Membership removal and TeamRole grant removal are not directly followed by a fresh resolver decision | Add current-state integration cases for membership and TeamRole grant revocation; retain inactive Team/role unit cases. |
| `11C2-ACTOR-01` | `ACTOR-06` | No cross-domain direct proof that a current persisted role replaces stale route-time role in every claimed mutation transaction | Add paired current-role tests for Stock, Routine, and Leave transaction adapters. |
| `11C2-API-01` | `API-10` | No exhaustive route/capability/channel ledger with a direct assertion for every migrated pair | Build the finite route ledger, then add only missing behavior-oriented boundary tests. |
| `11C2-TX-01` | `TX-01` | No deterministic grant/membership/role revocation race between initial authorization and final write | Add narrowly scoped transaction-race tests for paths that explicitly claim transaction-time revalidation. |
| `11C2-TX-02` | `TX-06` | Cross-domain stale authorization-state coverage is incomplete even where lifecycle tests exist | Add current-role/current-grant stale-state cases; do not extend the guarantee to unsupported paths without a policy decision. |
| `11C2-DEFERRED-01` | `COMPAT-07` | Routine summary/reference/export have no target central capability regression contract | Decide target policy first, then add tests as a separate migration; preserve current deferred status meanwhile. |
| `11C2-DEFERRED-02` | `COMPAT-10` | Leave report/export has no target central capability regression contract | Decide report/export policy first, then add dedicated authorization and query-scope tests. |
| `11C2-DEFERRED-03` | `COMPAT-13` | Email Request has no target central capability regression suite | Decide Email Request policy first, then add route/service tests; do not force it into the migrated count. |

The table intentionally has eight missing rows but nine recommended labels
because `11C2-CAP-02` covers two related central resolver rows. The recommended
work is ordered by security risk: current-state revocation and stale actor
state first, then route breadth, then separately approved deferred-surface
policy decisions.

`11C2-CHANNEL-01` is an additional strengthening item for the `INDIRECT`
`CHANNEL-07` row, not one of the eight missing rows: it adds paired
Dashboard/LIFF assertions for capabilities intentionally available in both
channels.

## Real security defects discovered

No new real security defect was identified in the current source. The audit did
not silently convert missing tests into a claim that production behavior is
correct; it classified those cases as `MISSING` above.

The following previously identified Phase 11B defects were confirmed as fixed
in current source and regression tests:

| Previously risky path | Current protection | Current evidence |
| --- | --- | --- |
| Routine assignee Employee lifecycle race | Target Employees are locked and re-read before the assignee write | `modules/routine/application/authorization.ts`; `modules/routine/application/mutations.test.ts` |
| Leave approver assignment race | Approver rows and relevant candidates are locked/re-read before assignment/decision | `modules/leave/application/approvals/`; Leave approval and decision tests |
| Leave exception fallback stale snapshot | Fallback candidates are locked and re-evaluated before use | Leave approval tests and `__tests__/api/leave-cancel.test.ts` |
| Stock stale authority before file write | Authorization is checked before file processing and immediately before the file-system write | `app/api/uploads/image/route.ts`; `__tests__/api/uploads-image-route.test.ts` |

The documented residual Stock file-system TOCTOU is a known non-atomic boundary,
not a newly discovered defect in this phase. No database transaction is claimed
to cover the external file-system write.

## Compatibility and deferred surfaces explicitly excluded from migration

The following are deliberately not target-policy migration work in Phase
11C.1:

- Employee broad read, stats, export, and the explicit Admin mutation floor.
- Department full-read compatibility floor.
- Notification actor-owned `OWN` compatibility floor.
- Stock relationship floors and the Dashboard ADMIN employee-optional allowlist.
- The exact Routine normal-USER work-item `NO_APPLICABLE_GRANT -> ALL`
  compatibility bridge.
- Routine summary, reference, and export central authorization migration.
- Leave report/export capability migration.
- Leave participant/attachment access, which remains domain-owned.
- Leave recovery and LIFF cancellation exceptions, which remain explicit
  domain/channel policy.
- Email Request capability migration.
- Team activation, nested Teams, TeamRole inheritance, and any Department-to-
  Team inference.
- UI/presentation projections and navigation as authority.
- Employee PII/broad-data policy redesign and unrelated future IT capabilities.

These items must not be relabeled `MIGRATED_AUTHORIZATION` merely because they
have session, route, domain, or presentation tests.

## Recommended Phase 11C.2 work items ordered by security risk

1. Implement `11C2-CAP-01` and `11C2-CAP-02`: prove current-state direct User,
   Team membership, and TeamRole grant revocation at the resolver boundary.
2. Implement `11C2-TX-01` and `11C2-TX-02`: prove authorization/state changes
   during supported mutation transactions, using deterministic races and the
   existing lock/re-read seams.
3. Implement `11C2-ACTOR-01`: prove current persisted role replacement across
   Stock, Routine, and Leave mutation transactions.
4. Implement `11C2-API-01`: complete the finite migrated route/capability/
   channel ledger and fill only true direct-test gaps.
5. Add paired Dashboard/LIFF and ADMIN-negative cases from
   `11C2-CHANNEL-01` and the explicit account-only allowlist, without changing
   channel or lifecycle policy.
6. Make separate policy decisions for Routine deferred surfaces, Leave
   report/export, and Email Request before adding any central capability tests
   for them (`11C2-DEFERRED-01` through `11C2-DEFERRED-03`).

No Phase 11C.2 item should activate Team policy, introduce explicit DENY,
wildcards, ABAC, nested Teams, role inheritance, or a persistence redesign.

## Verification record

This section records the exact commands and observed results after the matrix
document was created. The full-suite result must remain distinct from focused
authorization results, including any known default timeout limitation.

| Command | Observed result |
| --- | --- |
| `npm.cmd run architecture:check` | PASS, exit 0. `Architecture check passed: checked 1119 repository source file(s) for module boundaries.` |
| `npm.cmd run lint:strict` | PASS, exit 0. ESLint completed with `--max-warnings=0`. |
| `npm.cmd run typecheck` | PASS, exit 0. `tsc --noEmit` completed successfully. |
| Targeted authorization/security regression tests | PASS, exit 0. Vitest reported 34 test files and 431 tests passed in 13.94s. |
| `npm.cmd run test:run` | PASS, exit 0. Vitest reported 314 test files and 2,759 tests passed; duration 226.71s. |
| `git diff --check` | PASS, exit 0. No whitespace errors reported. |

The known Phase 11B.4 baseline was a non-zero default full-suite result caused
by the architecture test named `reads changed runtime imports again on a later
scan of the same root` exceeding the default 5000 ms timeout. That timeout did
not reproduce in the current default run. The test, timeout, and configuration
were not changed, and the historical failure remains recorded as a limitation
of the prior baseline rather than rewritten as a pass.

## Production policy change statement

Production authorization policy was **not changed** in Phase 11C.1. This phase
adds only this audit matrix document. No production source, schema, seed grant,
compatibility policy, deferred surface, or test configuration was changed.
