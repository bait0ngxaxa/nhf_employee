# Authorization Phase 11C.1 — Security Regression Matrix

Status: Phase 11C.2B complete; Phase 11C.2 remains open for `11C2-API-01`.

Historical baselines:

- `963b7d76752e4a44b56facd0c463d6d28df6d89f` — pre-Phase-11C.1
  production/test baseline audited by the first matrix.
- `f78b7b35afdae1cd0158d8d9ae5600070c6acb1f` — first Phase 11C.1 matrix
  implementation and corrective-pass baseline.
- `779d738c781eaff4ed21f31a0f328cca3f724bac` — current corrective matrix
  commit before this final correction.

Audit point: the current production source and tests after the Phase 11C.2B
regression additions.

This document is the authoritative cross-domain regression baseline for the
authorization implementation. It records what the current code enforces, what
the tests intentionally prove, and which gaps are in the approved Phase 11C.2
backlog. A row is not considered covered merely because a related source file
or an adjacent test exists.

## Executive verdict

The current source has no unclassified authorization bypass or other blocking
security defect identified by this corrective audit. Phase 11B's production
hardening was rechecked against current source and tests, including target
Employee lifecycle revalidation for Routine, approver/assignee revalidation for
Leave, and the pre-write authorization recheck for Stock uploads.

The baseline is not fully regression-complete. It contains explicit
compatibility policies and deferred surfaces, and it has one remaining missing
matrix proof for route-by-route breadth. The cross-domain stale-role and
supported transaction-time state proofs are now direct. The operation ledger
separately has 20 route/capability rows without an exact direct route
assertion. The deferred rows are evaluated against their current deferred
invariants; choosing their future target policy is outside the active
test-gap count. These are test and policy-scope findings, not silently
upgraded target behavior.

The operation-level inventory is finite: the migrated route ledger contains 81
route/capability/channel rows and the separate Authorization Administration
command ledger contains 17 rows. The 81 route rows contain 78 protected
route/capability rows and three LIFF action-availability projection rows; the
projection rows are not independent mutation operations. The route ledger has
61 `DIRECT`, zero `INDIRECT`, and 20 `MISSING` rows. The Administration command
ledger has 17 `DIRECT` rows, so the combined explicit ledger inventory has 98
rows: 78 `DIRECT`, zero `INDIRECT`, and 20 `MISSING`. All 20 missing route rows
are named in `API-10` and the Phase 11C.2 backlog.
This is a coverage finding, not evidence that the production database or a
persisted grant inventory is empty.

Quantified matrix result:

| Metric | Count |
| --- | ---: |
| Total matrix cases | 89 |
| `DIRECT` | 71 |
| `INDIRECT` | 14 |
| `MISSING` | 1 |
| `N/A` | 3 |
| Compatibility-policy rows | 14 |
| Deferred-authorization-surface rows | 3 |
| Blocking security defects discovered in this audit | 0 |
| Remaining genuine Phase 11C.2 regression work items | 1 |
| Future policy/migration decision families outside Phase 11C | 4 |

Quantified operation-ledger result:

| Ledger inventory | Total | DIRECT | INDIRECT | MISSING |
| --- | ---: | ---: | ---: | ---: |
| Migrated route/capability/channel rows | 81 | 61 | 0 | 20 |
| Protected route/capability rows | 78 | 58 | 0 | 20 |
| LIFF action-availability projection rows | 3 | 3 | 0 | 0 |
| Authorization Administration command rows | 17 | 17 | 0 | 0 |
| **Combined explicit ledger rows** | **98** | **78** | **0** | **20** |

Production authorization policy was not changed by Phase 11C.2A or Phase
11C.2B. No Team policy was activated; no production seed/grant records were
added; no compatibility bridge was retired; and no deferred capability was
migrated.

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

This audit did not query or inventory the production authorization database.
The code-owned authorization seed configuration is empty at this baseline.
That proves only what the repository seed would configure; it does not prove
that production contains no Team, TeamRole, TeamMembership,
TeamCapabilityGrant, TeamRoleCapabilityGrant, or UserCapabilityGrant records.
The presence or absence of those persisted records in production is therefore
not asserted by this document.

For every matrix row, the production column names the enforcement boundary and
the test column names an intentional behavior-oriented assertion. Where the
same test touches several layers but does not make the row's invariant its
primary assertion, the row is `INDIRECT` rather than `DIRECT`.

The operation ledger adopts Outcome A for this phase: every protected
route/capability/channel row requires an exact direct route assertion. A route
test that mocks the application authorization boundary, or an application test
that does not execute the route composition, is useful evidence but does not
close that ledger row. Consequently, no protected operation is closed as
`INDIRECT`; the 12 former `INDIRECT` operation rows are counted as `MISSING`
below and are owned by the finite `11C2-API-01` backlog item. The three
projection rows remain inventory-only presentation checks and are not included
in that mutation/route backlog.

Accordingly, a protected operation-ledger row without an exact direct route
assertion is `MISSING`, not `INDIRECT`. Matrix-level `INDIRECT` rows are
partial evidence for an aggregate, central-resolver, architecture, or
deferred-classification invariant; they are never a complete direct-coverage
claim. Their gap text must say whether the remaining proof is mandatory,
optional strengthening, or outside the current phase.

## Coverage and classification definitions

Coverage levels:

- `DIRECT`: a test intentionally proves the exact invariant in the row.
- `INDIRECT`: the invariant is exercised by an adjacent assertion, but is not
  the primary assertion or the row's complete claimed scope.
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
scopes. The empty seed is not a runtime database inventory and must not be
read as proof that Team-origin records are absent or ineffective in production.

### Runtime state and Team/scope terminology

The code-owned authorization seed configuration is empty at this baseline.
Phase 11C.1 did not query or inventory the production authorization database,
therefore the presence or absence of persisted Team, TeamRole, membership, or
User grant records in production is not asserted by this audit.

Team and TeamRole are grant sources/origins. `TEAM` is a resource scope. They
are orthogonal concepts: a persisted Team-origin grant may legitimately use
`ALL`, while a `TEAM`-scoped effective grant must preserve its valid originating
Team and cannot be fabricated from Department, manager, position, or Employee
metadata. No Team policy was activated by this corrective pass; that is a
source-change statement, not a claim about current production runtime state.

## Migrated route/capability/channel coverage ledger

This is the finite operation-level inventory used to audit `API-10`. It lists
the current entry points for the 35 capabilities classified as migrated. The
three Routine deferred capabilities, two Email Request capabilities, Leave
report/export, and other domain-owned/deferred routes are intentionally not
included. A route with more than one capability boundary has one row per
capability boundary. Three Stock LIFF rows are explicitly marked as
action-availability projections; they describe presentation output and do not
represent separate mutation authority.

The enforcement columns describe the production path. `Coverage` describes
regression evidence for the exact row: `DIRECT` means the named test asserts
that route/capability/channel boundary; `INDIRECT` means an application or
adjacent route test exists without that exact boundary assertion; `MISSING`
means no adequate operation-specific regression proof was found. `N/A` in the
transaction column means the operation is read-only or the architecture makes
no transaction-time claim; it does not mean unauthenticated.

### Former `INDIRECT` operation rows — Outcome A decision

The 12 operation rows that were previously `INDIRECT` were re-audited against
their real route, application boundary, adapter, and tests. The existing
evidence is useful, but it does not satisfy the selected exact-route contract:

| Ledger ID | Traced production boundary | Why the existing evidence is not an exact route proof | Final treatment |
| --- | --- | --- | --- |
| `LEDGER-ROU-01` | The route builds a server actor and delegates to `getRoutineTasks()`, which resolves `routine.task.read` in the query layer. | `__tests__/api/routines-tasks.test.ts` mocks the query service; Routine query/authorization tests do not execute this HTTP composition with the resolver. | `MISSING` — `LEDGER-GAP-ROU-01` in `11C2-API-01`. |
| `LEDGER-ROU-02` | The route authenticates, validates idempotency/body, builds the actor, and delegates to `createRoutineTask()`, whose transaction resolves `routine.task.create`. | The route test mocks the creation service; mutation tests begin below the HTTP route and therefore cannot prove the route/capability/channel pairing. | `MISSING` — `LEDGER-GAP-ROU-02` in `11C2-API-01`. |
| `LEDGER-ROU-06` | The route dispatches to `getRoutineOccurrences()`, which resolves `routine.occurrence.read` and builds the query scope. | The route test mocks the query service; application query tests prove scope construction but not this route boundary. | `MISSING` — `LEDGER-GAP-ROU-06` in `11C2-API-01`. |
| `LEDGER-ROU-07` | The same route dispatches `view=tasks` to `getRoutineTaskWorkItems()`, including the bounded work-item compatibility bridge. | The route test proves dispatch and filter forwarding; bridge/query tests are below the HTTP route. | `MISSING` — `LEDGER-GAP-ROU-07` in `11C2-API-01`. |
| `LEDGER-STK-01` | The category GET route itself calls `assertStockCapabilityForMigration(..., "stock.catalog.read")` before the service query. | The route suite proves the workforce gate but does not assert this capability allow/deny boundary; Stock adapter/query tests are separate. | `MISSING` — `LEDGER-GAP-STK-01` in `11C2-API-01`. |
| `LEDGER-STK-02` | The category POST route parses input, then calls the fixed `stock.inventory.manage` assertion before creating the category. | Mutation tests cover the Stock application service/adapter, but no category route test asserts the capability boundary. | `MISSING` — `LEDGER-GAP-STK-02` in `11C2-API-01`. |
| `LEDGER-STK-03` | The category DELETE route parses the target query value, then calls the fixed `stock.inventory.manage` assertion before deletion. | No operation-specific category delete capability assertion was found; service tests do not cover route composition. | `MISSING` — `LEDGER-GAP-STK-03` in `11C2-API-01`. |
| `LEDGER-STK-04` | The item GET route calls the fixed `stock.catalog.read` assertion before the catalog query. | The route suite covers workforce rejection and query tests cover data semantics, but neither directly asserts this route capability boundary. | `MISSING` — `LEDGER-GAP-STK-04` in `11C2-API-01`. |
| `LEDGER-STK-05` | The item POST route calls the fixed `stock.inventory.manage` assertion before creating an item. | Stock mutation tests and the item route suite cover other operations, not this create-route capability boundary. | `MISSING` — `LEDGER-GAP-STK-05` in `11C2-API-01`. |
| `LEDGER-STK-08` | The item-adjust route calls the fixed `stock.inventory.manage` assertion before `adjustStock()`. | Inventory mutation tests begin at the application service; no adjust-route capability assertion was found. | `MISSING` — `LEDGER-GAP-STK-08` in `11C2-API-01`. |
| `LEDGER-LEV-14` | The LIFF cancellation POST route verifies the LIFF session, constructs `LIFF_SELF_SERVICE` context, and delegates to `cancelLeaveRequest()`. | `__tests__/api/line-leave-routes.test.ts` mocks the handler and asserts response/actor plumbing; Leave application tests cover the lower path, not the complete route/capability pairing. | `MISSING` — `LEDGER-GAP-LEV-14` in `11C2-API-01`. |
| `LEDGER-LEV-16` | The LIFF not-taken POST route verifies the LIFF session, constructs the fixed LIFF context, and delegates to `handleLeaveNotTakenRequest()`. | The route suite covers the confirmation `PUT`, not this request `POST`; the lower domain path is not an exact route proof. | `MISSING` — `LEDGER-GAP-LEV-16` in `11C2-API-01`. |

This is a deliberate Outcome A decision, not a mechanical relabeling. The
route tests for the Routine rows mock the application service, the Stock rows
have only adjacent workforce/service evidence, and the LIFF Leave rows mock or
cover a different command boundary. Application and adapter tests remain
strong evidence for their own boundaries, but they do not close an exact
route/capability/channel row. Therefore `INDIRECT` is not used for an
operation that `API-10` requires to be directly asserted.

| Ledger ID | Domain | Entry point / method or command | Capability | Channel | Authentication boundary | Trusted actor provenance | Resource relationship / scope | Transaction revalidation applicability | Existing regression evidence / direct test(s) | Coverage | Gap |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| LEDGER-EMP-01 | Employee | `GET /api/employees` | `employee.read` | `DASHBOARD` | API session plus Employee adapter | Authenticated server User/current role | Organization-wide `ALL` compatibility query | `N/A` read path | `__tests__/api/employees-routes.test.ts` — list capability boundary | DIRECT | — |
| LEDGER-EMP-02 | Employee | `POST /api/employees` | `employee.create` | `DASHBOARD` | API session plus Employee adapter | Authenticated server User/current role | Create command; no client actor/target authority | Preflight and domain mutation; no transaction-wide re-read claim | `__tests__/api/employees-routes.test.ts` — denied before body/service | DIRECT | — |
| LEDGER-EMP-03 | Employee | `GET /api/employees/stats` | `employee.stats.read` | `DASHBOARD` | API session plus Employee adapter | Authenticated server User/current role | Organization-wide `ALL` compatibility query | `N/A` read path | `__tests__/api/employees-routes.test.ts` — statistics capability boundary | DIRECT | — |
| LEDGER-EMP-04 | Employee | `GET /api/employees/export` | `employee.export` | `DASHBOARD` | API session plus Employee adapter | Authenticated server User/current role | Organization-wide `ALL` compatibility export | `N/A` report path | Exporter tests cover formatting, not this route authorization boundary | MISSING | `LEDGER-GAP-EMP-04` |
| LEDGER-EMP-05 | Employee | `POST /api/employees/import` | `employee.import` | `DASHBOARD` | API session plus Employee adapter | Authenticated server User/current role | Import command; no client actor/target authority | Preflight/partial-success path; no transaction-wide re-read claim | `__tests__/api/employees-routes.test.ts` — denied before body/service | DIRECT | — |
| LEDGER-EMP-06 | Employee | `PATCH /api/employees/:id` | `employee.update` | `DASHBOARD` | Workforce/Admin session plus Employee transaction adapter | Server session; current User/Employee role is rebuilt | Target Employee lifecycle and command invariants | Serializable transaction with User/Employee lock and re-read | `__tests__/api/employees-routes.test.ts`; `modules/employee/application/authorization.test.ts` | DIRECT | — |
| LEDGER-EMP-07 | Employee | `DELETE /api/employees/:id` | `employee.delete` | `DASHBOARD` | Workforce/Admin session plus Employee transaction adapter | Server session; current User/Employee role is rebuilt | Target Employee lifecycle and delete blockers | Serializable transaction with User/Employee lock and re-read | `__tests__/api/employees-routes.test.ts`; `modules/employee/application/mutations.test.ts` | DIRECT | — |
| LEDGER-DEPT-01 | Department | `GET /api/departments` | `department.read` | `DASHBOARD` | API session plus Department adapter | Authenticated server User/current role | Reference-data full-read compatibility policy | `N/A` read path | `__tests__/api/departments-route.test.ts` | DIRECT | — |
| LEDGER-ROU-01 | Routine | `GET /api/routines/tasks` | `routine.task.read` | `DASHBOARD` | Dashboard workforce/Admin session | Server-derived actor/current Employee | `CREATED`/`ASSIGNED`/`ALL` per operation and compatibility mode | `N/A` query path | `__tests__/api/routines-tasks.test.ts` — route/filter and actor plumbing; `modules/routine/application/queries.test.ts` — query policy | MISSING | `LEDGER-GAP-ROU-01` |
| LEDGER-ROU-02 | Routine | `POST /api/routines/tasks` | `routine.task.create` | `DASHBOARD` | Dashboard workforce/Admin session | Server-derived actor/current Employee | `OWN`/`ALL` per adapter policy | Serializable mutation with current actor re-resolution | `__tests__/api/routines-tasks.test.ts` — idempotency and actor plumbing; Routine mutation tests — application boundary | MISSING | `LEDGER-GAP-ROU-02` |
| LEDGER-ROU-03 | Routine | `GET /api/routines/tasks/:id` | `routine.task.read` | `DASHBOARD` | Dashboard workforce/Admin session | Server-derived actor/current Employee | Creator/assignee/task relationship | `N/A` read path | `__tests__/api/routines-task-by-id.test.ts` — related/unrelated detail | DIRECT | — |
| LEDGER-ROU-04 | Routine | `PATCH /api/routines/tasks/:id` | `routine.task.update` | `DASHBOARD` | Dashboard workforce/Admin session | Server-derived actor/current Employee | Creator/assignee plus target lifecycle | Serializable mutation and current-state checks | `__tests__/api/routines-task-by-id.test.ts`; Routine mutation tests | DIRECT | — |
| LEDGER-ROU-05 | Routine | `DELETE /api/routines/tasks/:id` | `routine.task.delete` | `DASHBOARD` | Dashboard workforce/Admin session | Server-derived actor/current Employee | Creator/operation relationship plus workflow rules | Serializable mutation and current-state checks | `__tests__/api/routines-task-by-id.test.ts`; Routine mutation tests | DIRECT | — |
| LEDGER-ROU-06 | Routine | `GET /api/routines/occurrences` | `routine.occurrence.read` | `DASHBOARD` | Dashboard workforce/Admin session | Server-derived actor/current Employee | `ASSIGNED`/`ALL` occurrence workload | `N/A` read path | `__tests__/api/routines-occurrences.test.ts` — route/auth and actor plumbing; `modules/routine/application/queries.test.ts` — query policy | MISSING | `LEDGER-GAP-ROU-06` |
| LEDGER-ROU-07 | Routine | `GET /api/routines/occurrences?view=tasks` | `routine.task.read` | `DASHBOARD` | Dashboard workforce/Admin session | Server-derived actor/current Employee | Work-item relationship and exact `NO_APPLICABLE_GRANT -> ALL` bridge | `N/A` read path | `__tests__/api/routines-occurrences.test.ts` — view dispatch only; `modules/routine/application/authorization.test.ts`; Routine query tests | MISSING | `LEDGER-GAP-ROU-07` |
| LEDGER-ROU-08 | Routine | `GET /api/routines/occurrences/:id` | `routine.occurrence.read` | `DASHBOARD` | Dashboard workforce/Admin session | Server-derived actor/current Employee | `ASSIGNED`/`ALL` occurrence relationship | `N/A` read path | No occurrence-detail GET regression assertion; PATCH coverage is separate | MISSING | `LEDGER-GAP-ROU-08` |
| LEDGER-ROU-09 | Routine | `PATCH /api/routines/occurrences/:id` | `routine.occurrence.override` | `DASHBOARD` | Dashboard workforce/Admin session | Server-derived actor/current Employee | `ALL` plus target/workflow/version rules | Serializable transaction and expected-version re-read | `__tests__/api/routines-occurrence-by-id.test.ts` | DIRECT | — |
| LEDGER-ROU-10 | Routine | `PATCH /api/routines/occurrences/:id/assignees` | `routine.occurrence.reassign` | `DASHBOARD` | Dashboard workforce/Admin session | Server-derived actor/current Employee | `ALL` plus target Employee relationship/lifecycle | Serializable transaction with target Employee locks/re-read | `__tests__/api/routines-legacy-occurrence-mutations.test.ts` | DIRECT | — |
| LEDGER-ROU-11 | Routine | `PATCH /api/routines/occurrences/:id/due-date` | `routine.occurrence.change_due_date` | `DASHBOARD` | Dashboard workforce/Admin session | Server-derived actor/current Employee | `ALL` plus workflow/version rules | Serializable transaction and expected-version re-read | `__tests__/api/routines-legacy-occurrence-mutations.test.ts` | DIRECT | — |
| LEDGER-ROU-12 | Routine | `POST /api/routines/imports/preview` | `routine.import.manage` | `DASHBOARD` | Workforce/Admin session before multipart parsing | Server-derived actor/current Employee | `ALL`; import command validation | Preflight then import-specific staging; no transaction-wide claim | `__tests__/api/routine-import-preview.test.ts` | DIRECT | — |
| LEDGER-ROU-13 | Routine | `GET /api/routines/imports/reference` | `routine.import.manage` | `DASHBOARD` | Workforce/Admin session | Server-derived actor/current Employee | `ALL`; reference data for import | `N/A` reference read | `__tests__/api/routine-import-preview.test.ts` | DIRECT | — |
| LEDGER-ROU-14 | Routine | `GET /api/routines/imports/:batchId` | `routine.import.manage` | `DASHBOARD` | Workforce/Admin session | Server-derived actor/current Employee | `ALL`; batch ownership/validation is service-owned | Import batch read has no transaction-wide re-read claim | Import application tests do not assert this HTTP route/capability boundary | MISSING | `LEDGER-GAP-ROU-14` |
| LEDGER-ROU-15 | Routine | `GET /api/routines/imports/:batchId/rows` | `routine.import.manage` | `DASHBOARD` | Workforce/Admin session | Server-derived actor/current Employee | `ALL`; batch/row validation is service-owned | Import row read has no transaction-wide re-read claim | Import application tests do not assert this HTTP route/capability boundary | MISSING | `LEDGER-GAP-ROU-15` |
| LEDGER-ROU-16 | Routine | `PATCH /api/routines/imports/:batchId/rows/:rowId` | `routine.import.manage` | `DASHBOARD` | Workforce/Admin session | Server-derived actor/current Employee | `ALL`; batch/row validation is service-owned | Transaction-time capability recheck in command path; no route race test | Import application tests do not assert this HTTP route/capability boundary | MISSING | `LEDGER-GAP-ROU-16` |
| LEDGER-ROU-17 | Routine | `POST /api/routines/imports/:batchId/apply` | `routine.import.manage` | `DASHBOARD` | Workforce/Admin session | Server-derived actor/current Employee | `ALL`; batch apply/workflow rules | Transaction-time capability recheck in apply path; no route race test | Import application tests do not assert this HTTP route/capability boundary | MISSING | `LEDGER-GAP-ROU-17` |
| LEDGER-ROU-18 | Routine | `POST /api/routines/imports/:batchId/cancel` | `routine.import.manage` | `DASHBOARD` | Workforce/Admin session | Server-derived actor/current Employee | `ALL`; batch cancellation/workflow rules | Transaction-time capability recheck in cancel path; no route race test | Import application tests do not assert this HTTP route/capability boundary | MISSING | `LEDGER-GAP-ROU-18` |
| LEDGER-ROU-19 | Routine | `GET /api/line/routine/tasks` | `routine.task.read` | `LIFF_SELF_SERVICE` | Verified LIFF workforce session | Verified LIFF `sub` plus current User/Employee/link | Linked Employee self-service/mine view | `N/A` read path | `__tests__/api/line-routine-routes.test.ts` — forced mine/actor | DIRECT | — |
| LEDGER-ROU-20 | Routine | `POST /api/line/routine/tasks` | `routine.task.create` | `LIFF_SELF_SERVICE` | Verified LIFF workforce session | Verified LIFF `sub` plus linked Employee | Linked Employee is the owner; client assignee is rejected | Serializable create/idempotency path | `__tests__/api/line-routine-self-service-routes.test.ts` | DIRECT | — |
| LEDGER-ROU-21 | Routine | `GET /api/line/routine/tasks/:id` | `routine.task.read` | `LIFF_SELF_SERVICE` | Verified LIFF workforce session | Verified LIFF `sub` plus linked Employee | Linked Employee self-service/deep-link relationship | `N/A` read path | `__tests__/api/line-routine-routes.test.ts` — deep-link mine | DIRECT | — |
| LEDGER-ROU-22 | Routine | `PATCH /api/line/routine/tasks/:id` | `routine.task.update` | `LIFF_SELF_SERVICE` | Verified LIFF workforce session | Verified LIFF `sub` plus linked Employee | Linked Employee ownership/creator relationship | Serializable mutation with current actor re-resolution | `__tests__/api/line-routine-self-service-routes.test.ts` — detail edit/version | DIRECT | — |
| LEDGER-ROU-23 | Routine | `DELETE /api/line/routine/tasks/:id` | `routine.task.delete` | `LIFF_SELF_SERVICE` | Verified LIFF workforce session | Verified LIFF `sub` plus linked Employee | Linked Employee ownership/creator relationship | Serializable mutation with current actor re-resolution | `__tests__/api/line-routine-self-service-routes.test.ts` — delete delegates auth | DIRECT | — |
| LEDGER-STK-01 | Stock | `GET /api/stock/categories` | `stock.catalog.read` | `DASHBOARD` | Dashboard workforce/Admin session | Server-derived actor/current role | Catalog `ALL` | `N/A` read path | `__tests__/api/stock-requests-routes.test.ts` — workforce gate only; Stock authorization/query tests | MISSING | `LEDGER-GAP-STK-01` |
| LEDGER-STK-02 | Stock | `POST /api/stock/categories` | `stock.inventory.manage` | `DASHBOARD` | Dashboard workforce/Admin session | Server-derived actor/current role | Inventory `ALL` | Serializable inventory mutation path | Stock authorization/mutation tests; no category route capability assertion | MISSING | `LEDGER-GAP-STK-02` |
| LEDGER-STK-03 | Stock | `DELETE /api/stock/categories` | `stock.inventory.manage` | `DASHBOARD` | Dashboard workforce/Admin session | Server-derived actor/current role | Inventory `ALL` | Serializable inventory mutation path | Stock authorization/mutation tests; no category route capability assertion | MISSING | `LEDGER-GAP-STK-03` |
| LEDGER-STK-04 | Stock | `GET /api/stock/items` | `stock.catalog.read` | `DASHBOARD` | Dashboard workforce/Admin session | Server-derived actor/current role | Catalog `ALL` | `N/A` read path | `__tests__/api/stock-requests-routes.test.ts` — workforce gate only; `modules/stock/__tests__/queries.test.ts` — query behavior | MISSING | `LEDGER-GAP-STK-04` |
| LEDGER-STK-05 | Stock | `POST /api/stock/items` | `stock.inventory.manage` | `DASHBOARD` | Dashboard workforce/Admin session | Server-derived actor/current role | Inventory `ALL` | Serializable inventory mutation path | Stock authorization/mutation tests; item route suite covers update/delete, not create | MISSING | `LEDGER-GAP-STK-05` |
| LEDGER-STK-06 | Stock | `PATCH /api/stock/items/:id` | `stock.inventory.manage` | `DASHBOARD` | Dashboard workforce/Admin session | Server-derived actor/current role | Target inventory item `ALL` plus domain invariants | Serializable transaction with current workforce re-read | `__tests__/api/stock-items-route.test.ts` | DIRECT | — |
| LEDGER-STK-07 | Stock | `DELETE /api/stock/items/:id` | `stock.inventory.manage` | `DASHBOARD` | Dashboard workforce/Admin session | Server-derived actor/current role | Target inventory item `ALL` plus soft-delete rules | Serializable transaction with current workforce re-read | `__tests__/api/stock-items-route.test.ts` | DIRECT | — |
| LEDGER-STK-08 | Stock | `POST /api/stock/items/:id/adjust` | `stock.inventory.manage` | `DASHBOARD` | Dashboard workforce/Admin session | Server-derived actor/current role | Target inventory item `ALL` plus quantity invariants | Serializable inventory mutation path | `modules/stock/__tests__/mutations.test.ts` — application mutation only; no dedicated adjust route assertion | MISSING | `LEDGER-GAP-STK-08` |
| LEDGER-STK-09 | Stock | `GET /api/stock/requests` | `stock.request.read` | `DASHBOARD` | Dashboard workforce/Admin session | Server-derived actor/current role | `OWN`/`ALL`; requested scope cannot broaden effective grant | `N/A` read path | `__tests__/api/stock-requests-routes.test.ts` | DIRECT | — |
| LEDGER-STK-10 | Stock | `POST /api/stock/requests` | `stock.request.create` | `DASHBOARD` | Dashboard workforce/Admin session | Server-derived actor/current role | Owner is current Employee; `OWN` | Serializable transaction, idempotency, workforce re-read | `__tests__/api/stock-requests-routes.test.ts` | DIRECT | — |
| LEDGER-STK-11 | Stock | `POST /api/stock/requests/:id/review` with `ISSUE` | `stock.request.process` | `DASHBOARD` | Dashboard workforce/Admin session | Server-derived actor/current role | Processing `ALL` plus workflow state | Serializable transaction and workforce re-read | `__tests__/api/stock-requests-routes.test.ts` | DIRECT | — |
| LEDGER-STK-12 | Stock | `POST /api/stock/requests/:id/review` with `REJECT` | `stock.request.cancel` | `DASHBOARD` | Dashboard workforce/Admin session | Server-derived actor/current role | Cancellation `ALL` plus workflow state | Serializable transaction and workforce re-read | `__tests__/api/stock-requests-routes.test.ts` | DIRECT | — |
| LEDGER-STK-13 | Stock | `POST /api/stock/requests/:id/issue` | `stock.request.process` | `DASHBOARD` | Dashboard workforce/Admin session | Server-derived actor/current role | Processing `ALL` plus workflow state | Serializable transaction and workforce re-read | `__tests__/api/stock-requests-routes.test.ts` | DIRECT | — |
| LEDGER-STK-14 | Stock | `POST /api/stock/requests/:id/cancel` | `stock.request.cancel` | `DASHBOARD` | Dashboard workforce/Admin session | Server-derived actor/current role | Cancellation `OWN`/`ALL` per operation policy | Serializable transaction and workforce re-read | `__tests__/api/stock-requests-routes.test.ts` | DIRECT | — |
| LEDGER-STK-15 | Stock | `GET /api/stock/reports/export` | `stock.report.export` | `DASHBOARD` | Dashboard workforce/Admin session | Server-derived actor/current role | Report `ALL`; report/domain filters remain applicable | `N/A` report path | `__tests__/api/stock-reports-export-route.test.ts` | DIRECT | — |
| LEDGER-STK-16 | Stock | `POST /api/uploads/image` | `stock.inventory.manage` | `DASHBOARD` | API/workforce/Admin preflight and immediate recheck | Server-derived actor/current role | Inventory `ALL`; upload target/domain validation | Preflight plus immediate pre-write recheck; external filesystem is not atomic with DB | `__tests__/api/uploads-image-route.test.ts` | DIRECT | — |
| LEDGER-STK-17 | Stock | `GET /api/line/stock/categories` | `stock.catalog.read` | `LIFF_SELF_SERVICE` | Verified LIFF workforce session | Verified LIFF `sub` plus current User/Employee/link | Catalog `ALL`, mobile projection only | `N/A` read path | `__tests__/api/line-stock-routes.test.ts` | DIRECT | — |
| LEDGER-STK-18 | Stock | `GET /api/line/stock/items` | `stock.catalog.read` | `LIFF_SELF_SERVICE` | Verified LIFF workforce session | Verified LIFF `sub` plus current User/Employee/link | Active catalog `ALL`, mobile projection only | `N/A` read path | `__tests__/api/line-stock-routes.test.ts` | DIRECT | — |
| LEDGER-STK-19 | Stock | `GET /api/line/stock/availability` | `stock.catalog.read` | `LIFF_SELF_SERVICE` | Verified LIFF workforce session | Verified LIFF `sub` plus current User/Employee/link | Targeted catalog availability `ALL` with input validation | `N/A` read path | `__tests__/api/line-stock-routes.test.ts` | DIRECT | — |
| LEDGER-STK-20 | Stock | `GET /api/line/stock/requests` | `stock.request.read` | `LIFF_SELF_SERVICE` | Verified LIFF workforce session | Verified LIFF `sub` plus linked Employee | History `OWN`; forged scope is ignored | `N/A` read path | `__tests__/api/line-stock-routes.test.ts` | DIRECT | — |
| LEDGER-STK-21 | Stock | `POST /api/line/stock/requests` | `stock.request.create` | `LIFF_SELF_SERVICE` | Verified LIFF workforce session | Verified LIFF `sub` plus linked Employee | Current Employee owns request; `OWN` | Serializable transaction and idempotency | `__tests__/api/line-stock-routes.test.ts` | DIRECT | — |
| LEDGER-STK-22 | Stock | `GET /api/line/stock/requests/:id` | `stock.request.read` | `LIFF_SELF_SERVICE` | Verified LIFF workforce session | Verified LIFF `sub` plus linked Employee | Detail `OWN`/processor `ALL` according to trusted operation | `N/A` read path | `__tests__/api/line-stock-routes.test.ts` — owner/unrelated detail | DIRECT | — |
| LEDGER-STK-23 | Stock | `GET /api/line/stock/requests/:id` action projection | `stock.request.process` | `LIFF_SELF_SERVICE` | Verified LIFF workforce/processor session | Verified LIFF `sub` plus current role | Processor action only; read access does not imply `ISSUE` | `N/A` action projection | `__tests__/api/line-stock-routes.test.ts` — derives processor actions | DIRECT | — |
| LEDGER-STK-24 | Stock | `GET /api/line/stock/requests/:id` action projection | `stock.request.cancel` | `LIFF_SELF_SERVICE` | Verified LIFF workforce/processor session | Verified LIFF `sub` plus current role | Cancel action only; read access does not imply mutation | `N/A` action projection | `__tests__/api/line-stock-routes.test.ts` — derives processor actions | DIRECT | — |
| LEDGER-STK-25 | Stock | `GET /api/line/stock/processing` | `stock.request.process` | `LIFF_SELF_SERVICE` | Verified LIFF stock-processor session | Verified LIFF `sub` plus current role | Processing queue `ALL` | `N/A` read path | `__tests__/api/line-stock-routes.test.ts` — independent queue auth | DIRECT | — |
| LEDGER-STK-26 | Stock | `GET /api/line/stock/processing` action projection | `stock.request.cancel` | `LIFF_SELF_SERVICE` | Verified LIFF stock-processor session | Verified LIFF `sub` plus current role | Cancel action projection only | `N/A` action projection | `__tests__/api/line-stock-routes.test.ts` — independent action auth | DIRECT | — |
| LEDGER-STK-27 | Stock | `POST /api/line/stock/requests/:id/cancel` | `stock.request.cancel` | `LIFF_SELF_SERVICE` | Verified LIFF workforce session | Verified LIFF `sub` plus current User/Employee/link | Owner/operation relationship; `OWN`/documented processor path | Serializable transaction and idempotency | `__tests__/api/line-stock-routes.test.ts` | DIRECT | — |
| LEDGER-STK-28 | Stock | `POST /api/line/stock/requests/:id/issue` | `stock.request.process` | `LIFF_SELF_SERVICE` | Verified LIFF stock-processor session | Verified LIFF `sub` plus current role | Processing `ALL` plus workflow state | Serializable transaction and workforce re-read | `__tests__/api/line-stock-routes.test.ts` | DIRECT | — |
| LEDGER-LEV-01 | Leave | `GET /api/leave/me` | `leave.request.read` | `DASHBOARD` | Dashboard workforce session | Server-derived actor/current Employee | Owner `OWN` history | `N/A` read path | `__tests__/api/leave-me.test.ts` | DIRECT | — |
| LEDGER-LEV-02 | Leave | `GET /api/leave/approvals` | `leave.approval.read` | `DASHBOARD` | Dashboard workforce/Admin session | Server-derived actor/current Employee | Assigned approver workload | `N/A` read path | `__tests__/api/leave-approvals.test.ts` | DIRECT | — |
| LEDGER-LEV-03 | Leave | `GET /api/leave/approvers` | `leave.approver.manage` | `DASHBOARD` | Admin session with explicit account-only seam | Server-derived ADMIN principal | Configuration `ALL`; domain active-account rules | `N/A` read path | `__tests__/api/leave-approvers.test.ts` | DIRECT | — |
| LEDGER-LEV-04 | Leave | `PUT /api/leave/approvers` | `leave.approver.manage` | `DASHBOARD` | Admin session with explicit account-only seam | Server-derived ADMIN principal | Approver assignment/domain conflict rules | Serializable transaction and row re-read | `__tests__/api/leave-approvers.test.ts`; Leave approval tests | DIRECT | — |
| LEDGER-LEV-05 | Leave | `POST /api/leave/request` | `leave.request.create` | `DASHBOARD` | Dashboard workforce session | Server-derived actor/current Employee | Owner `OWN`; quota/date/workflow rules | Serializable transaction, idempotency, current actor checks | `__tests__/api/leave-request.test.ts` | DIRECT | — |
| LEDGER-LEV-06 | Leave | `POST /api/leave/cancel` | `leave.request.cancel` | `DASHBOARD` | Dashboard workforce session | Server-derived actor/current Employee | Owner/request relationship and state | Serializable transaction and current relationship/workflow re-read | `__tests__/api/leave-cancel.test.ts` | DIRECT | — |
| LEDGER-LEV-07 | Leave | `PUT /api/leave/cancel` | `leave.cancellation.decide` | `DASHBOARD` | Dashboard workforce/Admin session | Server-derived current approver/ADMIN | Assigned approver or explicit recovery relationship | Serializable transaction and approver/current-state re-read | `__tests__/api/leave-cancel.test.ts` | DIRECT | — |
| LEDGER-LEV-08 | Leave | `POST /api/leave/decision` | `leave.request.approve` | `DASHBOARD` | Dashboard workforce/Admin session | Server-derived current approver/ADMIN | Assigned approver relationship | Serializable transaction and approver/current-state re-read | `__tests__/api/leave-decision.test.ts` | DIRECT | — |
| LEDGER-LEV-09 | Leave | `POST /api/leave/not-taken` | `leave.request.not_taken` | `DASHBOARD` | Dashboard workforce/Admin session | Server-derived current approver/ADMIN | Owner `OWN` or documented recovery relationship | Serializable transaction for confirmation; normal request path is domain-specific | `__tests__/api/leave-not-taken.test.ts` | DIRECT | — |
| LEDGER-LEV-10 | Leave | `PUT /api/leave/not-taken` | `leave.request.not_taken` | `DASHBOARD` | Dashboard workforce/Admin session | Server-derived current approver/ADMIN | Assigned approver or explicit recovery relationship | Serializable transaction and approver/current-state re-read | `__tests__/api/leave-not-taken.test.ts` | DIRECT | — |
| LEDGER-LEV-11 | Leave | `GET /api/line/leave/me` | `leave.request.read` | `LIFF_SELF_SERVICE` | Verified LIFF workforce session | Verified LIFF `sub` plus linked Employee | Owner `OWN` | `N/A` read path | `__tests__/api/line-leave-routes.test.ts` | DIRECT | — |
| LEDGER-LEV-12 | Leave | `GET /api/line/leave/approvals` | `leave.approval.read` | `LIFF_SELF_SERVICE` | Verified LIFF workforce session | Verified LIFF `sub` plus linked Employee | Assigned effective approver workload | `N/A` read path | `__tests__/api/line-leave-routes.test.ts` | DIRECT | — |
| LEDGER-LEV-13 | Leave | `POST /api/line/leave/request` | `leave.request.create` | `LIFF_SELF_SERVICE` | Verified LIFF workforce session | Verified LIFF `sub` plus linked Employee | Owner `OWN`; client actor fields ignored | Serializable transaction and idempotency | `__tests__/api/line-leave-routes.test.ts` | DIRECT | — |
| LEDGER-LEV-14 | Leave | `POST /api/line/leave/cancel` | `leave.request.cancel` | `LIFF_SELF_SERVICE` | Verified LIFF workforce session | Verified LIFF `sub` plus linked Employee | Owner/request relationship and state | Serializable transaction and workflow re-read | `__tests__/api/line-leave-routes.test.ts` — route/response and actor plumbing with handler mock; `__tests__/api/leave-cancel.test.ts` — application path | MISSING | `LEDGER-GAP-LEV-14` |
| LEDGER-LEV-15 | Leave | `POST /api/line/leave/decision` | `leave.request.approve` | `LIFF_SELF_SERVICE` | Verified LIFF workforce session | Verified LIFF `sub` plus linked Employee | Assigned effective approver relationship | Serializable transaction and approver/current-state re-read | `__tests__/api/line-leave-routes.test.ts`; `__tests__/api/leave-decision.test.ts` | DIRECT | — |
| LEDGER-LEV-16 | Leave | `POST /api/line/leave/not-taken` | `leave.request.not_taken` | `LIFF_SELF_SERVICE` | Verified LIFF workforce session | Verified LIFF `sub` plus linked Employee | Owner `OWN`; no recovery override | Domain transaction path; explicit stronger central guarantee not claimed | `__tests__/api/line-leave-routes.test.ts` covers the confirmation `PUT`, not this request command | MISSING | `LEDGER-GAP-LEV-16` |
| LEDGER-LEV-17 | Leave | `PUT /api/line/leave/not-taken` | `leave.request.not_taken` | `LIFF_SELF_SERVICE` | Verified LIFF workforce session | Verified LIFF `sub` plus linked Employee | Assigned effective approver; no recovery override | Domain transaction path; explicit stronger central guarantee not claimed | No operation-specific LIFF not-taken PUT assertion found | MISSING | `LEDGER-GAP-LEV-17` |
| LEDGER-AUD-01 | Audit | `GET /api/audit-logs` | `audit.read` | `DASHBOARD` | API session plus Audit adapter | Authenticated server User/current role | Audit read `ALL` under central capability | `N/A` read path | `__tests__/api/audit-log-route.test.ts` | DIRECT | — |
| LEDGER-NOT-01 | Notification | `GET /api/notifications` | `notification.inbox.read` | `DASHBOARD` | API session plus Notification adapter | Server-derived User ID | Actor-owned `OWN` query | `N/A` read path | `__tests__/api/notifications.test.ts` | DIRECT | — |
| LEDGER-NOT-02 | Notification | `GET /api/notifications/all` | `notification.inbox.read` | `DASHBOARD` | API session plus Notification adapter | Server-derived User ID | Actor-owned `OWN` query; route name does not broaden scope | `N/A` read path | `__tests__/api/notifications.test.ts` | DIRECT | — |
| LEDGER-NOT-03 | Notification | `PATCH /api/notifications/:id/read` | `notification.inbox.update` | `DASHBOARD` | API session plus Notification adapter | Server-derived User ID; route ID is target only | Target notification belongs to actor `OWN` | Mutation command; no separate central transaction-time claim | `__tests__/api/notifications.test.ts` | DIRECT | — |
| LEDGER-NOT-04 | Notification | `POST /api/notifications/mark-all-read` | `notification.inbox.update` | `DASHBOARD` | API session plus Notification adapter | Server-derived User ID | Actor-owned `OWN` bulk update | Mutation command; no separate central transaction-time claim | `__tests__/api/notifications.test.ts` | DIRECT | — |

The ledger therefore has 81 migrated capability entry-point rows: 61
`DIRECT`, zero `INDIRECT`, and 20 `MISSING`. The 20 missing rows are
`LEDGER-EMP-04`, `LEDGER-ROU-01`, `LEDGER-ROU-02`, `LEDGER-ROU-06`,
`LEDGER-ROU-07`, `LEDGER-ROU-08`, `LEDGER-ROU-14`, `LEDGER-ROU-15`,
`LEDGER-ROU-16`, `LEDGER-ROU-17`, `LEDGER-ROU-18`, `LEDGER-STK-01`,
`LEDGER-STK-02`, `LEDGER-STK-03`, `LEDGER-STK-04`, `LEDGER-STK-05`,
`LEDGER-STK-08`, `LEDGER-LEV-14`, `LEDGER-LEV-16`, and
`LEDGER-LEV-17`. They are the finite route-level scope of `API-10`.
Ledger counts are operation evidence and are not added to the 89 matrix-case
total. Excluding the three action-availability projection rows, the 78
protected route/capability rows contain 58 `DIRECT` and 20 `MISSING` rows.

The three optional Stock LIFF rows attached to `GET` detail/processing
responses (`LEDGER-STK-23`, `LEDGER-STK-24`, and `LEDGER-STK-26`) describe
action-availability projection checks only. They are not independent protected
mutation operations and do not close or replace mutation authority. The
corresponding `POST` issue/cancel routes are the mutation authority and are
listed separately.

### Authorization Administration command ledger

Authorization Administration is a protected Dashboard command surface, not a
registered capability in the 35-row migrated capability set. It is listed
separately so the Team, TeamRole, membership, and direct User grant mutation
routes are not confused with migrated resource capabilities.

| Ledger ID | Entry point / method | Protected operation | Channel | Authentication boundary | Trusted actor provenance | Resource/configuration boundary | Transaction revalidation applicability | Existing direct test(s) | Coverage |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| LEDGER-ADM-01 | `GET /api/authorization/administration` | Administration overview | `DASHBOARD` | `requireAuthorizationAdministrationApiSession` | Server session -> verified ADMIN principal | Overview query and safe projection | `N/A` read path | `__tests__/api/authorization-administration.test.ts` | DIRECT |
| LEDGER-ADM-02 | `POST /api/authorization/administration` | Create Team | `DASHBOARD` | `requireAuthorizationAdministrationApiSession` | Server session -> verified ADMIN principal; body has no actor authority | Team input/schema and audit boundary | Serializable administration command | `__tests__/api/authorization-administration-mutations.test.ts`; administration mutation tests | DIRECT |
| LEDGER-ADM-03 | `GET /api/authorization/administration/users` | Bounded User search | `DASHBOARD` | `requireAuthorizationAdministrationApiSession` | Server session -> verified ADMIN principal; query is search only | Bounded query/input validation | `N/A` read path | `__tests__/api/authorization-administration.test.ts` | DIRECT |
| LEDGER-ADM-04 | `GET /api/authorization/administration/users/:id` | User detail | `DASHBOARD` | `requireAuthorizationAdministrationApiSession` | Server session -> verified ADMIN principal; route ID is target only | User detail query | `N/A` read path | `__tests__/api/authorization-administration.test.ts` | DIRECT |
| LEDGER-ADM-05 | `GET /api/authorization/administration/teams/:id` | Team detail | `DASHBOARD` | `requireAuthorizationAdministrationApiSession` | Server session -> verified ADMIN principal; route ID is target only | Team/role/membership detail query | `N/A` read path | `__tests__/api/authorization-administration.test.ts` | DIRECT |
| LEDGER-ADM-06 | `PATCH /api/authorization/administration/teams/:id` | Team lifecycle update | `DASHBOARD` | `requireAuthorizationAdministrationApiSession` | Server session -> verified ADMIN principal; body is configuration only | `Team.isActive` and input/audit rules | Serializable administration command | `__tests__/api/authorization-administration-mutations.test.ts`; administration mutation tests | DIRECT |
| LEDGER-ADM-07 | `POST /api/authorization/administration/teams/:id/members` | Add TeamMembership | `DASHBOARD` | `requireAuthorizationAdministrationApiSession` | Server session -> verified ADMIN principal; route IDs are targets | Membership existence/origin validation | Serializable administration command | `__tests__/api/authorization-administration-mutations.test.ts`; administration mutation tests | DIRECT |
| LEDGER-ADM-08 | `PATCH /api/authorization/administration/teams/:id/members/:userId` | Change TeamMembership TeamRole | `DASHBOARD` | `requireAuthorizationAdministrationApiSession` | Server session -> verified ADMIN principal; route IDs are targets | Membership and valid TeamRole origin | Serializable administration command | `__tests__/api/authorization-administration-mutations.test.ts`; administration mutation tests | DIRECT |
| LEDGER-ADM-09 | `DELETE /api/authorization/administration/teams/:id/members/:userId` | Remove TeamMembership | `DASHBOARD` | `requireAuthorizationAdministrationApiSession` | Server session -> verified ADMIN principal; route IDs are targets | Membership present/removed semantics | Serializable administration command | `__tests__/api/authorization-administration-mutations.test.ts`; administration mutation tests | DIRECT |
| LEDGER-ADM-10 | `POST /api/authorization/administration/teams/:id/roles` | Create TeamRole | `DASHBOARD` | `requireAuthorizationAdministrationApiSession` | Server session -> verified ADMIN principal; body is configuration only | TeamRole key/name/input validation | Serializable administration command | `__tests__/api/authorization-administration-mutations.test.ts`; administration mutation tests | DIRECT |
| LEDGER-ADM-11 | `PATCH /api/authorization/administration/teams/:id/roles/:roleId` | TeamRole lifecycle update | `DASHBOARD` | `requireAuthorizationAdministrationApiSession` | Server session -> verified ADMIN principal; route IDs are targets | `TeamRole.isActive` and origin validation | Serializable administration command | `__tests__/api/authorization-administration-mutations.test.ts`; administration mutation tests | DIRECT |
| LEDGER-ADM-12 | `POST /api/authorization/administration/teams/:id/grants` | Add TeamCapabilityGrant | `DASHBOARD` | `requireAuthorizationAdministrationApiSession` | Server session -> verified ADMIN principal; body cannot supply actor | Registered capability/scope and Team origin | Serializable administration command | `__tests__/api/authorization-administration-mutations.test.ts`; administration mutation tests | DIRECT |
| LEDGER-ADM-13 | `DELETE /api/authorization/administration/teams/:id/grants` | Remove TeamCapabilityGrant | `DASHBOARD` | `requireAuthorizationAdministrationApiSession` | Server session -> verified ADMIN principal; body cannot supply actor | Present/removed Team grant and registry validation | Serializable administration command | `__tests__/api/authorization-administration-mutations.test.ts`; administration mutation tests | DIRECT |
| LEDGER-ADM-14 | `POST /api/authorization/administration/teams/:id/roles/:roleId/grants` | Add TeamRoleCapabilityGrant | `DASHBOARD` | `requireAuthorizationAdministrationApiSession` | Server session -> verified ADMIN principal; body cannot supply actor | Registered capability/scope and TeamRole origin | Serializable administration command | `__tests__/api/authorization-administration-mutations.test.ts`; administration mutation tests | DIRECT |
| LEDGER-ADM-15 | `DELETE /api/authorization/administration/teams/:id/roles/:roleId/grants` | Remove TeamRoleCapabilityGrant | `DASHBOARD` | `requireAuthorizationAdministrationApiSession` | Server session -> verified ADMIN principal; body cannot supply actor | Present/removed TeamRole grant and registry validation | Serializable administration command | `__tests__/api/authorization-administration-mutations.test.ts`; administration mutation tests | DIRECT |
| LEDGER-ADM-16 | `POST /api/authorization/administration/users/:id/grants` | Add UserCapabilityGrant | `DASHBOARD` | `requireAuthorizationAdministrationApiSession` | Server session -> verified ADMIN principal; route ID is target only | Registered capability/scope and target User | Serializable administration command | `__tests__/api/authorization-administration-mutations.test.ts`; administration mutation tests | DIRECT |
| LEDGER-ADM-17 | `DELETE /api/authorization/administration/users/:id/grants` | Remove UserCapabilityGrant | `DASHBOARD` | `requireAuthorizationAdministrationApiSession` | Server session -> verified ADMIN principal; route ID is target only | Present/removed User grant and registry validation | Serializable administration command | `__tests__/api/authorization-administration-mutations.test.ts`; administration mutation tests | DIRECT |

The Administration command ledger has 17 rows. Its tests prove the trusted
ADMIN command boundary and mutation validation; they do not prove that the
production database currently contains or lacks any Team, membership, role, or
grant records.

## Security regression matrix

The matrix uses stable IDs independent of source line numbers. Test names are
included where they materially establish whether the row is direct or only
indirect.

| Matrix ID | Domain / surface | Capability or protected operation | Channel | Threat / invariant | Expected result | Production enforcement location | Existing regression test(s) | Coverage | Classification | Gap / required action | Notes / compatibility constraints |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AUTHN-01 | Auth and selected migrated Dashboard/API entry points | Employee list/stats/mutation, Department, Audit, Notification, and Authorization Administration boundaries represented by the named suites | `DASHBOARD` | Missing, invalid, or unauthenticated session must not reach the covered protected work | Return safe `401` and do not perform the covered protected query or mutation | `lib/auth/api.ts:requireApiSession`; route guards before services | `__tests__/api/employees-routes.test.ts`; `__tests__/api/departments-route.test.ts`; `__tests__/api/audit-log-route.test.ts`; `__tests__/api/notifications.test.ts`; `__tests__/api/authorization-administration-mutations.test.ts` | INDIRECT | MIGRATED_AUTHORIZATION | The exact protected operation rows without direct route proof are `LEDGER-EMP-04`, `LEDGER-ROU-01`, `LEDGER-ROU-02`, `LEDGER-ROU-06`, `LEDGER-ROU-07`, `LEDGER-ROU-08`, `LEDGER-ROU-14`, `LEDGER-ROU-15`, `LEDGER-ROU-16`, `LEDGER-ROU-17`, `LEDGER-ROU-18`, `LEDGER-STK-01`, `LEDGER-STK-02`, `LEDGER-STK-03`, `LEDGER-STK-04`, `LEDGER-STK-05`, `LEDGER-STK-08`, `LEDGER-LEV-14`, `LEDGER-LEV-16`, and `LEDGER-LEV-17`. They are owned by `11C2-API-01`. | This aggregate row does not claim every migrated route is directly tested. UI visibility is not part of this proof. |
| AUTHN-02 | LIFF entry points | LIFF-protected operations | `LIFF_SELF_SERVICE` | Missing, malformed, expired, tampered, or wrong-purpose LIFF session must not establish identity | Return `401` for invalid session material before workforce access | `modules/line/application/liff.ts:requireLiffWorkforceSession`; `modules/line/infrastructure/session/liff-session.ts` | `__tests__/auth/liff.test.ts`; `__tests__/lib/line-liff-session.test.ts` | DIRECT | MIGRATED_AUTHORIZATION | None for the covered LIFF boundary | Current User, Employee, and account-link state is checked after token verification. |
| AUTHN-03 | Generic account versus workforce routes | Legacy API and workforce-required operations | `DASHBOARD` | An authenticated account without an eligible Employee must not be treated as a workforce actor | Generic account resolution may succeed only where designed; workforce-required API returns the documented failure | `modules/auth/application/sessions.ts`; `lib/auth/api.ts`; `lib/auth/workforce.ts` | `__tests__/lib/server-auth-token-version.test.ts`; `__tests__/auth/workforce.test.ts` | DIRECT | DOMAIN_OR_LIFECYCLE_POLICY | None for the documented boundary | Account-only ADMIN seams are listed separately and do not make a normal USER a workforce actor. |
| AUTHN-04 | Session lifecycle | Dashboard/API session | `DASHBOARD` | Revoked session family, token-version mismatch, or invalid current account state must not authenticate | Reject before authorization and persistence access | `modules/auth/application/sessions.ts:resolveAuthenticatedAccount`; `lib/auth/server.ts` | `__tests__/lib/server-auth-token-version.test.ts`; `__tests__/auth/auth-principal.test.ts` | DIRECT | DOMAIN_OR_LIFECYCLE_POLICY | None for covered token/session conditions | Current persisted role is returned; route-time role is not trusted. |
| LIFE-01 | User lifecycle | All account-backed capabilities | `DASHBOARD` | Inactive User must not authorize | Deny before protected operation | `modules/auth/application/sessions.ts`; `modules/authorization/application/evaluator.ts` receives only authenticated actor | `__tests__/lib/server-auth-token-version.test.ts`; `__tests__/auth/workforce.test.ts` | DIRECT | DOMAIN_OR_LIFECYCLE_POLICY | None for current User lifecycle gate | Applies before capability resolution. |
| LIFE-02 | User lifecycle | All account-backed capabilities | `DASHBOARD` | Deleted User must not authorize | Deny before protected operation | `modules/auth/application/sessions.ts`; `lib/auth/server.ts` | `__tests__/lib/server-auth-token-version.test.ts`; `__tests__/auth/workforce.test.ts` | DIRECT | DOMAIN_OR_LIFECYCLE_POLICY | None for current User deletion gate | ADMIN is not an authentication bypass. |
| LIFE-03 | Employee lifecycle | Workforce-required migrated operations | `DASHBOARD` | Inactive, suspended, or deleted Employee must not authorize a workforce operation | Return the documented workforce denial and do not mutate | `lib/auth/workforce.ts:requireActiveWorkforceSession`; `lib/auth/workforce-transaction.ts` | `__tests__/auth/workforce.test.ts`; `__tests__/auth/workforce-transaction.test.ts`; `__tests__/api/stock-items-route.test.ts` | DIRECT | DOMAIN_OR_LIFECYCLE_POLICY | None for the covered workforce and transaction gates | Target Employee lifecycle is separately covered in transaction rows. |
| LIFE-04 | Employee lifecycle and LIFF link | LIFF self-service operations | `LIFF_SELF_SERVICE` | LIFF identity must correspond to a current active User, Employee, and valid current account link | Deny invalid current lifecycle or link state; never trust stale claims alone | `modules/line/application/liff.ts`; `modules/line/infrastructure/persistence/account-link.ts` | `__tests__/auth/liff.test.ts` | DIRECT | DOMAIN_OR_LIFECYCLE_POLICY | None for current LIFF lifecycle/link cases | Claim `employeeId` is checked against current identity. |
| LIFE-05 | Explicit account-only ADMIN seams | Stock lower operations, Leave approver management, Routine Dashboard lower helper | `DASHBOARD` | Account-only ADMIN exceptions must be narrow and explicit, not a general lifecycle bypass | Allow only the documented capability/path; require active User and preserve domain rules | `lib/auth/workforce.ts:requireActiveWorkforceOrAdminSession`; Stock, Leave, and Routine transaction authorization adapters | `__tests__/auth/workforce.test.ts`; `modules/stock/application/authorization.test.ts`; `modules/leave/application/authorization.test.ts`; `modules/routine/application/authorization.test.ts` | DIRECT | COMPATIBILITY_POLICY | No mandatory Phase 11C.2 gap; optional strengthening is limited to an explicit negative test for an unlisted capability if the allowlist expands | Current tests directly establish the narrow allowlisted seams. This is a compatibility seam, not a new ADMIN bypass. |
| LIFE-06 | Dashboard current-user projection | Dashboard navigation and capability projection | `DASHBOARD` | Presentation must not turn an account with no eligible Employee into a workforce authority | Projection is absent or restricted; server route still performs its own checks | `app/_lib/auth/current-user.ts` | `__tests__/auth/current-user-projection.test.ts` | DIRECT | PRESENTATION_ONLY | None for projection behavior | Projection flags are not authorization evidence. |
| ACTOR-01 | Dashboard actor construction | Migrated domain adapters | `DASHBOARD` | Actor `userId`, `employeeId`, and current role must come from authenticated server state | Build the actor from trusted session/current account; ignore client actor fields | `app/_lib/auth/current-user.ts`; domain `application/authorization.ts` adapters | `__tests__/api/employees-routes.test.ts`; `__tests__/api/authorization-administration-mutations.test.ts`; `__tests__/auth/current-user-projection.test.ts` | DIRECT | MIGRATED_AUTHORIZATION | None for the covered actor builders | Request data may select a target/filter but cannot establish the actor. |
| ACTOR-02 | API body, query, and headers | The Employee, Authorization Administration, Routine LIFF, Stock LIFF, and Leave LIFF cases named in the test column | `DASHBOARD` or `LIFF_SELF_SERVICE` | Request fields cannot supply actor user ID, role, capability, scope, Team origin, or channel in the covered cases | Authorization result remains based on the server-derived actor and operation contract | Route handlers pass authenticated identity to adapters; central resolver accepts `AuthorizationActor`, not `Request` | `__tests__/api/employees-routes.test.ts`; `__tests__/api/authorization-administration-mutations.test.ts`; `__tests__/api/line-routine-routes.test.ts`; `__tests__/api/line-routine-self-service-routes.test.ts`; `__tests__/api/line-stock-routes.test.ts`; `__tests__/api/line-leave-routes.test.ts` | INDIRECT | MIGRATED_AUTHORIZATION | Outcome A leaves a finite route-proof gap for `LEDGER-EMP-04`, `LEDGER-ROU-01`, `LEDGER-ROU-02`, `LEDGER-ROU-06`, `LEDGER-ROU-07`, `LEDGER-ROU-08`, `LEDGER-ROU-14`, `LEDGER-ROU-15`, `LEDGER-ROU-16`, `LEDGER-ROU-17`, `LEDGER-ROU-18`, `LEDGER-STK-01`, `LEDGER-STK-02`, `LEDGER-STK-03`, `LEDGER-STK-04`, `LEDGER-STK-05`, `LEDGER-STK-08`, `LEDGER-LEV-14`, `LEDGER-LEV-16`, and `LEDGER-LEV-17`; implement these only through `11C2-API-01` | Headers are transport metadata only where the route explicitly derives a fixed channel. This aggregate row records adjacent spoofing evidence and does not claim that the listed operation rows are complete. |
| ACTOR-03 | Dynamic route parameters | The Admin, Routine occurrence/task, and Stock request target cases named in the test column | `DASHBOARD` | Route IDs identify a target only and cannot supply an authorization role or capability in the covered cases | Use the authenticated actor with the route ID as resource input; reject unauthorized target access | Route handlers and service command contexts; Admin route auth | `__tests__/api/authorization-administration-mutations.test.ts`; `__tests__/api/routines-occurrence-by-id.test.ts`; `__tests__/api/routines-task-by-id.test.ts`; `__tests__/api/stock-requests-routes.test.ts` | INDIRECT | MIGRATED_AUTHORIZATION | Exact dynamic-route proof remains missing for `LEDGER-ROU-08`, `LEDGER-ROU-14`, `LEDGER-ROU-15`, `LEDGER-ROU-16`, `LEDGER-ROU-17`, `LEDGER-ROU-18`, and `LEDGER-STK-08`; these are included in the finite `11C2-API-01` list | A target ID is not actor provenance; this aggregate row does not claim every dynamic route is directly tested. |
| ACTOR-04 | LIFF identity boundary | LIFF self-service capabilities | `LIFF_SELF_SERVICE` | LIFF identity must come from a verified LIFF/session boundary and current link, not request data | Use the verified `sub`, current User/Employee, and current account link; reject mismatch | `modules/line/application/liff.ts:requireLiffWorkforceSession`; LIFF route handlers | `__tests__/auth/liff.test.ts`; `__tests__/api/line-routine-routes.test.ts`; `__tests__/api/line-stock-routes.test.ts`; `__tests__/api/line-leave-routes.test.ts` | DIRECT | MIGRATED_AUTHORIZATION | None for covered LIFF identity paths | LIFF Admin remains a LIFF actor and does not inherit Dashboard Admin semantics. |
| ACTOR-05 | Employee transaction authorization | Employee update/delete and related mutation commands | `DASHBOARD` | A stale route-time role must not override the current persisted role when revalidation is required | Lock and re-read current User/Employee, rebuild actor from current state, then resolve | `modules/employee/application/authorization.ts:resolveEmployeeCapabilityInTransaction` | `modules/employee/application/authorization.test.ts`; `__tests__/auth/workforce-transaction.test.ts` | DIRECT | DOMAIN_OR_LIFECYCLE_POLICY | None for the Employee path | This evidence is specific to Employee and must not be generalized to every mutation path. |
| ACTOR-06 | Cross-domain transaction actor state | Routine, Stock, and Leave mutation transactions | `DASHBOARD` | Current persisted role must replace stale route-time role across every path that claims transaction-time revalidation | Re-read the current account actor before the final authorization decision | Domain transaction adapters do this path-by-path; each named adapter now has a direct stale-role regression case | `modules/routine/application/authorization.test.ts` (`rebuilds a stale Dashboard ADMIN route actor from the current persisted USER role`); `modules/stock/application/authorization.test.ts` (`denies Dashboard ADMIN compatibility after the persisted role is downgraded to USER`); `modules/leave/application/authorization.test.ts` (`rebuilds a stale Dashboard ADMIN route actor from the current persisted USER role`; `uses the current USER actor for final authorization after a stale ADMIN preflight`) | DIRECT | DOMAIN_OR_LIFECYCLE_POLICY | None for the covered Routine, Stock, and Leave adapters | Each stale-role case keeps User/Employee active and proves that the persisted USER role replaces route-time ADMIN authority. |
| ACTOR-07 | Channel derivation boundary | Dashboard and LIFF adapters | `DASHBOARD` / `LIFF_SELF_SERVICE` | Request-controlled channel must not change authorization semantics | Adapter constructs a fixed channel from the entry point; unsupported channel fails closed | Domain actor builders; `modules/authorization/contracts.ts`; route composition | `modules/employee/application/authorization.test.ts`; `modules/routine/application/authorization.test.ts`; `modules/stock/application/authorization.test.ts`; `modules/leave/application/authorization.test.ts`; `__tests__/api/line-routine-routes.test.ts` | DIRECT | ARCHITECTURE_BOUNDARY | None for the covered builders | API entry point is not itself an actor channel; route composition chooses the fixed channel. |
| CAP-01 | Central resolver | Any requested capability key | Any | Unknown capability must fail closed | Deny with `UNKNOWN_CAPABILITY`; do not consult persistence as if the key were valid | `modules/authorization/application/evaluator.ts:getAuthorizationEvaluationContext`; `modules/authorization/registry.ts` | `modules/authorization/application/resolver.test.ts`; `modules/authorization/registry.test.ts` | DIRECT | MIGRATED_AUTHORIZATION | None | Registry lookup precedes grant evaluation. |
| CAP-02 | Central resolver | Registered capability on unsupported channel | Any | Unsupported channel must fail closed | Deny with `CHANNEL_NOT_SUPPORTED` | `modules/authorization/application/evaluator.ts:getAuthorizationEvaluationContext` | `modules/authorization/application/resolver.test.ts`; `modules/authorization/registry.test.ts` | DIRECT | MIGRATED_AUTHORIZATION | None | No compatibility fallback is allowed for a channel error. |
| CAP-03 | Central resolver and domain adapters | Registered capability with no applicable grant | `DASHBOARD` / `LIFF_SELF_SERVICE` | Default authorization is additive ALLOW plus default DENY | Deny with `NO_APPLICABLE_GRANT`, except for the exact documented compatibility bridge | `modules/authorization/application/evaluator.ts`; each migrated domain authorization adapter | `modules/authorization/application/resolver.test.ts`; domain `application/authorization.test.ts` suites | DIRECT | MIGRATED_AUTHORIZATION | None for the central default-deny decision | Compatibility translation is recorded in separate rows and cannot mask structural errors. |
| CAP-04 | Central resolver grant union | Team, TeamRole, and direct User grants | `DASHBOARD` / `LIFF_SELF_SERVICE` | Currently applicable grants from valid Team, TeamRole, and direct User sources are additive; direct User grant does not require membership | Union the current applicable grants and normalize scopes; deny when the union is empty | `modules/authorization/application/evaluator.ts`; `modules/authorization/infrastructure/persistence/authorization-resolution-repository.ts` | `modules/authorization/application/resolver.test.ts` (`unions active Team, TeamRole, and direct User grants`; direct User grant without membership) | DIRECT | MIGRATED_AUTHORIZATION | None | “Applicable” includes current Team/membership/TeamRole lifecycle checks; grant rows themselves have present/removed semantics. There is no general explicit DENY policy. |
| CAP-05 | Central resolver current grant state | Direct User grants | Any supported channel | Removing a persisted direct User grant must affect a fresh subsequent authorization resolution | A removed grant must not authorize the subsequent request; the model has no User-grant `isActive` state | `authorization-resolution-repository.ts` reads present UserCapabilityGrant rows; evaluator resolves the fresh current set | `__tests__/integration/authorization-resolver.integration.test.ts` (`resolves a direct User grant without a membership`; `stops using a removed direct User grant on a fresh resolution`) | DIRECT | MIGRATED_AUTHORIZATION | — | “Removed” is the supported persistence transition; do not invent an inactive-grant flag. |
| CAP-06 | Central resolver membership state | Team-origin grants | Any supported channel | Removing a User's TeamMembership must exclude the Team-origin grant on a fresh subsequent resolution; Team lifecycle is a separate `Team.isActive` condition | A removed membership must not authorize through that Team; an inactive Team is also excluded | `authorization-resolution-repository.ts` queries current membership and `Team.isActive`; evaluator preserves the Team origin | `__tests__/integration/authorization-resolver.integration.test.ts` (`resolves a Team grant through an active membership`; `stops using a Team grant after its membership is removed`; `excludes an inactive Team`); `modules/authorization/application/resolver.test.ts`; repository query tests | DIRECT | MIGRATED_AUTHORIZATION | — | Team source and `TEAM` resource scope are independent. TeamMembership has no generic `isActive` flag; “removed” is the applicable state. |
| CAP-07 | Central resolver TeamRole state | TeamRole-origin grants | Any supported channel | Removing a TeamRoleCapabilityGrant must exclude that source; applicability also depends on current membership, `Team.isActive`, and `TeamRole.isActive` | A removed grant or no-longer-applicable membership/Team/TeamRole state must not authorize through that source | `authorization-resolution-repository.ts`; evaluator checks current membership and active Team/TeamRole | `__tests__/integration/authorization-resolver.integration.test.ts` (`resolves an active TeamRole grant through its membership`; `stops using a removed TeamRole grant on a fresh resolution`; `excludes an inactive TeamRole but retains Team grants`); `modules/authorization/application/resolver.test.ts`; `modules/authorization/application/administration-mutations.test.ts` | DIRECT | MIGRATED_AUTHORIZATION | — | TeamRoleCapabilityGrant has no `isActive` flag; “removed” is the applicable grant state, while `TeamRole.isActive` is a real lifecycle field. |
| CAP-08 | Persisted grant/configuration validation | Any persisted capability and scope | Any | Unknown persisted key or unsupported scope must fail closed rather than normalize or broaden | Return typed invalid-configuration failure; never allow the row | `modules/authorization/application/evaluator.ts:validatePersistedGrant`; grant validation and administration | `modules/authorization/application/grant-validation.test.ts`; `modules/authorization/application/resolver.test.ts`; `modules/authorization/application/administration.test.ts` | DIRECT | MIGRATED_AUTHORIZATION | None | No trim, wildcard, fallback, or second capability list is accepted. |
| CAP-09 | Grant origin validation | Team, TeamRole, and User grants | Any | Invalid Team/TeamRole origin and direct User `TEAM` scope must fail closed | Reject missing/mismatched origin with typed structural/configuration error | `modules/authorization/application/evaluator.ts:toEffectiveGrant`; origin checks in persistence and administration | `modules/authorization/application/resolver.test.ts`; `modules/authorization/application/grant-validation.test.ts`; `modules/authorization/application/administration.test.ts` | DIRECT | MIGRATED_AUTHORIZATION | None | Domain modules do not invent Team origin. |
| CAP-10 | Role semantics | TeamRole and system role | Any | A TeamRole name has no intrinsic authority; only registered currently applicable grants and system role semantics matter | A role without a matching grant is denied | `modules/authorization/application/evaluator.ts`; `lib/ssot/permissions.ts:isAdminRole` | `modules/authorization/application/resolver.test.ts` (`role with no grant is denied`); `modules/authorization/registry.test.ts` | DIRECT | MIGRATED_AUTHORIZATION | None | TeamRole is an origin/source, not a hierarchy or inherited authority. `TeamRole.isActive` is a role lifecycle field; a capability-grant row is present or removed. |
| CAP-11 | Registry and seed boundary | All registered capabilities | Any | Capability vocabulary is code-owned and production seed configuration cannot silently activate policy | Registry is the only capability source; empty seed remains empty unless explicitly configured and validated | `modules/authorization/registry.ts`; `modules/authorization/application/seed.ts`; `prisma/seed.ts` | `modules/authorization/registry.test.ts`; `modules/authorization/application/seed.test.ts`; `modules/authorization/application/administration.test.ts` | DIRECT | ARCHITECTURE_BOUNDARY | None for the baseline configuration | Persisted configuration may reference only registered keys and supported scopes. |
| CAP-12 | Authorization model | ALLOW aggregation | Any | No general explicit DENY, wildcard capability, policy DSL, or priority override may enter the evaluator | Only valid additive grants contribute to the decision; default remains deny | `modules/authorization/contracts.ts`; evaluator grant union and normalized scopes | `modules/authorization/application/resolver.test.ts` (union and default-deny cases) | INDIRECT | MIGRATED_AUTHORIZATION | `11C2-CAP-03`: optional contract/schema assertion if the persistence model changes; no migration is required by this audit | Current source inspection confirms the absence; the existing tests primarily prove additive behavior. This is an optional strengthening item, not a current production defect. |
| SCOPE-01 | Stock, Leave, and Notification relationships | `OWN` | `DASHBOARD` / `LIFF_SELF_SERVICE` | A resource owned by another User must not be returned or mutated under `OWN` | Query is actor-owned or operation is denied before disclosure | Stock query predicates; Leave owner/participant policy; Notification actor-derived user filter | `__tests__/api/line-stock-routes.test.ts`; `__tests__/api/stock-requests-routes.test.ts`; `__tests__/api/leave-cancel.test.ts`; `__tests__/api/leave-me.test.ts`; `__tests__/api/notifications.test.ts` | DIRECT | DOMAIN_OR_LIFECYCLE_POLICY | None for covered owner paths | Notification intentionally supports only actor-derived `OWN`. |
| SCOPE-02 | Routine task mutations and queries | `CREATED` | `DASHBOARD` / `LIFF_SELF_SERVICE` | Created-by relationship must be evaluated against the authenticated Employee | Creator may access only where the capability/scope permits; unrelated creator is denied | `modules/routine/application/authorization.ts:buildRoutineTaskScope`; Routine services | `modules/routine/application/authorization.test.ts`; `__tests__/api/routines-tasks.test.ts`; `__tests__/api/routines-task-by-id.test.ts` | DIRECT | DOMAIN_OR_LIFECYCLE_POLICY | None for covered creator predicates | `CREATED` is not an alias for `OWN` unless the domain explicitly maps it. |
| SCOPE-03 | Routine assignee and Leave approver workload | `ASSIGNED` | `DASHBOARD` / `LIFF_SELF_SERVICE` | Assignment relationship must be checked against the current actor/Employee | Only assigned work is visible or actionable where the scope requires it | `modules/routine/application/authorization.ts`; Leave approval/approver domain policies | `modules/routine/application/authorization.test.ts`; `__tests__/api/line-routine-routes.test.ts`; `__tests__/api/leave-approvals.test.ts`; `__tests__/api/leave-decision.test.ts` | DIRECT | DOMAIN_OR_LIFECYCLE_POLICY | None for covered assignment paths | Assignment changes are re-read in transaction rows where mutation semantics require it. |
| SCOPE-04 | Central Team grant origins | `TEAM` | Any | A Team-scoped grant must retain the Team that supplied the grant | Effective grant carries the valid originating `teamId` | `modules/authorization/application/evaluator.ts:toEffectiveGrant`; repository origin mapping | `modules/authorization/application/resolver.test.ts` (`preserves originating Team constraint`); `modules/authorization/application/administration.test.ts` | DIRECT | MIGRATED_AUTHORIZATION | None for current synthetic/origin validation | Team source and resource `TEAM` scope remain separate. No Team policy was activated by this corrective pass; production persisted state was not inventoried. |
| SCOPE-05 | Team resource semantics across domain modules | `TEAM` | Any | Team cannot broaden into another Team, and Team is not Department | No cross-Team authorization is claimed until a separately approved domain Team policy is activated | No active domain Team scope adapter; architecture and persistence contracts prohibit Department inference | `modules/authorization/application/resolver.test.ts` origin tests; architecture/documentation checks | N/A | ARCHITECTURE_BOUNDARY | Do not add Team policy in 11C.1; require a separately approved migration and domain tests | This is an architecture/deferred boundary, not a statement about current production Team records. |
| SCOPE-06 | Structural Team origin | `TEAM` and direct User grants | Any | Missing Team origin must fail closed | Reject direct User `TEAM` and malformed Team/TeamRole origins | `modules/authorization/application/evaluator.ts`; persistence validation | `modules/authorization/application/resolver.test.ts` (`direct User TEAM scope requires origin` and origin preservation) | DIRECT | MIGRATED_AUTHORIZATION | None | A domain must never fabricate a Team origin from Department, manager, position, or Employee metadata. |
| SCOPE-07 | ALL-scoped domain operations | `ALL` | `DASHBOARD` / `LIFF_SELF_SERVICE` | `ALL` removes only the relationship restriction represented by the scope | It does not bypass authentication, lifecycle, workflow, validation, locks, or concurrency | Domain query/mutation policies; transaction authorization adapters | `modules/stock/application/authorization.test.ts`; `modules/routine/application/authorization.test.ts`; `modules/leave/application/authorization.test.ts`; `modules/employee/application/mutations.test.ts` | DIRECT | DOMAIN_OR_LIFECYCLE_POLICY | None for covered domain paths | This invariant is repeated in the Admin rows because ADMIN receives authority through the same boundaries. |
| SCOPE-08 | Requested scope handling | Request `scope=all` and narrower grants | `DASHBOARD` / `LIFF_SELF_SERVICE` | A request cannot widen a narrower effective grant | Requested scope is a filter/selector only; effective scopes decide | Stock and Routine authorization/query builders | `__tests__/api/stock-requests-routes.test.ts`; `__tests__/api/line-stock-routes.test.ts`; `modules/routine/application/authorization.test.ts` | DIRECT | DOMAIN_OR_LIFECYCLE_POLICY | None for covered requested-scope cases | The Routine work-item bridge is an exact compatibility exception documented in COMPAT-06. |
| SCOPE-09 | Query-level relationship enforcement | Employee, Routine, Stock, Leave, Notification | `DASHBOARD` / `LIFF_SELF_SERVICE` | Unauthorized resources must not be returned before a later UI check in the covered reader cases | Apply actor/resource predicates before the query or return a safe denial | Domain query builders and route authorization gates | `__tests__/api/departments-route.test.ts`; `__tests__/api/notifications.test.ts`; `__tests__/api/stock-requests-routes.test.ts`; `__tests__/api/line-stock-routes.test.ts`; `__tests__/api/leave-me.test.ts`; `__tests__/api/routines-task-by-id.test.ts` | INDIRECT | DOMAIN_OR_LIFECYCLE_POLICY | No second unbounded route gap is implied. Required exact route assertions are the 20-row `11C2-API-01` set; the named domain query tests remain direct evidence for their own predicate semantics. Optional HTTP-plus-real-query strengthening may target `LEDGER-ROU-01`, `LEDGER-ROU-06`, and `LEDGER-ROU-07` only. | UI filtering is not a substitute for query scoping. This aggregate row does not claim every migrated reader is directly tested. |
| CHANNEL-01 | Dashboard migrated domains | Employee, Department, Routine, Stock, Leave, Audit, Notification | `DASHBOARD` | Dashboard operations use the Dashboard channel and current server actor | Resolve the registered capability for `DASHBOARD`, then apply domain policy | Domain authorization adapters and Dashboard route handlers | Employee, Department, Audit, Notification, Stock, Routine, and Leave authorization test suites; corresponding API suites | DIRECT | MIGRATED_AUTHORIZATION | None for covered Dashboard adapters | Broad compatibility floors are separate from central target policy. |
| CHANNEL-02 | LIFF migrated/self-service domains | Routine, Stock, Leave | `LIFF_SELF_SERVICE` | LIFF must use the same authoritative model while retaining self-service restrictions | Resolve with verified LIFF actor and LIFF channel; clamp operation/resource to self-service contract | `modules/line/application/liff.ts`; LIFF route handlers; domain adapters | `__tests__/api/line-routine-routes.test.ts`; `__tests__/api/line-stock-routes.test.ts`; `__tests__/api/line-leave-routes.test.ts`; LIFF session tests | DIRECT | MIGRATED_AUTHORIZATION | None for covered LIFF routes | LIFF is not a client-supplied role or unrestricted Dashboard channel. |
| CHANNEL-03 | Routine LIFF Admin | Routine task and summary self-service entry points | `LIFF_SELF_SERVICE` | ADMIN through LIFF must not inherit unrestricted Dashboard administrative semantics | Force mine/self-service scope and current LIFF Employee context | `app/api/line/routine/tasks/route.ts`; Routine LIFF actor/mode adapter; LIFF summary route | `__tests__/api/line-routine-routes.test.ts`; `modules/routine/application/authorization.test.ts` | DIRECT | COMPATIBILITY_POLICY | None for the explicit LIFF Admin clamp | Summary remains a deferred central capability surface even though the route is self-service scoped. |
| CHANNEL-04 | Stock LIFF processing | `stock.request.process` | `LIFF_SELF_SERVICE` | LIFF Admin must not obtain Dashboard-only account-only employee omission or unrelated administrative reach | Require verified LIFF workforce identity and the LIFF operation contract | `modules/stock/presentation/liff-stock-auth.ts`; LIFF stock route | `__tests__/api/line-stock-routes.test.ts`; `modules/stock/application/authorization.test.ts` | DIRECT | COMPATIBILITY_POLICY | None for covered processor route | The Dashboard ADMIN employee-optional seam is channel-specific. |
| CHANNEL-05 | Leave recovery and cancellation | `leave.cancellation.decide` and related recovery paths | `DASHBOARD` / `LIFF_SELF_SERVICE` | Explicit Dashboard recovery authority must not leak into LIFF | Enforce the documented Dashboard-only recovery exception; LIFF uses ordinary self-service/domain path | `modules/leave/application/authorization.ts:canUseLeaveAdminRecoveryOverride`; Leave route composition | `__tests__/api/leave-cancel.test.ts`; `__tests__/api/line-leave-routes.test.ts`; `modules/leave/application/authorization.test.ts` | DIRECT | COMPATIBILITY_POLICY | None for current channel restriction | No generic `ALL` bypass is created by the recovery exception. |
| CHANNEL-06 | Dashboard and LIFF projections | Capability and navigation projections | `DASHBOARD` / `LIFF_SELF_SERVICE` | Presentation projections must not change server authority | Projection may hide/show affordances, but direct route calls are independently authorized | `app/_lib/auth/current-user.ts`; `modules/line/application/liff.ts:getLiffCapabilities` | `__tests__/auth/current-user-projection.test.ts`; `__tests__/api/line-routine-routes.test.ts`; direct API denial tests | DIRECT | PRESENTATION_ONLY | None for the projection boundary | A hidden button is not evidence of protection. |
| CHANNEL-07 | Cross-channel model parity | Same capability model with explicit channel constraints | `DASHBOARD` / `LIFF_SELF_SERVICE` | Dashboard and LIFF must share registry/resolver semantics without sharing unrestricted channel authority | Same central decision model; channel-specific adapters constrain operation/resource | Domain adapters use the same resolver API with fixed channels | Cross-domain authorization adapter tests and LIFF route suites | INDIRECT | MIGRATED_AUTHORIZATION | `11C2-CHANNEL-01`: add a paired Dashboard/LIFF assertion for each capability that is intentionally available in both channels | Existing tests establish the two paths separately, not one exhaustive parity table. |
| API-01 | Employee API | Employee route/capability cases with named direct tests | `DASHBOARD` | Direct HTTP invocation must enforce authentication, capability, target relationship, lifecycle, and business rules in the covered cases | Unauthorized calls fail before service mutation/query; authorized calls still pass domain invariants | `app/api/employees/route.ts`; `app/api/employees/[id]/route.ts`; Employee authorization/service/transaction layer | `__tests__/api/employees-routes.test.ts`; `modules/employee/application/authorization.test.ts`; `modules/employee/application/mutations.test.ts` | INDIRECT | MIGRATED_AUTHORIZATION | The only Employee ledger row without an exact operation assertion is `LEDGER-EMP-04` (`GET /api/employees/export`, `employee.export`); it is the Employee portion of `11C2-API-01` | Broad Employee read/stat/export behavior is compatibility policy, not evidence of narrower target policy. |
| API-02 | Department API | `department.read` | `DASHBOARD` | Direct API access cannot bypass authentication or the central read capability | Deny before query unless the current actor is authorized; return scoped/full data only per current policy | `app/api/departments/route.ts`; Department authorization adapter | `__tests__/api/departments-route.test.ts`; `modules/department/application/authorization.test.ts` | DIRECT | MIGRATED_AUTHORIZATION | None for the current route | Department is reference data and is not a Team source. |
| API-03 | Routine migrated API | Routine route/capability cases with named direct tests | `DASHBOARD` / `LIFF_SELF_SERVICE` | Direct task, occurrence, and import calls must enforce auth, central capability, resource scope, lifecycle, workflow, and transaction rules in the covered cases | Deny before unauthorized disclosure/write; authorized mutation revalidates claimed invariants | `app/api/routines/tasks/**`; `app/api/routines/occurrences/**`; import routes; Routine authorization/mutations | `__tests__/api/routines-tasks.test.ts`; `__tests__/api/routines-task-by-id.test.ts`; `__tests__/api/routines-occurrences.test.ts`; `__tests__/api/routines-occurrence-by-id.test.ts`; `__tests__/api/routine-import-preview.test.ts`; Routine application tests | INDIRECT | MIGRATED_AUTHORIZATION | The exact Routine ledger gaps are `LEDGER-ROU-01`, `LEDGER-ROU-02`, `LEDGER-ROU-06`, `LEDGER-ROU-07`, `LEDGER-ROU-08`, `LEDGER-ROU-14`, `LEDGER-ROU-15`, `LEDGER-ROU-16`, `LEDGER-ROU-17`, and `LEDGER-ROU-18`; all are owned by `11C2-API-01`. Deferred summary/reference/export remain outside the ledger. | Summary/reference/export are explicitly excluded and listed as deferred. |
| API-04 | Stock migrated API | Stock route/capability cases with named direct tests | `DASHBOARD` / `LIFF_SELF_SERVICE` | Direct catalog, inventory, request, and report calls must enforce auth, capability, relationship, lifecycle, workflow, and idempotency/concurrency rules in the covered cases | Unauthorized resources are not returned and unauthorized writes do not occur | `app/api/stock/**`; `app/api/uploads/image/route.ts`; Stock authorization/mutations/queries | `__tests__/api/stock-requests-routes.test.ts`; `__tests__/api/stock-items-route.test.ts`; `__tests__/api/stock-reports-export-route.test.ts`; `__tests__/api/uploads-image-route.test.ts`; `__tests__/api/line-stock-routes.test.ts`; Stock application tests | INDIRECT | MIGRATED_AUTHORIZATION | The exact Stock ledger gaps are `LEDGER-STK-01`, `LEDGER-STK-02`, `LEDGER-STK-03`, `LEDGER-STK-04`, `LEDGER-STK-05`, and `LEDGER-STK-08`; all are owned by `11C2-API-01`. `LEDGER-STK-23`, `LEDGER-STK-24`, and `LEDGER-STK-26` are presentation projections, not mutation gaps. | File-system writes retain the documented non-atomic residual race; see TX-08. |
| API-05 | Leave migrated API | Leave route/capability cases with named direct tests | `DASHBOARD` / `LIFF_SELF_SERVICE` | Direct Leave calls must enforce auth, capability, relationship, lifecycle, workflow, quota, and transaction rules in the covered cases | Unauthorized request/approval/cancellation actions fail without disclosure or mutation | `app/api/leave/**`; Leave authorization and workflow services | `__tests__/api/leave-request.test.ts`; `__tests__/api/leave-decision.test.ts`; `__tests__/api/leave-cancel.test.ts`; `__tests__/api/leave-not-taken.test.ts`; `__tests__/api/leave-approvers.test.ts`; `__tests__/api/line-leave-routes.test.ts`; Leave application tests | INDIRECT | MIGRATED_AUTHORIZATION | The exact Leave ledger gaps are `LEDGER-LEV-14`, `LEDGER-LEV-16`, and `LEDGER-LEV-17`; all are owned by `11C2-API-01`. Deferred report/export and participant surfaces remain separate. | Explicit domain recovery is not a generic capability bypass. |
| API-06 | Audit API | `audit.read` | `DASHBOARD` | Direct audit log access must use the server actor and central capability before query | Deny ungranted access before query; preserve safe audit response | `app/api/audit-logs/route.ts`; Audit authorization adapter | `__tests__/api/audit-log-route.test.ts`; `modules/audit/application/authorization.test.ts` | DIRECT | MIGRATED_AUTHORIZATION | Audit export-event metadata policy remains a separate review item | The actual route is `audit-logs`, not `app/api/audit/route.ts`. |
| API-07 | Notification API | `notification.inbox.read`, `notification.inbox.update` | `DASHBOARD` | Direct inbox read/update must use actor-derived User ownership and separate mutation capability | Read and update are independently authorized; no client user ID broadens access | `app/api/notifications/**`; Notification authorization adapter | `__tests__/api/notifications.test.ts`; `modules/notification/application/authorization.test.ts` | DIRECT | MIGRATED_AUTHORIZATION | None for covered inbox operations | The adapter intentionally rejects broad non-`OWN` notification scopes. |
| API-08 | Authorization Administration API | Team, TeamRole, membership, and User grant administration | `DASHBOARD` | Admin management must authenticate and authorize the trusted server principal; body role/user fields cannot elevate | Unauthenticated/non-ADMIN callers fail before persistence; valid Admin commands retain validation and audit rules | `app/api/authorization/administration/_lib/route-auth.ts`; `modules/authorization/application/administration.ts` | `__tests__/api/authorization-administration.test.ts`; `__tests__/api/authorization-administration-mutations.test.ts`; `modules/authorization/application/administration-mutations.test.ts` | DIRECT | MIGRATED_AUTHORIZATION | None for covered Admin administration boundaries | Administration can persist configuration independently of the code-owned seed; this audit did not inspect production runtime records. |
| API-09 | Direct API versus presentation | Migrated protected actions represented by the named route denial suites | `DASHBOARD` / `LIFF_SELF_SERVICE` | A hidden UI control or absent navigation must not be the only protection in the covered cases | Direct HTTP call still hits server auth, authorization, relationship, lifecycle, and domain/workflow checks | Route handlers, service command boundaries, and transaction adapters | Employee, Routine, Stock, Leave, Notification, Admin, and LIFF route denial tests | INDIRECT | MIGRATED_AUTHORIZATION | Presentation evidence does not close the 20 operation rows in the finite `11C2-API-01` set: `LEDGER-EMP-04`, `LEDGER-ROU-01`, `LEDGER-ROU-02`, `LEDGER-ROU-06`, `LEDGER-ROU-07`, `LEDGER-ROU-08`, `LEDGER-ROU-14`, `LEDGER-ROU-15`, `LEDGER-ROU-16`, `LEDGER-ROU-17`, `LEDGER-ROU-18`, `LEDGER-STK-01`, `LEDGER-STK-02`, `LEDGER-STK-03`, `LEDGER-STK-04`, `LEDGER-STK-05`, `LEDGER-STK-08`, `LEDGER-LEV-14`, `LEDGER-LEV-16`, and `LEDGER-LEV-17`. | Presentation rows cannot be counted as API enforcement. This aggregate row does not claim every migrated action is directly tested. |
| API-10 | Migrated route breadth | Every migrated protected route/capability/channel row in the finite ledger; the three Stock LIFF projection rows are inventory-only | `DASHBOARD` / `LIFF_SELF_SERVICE` | Under Outcome A, every migrated protected route/capability/channel pair requires a direct regression assertion for its own boundary | The target contract is an exact route-level assertion for each of the 78 protected rows; projection flags do not substitute for mutation authority | Source inventory is broad; the operation-level ledger is explicit and separates protected operations from presentation projections | The ledger names the exact 20 protected rows without adequate direct route proof | MISSING | MIGRATED_AUTHORIZATION | `11C2-API-01`: add direct behavior tests for exactly `LEDGER-EMP-04`, `LEDGER-ROU-01`, `LEDGER-ROU-02`, `LEDGER-ROU-06`, `LEDGER-ROU-07`, `LEDGER-ROU-08`, `LEDGER-ROU-14`, `LEDGER-ROU-15`, `LEDGER-ROU-16`, `LEDGER-ROU-17`, `LEDGER-ROU-18`, `LEDGER-STK-01`, `LEDGER-STK-02`, `LEDGER-STK-03`, `LEDGER-STK-04`, `LEDGER-STK-05`, `LEDGER-STK-08`, `LEDGER-LEV-14`, `LEDGER-LEV-16`, and `LEDGER-LEV-17`. Do not create an unbounded route-breadth task. | This is a finite coverage gap, not evidence of a production bypass. The three projection rows remain presentation evidence and are not independent mutation operations. |
| TX-01 | Mutation-sensitive migrated operations | Authorization state visible to a supported transaction-time re-read | `DASHBOARD` / `LIFF_SELF_SERVICE` | A supported revalidation path must not make its final decision from a stale preflight actor/resource state when a revocation or lifecycle change is visible to that transaction | Final authorization uses the state observed by the path's own lock/re-read boundary; no atomic guarantee is claimed for a grant, membership, or role row committed concurrently in an unrelated transaction after the resolver read | `resolveInTransaction`; `runSerializableTransaction`; domain adapters lock/re-read User, Employee, target Employee, or relationship rows where documented. Grant/membership rows are not generally locked by the resolver | `modules/leave/application/authorization.test.ts` (`rejects a stale Employee 21 preflight when persisted User now belongs to Employee 22`) — query for `employeeId: 21` returns no row because the current persisted relationship is 22; the adapter denies before the central resolver | DIRECT | MIGRATED_AUTHORIZATION | None for the supported Leave relationship re-read boundary covered here | This direct test uses a query-aware mock that applies the production `employeeId` predicate; it models only state visible after the adapter's own User/Employee locks and does not require an unrelated external grant or membership commit to become visible. |
| TX-02 | Current actor lifecycle in mutation transactions | User and Employee lifecycle | `DASHBOARD` / `LIFF_SELF_SERVICE` | User/Employee deactivation, deletion, or suspension while a mutation waits must fail closed | Lock/re-read current actor lifecycle before final authorization and write | `lib/auth/workforce-transaction.ts`; Employee, Stock, Routine, and Leave transaction adapters | `__tests__/auth/workforce-transaction.test.ts`; `modules/employee/application/authorization.test.ts`; `modules/stock/application/authorization.test.ts`; `modules/leave/application/authorization.test.ts`; Routine mutation tests | DIRECT | DOMAIN_OR_LIFECYCLE_POLICY | None for covered lifecycle races | The exact supported transaction paths are domain-specific. |
| TX-03 | Routine assignee and Employee target state | Routine task/occurrence mutation | `DASHBOARD` / `LIFF_SELF_SERVICE` | Target Employee lifecycle changes or an invalid assignee must not be committed | Lock and re-read target Employees; reject inactive/deleted targets before write | `modules/routine/application/authorization.ts:assertActiveEmployeesInTransaction`; Routine mutation services | `modules/routine/application/mutations.test.ts`; `modules/routine/application/authorization.test.ts`; `__tests__/api/routines-task-by-id.test.ts` | DIRECT | DOMAIN_OR_LIFECYCLE_POLICY | None for the verified Routine target path | This is one of the Phase 11B.3 hardening fixes. |
| TX-04 | Routine assignment and Leave approval relationships | Assignee/approver/resource relationship | `DASHBOARD` / `LIFF_SELF_SERVICE` | A stale or changed relationship must not authorize the final mutation | Re-read relationship under the domain transaction and reject invalid current assignment/approver state | Routine mutation transaction; Leave approval/approver transaction services | `modules/routine/application/mutations.test.ts`; `modules/leave/application/approvals/*.test.ts`; `__tests__/api/leave-decision.test.ts`; `__tests__/api/leave-cancel.test.ts` | DIRECT | DOMAIN_OR_LIFECYCLE_POLICY | None for covered relationship races | Relationship semantics remain owned by the domain module. |
| TX-05 | Lock and re-read ordering | Employee, Routine, Stock, Leave mutation paths | `DASHBOARD` / `LIFF_SELF_SERVICE` | A lock must precede the final current-state check where the path claims protection | Wait for relevant row locks, then re-read current state and decide; no stale pre-lock snapshot may authorize | `lib/auth/workforce-transaction.ts`; per-domain transaction authorization functions | `__tests__/auth/workforce-transaction.test.ts`; Employee/Stock/Routine/Leave authorization and mutation tests | DIRECT | DOMAIN_OR_LIFECYCLE_POLICY | None for the covered lock/re-read implementations | This proves only paths that actually implement the helper/transaction contract. |
| TX-06 | Cross-domain stale actor state | Current persisted system role in final mutation decision for adapters that claim actor revalidation | `DASHBOARD` / `LIFF_SELF_SERVICE` | A supported mutation adapter must not reuse a stale route-time or client-supplied system role after the current persisted role has changed | Re-read the current User/Employee actor state at the adapter's documented boundary; no claim is made that the resolver atomically observes an unrelated concurrent grant-table commit | Employee explicitly rebuilds the actor; Stock, Routine, and Leave now each assert the current actor at the final resolver boundary | `modules/routine/application/authorization.test.ts` (`uses the revalidated Routine actor for the final capability decision`); `modules/stock/application/authorization.test.ts` (`denies Dashboard ADMIN compatibility after the persisted role is downgraded to USER`); `modules/leave/application/authorization.test.ts` (`uses the current USER actor for final authorization after a stale ADMIN preflight`) | DIRECT | DOMAIN_OR_LIFECYCLE_POLICY | None for the covered Stock, Routine, and Leave transaction adapters | The final resolver receives the current USER actor; no grant/membership race or atomic external-commit guarantee is added. |
| TX-07 | Workflow and concurrency invariants | Version checks, idempotency, overlap, state transitions, and serializable operations | `DASHBOARD` / `LIFF_SELF_SERVICE` | ADMIN and ordinary actors cannot bypass domain concurrency or invalid-state rules | Reject stale versions, duplicate/replayed effects, overlap, processed-state changes, or conflicting writes | Domain mutation transactions and workflow services | `modules/routine/application/mutations.test.ts`; `modules/stock/__tests__/mutations.test.ts`; `__tests__/api/leave-request.test.ts`; `__tests__/api/leave-not-taken.test.ts`; Leave integration concurrency test | DIRECT | DOMAIN_OR_LIFECYCLE_POLICY | None for covered domain invariants | Authorization `ALL` never removes these checks. |
| TX-08 | Stock upload boundary | `stock.inventory.manage` plus image/file write | `DASHBOARD` | Stale authority must not reach a file-system write after preflight | Require capability before parsing/file work and immediately before the write | `app/api/uploads/image/route.ts`; Stock authorization adapter | `__tests__/api/uploads-image-route.test.ts` | DIRECT | DOMAIN_OR_LIFECYCLE_POLICY | Documented residual file-system TOCTOU remains accepted; address only if atomic file authorization is later required | Database authorization and file-system write are not one atomic transaction. |
| TX-09 | Read-only and explicitly non-transactional paths | Reads, Employee create/import, and other paths without a transaction-time claim | `DASHBOARD` / `LIFF_SELF_SERVICE` | Do not invent transaction guarantees that the current path does not claim | Apply route preflight and the documented domain/lifecycle policy; classify stronger guarantees as future work | Per-route authorization and service boundaries; no `resolveInTransaction` claim for these paths | Existing read/import tests cover their documented behavior, not a transaction race | N/A | DOMAIN_OR_LIFECYCLE_POLICY | No action in 11C.1; require an explicit policy decision before adding a guarantee | N/A means the transaction-time invariant is not claimed, not that the route is unauthenticated. |
| TX-10 | Routine import | `routine.import.manage` | `DASHBOARD` | Partial import semantics do not claim a transaction-wide authorization re-read | Keep the documented preflight/parse/validation behavior; do not label it transactionally revalidated | Routine import route and service | `__tests__/api/routine-import-preview.test.ts`; Routine import application tests | N/A | DOMAIN_OR_LIFECYCLE_POLICY | Defer stronger atomic/revalidation semantics to a separately scoped Routine decision | This surface is migrated for capability gating but has no transaction-wide re-read claim. |
| TX-11 | Resolver transaction context | Any migrated capability used inside a supported transaction | `DASHBOARD` / `LIFF_SELF_SERVICE` | Transactional callers must use the supplied current context and central resolver rather than a request-controlled actor | `resolveInTransaction` preserves central registry/channel/grant semantics | `modules/authorization/application/resolver.ts:resolveInTransaction`; transaction adapters | `modules/authorization/application/resolver.test.ts`; domain authorization transaction tests | DIRECT | MIGRATED_AUTHORIZATION | None for the resolver context contract | Domain locks and business rules remain outside the resolver. |
| ADMIN-01 | Central ADMIN resolution | All registered capabilities supported by system role | `DASHBOARD` / `LIFF_SELF_SERVICE` | ADMIN is the highest system authorization role within registered capability/channel semantics | Registered capability resolves to intended ADMIN authority and supported scopes | `modules/authorization/application/evaluator.ts`; `lib/ssot/permissions.ts:isAdminRole` | `modules/authorization/application/resolver.test.ts`; domain authorization tests; Admin route tests | DIRECT | MIGRATED_AUTHORIZATION | None for central ADMIN authority | ADMIN does not mean unrestricted execution. |
| ADMIN-02 | Authentication boundary | Any ADMIN operation | `DASHBOARD` / `LIFF_SELF_SERVICE` | ADMIN must not bypass authentication or session validity | Missing/invalid/inactive/deleted account fails before ADMIN resolution | `lib/auth/api.ts:requireAdminSession`; `modules/line/application/liff.ts` for LIFF | `__tests__/api/authorization-administration.test.ts`; `__tests__/api/authorization-administration-mutations.test.ts`; `__tests__/lib/server-auth-token-version.test.ts`; LIFF auth tests | DIRECT | MIGRATED_AUTHORIZATION | None | A request body role or route role cannot create ADMIN. |
| ADMIN-03 | ADMIN workforce lifecycle | Stock, Routine, Leave, and lower-level ADMIN paths | `DASHBOARD` / `LIFF_SELF_SERVICE` | ADMIN cannot bypass required active workforce lifecycle except explicit account-only paths | Require active Employee where the operation requires it; allow only the documented Dashboard account-only exceptions | Stock, Routine, and Leave transaction authorization adapters; workforce helpers | `modules/stock/application/authorization.test.ts`; `modules/routine/application/authorization.test.ts`; `modules/leave/application/authorization.test.ts`; `__tests__/auth/workforce.test.ts` | DIRECT | COMPATIBILITY_POLICY | No mandatory Phase 11C.2 gap; optional strengthening is limited to an explicit negative test for an unlisted account-only capability if the allowlist expands | Current tests directly establish required workforce gates and the narrow Dashboard account-only exceptions. Account-only exceptions do not generalize to all capabilities or LIFF. |
| ADMIN-04 | Domain and workflow invariants | All ADMIN mutations | `DASHBOARD` / `LIFF_SELF_SERVICE` | ADMIN cannot bypass invalid state transitions, resource relationships, business rules, or validation | Domain command remains subject to current state, ownership/assignment semantics, and validation | Domain services and transaction adapters after authorization | Employee mutation tests; Routine mutation tests; Stock mutation tests; Leave decision/cancel/not-taken tests | DIRECT | DOMAIN_OR_LIFECYCLE_POLICY | None for covered domain invariants | `ALL` removes only a relationship restriction represented by the scope. |
| ADMIN-05 | ADMIN transaction/concurrency boundary | Mutation-sensitive ADMIN operations | `DASHBOARD` / `LIFF_SELF_SERVICE` | ADMIN cannot bypass locks, re-reads, expected-version, idempotency, or serializable constraints | Same transaction/concurrency outcome as the domain contract requires | Employee, Routine, Stock, and Leave transaction services | `__tests__/auth/workforce-transaction.test.ts`; Routine/Stock/Leave mutation and concurrency tests | DIRECT | DOMAIN_OR_LIFECYCLE_POLICY | None for covered mutation paths | No claim is made for unsupported non-transactional paths. |
| ADMIN-06 | ADMIN Team origin | `TEAM` scope | Any | ADMIN cannot fabricate a Team origin or turn Team into an implicit broad scope | Team-only ADMIN configuration fails closed unless a valid origin is present; no Team ADMIN policy was activated by this corrective pass | `modules/authorization/application/evaluator.ts` ADMIN branch; registry scope validation | `modules/authorization/application/resolver.test.ts` (`ADMIN Team-only configuration fails`); `modules/authorization/application/administration.test.ts` | DIRECT | MIGRATED_AUTHORIZATION | None | ADMIN is not a reason to invent a Team; this does not assert current production Team records. |
| ADMIN-07 | Channel restriction | LIFF-visible Admin operations and Dashboard-only recovery | `LIFF_SELF_SERVICE` | ADMIN through LIFF must remain channel-restricted | Apply LIFF operation/resource restrictions and reject Dashboard-only recovery semantics | LIFF route composition; Routine, Stock, and Leave channel adapters | `__tests__/api/line-routine-routes.test.ts`; `__tests__/api/line-stock-routes.test.ts`; `__tests__/api/line-leave-routes.test.ts`; `__tests__/api/leave-cancel.test.ts` | DIRECT | COMPATIBILITY_POLICY | None for covered channel restrictions | LIFF Admin is not a Dashboard Admin session. |
| ADMIN-08 | Current ADMIN role | Employee/Admin route and transaction cases named in the test column | `DASHBOARD` | A stale route-time or client-supplied role must not remain authoritative after persisted role changes in the covered cases | Re-authenticate/re-read current role at the applicable boundary; non-ADMIN is denied | `modules/auth/application/sessions.ts`; Admin route auth; Employee transaction adapter | `__tests__/auth/auth-principal.test.ts`; `__tests__/lib/server-auth-token-version.test.ts`; `modules/employee/application/authorization.test.ts`; Admin mutation tests | INDIRECT | DOMAIN_OR_LIFECYCLE_POLICY | Cross-domain mutation breadth is tracked in `ACTOR-06` and `TX-06`; do not generalize Employee proof to every ADMIN mutation | Current role comes from persistence, not the request. |
| COMPAT-01 | Employee compatibility | Employee read, stats, and export | `DASHBOARD` | Broad legacy read policy must remain explicit and must not be mistaken for narrow relationship policy | Current documented broad floor may allow the operation; no claim of migrated fine-grained PII policy is made | `modules/employee/application/authorization.ts` legacy read/stats/export mapping | `modules/employee/application/authorization.test.ts`; `__tests__/api/employees-routes.test.ts` | DIRECT | COMPATIBILITY_POLICY | Revisit only through an explicit Employee broad-data policy decision | Employee PII/broad-data policy is out of scope for 11C.1. |
| COMPAT-02 | Employee compatibility | Employee create/update/delete/import ADMIN floor | `DASHBOARD` | Legacy Admin floor must not be read as a central User grant or as an ADMIN lifecycle bypass | Explicit trusted ADMIN floor may authorize the adapter; lifecycle, validation, and transaction rules remain | `modules/employee/application/authorization.ts`; Employee mutation service | `modules/employee/application/authorization.test.ts`; `__tests__/api/employees-routes.test.ts`; `modules/employee/application/mutations.test.ts` | DIRECT | COMPATIBILITY_POLICY | Keep floor until a separately approved Employee migration replaces it | Exact structural/configuration denials do not bridge. |
| COMPAT-03 | Department compatibility | `department.read` | `DASHBOARD` | Full-read floor is a documented compatibility policy, not Team authorization | Current compatible full response may be returned after auth; no Department-to-Team inference | `modules/department/application/authorization.ts` | `modules/department/application/authorization.test.ts`; `__tests__/api/departments-route.test.ts` | DIRECT | COMPATIBILITY_POLICY | None for the accepted floor | Department remains independent reference data. |
| COMPAT-04 | Notification compatibility | `notification.inbox.read` and `notification.inbox.update` | `DASHBOARD` | Legacy default must remain actor-owned and cannot broaden to all users | Exact no-grant compatibility may resolve to `OWN`; non-OWN broad scopes are rejected by the adapter | `modules/notification/application/authorization.ts` | `modules/notification/application/authorization.test.ts`; `__tests__/api/notifications.test.ts` | DIRECT | COMPATIBILITY_POLICY | None | This is a deliberately narrow compatibility floor. |
| COMPAT-05 | Stock compatibility | Stock catalog/request floors and Dashboard ADMIN employee-optional branch | `DASHBOARD` / `LIFF_SELF_SERVICE` | Legacy floors must not broaden requested scope or bypass the applicable workforce/channel rules | Preserve explicit Stock mapping; employee-optional behavior is Dashboard ADMIN-only for the allowlist | `modules/stock/application/authorization.ts`; `modules/stock/presentation/liff-stock-auth.ts` | `modules/stock/application/authorization.test.ts`; `__tests__/api/stock-requests-routes.test.ts`; `__tests__/api/line-stock-routes.test.ts` | DIRECT | COMPATIBILITY_POLICY | None for current mappings | LIFF requires verified workforce identity; request `scope` cannot promote a User. |
| COMPAT-06 | Routine compatibility bridge | Routine work-item read with requested `scope=all` | `DASHBOARD` | The NO_APPLICABLE_GRANT to `ALL` bridge must apply only to the exact historical work-item case | Normal USER, `routine.task.read`, exact resolver denial reason, work-item view, and requested all may bridge; all other denials remain denials | `modules/routine/application/authorization.ts`; task occurrence route/service | `modules/routine/application/authorization.test.ts`; `__tests__/api/routines-occurrences.test.ts`; `__tests__/api/routine-summary.test.ts` for contrast | DIRECT | COMPATIBILITY_POLICY | Do not retire or broaden this bridge in 11C.1 | Explicit grants, structural errors, unsupported channels, and non-work-item operations do not bridge. |
| COMPAT-07 | Routine deferred surfaces | `routine.summary.read`, `routine.reference.read`, `routine.task.export` | `DASHBOARD` / `LIFF_SELF_SERVICE` | Deferred surfaces must not be reported as migrated central authorization | Preserve current route authentication, self-service/resource behavior, and explicit deferred/non-grantable status until policy is selected | `app/api/routines/summary/route.ts`; `app/api/routines/reference/route.ts`; `app/api/routines/export/route.ts`; `app/api/line/routine/summary/route.ts`; `app/api/line/routine/reference/route.ts`; administration catalog/mutation boundary | `modules/authorization/application/administration.test.ts` directly asserts deferred/non-grantable metadata; `modules/authorization/application/administration-mutations.test.ts` rejects ordinary grants; `__tests__/api/routine-summary.test.ts`; `__tests__/api/routines-reference.test.ts`; `__tests__/api/routine-export.test.ts` cover current route behavior | DIRECT | DEFERRED_AUTHORIZATION_SURFACE | None for the current deferred invariant. Future target-policy selection is outside the Phase 11C.2 regression backlog | Summary/reference/export are excluded from the 35 migrated capabilities. Existing route tests are not evidence that the future target policy has been chosen. |
| COMPAT-08 | Routine LIFF Admin compatibility | Routine task self-service | `LIFF_SELF_SERVICE` | LIFF Admin compatibility must remain Employee-scoped and cannot inherit Dashboard all-view | Clamp task access to the linked/current Employee and preserve self-service mutation rules | Routine actor mode and LIFF route composition | `__tests__/api/line-routine-routes.test.ts`; `modules/routine/application/authorization.test.ts`; `__tests__/api/line-routine-self-service-routes.test.ts` | DIRECT | COMPATIBILITY_POLICY | None for current clamp | This is separate from deferred Dashboard summary/export policy. |
| COMPAT-09 | Leave compatibility | Leave request/approval ownership and explicit account-only Admin mapping | `DASHBOARD` / `LIFF_SELF_SERVICE` | Legacy relationship floors and narrow Admin exception must remain explicit | Apply `OWN`/`ASSIGNED`/documented Admin mapping; preserve workflow and lifecycle rules | `modules/leave/application/authorization.ts`; Leave workflow services | `modules/leave/application/authorization.test.ts`; `__tests__/api/leave-decision.test.ts`; `__tests__/api/leave-cancel.test.ts`; `__tests__/api/leave-approvers.test.ts` | DIRECT | COMPATIBILITY_POLICY | None for current migrated Leave mapping | No generic `ALL` compatibility is introduced. |
| COMPAT-10 | Leave deferred report/export | Leave report/export operations | `DASHBOARD` | Report/export must not be represented as a migrated capability merely because the route authenticates | Preserve current route/domain checks and keep the operation outside the migrated capability set until policy is selected | `app/api/leave/export/route.ts`; report services; registry/administration capability inventory | `__tests__/api/leave-export.test.ts`; `modules/leave/infrastructure/reports/report-export.test.ts` cover current route/report behavior; registry/administration tests provide adjacent evidence that no Leave report/export capability is in the migrated set | INDIRECT | DEFERRED_AUTHORIZATION_SURFACE | Optional strengthening: add an explicit current-classification assertion; selecting a future report/export policy is outside the Phase 11C.2 regression backlog | Employee broad-data and Leave reporting decisions remain out of scope. Current report behavior is not presented as migrated central authorization or as an administratively grantable capability. |
| COMPAT-11 | Leave participant and attachment access | Leave participant/detail/attachment operations | `DASHBOARD` / `LIFF_SELF_SERVICE` | Domain participant and file ownership rules must not be relabeled as generic capability coverage | Enforce current participant/approver/owner/admin domain relationship and safe file/path rules | Leave attachment/detail routes and domain policy | `__tests__/api/leave-attachment.test.ts`; `__tests__/api/line-leave-routes.test.ts`; Leave participant/attachment tests | DIRECT | DOMAIN_OR_LIFECYCLE_POLICY | Keep as domain policy until a dedicated capability is approved | This row is not part of the eight migrated Leave capabilities. |
| COMPAT-12 | Leave recovery and LIFF cancellation exceptions | Recovery/admin decision and self-service cancellation | `DASHBOARD` / `LIFF_SELF_SERVICE` | Explicit recovery/domain exceptions must not become generic authorization bypasses | Dashboard Admin recovery remains domain-gated; LIFF cannot use recovery override; ordinary cancellation remains relationship/workflow gated | `modules/leave/application/authorization.ts`; recovery and cancellation route/service boundaries | `__tests__/api/leave-admin-recovery.test.ts`; `__tests__/api/leave-cancel.test.ts`; `__tests__/api/line-leave-routes.test.ts`; `__tests__/api/leave-not-taken.test.ts` | DIRECT | DOMAIN_OR_LIFECYCLE_POLICY | None for current exception boundaries | The exception is channel- and operation-specific. |
| COMPAT-13 | Email Request deferred surface | `email.request.read`, `email.request.create` | `DASHBOARD` | Existing Admin/API session handling must not be mistaken for a migrated central capability | Preserve current explicit route behavior and deferred/non-grantable status; no capability registry migration in this phase | `app/api/email-request/route.ts`; outbox/email service; existing session guards; administration catalog/mutation boundary | `modules/authorization/application/administration.test.ts` directly asserts deferred/non-grantable metadata; `modules/authorization/application/administration-mutations.test.ts` rejects ordinary deferred grants; `__tests__/api/email-request.test.ts` covers current route behavior | DIRECT | DEFERRED_AUTHORIZATION_SURFACE | None for the current deferred invariant. Selecting Email Request policy is outside the Phase 11C.2 regression backlog | Do not force deferred Email into the migrated count. Current route behavior is not evidence of a future target policy. |
| COMPAT-14 | Presentation-only policy | Dashboard and LIFF navigation, tabs, buttons, and projections | `DASHBOARD` / `LIFF_SELF_SERVICE` | UI visibility can be stale, absent, or permissive without changing server authority | Direct server invocation remains the security test; projections are informative only | `app/_lib/auth/current-user.ts`; `modules/line/application/liff.ts:getLiffCapabilities` | `__tests__/auth/current-user-projection.test.ts`; direct API denial suites | DIRECT | PRESENTATION_ONLY | None for the boundary; add UI tests only for UX, not security authority | Do not count a hidden control as an authorization regression test. |
| COMPAT-15 | Team and organization architecture | Future Team policy; Department reference data | Any | Team is not Department, TeamRole names do not imply authority, and no Team origin may be inferred from employee metadata | Do not activate Team policy in this phase; require explicit origin/configuration before any future migration | `docs/architecture/dependency-rules.md`; `docs/architecture/module-boundaries.md`; authorization persistence and resolver contracts | Architecture checker tests; registry/resolver origin tests; administration tests | INDIRECT | ARCHITECTURE_BOUNDARY | Preserve the documented boundary; a future Team migration needs its own domain/resource matrix and explicit behavior tests | This is an architecture/non-inference boundary, not a production database inventory. |

## Coverage summary grouped by invariant

Counts below are derived from the matrix rows above. `N/A` is included rather
than silently counted as a gap because the current implementation explicitly
does not claim that invariant for those paths.

| Invariant dimension | Total | DIRECT | INDIRECT | MISSING | N/A |
| --- | ---: | ---: | ---: | ---: | ---: |
| `AUTHN-*` Authentication boundary | 4 | 3 | 1 | 0 | 0 |
| `LIFE-*` Identity lifecycle | 6 | 6 | 0 | 0 | 0 |
| `ACTOR-*` Trusted actor provenance | 7 | 5 | 2 | 0 | 0 |
| `CAP-*` Capability resolution | 12 | 11 | 1 | 0 | 0 |
| `SCOPE-*` Resource scopes | 9 | 7 | 1 | 0 | 1 |
| `CHANNEL-*` Channel isolation and projections | 7 | 6 | 1 | 0 | 0 |
| `API-*` Direct API enforcement | 10 | 4 | 5 | 1 | 0 |
| `TX-*` Transaction-time revalidation | 11 | 9 | 0 | 0 | 2 |
| `ADMIN-*` ADMIN invariants | 8 | 7 | 1 | 0 | 0 |
| `COMPAT-*` Compatibility and deferred surfaces | 15 | 13 | 2 | 0 | 0 |
| **Total** | **89** | **71** | **14** | **1** | **3** |

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
| Auth/session and lifecycle | `AUTHN-*`, `LIFE-*` | 10 | 9 | 1 | 0 | 0 |
| Central actor/resolver/registry | `ACTOR-*`, `CAP-*` | 19 | 16 | 3 | 0 | 0 |
| Cross-domain scope semantics | `SCOPE-*` | 9 | 7 | 1 | 0 | 1 |
| Dashboard, LIFF, and presentation boundary | `CHANNEL-*` | 7 | 6 | 1 | 0 | 0 |
| Employee API and migrated policy | `API-01` | 1 | 0 | 1 | 0 | 0 |
| Department API and migrated policy | `API-02` | 1 | 1 | 0 | 0 | 0 |
| Routine migrated API | `API-03` | 1 | 0 | 1 | 0 | 0 |
| Stock migrated API | `API-04` | 1 | 0 | 1 | 0 | 0 |
| Leave migrated API | `API-05` | 1 | 0 | 1 | 0 | 0 |
| Audit API | `API-06` | 1 | 1 | 0 | 0 | 0 |
| Notification API | `API-07` | 1 | 1 | 0 | 0 | 0 |
| Authorization Administration API | `API-08` | 1 | 1 | 0 | 0 | 0 |
| Cross-domain direct API breadth | `API-09`, `API-10` | 2 | 0 | 1 | 1 | 0 |
| Transaction and concurrency enforcement | `TX-*` | 11 | 9 | 0 | 0 | 2 |
| ADMIN cross-domain invariants | `ADMIN-*` | 8 | 7 | 1 | 0 | 0 |
| Employee compatibility | `COMPAT-01`, `COMPAT-02` | 2 | 2 | 0 | 0 | 0 |
| Department compatibility | `COMPAT-03` | 1 | 1 | 0 | 0 | 0 |
| Notification compatibility | `COMPAT-04` | 1 | 1 | 0 | 0 | 0 |
| Stock compatibility | `COMPAT-05` | 1 | 1 | 0 | 0 | 0 |
| Routine compatibility/deferred | `COMPAT-06` to `COMPAT-08` | 3 | 3 | 0 | 0 | 0 |
| Leave compatibility/deferred/domain | `COMPAT-09` to `COMPAT-12` | 4 | 3 | 1 | 0 | 0 |
| Email deferred surface | `COMPAT-13` | 1 | 1 | 0 | 0 | 0 |
| Presentation-only surface | `COMPAT-14` | 1 | 1 | 0 | 0 | 0 |
| Team/Department architecture boundary | `COMPAT-15` | 1 | 0 | 1 | 0 | 0 |
| **Total** |  | **89** | **71** | **14** | **1** | **3** |

All currently migrated domain surfaces are represented: central Authorization,
Authorization Administration, Employee, Department, Routine, Stock, Leave,
Audit, Notification, Dashboard, and LIFF. The registry's Email capabilities
and the non-migrated Routine and Leave surfaces remain explicitly deferred.

## Existing strong coverage to reuse

The following tests are the strongest current regression building blocks and
should be extended rather than replaced by a giant synthetic test:

| Security boundary | Existing evidence to reuse | Why it is strong |
| --- | --- | --- |
| Central resolver semantics | `modules/authorization/application/resolver.test.ts`; `modules/authorization/application/grant-validation.test.ts`; `modules/authorization/registry.test.ts` | Intentionally asserts registry lookup, channel failure, default deny, current applicable grant union, scope normalization, ADMIN semantics, origin validation, and invalid persisted configuration. |
| Current account/session identity | `__tests__/auth/auth-principal.test.ts`; `__tests__/lib/server-auth-token-version.test.ts`; `__tests__/auth/workforce.test.ts` | Proves current persisted role, token/session lifecycle, User/Employee lifecycle, and the explicit account-only Admin seam. |
| LIFF provenance | `__tests__/auth/liff.test.ts`; `__tests__/lib/line-liff-session.test.ts` | Proves verified claims, current lifecycle/link state, token rejection, and safe cookie/session behavior. |
| Transactional workforce revalidation | `__tests__/auth/workforce-transaction.test.ts` | Proves lock/re-read ordering and detects lifecycle changes while waiting for a lock. |
| Routine target and assignment hardening | `modules/routine/application/mutations.test.ts`; `modules/routine/application/authorization.test.ts`; `__tests__/api/routines-task-by-id.test.ts`; `__tests__/api/routines-occurrence-by-id.test.ts` | Proves current assignee/creator semantics, target Employee lifecycle, actor/capability separation, expected versions, and workflow invariants. |
| Stock authorization and write boundary | `modules/stock/application/authorization.test.ts`; `modules/stock/__tests__/mutations.test.ts`; `__tests__/api/uploads-image-route.test.ts`; `__tests__/api/stock-requests-routes.test.ts` | Proves compatibility mapping, requested-scope non-broadening, transaction revalidation, and auth immediately before file write. |
| Leave workflow and exception paths | `modules/leave/application/authorization.test.ts`; `modules/leave/application/approvals/*.test.ts`; `__tests__/api/leave-decision.test.ts`; `__tests__/api/leave-cancel.test.ts`; `__tests__/api/leave-not-taken.test.ts` | Proves relationship/workflow/lifecycle rules, approver locking, fallback candidate re-read, recovery limits, and concurrency behavior. |
| Direct API and Admin boundaries | `__tests__/api/employees-routes.test.ts`; `__tests__/api/departments-route.test.ts`; `__tests__/api/audit-log-route.test.ts`; `__tests__/api/notifications.test.ts`; `__tests__/api/authorization-administration-mutations.test.ts` | Proves server-side gates, query-before-return behavior, ignored authority-shaped input, and safe denial before persistence. |
| Architecture boundary | `scripts/check-architecture.mjs`; `__tests__/architecture/check-architecture.test.ts`; Routine browser graph tests | Proves browser/server and module-boundary rules relevant to trusted actor and authorization ownership. |

## Missing DIRECT regression coverage

The only remaining `MISSING` matrix row is listed below. It is not a production
defect by itself; it is a finite regression proof that is not yet present in the
current source/test baseline. The operation ledger has a separate, more
granular set of 20 missing protected route proofs; those rows are not added to
the matrix-case total.

| Work item | Matrix row | Exact missing proof | Recommended Phase 11C.2 action |
| --- | --- | --- | --- |
| `11C2-API-01` | `API-10` | Direct operation-specific route proof is absent for the finite ledger rows `LEDGER-EMP-04`, `LEDGER-ROU-01`, `LEDGER-ROU-02`, `LEDGER-ROU-06`, `LEDGER-ROU-07`, `LEDGER-ROU-08`, `LEDGER-ROU-14`, `LEDGER-ROU-15`, `LEDGER-ROU-16`, `LEDGER-ROU-17`, `LEDGER-ROU-18`, `LEDGER-STK-01`, `LEDGER-STK-02`, `LEDGER-STK-03`, `LEDGER-STK-04`, `LEDGER-STK-05`, `LEDGER-STK-08`, `LEDGER-LEV-14`, `LEDGER-LEV-16`, and `LEDGER-LEV-17` | Add only the 20 named route/capability/channel boundary tests; do not create an unbounded “remaining routes” task. |

The CAP revocation rows are no longer in this missing-coverage table:
`CAP-05`, `CAP-06`, and `CAP-07` are directly covered by the Phase 11C.2A
integration resolver tests, while the inactive Team and TeamRole lifecycle
cases remain covered separately.

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

The following current policies and boundaries are intentionally preserved and
are not target-policy migration work in Phase 11C.1:

- Employee broad read, stats, export, and the explicit Admin mutation floor.
- Department full-read compatibility floor.
- Notification actor-owned `OWN` compatibility floor.
- Stock relationship floors and the Dashboard ADMIN employee-optional allowlist.
- The exact Routine normal-USER work-item `NO_APPLICABLE_GRANT -> ALL`
  compatibility bridge.
- Leave participant/attachment access, which remains domain-owned.
- Leave recovery and LIFF cancellation exceptions, which remain explicit
  domain/channel policy.
- UI/presentation projections and navigation as authority.
- Employee PII/broad-data policy redesign and unrelated future IT capabilities.

These items must not be relabeled `MIGRATED_AUTHORIZATION` merely because they
have session, route, domain, or presentation tests. Deferred rows are measured
against their current classification and current route/domain behavior in the
matrix; they are not counted as test gaps solely because a future target policy
has not been selected.

The following adjacent routes are also classified explicitly so they are not
silently treated as migrated capability operations:

| Surface | Classification | Current invariant and boundary |
| --- | --- | --- |
| `POST /api/audit-logs/export` | `DOMAIN_OR_LIFECYCLE_POLICY` | Requires the API session and records export-event metadata; it is not the `audit.read` data query authority. |
| `GET /api/leave/admin/recovery` | `DOMAIN_OR_LIFECYCLE_POLICY` | Requires the current workforce session, ADMIN role, and Leave recovery rules; it is not a generic `ALL` or `leave.approver.manage` bypass. |
| `PUT /api/line/leave/cancel` | `DOMAIN_OR_LIFECYCLE_POLICY` | Uses the explicit effective-LIFF-approver cancellation exception; the registry does not make `leave.cancellation.decide` a LIFF capability. |
| `GET /api/uploads/[...path]` | `ARCHITECTURE_BOUNDARY` | Public asset delivery is outside the migrated capability ledger and still enforces safe non-private path rules; it is not an authorization grant surface. |
| Leave participant/detail/attachment routes | `DOMAIN_OR_LIFECYCLE_POLICY` | Current participant, owner, approver, and safe-file rules remain domain-owned as recorded in `COMPAT-11`. |

## Phase 11C.2 — Regression implementation backlog

This is the finite security-regression backlog produced by this audit. It does
not include future policy selection, and it does not authorize production
behavior changes.

| Priority | Work item | Exact invariant and affected surface | Regression proof / status | Expected outcome |
| ---: | --- | --- | --- | --- |
| 1 | `11C2-CAP-01` | Direct User grant removal at the central resolver | **COMPLETE — Phase 11C.2A:** `__tests__/integration/authorization-resolver.integration.test.ts` removes the persisted grant and performs a fresh same-capability resolution. | The next resolution has no removed direct grant and returns default denial. |
| 2 | `11C2-CAP-02` | TeamMembership removal and TeamRoleCapabilityGrant removal at the resolver | **COMPLETE — Phase 11C.2A:** `__tests__/integration/authorization-resolver.integration.test.ts` covers both persisted removals followed by fresh same-capability resolutions. | Team-origin authorization disappears without introducing grant-row `isActive` state; inactive `Team.isActive` and `TeamRole.isActive` cases remain covered. |
| 3 | `11C2-ACTOR-01` | Current persisted system role in Routine, Stock, and Leave transaction actor construction | **COMPLETE — Phase 11C.2B:** `modules/routine/application/authorization.test.ts`, `modules/stock/application/authorization.test.ts`, and `modules/leave/application/authorization.test.ts` directly cover stale Dashboard ADMIN to persisted USER actor replacement. | The final actor uses current trusted role; client/request role remains irrelevant. |
| 4 | `11C2-TX-01` | Transaction-time current-state visibility for supported mutation adapters | **COMPLETE — Phase 11C.2B:** `modules/leave/application/authorization.test.ts` uses a query-aware mock where persisted User 7 belongs to Employee 22, so the production query for preflight Employee 21 returns no row after the adapter's own locks. | The test proves only the claimed lock/re-read/isolation boundary; it does not require coordination with an unrelated external grant commit. |
| 5 | `11C2-TX-02` | Final stale actor/authorization state in the exact Stock, Routine, and Leave transaction paths | **COMPLETE — Phase 11C.2B:** Routine, Stock, and Leave authorization tests assert the current USER actor reaches `authorization.resolveInTransaction` and that stale Dashboard ADMIN compatibility is not retained. | Each named adapter rejects or narrows stale actor state at its claimed boundary; no unsupported grant/membership race guarantee is added. |
| 6 | `11C2-API-01` | Twenty exact missing protected route rows: `LEDGER-EMP-04`, `LEDGER-ROU-01`, `LEDGER-ROU-02`, `LEDGER-ROU-06`, `LEDGER-ROU-07`, `LEDGER-ROU-08`, `LEDGER-ROU-14`, `LEDGER-ROU-15`, `LEDGER-ROU-16`, `LEDGER-ROU-17`, `LEDGER-ROU-18`, `LEDGER-STK-01`, `LEDGER-STK-02`, `LEDGER-STK-03`, `LEDGER-STK-04`, `LEDGER-STK-05`, `LEDGER-STK-08`, `LEDGER-LEV-14`, `LEDGER-LEV-16`, and `LEDGER-LEV-17` | **OPEN:** No adequate operation-specific direct route assertion exists for those capability/channel pairs. | Add 20 finite behavior-oriented route tests covering authentication, trusted actor, capability/resource boundary, and applicable lifecycle/workflow behavior. The three Stock LIFF projection rows are not part of this work item. |

## Strengthening / optional coverage

These items are useful hardening but are not counted as the remaining genuine
missing-regression work item:

- `11C2-CHANNEL-01`: pair Dashboard and LIFF assertions for each capability
  intentionally available in both channels (`CHANNEL-07` remains aggregate
  `INDIRECT` evidence, not an operation-ledger classification).
- `11C2-CAP-03`: add an additive-only schema/contract assertion if the
  persistence model changes (`CAP-12` is currently `INDIRECT`).
- Add an explicit current-classification assertion that Leave report/export
  remains outside the migrated/administratively grantable capability set
  (`COMPAT-10` remains deferred-surface `INDIRECT` evidence); this is not a
  future policy decision.
- Add a negative test for an unlisted account-only ADMIN capability if the
  allowlist expands; the current allowlist and its domain tests remain policy
  evidence, not a Team activation.

## Future Policy / Migration Decisions — Explicitly Outside Phase 11C

The following four decision families are not Phase 11C.2 regression work and
must not increase the matrix `MISSING` count:

1. Select the future central authorization policy for Routine summary,
   reference, and export.
2. Select the future authorization policy for Leave report/export.
3. Select the future authorization policy for Email Request read/create.
4. Approve any future Team policy and domain resource semantics, including
   explicit Team origins; do not infer Team from Department or Employee
   metadata, add nested Teams, or add TeamRole inheritance.

Until those decisions are separately approved, the current deferred or
domain-owned behavior remains the invariant: registered deferred capabilities
retain their non-grantable administration metadata (`COMPAT-07` and
`COMPAT-13`), while Leave report/export remains outside the migrated set
(`COMPAT-10`).

## Accepted limitations and non-atomic boundaries

- Phase 11C.1 did not query or inventory the production authorization database;
  empty code-owned seed configuration is not evidence of empty persisted state.
- A fresh request resolves the current persisted grant sources. The resolver's
  transaction context does not promise that a grant, membership, or role row
  committed by an unrelated concurrent transaction after the resolver read is
  atomically coordinated with the current transaction.
- Supported transaction adapters lock/re-read the rows named by their
  contracts. The resolver does not generally lock grant or membership rows.
- Employee create/import, read-only paths, Routine import's partial-success
  semantics, and external filesystem writes do not claim a transaction-wide
  authorization guarantee.
- Stock image authorization has a preflight and immediate pre-write check, but
  the database decision and external filesystem write are not one atomic
  transaction; the residual filesystem TOCTOU is accepted and documented.

No Phase 11C.2 item should activate Team policy, introduce explicit DENY,
wildcards, ABAC, nested Teams, role inheritance, or a persistence redesign.

## Verification record

This section records the exact commands and observed results for Phase 11C.2A.
The focused resolver and persistence tests were run against both the real
MySQL integration database and the default unit-test configuration. No timeout
or test configuration was changed.

The focused integration command used this process-only environment setup:

```powershell
$integrationValues = Get-Content -Raw -Encoding UTF8 integration.env | ConvertFrom-StringData
$env:DATABASE_URL = $integrationValues.TEST_DATABASE_URL
$env:TEST_DATABASE_URL = $integrationValues.TEST_DATABASE_URL
$env:NODE_ENV = "test"
node node_modules/vitest/vitest.mjs run --config vitest.integration.config.ts __tests__/integration/authorization-resolver.integration.test.ts
```

| Command | Observed result |
| --- | --- |
| `node node_modules/vitest/vitest.mjs run --config vitest.integration.config.ts __tests__/integration/authorization-resolver.integration.test.ts` with `DATABASE_URL` mapped from `integration.env:TEST_DATABASE_URL` | PASS, exit 0. 1 integration file and 10 tests passed. |
| `npm.cmd run test:run -- modules/authorization/application/resolver.test.ts modules/authorization/infrastructure/persistence/authorization-resolution-repository.test.ts` | PASS, exit 0. 2 files and 32 tests passed. |
| `npm.cmd run architecture:check` | PASS, exit 0. `Architecture check passed: checked 1119 repository source file(s) for module boundaries.` |
| `npm.cmd run lint:strict` | PASS, exit 0. ESLint completed with `--max-warnings=0`. |
| `npm.cmd run typecheck` | PASS, exit 0. `tsc --noEmit` completed successfully. |
| `npm.cmd run test:run` | FAIL, exit 1. 313 test files passed and 1 failed; 2,758 tests passed and 1 failed. `__tests__/architecture/check-architecture.test.ts` test `allows the current Routine browser graph` timed out at 30,000 ms. |
| `npm.cmd run test:integration:mysql` | FAIL, exit 1. Prisma migrations succeeded; 15 integration files passed and 1 failed, with 103 tests passed and 1 failed. The unrelated failure was `__tests__/integration/leave-quota-concurrency.integration.test.ts` / `creates one quota for concurrent non-overlapping requests with different keys`, which raised `WorkforceAuthorizationError` in `modules/leave/application/authorization.ts:parseUserRole`. |
| `git diff --check` | PASS, exit 0. No whitespace errors reported; Git emitted only its LF-to-CRLF working-copy warning. |

### Phase 11C.2B verification record

The Phase 11C.2B slice was verified against the targeted authorization seams
before the required repository-wide checks. No timeout configuration was
changed, and the full unit-suite architecture timeout was rerun in isolation.

| Command | Observed result |
| --- | --- |
| `npm.cmd run test:run -- modules/routine/application/authorization.test.ts modules/stock/application/authorization.test.ts modules/leave/application/authorization.test.ts __tests__/auth/workforce-transaction.test.ts` | PASS, exit 0. 4 test files and 62 tests passed. |
| `npm.cmd run architecture:check` | PASS, exit 0. `Architecture check passed: checked 1119 repository source file(s) for module boundaries.` |
| `npm.cmd run lint:strict` | PASS, exit 0. ESLint completed with `--max-warnings=0`. |
| `npm.cmd run typecheck` | PASS, exit 0. `tsc --noEmit` completed successfully. |
| `npm.cmd run test:run` | FAIL, exit 1. 313 test files passed and 1 failed; 2,745 tests passed and 20 failed. The known intermittent architecture timeout affected 20 tests in `__tests__/architecture/check-architecture.test.ts`: 19 tests timed out at 5,000 ms, including `reads changed runtime imports again on a later scan of the same root`; `allows the current Routine browser graph` timed out at 30,000 ms. |
| `npm.cmd run test:run -- __tests__/architecture/check-architecture.test.ts -t "reads changed runtime imports again on a later scan of the same root"` | PASS, exit 0. The focused test passed; 250 sibling tests were skipped. |
| `npm.cmd run test:integration:mysql` | FAIL, exit 1. MySQL migrations succeeded with 67 migrations and no pending work; 15 integration files passed and 1 failed, with 103 tests passed and 1 failed. The known baseline failure was `__tests__/integration/leave-quota-concurrency.integration.test.ts` / `creates one quota for concurrent non-overlapping requests with different keys`, raising `WorkforceAuthorizationError` at `modules/leave/application/authorization.ts:parseUserRole` from the malformed route mock shape. |
| `git diff --check` | PASS, exit 0. No whitespace errors reported. |

## Production policy change statement

Production authorization policy was **not changed** in Phase 11C.2A or Phase
11C.2B. The Phase 11C.2B slice adds only regression tests and matrix updates.
No production source, schema, seed grant, compatibility policy, deferred
surface, or test configuration was changed.
