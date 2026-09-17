# Phase 12C.3 — Routine Additive Default Policy Migration

Status: **CLOSED**

Starting commit:

```text
b9ce50422efba6effd72eae7b0795ed672e4c5b0
feat(auth): migrate employee to additive default policy
```

This closure migrates the nine currently enforced Routine capabilities from
temporary compatibility fallback mechanics to the permanent Phase 12A/12B
authorization architecture. It does not migrate deferred Routine surfaces,
Stock, Leave, Email Request, or future IT.

## Contract lineage

Phase 12A locked the existing NHF no-grant normal-USER behavior as permanent
Default Domain Policy. Configured Team, TeamRole, and direct User grants are
additional authority: a narrower configured grant cannot remove a default
scope or resource relationship. Structural channel denial, unknown
capabilities, capability mismatch, and authorization configuration errors
remain fail-closed. Phase 12A also locked the Routine work-item `scope=all`
behavior as an intentional `ALL` default for a normal USER.

Phase 12B introduced the pure
`composeAuthorizationAuthority(actor, capability, defaultScopes,
configuredDecision)` seam. It normalizes the additive scope union while
preserving the configured decision and grant provenance; it does not create a
fake `DEFAULT_POLICY` grant. Routine now uses this seam for route-time,
presentation, and transaction-time enforcement.

Phase 12C.1 migrated Department and Notification. Phase 12C.2 migrated
Employee. Those closures established the permanent adapter terminology,
generic administration readiness, and transaction-time re-resolution pattern
that Routine follows here.

## Routine capability inventory

### Enforced in Phase 12C.3

The first five capabilities have a permanent normal-USER baseline:

```text
routine.task.read
routine.task.create
routine.task.update
routine.task.delete
routine.occurrence.read
```

The following four remain central-only with an empty normal-USER baseline:

```text
routine.occurrence.override
routine.occurrence.reassign
routine.occurrence.change_due_date
routine.import.manage
```

All nine are `GRANTABLE` through the existing generic Team, TeamRole, and
direct User grant mutations. No Routine-specific administration API, seed,
backfill, grant inventory, or database migration was introduced.

### Deferred outside this phase

These registered capabilities remain explicitly `DEFERRED`:

```text
routine.task.export
routine.summary.read
routine.reference.read
```

The Routine exporter continues to call `getRoutineTaskWorkItems()` with
`authorizationMode: "DEFERRED_EXPORT"`. Summary and reference services retain
their existing deferred role/domain behavior. `isRoutineAdminActor()` remains
where those deferred callers still require it.

## Permanent Routine Default Domain Policy

For a normal USER, the exact defaults are:

| Capability | Trusted context | Default scopes |
|---|---|---|
| `routine.task.read` | management, or no task-read view option | `CREATED + ASSIGNED` |
| `routine.task.read` | work-item, `requestedScope: "mine"` | `ASSIGNED` |
| `routine.task.read` | work-item, `requestedScope: "all"` | `ALL` |
| `routine.task.create` | any enforced Routine context | `OWN` |
| `routine.task.update` | any enforced Routine context | `CREATED + ASSIGNED` |
| `routine.task.delete` | any enforced Routine context | `CREATED` |
| `routine.occurrence.read` | Dashboard | `ASSIGNED` |
| `routine.occurrence.override` | Dashboard | empty |
| `routine.occurrence.reassign` | Dashboard | empty |
| `routine.occurrence.change_due_date` | Dashboard | empty |
| `routine.import.manage` | Dashboard | empty |

The four empty-default capabilities are still `CENTRAL_ONLY`; no compatibility
or default authority was added for them. An unconfigured normal USER is denied,
while an explicit configured grant can authorize the capability subject to the
registered channel and all Routine business rules. ADMIN authority comes from
the central resolver's `SYSTEM_ROLE / ADMIN` result.

`routine.task.read` is intentionally context-sensitive. The established
management/detail paths use `CREATED + ASSIGNED`, work-item `mine` uses
`ASSIGNED`, and work-item `all` uses `ALL`. The all-scope behavior is not
reinterpreted as a migration risk in this phase: it is the Phase 12A permanent
Default Domain Policy. The Routine query still returns the active all-scope
work items according to the existing filters, focus behavior, assignment
semantics, and pagination.

## Composition and domain resource policy

The Routine adapter first obtains the trusted central resolver decision, asks
`defaultRoutineScopes()` for the permanent normal-USER default, and passes both
to `composeAuthorizationAuthority()`. It then applies Routine-owned
execution-channel semantics and returns the actor, capability, configured
decision, `defaultScopes`, final Routine `scopes`, administrative status, and
explicit `liffSelfServicePolicyApplied` metadata. There is no active
`NO_APPLICABLE_GRANT` compatibility fallback in the enforced Routine adapter.

The generic scope union is not duplicated in Routine. Routine continues to own
how scopes become resource predicates through
`buildRoutineTaskScope()`, `buildRoutineTaskAccessScope()`,
`buildRoutineOccurrenceScope()`, `buildRoutineTaskReadWhere()`,
`buildRoutineFocusAuthorizationWhere()`, and their existing relationship
helpers. Query filters, relevant-occurrence selection, active/inactive task
behavior, search, category/unit filters, due dates, timing, pagination, task
assignment, and occurrence assignment are unchanged.

LIFF task-detail authorization is a permanent Routine resource policy, not a
generic scope-array translation. The self-service predicate preserves access
through:

```text
createdBy actor
OR active task assignee
OR active occurrence assignee
```

For a normal LIFF USER, configured authority composes additively with that
baseline relationship. A narrow configured grant cannot remove occurrence-
assignee access. A configured `ALL` can expand the detail query beyond the
default relationship. The resource query therefore does not preserve the
baseline predicate in a way that blocks configured `ALL`.

## Execution-channel policy

Channel validation remains structural and happens before default composition
can authorize anything. `routine.occurrence.read` and the four central-only
Routine management capabilities are Dashboard-only. A LIFF request for one of
these capabilities therefore remains `CHANNEL_NOT_SUPPORTED`; default
`ASSIGNED` or configured authority cannot recover that denial.

Dashboard ADMIN and LIFF ADMIN are deliberately different:

```text
ADMIN + DASHBOARD
  -> central SYSTEM_ROLE / ADMIN
  -> full registered authority
  -> isAdministrative = true

ADMIN + LIFF_SELF_SERVICE
  -> central authority is composed first
  -> Routine self-service channel policy applies
  -> task scopes are limited to the established self-service envelope
  -> isAdministrative = false
```

The LIFF ADMIN restriction is not implemented as USER Default Domain Policy,
and it is not a DENY grant. It is a Routine execution-channel policy applied
after central composition. It prevents a central ADMIN `ALL` decision from
becoming unscoped LIFF task-detail access. Normal LIFF USER configured grants
remain valid wherever the registry supports them; they are not globally
clamped to the default envelope.

`isAdministrative` means trusted Dashboard ADMIN system-role authority. It is
not derived from `scopes.includes("ALL")`. A normal USER with configured
`routine.task.create / ALL` or `routine.task.update / ALL` can receive broader
target authority but remains non-administrative.

## Routine business and mutation invariants

Capability ALLOW remains separate from Routine business authorization.

- Task create keeps active User/Employee checks, assigns a normal USER's
  acting Employee as the single OWNER, removes privileged source-file
  metadata, canonicalizes reminder recipients to self-service semantics, and
  preserves idempotency and audit behavior. USER `ALL` does not bypass these
  rules; Dashboard ADMIN keeps administrative creation semantics.
- Task update keeps creator versus active-assignee behavior. Creator-only
  lifecycle authority, assignee restrictions, source metadata redaction,
  reminder normalization, active-state validation, task version checks,
  outbox behavior, and audit details remain domain-owned. USER `ALL` broadens
  target lookup without setting `isAdministrative`.
- Task delete keeps the `CREATED` baseline and can use configured `ALL` to
  broaden target selection, while preserving occurrence cleanup, pending
  outbox handling, import ledger/idempotency cleanup, audit, transaction, and
  concurrency behavior.
- Occurrence read continues to translate assignment at the occurrence layer;
  it does not reuse task creation ownership. Occurrence override, reassign,
  and due-date mutation retain active target Employee checks, exactly-one-OWNER
  and duplicate-assignee validation, schedule/due-date/reminder rules,
  reminder-version concurrency, outbox, and audit behavior.
- Import management remains `CENTRAL_ONLY / ALL / DASHBOARD`. It retains upload
  and XLS/XLSX safety validation, staged batch ownership/state rules, row
  validation and reference mapping, idempotency, conflict handling,
  transaction-time active-target checks, and audit behavior. It is not mapped
  to ordinary `routine.task.create / OWN`.

Mutation services retain the existing serializable transaction flow:

```text
route/session actor
  -> lock and re-read current User
  -> revalidate current Employee where required
  -> rebuild current AuthorizationActor
  -> authorization.resolveInTransaction()
  -> compose default + configured authority
  -> Routine channel/resource policy
  -> target predicate and business rules
  -> mutation
```

`assertActiveRoutineActorInTransaction()`, `lockUserRows()`,
`lockEmployeeRows()`, and `resolveInTransaction()` remain in place. A grant
revoked before transaction-time resolution restores a baseline-backed policy:
for example, task update returns to `CREATED + ASSIGNED` and task delete
returns to `CREATED`; a task reachable only through the removed `ALL` grant is
not authorized. Revoking the only grant for an empty-default central-only
operation denies the operation. This is resource restoration, not blanket
denial for capabilities with a permanent baseline.

Dashboard ADMIN lifecycle semantics retain the approved account-only exception
where applicable. If a linked Employee exists but is inactive, current failure
semantics remain. Normal USER and LIFF self-service actors continue to require
the appropriate active workforce state. Capability authority never bypasses
target Employee lifecycle, optimistic concurrency, idempotency, or other
business invariants.

## Presentation and administration

`getRoutinePresentationCapabilities()` uses the same permanent composition
path. For an eligible no-grant normal USER on Dashboard it continues to
project:

```text
canReadTasks = true
canCreateTasks = true
canUpdateTasks = true
canDeleteTasks = true
canReadOccurrences = true
canOverrideOccurrences = false
canReassignOccurrences = false
canChangeOccurrenceDueDate = false
canManageImports = false
```

These are capability-eligibility hints, not resource authorization. Per-task
edit/delete projection still uses `resolveRoutineTaskCapabilities()` and
resource relationships. Source metadata (`sourceFileName`, `sourceSheet`,
`sourceRow`) remains redacted for non-administrative actors, including normal
USER `ALL` grants.

The five newly default-backed capabilities are now administratively grantable
through the existing generic Team, TeamRole, and direct User add/remove
mutations. The four central-only capabilities were already grantable and
remain so. Representative add/remove coverage exists for each newly unlocked
capability. `stock.request.read` and `leave.request.read` remain blocked by
`POLICY_ACTIVATION_REQUIRED`, proving that Routine migration did not unlock
the remaining compatibility families.

The Phase 12E Effective Access Inspector is not implemented here. A resolver-
level inspector cannot honestly show one universal final Routine task-read
scope because the default depends on trusted management/work-item context;
the future inspector must display that context explicitly rather than fake a
single value.

## Catalog transition and counts

The five baseline-backed Routine capabilities moved from
`CENTRAL_WITH_COMPATIBILITY / POLICY_ACTIVATION_REQUIRED` to
`CENTRAL_WITH_DEFAULT_POLICY / GRANTABLE`:

```text
routine.task.read
routine.task.create
routine.task.update
routine.task.delete
routine.occurrence.read
```

The four empty-default capabilities remain `CENTRAL_ONLY / GRANTABLE`, and
the three deferred capabilities remain `DEFERRED`.

The final catalog counts are:

```text
CENTRAL_WITH_DEFAULT_POLICY   11
CENTRAL_WITH_COMPATIBILITY    11
CENTRAL_ONLY                  13
DEFERRED                       5
TOTAL                         40
```

Administrative readiness is:

```text
GRANTABLE                     24
POLICY_ACTIVATION_REQUIRED   11
DEFERRED                       5
TOTAL                         40
```

The remaining compatibility-backed capabilities are exactly the Stock and
Leave families. Department, Notification, Employee, and the enforced Routine
surfaces now use permanent additive default composition. Email Request and
future IT remain deferred.

## Verification and phase boundary

The focused suites passed:

```text
npm.cmd exec -- vitest run modules/routine/application/authorization.test.ts modules/routine/application/queries.test.ts modules/routine/application/mutations.test.ts modules/routine/application/idempotency.test.ts modules/routine/application/imports/staging.test.ts modules/routine/application/presentation-capabilities.test.ts modules/authorization/application/administration.test.ts modules/authorization/application/administration-mutations.test.ts modules/authorization/application/composition.test.ts modules/authorization/application/resolver.test.ts
10 test files, 215 tests passed

npm.cmd exec -- vitest run __tests__/api/routines-tasks.test.ts __tests__/api/routines-task-by-id.test.ts __tests__/api/routines-occurrences.test.ts __tests__/api/routines-occurrence-by-id.test.ts __tests__/api/routines-legacy-occurrence-mutations.test.ts __tests__/api/routine-import-preview.test.ts __tests__/integration/routine-import-apply.integration.test.ts __tests__/api/line-routine-routes.test.ts __tests__/api/line-routine-self-service-routes.test.ts __tests__/api/routine-export.test.ts modules/routine/infrastructure/reports/routine-export.test.ts __tests__/dashboard-routine-page.test.tsx __tests__/api/authorization-administration-mutations.test.ts
12 test files, 76 tests passed

npm.cmd exec -- vitest run __tests__/api/phase-11c2c1-employee-routine-route-authorization.test.ts modules/routine/application/authorization.test.ts modules/routine/application/queries.test.ts modules/routine/application/mutations.test.ts
4 test files, 115 tests passed

npm.cmd exec -- vitest run modules/routine/application/mutations.test.ts modules/routine/application/authorization.test.ts
2 test files, 56 tests passed
```

Repository verification also passed:

```text
npm.cmd run architecture:check   # passed; 1,123 source files checked
npm.cmd run lint:strict          # passed; zero warnings
npm.cmd run typecheck            # passed
npm.cmd run test:run             # passed; 317 files, 2,830 tests
git diff --check                 # passed
```

The focused suites cover Routine authorization, query, mutation, idempotency,
import, presentation, Dashboard API, occurrence API, LIFF routes, deferred
export, Authorization Administration catalog/mutation, composition, and
resolver regressions. The full suite confirms no cross-domain regression.

No Prisma migration, schema change, grant seed/backfill, query redesign,
export migration, summary/reference migration, or Authorization
Administration UX redesign is part of this phase.

The exact handoff is:

```text
Phase 12C.4 — Stock Additive Default Policy Migration
```

Closure invariant:

> Routine enforced authorization no longer depends on temporary
> `NO_APPLICABLE_GRANT` compatibility mechanics. Its existing
> context-sensitive USER behavior is represented as permanent Default Domain
> Policy and composed additively with centrally configured authority, while
> Routine-owned resource relationships, LIFF self-service channel
> restrictions, Dashboard ADMIN semantics, transaction-time re-resolution,
> and business/concurrency invariants remain authoritative. Deferred export,
> summary, and reference surfaces remain explicitly outside this migration.
