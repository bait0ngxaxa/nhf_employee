# NHF Employee — Authorization Phase 12C.2: Employee Additive Default Policy Migration

สถานะ: **CLOSED**

Phase 12C.2 migrates the complete registered Employee capability adapter from
the Phase 8 migration-era fallback to the permanent Phase 12 authorization
model:

```text
Default Domain Policy
        +
Configured Capability Grants
        =
Effective Authorization
```

The migration preserves the existing NHF Employee product behavior. It does
not narrow Employee visibility, introduce a new Employee scope, change the
capability registry, change Team semantics, or migrate another domain.

## 1. Baseline and source contracts

The implementation starts from commit
`77ea17acda179fdb38c793023c365b96bcdc82df`:

```text
feat(auth): migrate department and notification additive policies
```

The policy source is [Phase 12A — additive policy
contract](authorization-phase-12a-additive-policy-contract.md). Phase 12A
locks existing no-grant USER behavior as permanent Default Domain Policy and
defines Team, TeamRole, and direct User grants as additive authority.

The composition source is [Phase 12B — additive composition
core](authorization-phase-12b-additive-composition-core.md). Its public
`composeAuthorizationAuthority()` primitive owns the union and fail-closed
rules; Employee does not duplicate that logic.

The direct precedent is [Phase 12C.1 — Department + Notification additive
migration](authorization-phase-12c1-department-notification-additive-migration.md).
Employee follows its permanent adapter/result pattern while retaining
Employee-specific transaction and lifecycle boundaries.

## 2. Complete Employee capability inventory

The code-owned `CAPABILITY_REGISTRY` remains unchanged. The complete
Employee adapter inventory is:

| Capability | Registered scopes | Registered channel | Runtime mode after 12C.2 |
|---|---|---|---|
| `employee.read` | `ALL` | `DASHBOARD` | `CENTRAL_WITH_DEFAULT_POLICY` |
| `employee.stats.read` | `ALL` | `DASHBOARD` | `CENTRAL_WITH_DEFAULT_POLICY` |
| `employee.create` | `ALL` | `DASHBOARD` | `CENTRAL_ONLY` |
| `employee.update` | `ALL` | `DASHBOARD` | `CENTRAL_ONLY` |
| `employee.delete` | `ALL` | `DASHBOARD` | `CENTRAL_ONLY` |
| `employee.import` | `ALL` | `DASHBOARD` | `CENTRAL_ONLY` |
| `employee.export` | `ALL` | `DASHBOARD` | `CENTRAL_WITH_DEFAULT_POLICY` |

No scope or channel was added, removed, or reinterpreted.

## 3. Permanent Employee Default Domain Policy

For a normal USER, `defaultEmployeeScopes()` is role-independent and is the
single Employee default-policy definition:

| Capability | Permanent normal-USER default |
|---|---|
| `employee.read` | `[ALL]` |
| `employee.stats.read` | `[ALL]` |
| `employee.export` | `[ALL]` |
| `employee.create` | `[]` |
| `employee.update` | `[]` |
| `employee.delete` | `[]` |
| `employee.import` | `[]` |

The empty defaults are intentional authority, not missing configuration. They
preserve the existing denial of ungranted USER management operations. The
non-empty defaults preserve the existing organization-wide Employee list,
stats, and export behavior.

## 4. ADMIN authority

ADMIN is not represented in `defaultEmployeeScopes()`. After capability and
channel validation, the central resolver returns the existing
`SYSTEM_ROLE / ADMIN` authority. The Employee composer preserves that result
and does not apply normal-USER defaults to an ADMIN actor.

Therefore:

```text
normal USER + no management grant = [] -> DENY
normal USER + explicit management ALL grant = ALL -> ALLOW
ADMIN + central SYSTEM_ROLE / ADMIN = ALL -> ALLOW
```

ADMIN still has to pass authentication, active workforce requirements at the
route boundary, target validation, lifecycle checks, business rules,
transaction/concurrency checks, and all other existing Employee safeguards.

## 5. Adapter composition and removed compatibility fallback

Before Phase 12C.2, the Employee adapter translated a
`NO_APPLICABLE_GRANT` decision through `legacyEmployeeScopes()`. That function
also contained an ADMIN mutation fallback. Neither behavior is used now.

The permanent flow is:

```text
trusted Employee DASHBOARD actor
        -> authorization.resolve(...)
        -> defaultEmployeeScopes(capability)
        -> composeAuthorizationAuthority(
               actor,
               capability,
               defaultScopes,
               configuredDecision,
           )
        -> EmployeeCapabilityAuthorization
```

The Employee result exposes:

```ts
interface EmployeeCapabilityAuthorization {
    readonly actor: EmployeeAuthorizationActor;
    readonly capability: EmployeeCapability;
    readonly decision: AuthorizationDecision;
    readonly defaultScopes: readonly AuthorizationScope[];
    readonly scopes: readonly AuthorizationScope[];
}
```

`decision` remains the central configured/system-role decision. `defaultScopes`
describes domain policy, and `scopes` is the final composed authority. No fake
default grant record is created; configured provenance remains in the
composer/resolver result infrastructure.

The Employee-only migration names were removed from the active contract:

| Migration-era name | Permanent name |
|---|---|
| `EMPLOYEE_MIGRATED_CAPABILITIES` | `EMPLOYEE_CAPABILITIES` |
| `EmployeeMigratedCapability` | `EmployeeCapability` |
| `resolveEmployeeCapabilityForMigration` | `resolveEmployeeCapability` |
| `assertEmployeeCapabilityForMigration` | `assertEmployeeCapability` |
| `legacyEmployeeScopes` | `defaultEmployeeScopes` |

Routes, the Employee barrel, presentation code, and tests use the permanent
names. Migration terminology retained in historical Phase 8 closure records
is historical evidence only; it is not an active Employee runtime contract.

## 6. Non-transactional route authorization

All current Employee route callers use `assertEmployeeCapability()`:

| Route surface | Capability |
|---|---|
| `GET /api/employees` | `employee.read / ALL` |
| `GET /api/employees/stats` | `employee.stats.read / ALL` |
| `POST /api/employees` | `employee.create / ALL` |
| `PATCH /api/employees/[id]` | `employee.update / ALL` |
| `DELETE /api/employees/[id]` | `employee.delete / ALL` |
| `POST /api/employees/import` | `employee.import / ALL` |
| `GET /api/employees/export` | `employee.export / ALL` |

The route ordering, authentication boundary, body-read behavior, response
semantics, validation, and service calls are unchanged. Create and import
remain route-level authorization boundaries; `createEmployee()` and the CSV
import service were not made responsible for central capability authorization.

For an eligible normal USER with no grant, read/stats/export compose to
`[ALL]`, while create/update/delete/import remain denied. Explicit valid USER
`ALL` grants are additive and do not promote the actor to ADMIN.

## 7. Transaction-time update/delete authorization

`resolveEmployeeCapabilityInTransaction()` uses the same
`defaultEmployeeScopes()` and `composeAuthorizationAuthority()` path as
non-transactional authorization. There is one default-policy definition and
no transaction-specific policy copy.

The existing authoritative mutation sequence remains:

```text
route authorization check
        |
        v
serializable transaction
        |
        v
lock actor User rows
        |
        v
read actor User, lock actor Employee rows, and re-read User
        |
        v
validate active User/Employee lifecycle and actor Employee ID consistency
        |
        v
build trusted current actor from persisted role/identity
        |
        v
authorization.resolveInTransaction(...)
        |
        v
compose Employee default policy + current configured authority
        |
        v
assert employee.update/delete / ALL
        |
        v
lock/re-read target and apply the existing mutation/business rules
```

The transaction does not reuse the route-time decision. If a USER's
`employee.update` or `employee.delete` grant disappears before transaction-time
resolution, the resolver returns `NO_APPLICABLE_GRANT`; the empty Employee
default then produces no effective authority and the mutation is denied.
ADMIN remains transactionally authorized through the current persisted
`SYSTEM_ROLE / ADMIN` decision.

## 8. Lifecycle and business invariant preservation

Capability authorization is only a prerequisite. An explicit USER management
grant does not bypass:

- active acting User and active acting Employee requirements;
- actor Employee ID consistency and row locking;
- self-offboarding protection;
- last-active-ADMIN protection;
- target existence and account lifecycle checks;
- subordinate dependency checks;
- Leave/offboarding dependency checks;
- email format, organization-email, duplicate-email, and identity-sync rules;
- status lifecycle behavior and session/account revocation;
- audit behavior, serializable transactions, and concurrency handling.

The migration adds regression coverage for transaction-time grant loss and for
self-offboarding with an explicit USER delete grant. Existing Employee mutation
coverage continues to establish the remaining lifecycle and dependency
invariants. The contract is:

```text
authorization ALLOW != business invariant ALLOW
```

No `if ADMIN then skip lifecycle check` path was introduced.

## 9. Query, import, export, and broad-read preservation

Employee query semantics were not changed. List/search/filter/pagination,
deleted-row filtering, bootstrap-admin exclusions where already applied,
stats filtering, export filters/limits/CSV shape, and import processing/partial
success remain owned by their existing Employee services.

`employee.read`, `employee.stats.read`, and `employee.export` remain
organization-wide `ALL` policy for eligible no-grant USER actors. Phase 12C.2
does not introduce `OWN`, `TEAM`, Department, manager hierarchy, or PII/HR
policy. Department remains reference data and is not an authorization
grouping.

## 10. Presentation projection

`getEmployeePresentationCapabilities()` uses one `authorization.resolveMany()`
call over `EMPLOYEE_CAPABILITIES` and composes each returned decision through
the same Employee default-policy path.

For a normal USER with no configured grants, the projection remains:

```text
canReadEmployees    = true
canReadStats        = true
canExportEmployees  = true

canCreateEmployees  = false
canUpdateEmployees  = false
canDeleteEmployees  = false
canImportEmployees  = false
```

Configured grants can enable the corresponding mutation field, but no grant
can turn off the permanent read/stats/export baseline. ADMIN presentation
authority is derived from the central resolver's system-role decisions. The
UI remains non-authoritative; routes and mutation transactions remain the
server authority.

## 11. Fail-closed behavior

Employee composition only contributes a default for a valid central
`NO_APPLICABLE_GRANT` decision. It does not recover structural failures:

| Condition | Employee outcome |
|---|---|
| `UNKNOWN_CAPABILITY` | denied |
| `CHANNEL_NOT_SUPPORTED` | denied |
| `AuthorizationConfigurationError` | propagated/fail closed |
| capability mismatch | configuration error/fail closed |
| unsupported configured scope | central resolver configuration error propagated |

There is no Employee-level `if (!decision.allowed) fallback` branch.

## 12. Administration catalog and grant behavior

The Employee metadata no longer uses `EMPLOYEE_COMPATIBILITY` or
`CENTRAL_WITH_COMPATIBILITY`:

```text
employee.read       -> CENTRAL_WITH_DEFAULT_POLICY, GRANTABLE
employee.stats.read -> CENTRAL_WITH_DEFAULT_POLICY, GRANTABLE
employee.export     -> CENTRAL_WITH_DEFAULT_POLICY, GRANTABLE

employee.create     -> CENTRAL_ONLY, GRANTABLE
employee.update     -> CENTRAL_ONLY, GRANTABLE
employee.delete     -> CENTRAL_ONLY, GRANTABLE
employee.import     -> CENTRAL_ONLY, GRANTABLE
```

The existing generic Administration commands accept `ALL` Employee grants
from each supported source. Regression coverage proves add/remove for:

- Team: `employee.read / ALL`;
- TeamRole: `employee.stats.read / ALL`;
- direct User: `employee.export / ALL`.

The same generic commands remain blocked for compatibility-backed examples
such as `routine.task.read`, `stock.request.read`, and `leave.request.read`.
No Employee-specific grant API, seed, backfill, or database migration was
added.

## 13. Catalog counts and migration boundary

The final counts are recomputed from the actual catalog tests:

```text
CENTRAL_WITH_DEFAULT_POLICY     6
CENTRAL_WITH_COMPATIBILITY     16
CENTRAL_ONLY                   13
DEFERRED                        5
TOTAL                          40
```

Administrative readiness is:

```text
GRANTABLE                      19
POLICY_ACTIVATION_REQUIRED     16
DEFERRED                        5
TOTAL                          40
```

After Phase 12C.2:

```text
Default-policy migrated:
- Department
- Notification
- Employee

Still compatibility-backed:
- Routine
- Stock
- Leave

Deferred:
- Routine deferred surfaces
- Email Request / future IT
```

Routine, Stock, Leave, Email Request, future IT, and Routine deferred
capabilities were not activated or otherwise migrated in this phase.

## 14. Effective Access Inspector limitation

Phase 12C.2 does not implement Phase 12E. The Administration inspector still
primarily displays central resolver/configured authority. Consequently, an
eligible no-grant normal USER may appear resolver-denied for
`employee.read`, `employee.stats.read`, or `employee.export` even though the
final Employee domain result is allowed by permanent Default Domain Policy.

The inspector must not label resolver scopes as final Employee effective
scopes. The full `Default + Additional + Effective` operator visualization
remains a Phase 12E responsibility.

## 15. Verification record

Employee authorization tests explicitly cover:

- all seven registered capabilities and the exact default matrix;
- no-grant USER read/stats/export allow and mutation denial;
- explicit USER `ALL` grants for all seven capabilities;
- read baseline preservation after configured grant add/remove;
- Team/TeamRole/direct User Administration grant add/remove;
- structural denial, configuration error, capability mismatch, and unsupported
  configured-scope fail-closed behavior;
- transaction-time actor revalidation, locks, current persisted role, and grant
  revocation denial;
- presentation projection and route caller migration;
- existing Employee query, export, import, mutation, and lifecycle suites.

The focused command was:

```text
npm.cmd run test:run -- modules/employee/application/authorization.test.ts modules/employee/application/mutations.test.ts modules/employee/application/presentation-capabilities.test.ts modules/employee/application/import-employees.test.ts modules/employee/infrastructure/persistence/employee-queries.test.ts modules/employee/infrastructure/persistence/employee-list.test.ts modules/employee/infrastructure/export/employee-export.test.ts modules/employee/application/audit.test.ts modules/employee/schemas/employee.test.ts __tests__/api/employees-routes.test.ts __tests__/api/authorization-current-state.test.ts __tests__/api/phase-11c2c1-employee-routine-route-authorization.test.ts __tests__/auth/current-user-projection.test.ts __tests__/dashboard-employee-pages.test.tsx modules/employee/presentation/dashboard/EmployeeManagementSection.test.tsx modules/employee/presentation/dashboard/EmployeeSearchControls.test.tsx modules/employee/presentation/dashboard/EmployeeTable.test.tsx modules/employee/presentation/dashboard/context/EmployeeProvider.test.tsx modules/authorization/application/administration.test.ts modules/authorization/application/administration-mutations.test.ts modules/authorization/application/composition.test.ts modules/authorization/application/resolver.test.ts
```

It passed with **22 test files and 295 tests**. The required direct resolver
checks also passed:

```text
npx.cmd vitest run modules/authorization/application/composition.test.ts  # 1 file, 23 tests
npx.cmd vitest run modules/authorization/application/resolver.test.ts     # 1 file, 30 tests
```

Repository-wide verification passed:

```text
npm.cmd run architecture:check  # checked 1123 source files
npm.cmd run lint:strict
npm.cmd run typecheck
npm.cmd run test:run             # 317 test files, 2820 tests
git diff --check
```

No development server or production build was run. No schema, migration,
seed, grant backfill, or persisted authorization data changed.

## 16. Exact handoff

The next implementation phase is:

```text
Phase 12C.3 — Routine Additive Default Policy Migration
```

Phase 12C.2 closure invariant:

> Employee authorization no longer depends on temporary compatibility fallback mechanics. The existing broad USER read/stats/export behavior is supplied as permanent Default Domain Policy, while create/update/delete/import have no normal-USER default authority and remain centrally grantable. ADMIN continues through SYSTEM_ROLE authority, explicit USER grants remain additive, and Employee transaction/lifecycle/business invariants remain authoritative after capability authorization.
