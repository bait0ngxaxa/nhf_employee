# NHF Employee — Phase 12H-C Domain Default Policy Rebaseline

Status: **COMPLETE**

Baseline: `9d2b41c03b29a6f9fb6175f6ce7027d0e520b3d1` — `docs(auth): align compatibility seam lifecycle with rollout roadmap`

Previous implementation boundary: Phase 12H-B, `0aaef3ffc2bc292e69496e5f8f513892e6c98582` — `feat(auth): implement Phase 12H-B role-neutral authorization core`

## Outcome

Phase 12H-C rebaselines the domain-provided Default Domain Policy. Given the same trusted workforce/domain relationship, capability, channel, and resource context, changing only `systemRole` from `USER` to `ADMIN` no longer changes the default scopes for the covered domains.

The production `authorization` singleton was not switched to `createRoleNeutralAuthorizationResolver()`. Domain adapters continue to use `composeLegacyAdminCompatibleAuthorizationAuthority()`. Therefore the target default policy is role-neutral while current Dashboard ADMIN effective business authority can still include the temporary central `SYSTEM_ROLE / ADMIN` compatibility result.

## Implemented default policy

| Domain | Capability | Default scopes |
| --- | --- | --- |
| Employee | `employee.read`, `employee.stats.read`, `employee.export` | `ALL` |
| Employee | `employee.create`, `employee.update`, `employee.delete`, `employee.import` | none |
| Department | `department.read` | `ALL` |
| Routine | `routine.task.read` | `CREATED + ASSIGNED`; `work-item` `mine` is `ASSIGNED` |
| Routine | `routine.task.create` | `OWN` |
| Routine | `routine.task.update` | `CREATED + ASSIGNED` |
| Routine | `routine.task.delete` | `CREATED` |
| Routine | `routine.occurrence.read` | `ASSIGNED` |
| Routine | `routine.occurrence.override`, `routine.occurrence.reassign`, `routine.occurrence.change_due_date`, `routine.import.manage` | none |
| Routine | `routine.task.export` | none; configured `ALL` remains supported |
| Routine | `routine.summary.read` | `ASSIGNED`; configured `ALL` may broaden Dashboard queries |
| Routine | `routine.reference.read` | `OWN`; configured `ALL` may broaden Dashboard reference data |
| Stock | `stock.catalog.read` | `ALL` |
| Stock | `stock.request.read`, `stock.request.create`, `stock.request.cancel` | `OWN` |
| Stock | `stock.inventory.manage`, `stock.request.process`, `stock.report.export` | none |
| Leave | `leave.request.read`, `leave.request.create`, `leave.request.cancel` | `OWN` |
| Leave | `leave.approval.read`, `leave.request.approve` | `ASSIGNED` |
| Leave | `leave.cancellation.decide` | `ASSIGNED` on Dashboard; none on unsupported channels |
| Leave | `leave.request.not_taken` | `OWN + ASSIGNED` |
| Leave | `leave.approver.manage` | none |
| Audit | `audit.read` | none; configured `ALL` is required |
| Notification | `notification.inbox.read`, `notification.inbox.update` | `OWN` |

Employee, Department, and Notification implementations were already close to the target and received role-neutral regression coverage. Stock and Leave removed their `systemRole`-based default short-circuits while retaining channel, lifecycle, recovery, workflow, and presentation seams. Audit remains central-only with no implicit default.

## Routine narrowing decisions

Routine is the material behavior change in this phase:

1. `routine.task.read` no longer returns automatic `ALL` for `requestedScope = "all"`. The requested view is not authorization authority. Without effective configured `ALL`, `buildRoutineTaskReadWhere()` translates the effective `CREATED` / `ASSIGNED` scopes into relationship predicates at the query boundary.
2. `routine.summary.read` always defaults to `ASSIGNED`. The application query path no longer derives an omitted summary scope from Dashboard ADMIN role; omitted scope is `mine`. An explicit `all` request remains `mine` at the query boundary unless effective configured `ALL` exists.
3. `routine.task.export` no longer has a default. A normal actor without configured `routine.task.export / ALL` is denied. Configured `ALL` continues through the existing export path and preserves active-task rules, row limits, batching, format and field behavior, data minimization, and audit behavior.
4. `routine.reference.read` keeps default `OWN`. Configured `ALL` can broaden the Dashboard reference surface, while the LIFF response remains minimized and self-service.
5. LIFF self-service policy is channel-based rather than ADMIN-role-based. Equivalent USER and ADMIN LIFF actors receive the same self-service restriction, and configured `ALL` cannot bypass creator/active-task-assignee/active-occurrence-assignee access or turn LIFF into a Dashboard administrative surface.

Existing task/occurrence ownership, assignee, active-account, focus/deep-link, mutation, transaction, concurrency, notification, audit, and response-minimization rules remain domain-owned and unchanged except for the authority narrowing above.

## Compatibility and boundaries

Intentionally retained:

- the production `authorization` singleton and legacy ADMIN compatibility wrapper;
- `SYSTEM_ROLE` grant/source support;
- current Dashboard ADMIN effective business compatibility;
- Dashboard ADMIN employee-optional Stock lifecycle behavior;
- `canUseLeaveAdminRecoveryOverride()`, account-only ADMIN recovery/approver lifecycle handling, and recovery route gates;
- existing presentation `isAdministrative` behavior where it is compatibility metadata.

Not implemented in 12H-C:

- `leave.recovery.manage` or any new capability;
- Email Request completion or other deferred capabilities;
- Team/TeamRole/User grant data, seeds, backfills, schema, or migrations;
- broad presentation/route ADMIN-gate migration;
- switching production enforcement to the role-neutral resolver (Phase 12H-G);
- redesign of domain workflow, resource, lifecycle, quota, or approval policy.

Historical phase documents retain the behavior recorded at their phase
boundaries. This closure supersedes their selected Routine broad-default claims
for the current target; it does not rewrite that historical evidence.

## Regression evidence

The focused authorization suite covers role-neutral defaults for Employee,
Department, Routine, Stock, Leave, Audit, and Notification. Routine coverage
also proves:

- requested task `scope=all` does not manufacture `ALL` and remains query-constrained;
- configured Routine `ALL` broadens Dashboard task and summary queries where supported;
- summary omitted/default and explicit `all` behavior;
- normal-user export denial without configured `ALL` and success with configured `ALL`;
- legacy Dashboard ADMIN export compatibility remains active;
- LIFF configured broad authority remains self-service constrained;
- `UNKNOWN_CAPABILITY`, `CHANNEL_NOT_SUPPORTED`, and resolver/configuration failures remain fail-closed;
- the production resolver/composition path was not cut over.

Executed verification:

- Focused authorization/domain, Routine query, resolver/composition, and summary API tests: **11 files, 290 tests passed**.
- Affected Routine presentation/effective-access/route-seam regression tests: **6 files, 120 tests passed**.
- Broader repository suite: **325 files, 3,055 tests passed**.
- `npm.cmd run typecheck`: **passed**.
- `npm.cmd run lint:strict`: **passed**.
- `npm.cmd run architecture:check`: **passed**.

The broader suite emits existing diagnostic stderr from tests that intentionally exercise failures, provider mocks, outbox retries, React `act` warnings, and invalid-configuration boundaries; it completed with all tests passing.

## Next phase

**Phase 12H-D — Missing/deferred capability completion.**
