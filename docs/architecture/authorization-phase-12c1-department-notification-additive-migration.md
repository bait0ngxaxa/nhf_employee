# NHF Employee — Authorization Phase 12C.1: Department + Notification Additive Migration

Status: **CLOSED**  
Date: 2026-09-16  
Starting commit: `9319722052d5c40c434797a3fe9a8446b740f4b5` — `fix(auth): bypass USER default validation for ADMIN composition`

## 1. Scope and source contracts

Phase 12C.1 is the first production-domain runtime migration from temporary
compatibility fallback mechanics to the permanent Phase 12 architecture:

```text
Default Domain Policy + Configured Capability Grants = Effective Authorization
```

The Phase 12A policy source is
[authorization-phase-12a-additive-policy-contract.md](authorization-phase-12a-additive-policy-contract.md).
It locks the existing no-grant USER behavior as permanent Default Domain
Policy, and defines Team, TeamRole, and direct User grants as additive authority
that cannot narrow the baseline.

The Phase 12B composition source is
[authorization-phase-12b-additive-composition-core.md](authorization-phase-12b-additive-composition-core.md).
Its public runtime seam is
`composeAuthorizationAuthority(actor, capability, defaultScopes,
configuredDecision, registry?)`. The central resolver remains the source of
configured and system-role authority and is unchanged by this phase.

Only these capabilities were migrated:

```text
department.read
notification.inbox.read
notification.inbox.update
```

Employee, Routine, Stock, Leave, Email Request, the future IT module, and all
other deferred surfaces remain outside this phase.

## 2. Permanent domain default policies

### Department

`modules/department/application/authorization.ts` now supplies:

```text
defaultDepartmentScopes("department.read") = ["ALL"]
```

The existing Department query and response remain unchanged. Department is
reference data and remains independent from Team:

```text
Department != Team
```

No Team, grant, seed, backfill, Department-to-Team mapping, or Department-based
authorization inference is required for the USER baseline.

### Notification

`modules/notification/application/authorization.ts` now supplies:

```text
defaultNotificationScopes("notification.inbox.read")   = ["OWN"]
defaultNotificationScopes("notification.inbox.update") = ["OWN"]
```

The code-owned registry remains unchanged:

```text
notification.inbox.read   -> supportedScopes ["OWN"]
notification.inbox.update -> supportedScopes ["OWN"]
```

No `ALL` scope was added. Read and update remain independent capabilities.

## 3. Runtime flow

Before Phase 12C.1, each adapter had a migration-only branch equivalent to:

```text
resolver ALLOW
    -> use configured scopes

resolver NO_APPLICABLE_GRANT
    -> legacy compatibility fallback scopes
```

After Phase 12C.1, both migrated adapters use the same additive flow:

```text
trusted domain actor
        |
        v
defaultDepartmentScopes(...) or defaultNotificationScopes(...)
        |
        + authorization.resolve(...)
        |
        v
composeAuthorizationAuthority(
    actor,
    capability,
    defaultScopes,
    configuredDecision,
)
        |
        v
domain scope assertion
        |
        v
existing query/resource policy
```

The adapters no longer translate `NO_APPLICABLE_GRANT` through a local
compatibility branch. They do not use a local `if (!decision.allowed) fallback`
path. Structural denials and resolver/configuration failures remain
fail-closed through the Phase 12B composer and central resolver.

The former migration-only adapter names were deliberately renamed within these
two domains: `DEPARTMENT_MIGRATED_CAPABILITIES` and
`NOTIFICATION_MIGRATED_CAPABILITIES` became `DEPARTMENT_CAPABILITIES` and
`NOTIFICATION_CAPABILITIES`; the `*CapabilityForMigration` entry points became
the permanent `resolve*Capability` and `assert*Capability` entry points.
`usedMigrationCompatibility` and the `legacyDepartmentScopes` /
`legacyNotificationScopes` concepts were removed from these two adapter
contracts. Compatibility names and fields in Employee, Routine, Stock, Leave,
Audit, and their historical records were not changed.

## 4. Resource and privacy boundaries

The Notification route and repository audit covered all four production
surfaces:

```text
GET   /api/notifications
GET   /api/notifications/all
PATCH /api/notifications/[id]/read
POST  /api/notifications/mark-all-read
```

The authenticated server-side user ID remains supplied to the application
queries/commands and is retained in every relevant persistence predicate:

```text
latest/history/count reads      -> where userId = trusted actor userId
single read-state update        -> where id = target id AND userId = actor userId
mark-all-read updateMany        -> where userId = actor userId AND isRead = false
```

Therefore a configured `OWN` grant cannot make User A read or update User B's
inbox. Team membership does not redefine `OWN`; it remains the authenticated
actor's inbox. Department query behavior was likewise left unchanged.

## 5. Administration runtime mode and catalog

`RuntimeAuthorizationMode` now has the four intended values:

```text
CENTRAL_ONLY
CENTRAL_WITH_DEFAULT_POLICY
CENTRAL_WITH_COMPATIBILITY
DEFERRED
```

`CENTRAL_WITH_DEFAULT_POLICY` means central configured/system-role authority
plus a permanent domain default composed by the Phase 12B primitive. Its
administration mapping is:

```text
CENTRAL_ONLY                 -> GRANTABLE
CENTRAL_WITH_DEFAULT_POLICY  -> GRANTABLE
CENTRAL_WITH_COMPATIBILITY   -> POLICY_ACTIVATION_REQUIRED
DEFERRED                     -> DEFERRED
```

Exactly the three migrated capabilities are now
`CENTRAL_WITH_DEFAULT_POLICY`, `GRANTABLE`, and
`administrativelyGrantable: true`. No `nonGrantableReason` is attached to
them. Employee, Routine, Stock, and Leave compatibility metadata remains
unchanged.

The resulting inventory, computed from the code-owned registry and catalog, is:

```text
Runtime authorization mode                 Count
CENTRAL_WITH_DEFAULT_POLICY                    3
CENTRAL_WITH_COMPATIBILITY                    19
CENTRAL_ONLY                                  13
DEFERRED                                       5
                                              ---
Total                                         40

Administrative readiness                    Count
GRANTABLE                                     16
POLICY_ACTIVATION_REQUIRED                    19
DEFERRED                                       5
                                              ---
Total                                         40
```

## 6. Administration mutations

No Department- or Notification-specific mutation command was added. Existing
generic ADMIN commands now accept valid grants because the catalog readiness
gate recognizes the three capabilities as `GRANTABLE`:

```text
Team       department.read / ALL
TeamRole   notification.inbox.read / OWN
User       notification.inbox.update / OWN
```

The same add/remove commands continue to reject compatibility-backed examples
such as `routine.task.read`, `employee.read`, `stock.request.read`, and
`leave.request.read` with `CAPABILITY_POLICY_ACTIVATION_REQUIRED`. Existing
validation, trusted ADMIN checks, transactions, audit writes, origin checks,
and unsupported-scope checks remain authoritative.

A capability may be safely administratively grantable even when the currently
supported configured scope does not expand beyond the permanent default.
Grantability means the additive configuration is safe, not that every grant
necessarily increases effective authority. This is currently expected for
Notification because its only supported configured scope is `OWN`, the same as
its permanent default.

## 7. Effective authority invariants

For Department:

```text
USER no grant       -> default ALL
USER configured ALL -> default ALL UNION configured ALL = ALL
grant removed       -> default ALL
```

For Notification:

```text
USER no grant       -> default OWN
USER configured OWN -> default OWN UNION configured OWN = OWN
grant removed       -> default OWN
```

Configured authority is additive and cannot narrow either baseline. ADMIN does
not receive USER default scopes: the composer preserves Phase 12B behavior and
uses the resolver's `SYSTEM_ROLE / ADMIN` decision. Department therefore keeps
its registered ADMIN `ALL` behavior. Notification continues to use the
evaluator's registered ADMIN semantics within its OWN-only registry; no
Notification `ALL` authority was invented.

Unknown capabilities, unsupported channels, mismatched resolver decisions,
invalid default scopes, and invalid persisted grant configuration remain errors
or denials. A default policy never recovers a structural denial or a resolver
configuration failure.

## 8. Presentation and inspector behavior

`getDepartmentPresentationCapabilities()` and
`getNotificationPresentationCapabilities()` use the same migrated composition
path as their server adapters. Existing presentation results remain:

```text
eligible no-grant USER Department  -> canReadDepartments: true
eligible no-grant USER Notification -> canReadInbox: true,
                                      canUpdateInbox: true
```

Configured grants cannot turn these booleans off. The Department API and the
Notification APIs remain authoritative; presentation is only an entry-point
projection.

The current Authorization Administration effective-access inspector remains a
central resolver/configured-authority inspector. For a migrated capability, a
resolver `DENY` with `NO_APPLICABLE_GRANT` must not be read as the final domain
denial because the permanent Default Domain Policy may still allow the normal
USER. The complete `Default + Additional + Effective` operator UX remains
deferred to Phase 12E.

## 9. Verification

Focused authorization/API/presentation/catalog/mutation verification passed:

```text
npx.cmd vitest run modules/department/application/authorization.test.ts modules/department/application/presentation-capabilities.test.ts modules/department/application/queries.test.ts __tests__/api/departments-route.test.ts modules/notification/application/authorization.test.ts modules/notification/application/presentation-capabilities.test.ts modules/notification/application/queries.test.ts modules/notification/application/commands.test.ts modules/notification/infrastructure/persistence/repository.test.ts __tests__/api/notifications.test.ts modules/authorization/application/composition.test.ts modules/authorization/application/resolver.test.ts modules/authorization/application/administration.test.ts modules/authorization/application/administration-mutations.test.ts
```

Result: **14 test files and 182 tests passed**.

The final repository verification for this closure is:

```text
npx.cmd vitest run modules/authorization/application/composition.test.ts
npx.cmd vitest run modules/authorization/application/resolver.test.ts
npm.cmd run architecture:check
npm.cmd run lint:strict
npm.cmd run typecheck
npm.cmd run test:run
git diff --check
```

Results:

```text
composition.test.ts       -> 1 file, 23 tests passed
resolver.test.ts          -> 1 file, 30 tests passed
architecture:check        -> passed (1,123 source files checked)
lint:strict               -> passed with zero warnings
typecheck                 -> passed
test:run                  -> 317 files, 2,815 tests passed
git diff --check           -> passed
```

No development server, production build, Prisma migration, seed, backfill, or
grant inventory operation was run or added.

## 10. Exact handoff to Phase 12C.2

Phase 12C.2 — Employee Additive Default Policy Migration — is the next
runtime migration. It must use the same Phase 12B composition seam, preserve
Employee's existing resource/lifecycle/query invariants, and leave the
remaining Routine, Stock, Leave, Email Request, and deferred behavior outside
its scope unless explicitly included in that phase.

The Phase 12C.1 closure invariant is:

> Department and Notification no longer depend on temporary
> `NO_APPLICABLE_GRANT` compatibility fallback mechanics. Their existing USER
> behavior is supplied as permanent Default Domain Policy and composed
> additively with centrally resolved configured grants. Their capabilities are
> administratively grantable without changing existing no-grant behavior, while
> Department/Team separation and Notification actor-owned privacy boundaries
> remain intact.
