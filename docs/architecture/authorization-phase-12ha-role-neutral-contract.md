# NHF Employee — Phase 12H-A: Role-Neutral Business Authorization Contract & Inventory

Status: **OPEN — correction required before Phase 12H-B; not closed**

Reviewed baseline: `5a72b9e57216701f2c620b54e035c9dc1740f53d`
(`fix(auth): use migration lifecycle for readiness checks`)

This document is the authoritative Phase 12H-A target contract and migration
ledger. It records the future authorization architecture and the exhaustive
current-code inventory needed by later Phase 12H work. The inventory is under
correction review; closure remains pending acceptance of the pre-12H-B
corrections recorded below. It does not claim that the target runtime has been
deployed.

## 1. Locked target contract

The target authorization pipeline is:

```text
Authenticated Actor
        |
        v
Trusted identity / lifecycle / channel
        |
        v
Role-neutral Default Domain Policy
        +
Configured Capability Grants
(Team + TeamRole + exceptional direct User)
        |
        v
Effective Business Authority
        |
        v
Domain Resource / Relationship Policy
        |
        v
Workflow / Validation / Transaction Invariants
        |
        v
ALLOW / DENY
```

The final invariant is:

```text
Given the same trusted workforce/domain context, execution channel,
and resource relationships, USER and ADMIN receive the same
Default Domain Policy.

Additional business authority can only come from Team, TeamRole,
or exceptional direct User grants.

The ADMIN system role grants no implicit business capability authority.
```

Role-neutral does not mean unconditional access. Account lifecycle, active
Employee/workforce context, channel, resource relationships, workflow state,
validation, transaction, and concurrency checks remain authoritative. An
ADMIN without the required Employee/workforce context cannot satisfy a
business-domain prerequisite merely by being ADMIN.

### 1.1 Supersession boundary

Phase 12A was a valid historical contract at its phase boundary. Phase 12H-A
supersedes two parts of its long-term target:

1. The assumption that `ADMIN` is the highest coarse business authority and
   does not need configured grants.
2. The assumption that every existing normal-USER behavior is permanently
   preserved as the default. Phase 12H-A explicitly narrows selected legacy
   Routine defaults: broad `routine.task.read` `ALL`,
   `routine.summary.read` `ALL`, and `routine.task.export` `ALL` are no longer
   automatic defaults. Their role-neutral target defaults are recorded in
   Section 3 and the capability inventory.

Both changes are **superseded by this Phase 12H-A target**. Other approved
normal-USER defaults remain the starting role-neutral baseline unless this
contract explicitly narrows them.

The Phase 12A document is retained as historical evidence. Its statements
about the runtime at that boundary must not be rewritten as though they never
existed. Current runtime semantics remain pre-12H and are recorded separately
below.

### 1.2 Invariants

| Invariant | Phase 12H target |
| --- | --- |
| Business default authority | Role-neutral |
| Business privilege expansion | Capability grants |
| Team | Primary administrative grouping for shared authority |
| TeamRole | Capability source within a Team |
| Direct User Grant | Exceptional source only |
| Department | Separate from Team; never inferred as an authorization grouping |
| Explicit DENY | Not supported |
| Grant precedence | None; authority is additive |
| Default narrowing by grant | Forbidden |
| Resource/workflow rules | Remain domain-owned |
| System role | Identity/control-plane concern, not generic business permission |
| ADMIN business bypass | Forbidden |
| Capability registry | Code-owned vocabulary |
| Server-side enforcement | Mandatory |
| UI visibility | Projection only; never authority |
| Audit | Preserve actor/source/target/capability/scope provenance |

The target does not introduce DENY grants, negative permissions, role
hierarchy, permission precedence, an ABAC policy DSL, wildcard permissions, or
`adminAuthority = SYSTEM | CONFIGURED`. Business capability semantics must not
need to know whether ADMIN receives a capability.

## 2. Current runtime boundary

Phase 12H-A does not change runtime authorization. In particular, it does not
modify:

- `modules/authorization/application/evaluator.ts`;
- `modules/authorization/application/composition.ts`;
- domain default policy implementations;
- routes, queries, mutations, or presentation behavior;
- the Prisma schema, migrations, authorization persistence, grant data, or
  seed behavior.

The current runtime still contains the pre-12H behavior:

```text
ADMIN
  -> central SYSTEM_ROLE / ADMIN authority for many registered capabilities
  -> domain/channel/lifecycle/resource/workflow checks still apply

USER
  -> resolver grants plus the current domain adapter's default policy
```

The target runtime will become:

```text
USER and ADMIN
  -> the same role-neutral Default Domain Policy for equivalent trusted context
  -> the same Team/TeamRole/direct-User grant resolution
```

The transition from the first form to the second is deferred to later Phase
12H implementation phases.

## 3. Role-neutral default baseline decisions

The target starts from the current normal-USER behavior unless an explicit
product narrowing is recorded here.

### 3.1 Employee

`employee.read`, `employee.stats.read`, and `employee.export` retain the
current broad normal-user baseline as role-neutral default policy. The
privileged mutations `employee.create`, `employee.update`,
`employee.delete`, and `employee.import` are configured business capabilities
and are not automatic ADMIN authority in the target.

Employee query shape, lifecycle eligibility, filtering, pagination, import
validation/partial-success behavior, export fields/limits, audit behavior,
and transaction revalidation remain Employee-owned.

### 3.2 Department

`department.read` may remain role-neutral default reference-data authority
where the current evidence supports it. Department remains separate from
Team and never implies Team membership, TeamRole membership, or a grant.

### 3.3 Routine

The target preserves self/creator/assignee behavior but removes broad
organization-wide authority from the default policy:

| Capability | Target default |
| --- | --- |
| `routine.task.read` | `CREATED + ASSIGNED` for the default management/self relationship; `ALL` is not automatic |
| `routine.summary.read` | `ASSIGNED`; `ALL` requires configured authority |
| `routine.task.export` | None; `ALL` requires configured authority |

The remaining Routine defaults are recorded in the exhaustive inventory. Any
`requestedScope=all`, `summaryView=all`, broad export, management, occurrence
administration, import, override, reassign, or due-date administration path
is a separate ledger item. Creator, assignee, occurrence assignment, active
Employee, route/channel, data-minimization, workflow, and transaction rules
remain Routine-owned.

### 3.4 Stock

Normal catalog/requester behavior remains role-neutral default policy.
`stock.inventory.manage`, `stock.request.process`, and
`stock.report.export` are configured business authority regardless of system
role. Current ADMIN broad request read/cancel/process behavior is explicitly
classified in the inventory and role ledger; it is not preserved as an
implicit target privilege.

Requester ownership, processor/resource/status checks, inventory locks,
quantity validation, idempotency, notification, and transaction invariants
remain Stock-owned.

### 3.5 Leave

Normal owner/effective-approver behavior remains role-neutral default policy:

```text
OWN
ASSIGNED
effective approver relationships
workflow/state rules
```

`leave.approver.manage / ALL` is configured business authority. Current ADMIN
recovery and override paths are not a hidden system-role exception in the
target. The valid future candidate key is:

```text
leave.recovery.manage
```

It is intentionally not registered in Phase 12H-A. Its future authority is
entry into Leave recovery operations only; Leave must continue to enforce
unavailable-approver conditions, a required recovery reason, request state,
date constraints, relationship rules, transaction revalidation, audit, and
all other existing recovery invariants. `leave.request.not_taken` is not a
generic recovery capability.

### 3.6 Audit

`audit.read / ALL` is application visibility, not inherent system-role
authority. It is configured business authority. Authorization Administration
audit/provenance requirements remain separate from permission to read the
application AuditLog data.

### 3.7 Email Request

The registered Email Request capabilities remain deferred in this phase, but
their target classification is explicit:

```text
email.request.create / ALL
  -> configured authority

email.request.read / OWN
  -> configured requester authority when required

email.request.read / ALL
  -> configured operational authority
```

The target is not `requiredRole: ADMIN`. No Email Request runtime migration is
performed here.

### 3.8 Notification

Current actor-owned inbox behavior remains role-neutral default policy. Read
and update stay independent, actor-derived, and `OWN`-constrained.

### 3.9 Future IT module

IT is not implemented or registered in this phase. It is intended to be the
first clean capability-first domain:

```text
role-neutral default:
  it.ticket.create
  it.ticket.read / OWN
  it.ticket.comment / OWN

configured Team IT authority:
  it.ticket.read / ALL
  it.ticket.manage / ALL
  it.ticket.assign / ALL
  it.ticket.summary.read / ALL
  it.ticket.analytics.read / ALL
```

These keys are future design input only, not registry entries.

## 4. Exhaustive registered capability inventory

The counts below were recomputed from the current source files rather than
copied from a historical document:

- `modules/authorization/registry.ts` contains 40 definitions;
- `modules/authorization/application/administration-catalog.ts` contains the
  exhaustive runtime-mode metadata map; and
- `modules/authorization/registry.test.ts` verifies registry shape and
  uniqueness.

| Current runtime mode | Count |
| --- | ---: |
| `CENTRAL_WITH_DEFAULT_POLICY` | 25 |
| `CENTRAL_WITH_COMPATIBILITY` | 0 |
| `CENTRAL_ONLY` | 13 |
| `DEFERRED` | 2 |
| **Total registered** | **40** |

The exact current mode sets are:

| Mode | Capabilities |
| --- | --- |
| `CENTRAL_WITH_DEFAULT_POLICY` | `employee.read`, `employee.stats.read`, `employee.export`, `department.read`, `routine.task.read`, `routine.task.create`, `routine.task.update`, `routine.task.delete`, `routine.occurrence.read`, `routine.task.export`, `routine.summary.read`, `routine.reference.read`, `stock.catalog.read`, `stock.request.read`, `stock.request.create`, `stock.request.cancel`, `leave.request.read`, `leave.approval.read`, `leave.request.create`, `leave.request.cancel`, `leave.request.approve`, `leave.cancellation.decide`, `leave.request.not_taken`, `notification.inbox.read`, `notification.inbox.update` |
| `CENTRAL_ONLY` | `employee.create`, `employee.update`, `employee.delete`, `employee.import`, `routine.occurrence.override`, `routine.occurrence.reassign`, `routine.occurrence.change_due_date`, `routine.import.manage`, `stock.inventory.manage`, `stock.request.process`, `stock.report.export`, `leave.approver.manage`, `audit.read` |
| `DEFERRED` | `email.request.read`, `email.request.create` |

Every registered capability has exactly one target disposition in the table
below. `Configured scopes` means scopes that require a Team, TeamRole, or
exceptional direct User grant in addition to the role-neutral default. A
scope of `none beyond default` does not prohibit redundant provenance or
configuration; it means that the default already covers the registry's
supported authority.

| Capability | Domain | Supported scopes | Supported channels | Current runtime mode | Current normal USER default | Current ADMIN behavior/source | Target role-neutral default | Target configured authority | Domain limitations | Migration required | Future Phase | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `employee.read` | Employee | `ALL` | `DASHBOARD` | `CENTRAL_WITH_DEFAULT_POLICY` | `ALL` | `SYSTEM_ROLE / ADMIN`, `ALL` | `ALL` | none beyond default | Active account/workforce boundary; Employee query filters, pagination, deleted/bootstrap exclusions, and response shape | Yes | 12H-C | `modules/authorization/registry.ts`; `modules/employee/application/authorization.ts`; `modules/employee/application/authorization.test.ts`; `__tests__/api/employees-routes.test.ts` |
| `employee.stats.read` | Employee | `ALL` | `DASHBOARD` | `CENTRAL_WITH_DEFAULT_POLICY` | `ALL` | `SYSTEM_ROLE / ADMIN`, `ALL` | `ALL` | none beyond default | Existing aggregate/query buckets and lifecycle boundary remain Employee-owned | Yes | 12H-C | `modules/authorization/registry.ts`; `modules/employee/application/authorization.ts`; `modules/employee/application/authorization.test.ts`; `__tests__/api/employees-routes.test.ts` |
| `employee.create` | Employee | `ALL` | `DASHBOARD` | `CENTRAL_ONLY` | None | `SYSTEM_ROLE / ADMIN`, `ALL`, then Employee validation/lifecycle | None | `ALL` | Active workforce, input validation, duplicate/identity rules, transaction and audit invariants | Yes | 12H-B → 12H-G | `modules/authorization/registry.ts`; `modules/employee/application/authorization.ts`; `modules/employee/application/authorization.test.ts`; `modules/employee/application/mutations.test.ts` |
| `employee.update` | Employee | `ALL` | `DASHBOARD` | `CENTRAL_ONLY` | None | `SYSTEM_ROLE / ADMIN`, `ALL`, then Employee lifecycle/transaction checks | None | `ALL` | Target lifecycle, row locks, serializable revalidation, field/business validation, and audit | Yes | 12H-B → 12H-G | `modules/authorization/registry.ts`; `modules/employee/application/authorization.ts`; `modules/employee/application/mutations.test.ts` |
| `employee.delete` | Employee | `ALL` | `DASHBOARD` | `CENTRAL_ONLY` | None | `SYSTEM_ROLE / ADMIN`, `ALL`, then offboarding/lifecycle rules | None | `ALL` | Offboarding dependencies, last-account/lifecycle safeguards, transaction and audit rules | Yes | 12H-B → 12H-G | `modules/authorization/registry.ts`; `modules/employee/application/authorization.ts`; `modules/employee/application/mutations.test.ts` |
| `employee.import` | Employee | `ALL` | `DASHBOARD` | `CENTRAL_ONLY` | None | `SYSTEM_ROLE / ADMIN`, `ALL`, then import validation and partial-success rules | None | `ALL` | File/body validation, import mapping, partial success, lifecycle and audit behavior | Yes | 12H-B → 12H-G | `modules/authorization/registry.ts`; `modules/employee/application/authorization.ts`; `modules/employee/application/import-employees.test.ts`; `__tests__/api/employees-routes.test.ts` |
| `employee.export` | Employee | `ALL` | `DASHBOARD` | `CENTRAL_WITH_DEFAULT_POLICY` | `ALL` | `SYSTEM_ROLE / ADMIN`, `ALL` | `ALL` | none beyond default | Existing broad export query, fields, limits, filters, lifecycle and audit behavior | Yes | 12H-C | `modules/authorization/registry.ts`; `modules/employee/application/authorization.ts`; `modules/employee/infrastructure/export/employee-export.test.ts`; `__tests__/api/employees-routes.test.ts` |
| `department.read` | Department | `ALL` | `DASHBOARD` | `CENTRAL_WITH_DEFAULT_POLICY` | `ALL` | `SYSTEM_ROLE / ADMIN`, `ALL` | `ALL` | none beyond default | Reference-data query/order/shape; Department never implies Team authority | Yes | 12H-C | `modules/authorization/registry.ts`; `modules/department/application/authorization.ts`; `modules/department/application/authorization.test.ts`; `__tests__/api/departments-route.test.ts` |
| `routine.task.read` | Routine | `CREATED`, `ASSIGNED`, `ALL` | `DASHBOARD`, `LIFF_SELF_SERVICE` | `CENTRAL_WITH_DEFAULT_POLICY` | Management `CREATED + ASSIGNED`; work-item mine `ASSIGNED`; work-item all currently `ALL` | Dashboard `SYSTEM_ROLE / ADMIN`, supported broad scopes; LIFF ADMIN is channel-clamped | `CREATED + ASSIGNED` for default self/relationship access; not automatic `ALL` | `ALL` for broad organization-wide access | Creator/assignee/occurrence relationships, active task/lifecycle, focus/deep-link, channel and LIFF data minimization | Yes | 12H-C | `modules/authorization/registry.ts`; `modules/routine/application/authorization.ts`; `modules/routine/application/queries.ts`; `modules/routine/application/authorization.test.ts`; `__tests__/api/routines-tasks.test.ts`; `__tests__/api/routines-occurrence-by-id.test.ts` |
| `routine.task.create` | Routine | `OWN`, `ALL` | `DASHBOARD`, `LIFF_SELF_SERVICE` | `CENTRAL_WITH_DEFAULT_POLICY` | `OWN` | Dashboard `SYSTEM_ROLE / ADMIN`, `ALL`; LIFF applies self-service policy | `OWN` | `ALL` | Actor-derived ownership/Employee context, assignment normalization, validation and transaction invariants | Yes | 12H-C | `modules/authorization/registry.ts`; `modules/routine/application/authorization.ts`; `modules/routine/application/mutations.ts`; `modules/routine/application/authorization.test.ts`; `__tests__/api/routines-tasks.test.ts` |
| `routine.task.update` | Routine | `CREATED`, `ASSIGNED`, `ALL` | `DASHBOARD`, `LIFF_SELF_SERVICE` | `CENTRAL_WITH_DEFAULT_POLICY` | `CREATED + ASSIGNED` | Dashboard `SYSTEM_ROLE / ADMIN`, `ALL`; LIFF applies self-service policy | `CREATED + ASSIGNED` | `ALL` | Creator/assignee edit rules, target lifecycle, editable fields, state, version and concurrency checks | Yes | 12H-C | `modules/authorization/registry.ts`; `modules/routine/application/authorization.ts`; `modules/routine/application/mutations.ts`; `modules/routine/application/authorization.test.ts`; `__tests__/api/routines-task-by-id.test.ts` |
| `routine.task.delete` | Routine | `CREATED`, `ALL` | `DASHBOARD`, `LIFF_SELF_SERVICE` | `CENTRAL_WITH_DEFAULT_POLICY` | `CREATED` | Dashboard `SYSTEM_ROLE / ADMIN`, `ALL`; LIFF applies self-service policy | `CREATED` | `ALL` | Creator/resource relationship, deletion state, lifecycle and transaction rules | Yes | 12H-C | `modules/authorization/registry.ts`; `modules/routine/application/authorization.ts`; `modules/routine/application/mutations.ts`; `modules/routine/application/authorization.test.ts`; `__tests__/api/routines-task-by-id.test.ts` |
| `routine.occurrence.read` | Routine | `ASSIGNED`, `ALL` | `DASHBOARD` | `CENTRAL_WITH_DEFAULT_POLICY` | `ASSIGNED` | `SYSTEM_ROLE / ADMIN`, `ALL` | `ASSIGNED` | `ALL` | Occurrence-level assignment, active task, route/focus and workflow checks | Yes | 12H-C | `modules/authorization/registry.ts`; `modules/routine/application/authorization.ts`; `modules/routine/application/queries.ts`; `modules/routine/application/authorization.test.ts`; `__tests__/api/routines-occurrences.test.ts` |
| `routine.occurrence.override` | Routine | `ALL` | `DASHBOARD` | `CENTRAL_ONLY` | None | `SYSTEM_ROLE / ADMIN`, `ALL`, then occurrence/state checks | None | `ALL` | Occurrence state, assignment, validation, locks and transaction rules | Yes | 12H-B → 12H-G | `modules/authorization/registry.ts`; `modules/routine/application/authorization.ts`; `modules/routine/application/mutations.ts`; `modules/routine/application/authorization.test.ts`; `__tests__/api/routines-occurrences.test.ts` |
| `routine.occurrence.reassign` | Routine | `ALL` | `DASHBOARD` | `CENTRAL_ONLY` | None | `SYSTEM_ROLE / ADMIN`, `ALL`, then assignee lifecycle/transaction rules | None | `ALL` | Assignee lifecycle, owner/role normalization, state and concurrency invariants | Yes | 12H-B → 12H-G | `modules/authorization/registry.ts`; `modules/routine/application/authorization.ts`; `modules/routine/application/mutations.ts`; `modules/routine/application/authorization.test.ts`; `__tests__/api/routines-occurrences.test.ts` |
| `routine.occurrence.change_due_date` | Routine | `ALL` | `DASHBOARD` | `CENTRAL_ONLY` | None | `SYSTEM_ROLE / ADMIN`, `ALL`, then date/state/concurrency rules | None | `ALL` | Due-date validation, occurrence state, locks, generation and audit | Yes | 12H-B → 12H-G | `modules/authorization/registry.ts`; `modules/routine/application/authorization.ts`; `modules/routine/application/mutations.ts`; `modules/routine/application/authorization.test.ts`; `__tests__/api/routines-occurrences.test.ts` |
| `routine.import.manage` | Routine | `ALL` | `DASHBOARD` | `CENTRAL_ONLY` | None | `SYSTEM_ROLE / ADMIN`, `ALL`, then import validation and domain invariants | None | `ALL` | Upload/body validation, staging/apply/cancel lifecycle, assignment and transaction rules | Yes | 12H-B → 12H-G | `modules/authorization/registry.ts`; `modules/routine/application/authorization.ts`; `modules/routine/application/imports/apply.ts`; `modules/routine/application/authorization.test.ts`; `__tests__/api/routine-import-preview.test.ts`; `__tests__/integration/routine-import-apply.integration.test.ts` |
| `routine.task.export` | Routine | `ALL` | `DASHBOARD` | `CENTRAL_WITH_DEFAULT_POLICY` | Current code: eligible Dashboard USER `ALL` | `SYSTEM_ROLE / ADMIN`, `ALL`; exporter remains role-sensitive/currently deferred in surrounding paths | None | `ALL` | Export query/resource/lifecycle checks, audit and data-minimization limits | Yes | 12H-C → 12H-D | `modules/authorization/registry.ts`; `modules/routine/application/authorization.ts`; `modules/routine/infrastructure/reports/routine-export.ts`; `modules/routine/application/authorization.test.ts`; `__tests__/api/routine-export.test.ts` |
| `routine.summary.read` | Routine | `ASSIGNED`, `ALL` | `DASHBOARD`, `LIFF_SELF_SERVICE` | `CENTRAL_WITH_DEFAULT_POLICY` | Current code: `ASSIGNED` for mine and `ALL` for Dashboard all | Dashboard `SYSTEM_ROLE / ADMIN`, `ALL`; LIFF is self-service/mine | `ASSIGNED`; `ALL` requires configured authority | `ALL` | Summary view, task/occurrence relationship, channel and query scope remain Routine-owned | Yes | 12H-C → 12H-D | `modules/authorization/registry.ts`; `modules/routine/application/authorization.ts`; `modules/routine/application/queries.ts`; `modules/routine/application/authorization.test.ts`; `__tests__/api/routine-summary.test.ts` |
| `routine.reference.read` | Routine | `OWN`, `ALL` | `DASHBOARD`, `LIFF_SELF_SERVICE` | `CENTRAL_WITH_DEFAULT_POLICY` | `OWN` | Dashboard `SYSTEM_ROLE / ADMIN`, supported broad scope; LIFF self-service projection/data minimization | `OWN` | `ALL` | Reference query, channel, response shape and no-employee-list LIFF contract | Yes | 12H-C → 12H-D | `modules/authorization/registry.ts`; `modules/routine/application/authorization.ts`; `modules/routine/application/queries.ts`; `modules/routine/application/authorization.test.ts`; `__tests__/api/routines-reference.test.ts` |
| `stock.catalog.read` | Stock | `ALL` | `DASHBOARD`, `LIFF_SELF_SERVICE` | `CENTRAL_WITH_DEFAULT_POLICY` | `ALL` | `SYSTEM_ROLE / ADMIN`, `ALL` | `ALL` | none beyond default | Active catalog/item/category and availability queries; catalog does not imply processing | Yes | 12H-C | `modules/authorization/registry.ts`; `modules/stock/application/authorization.ts`; `modules/stock/application/authorization.test.ts`; `__tests__/api/stock-items-route.test.ts` |
| `stock.inventory.manage` | Stock | `ALL` | `DASHBOARD` | `CENTRAL_ONLY` | None | `SYSTEM_ROLE / ADMIN`, `ALL`; current Dashboard ADMIN employee-optional lifecycle branch | None | `ALL` | Inventory locks, quantity/variant invariants, lifecycle and transaction checks | Yes | 12H-B → 12H-G | `modules/authorization/registry.ts`; `modules/stock/application/authorization.ts`; `modules/stock/application/authorization.test.ts`; `modules/stock/__tests__/mutations.test.ts` |
| `stock.request.read` | Stock | `OWN`, `ALL` | `DASHBOARD`, `LIFF_SELF_SERVICE` | `CENTRAL_WITH_DEFAULT_POLICY` | `OWN`; `ALL` only through current effective authority/request path | `SYSTEM_ROLE / ADMIN`, `OWN + ALL` as supported; LIFF/requester relationship still applies | `OWN` | `ALL` | Server-derived requester identity, requested view, detail not-found boundary and resource predicates | Yes | 12H-C | `modules/authorization/registry.ts`; `modules/stock/application/authorization.ts`; `modules/stock/application/queries/queries.ts`; `modules/stock/application/authorization.test.ts`; `__tests__/api/stock-requests-routes.test.ts` |
| `stock.request.create` | Stock | `OWN` | `DASHBOARD`, `LIFF_SELF_SERVICE` | `CENTRAL_WITH_DEFAULT_POLICY` | `OWN` | `SYSTEM_ROLE / ADMIN`, `OWN`; active workforce and request invariants remain | `OWN` | none beyond default | Requester attribution, item/quantity/stock validation, idempotency, transaction and notification behavior | Yes | 12H-C | `modules/authorization/registry.ts`; `modules/stock/application/authorization.ts`; `modules/stock/application/requests/request-creation.ts`; `modules/stock/application/authorization.test.ts`; `__tests__/api/stock-requests-routes.test.ts` |
| `stock.request.cancel` | Stock | `OWN`, `ALL` | `DASHBOARD`, `LIFF_SELF_SERVICE` | `CENTRAL_WITH_DEFAULT_POLICY` | `OWN`; current broad cancellation requires `ALL` authority | `SYSTEM_ROLE / ADMIN`, `OWN + ALL`; current processor notification mode is role-derived | `OWN` | `ALL` | Requester/status/state, transaction, notification and concurrency checks | Yes | 12H-C | `modules/authorization/registry.ts`; `modules/stock/application/authorization.ts`; `modules/stock/application/requests/request-mutations.ts`; `modules/stock/application/authorization.test.ts`; `__tests__/api/stock-requests-routes.test.ts` |
| `stock.request.process` | Stock | `ALL` | `DASHBOARD`, `LIFF_SELF_SERVICE` | `CENTRAL_ONLY` | None | `SYSTEM_ROLE / ADMIN`, `ALL`; LIFF ADMIN remains processor-compatible; Dashboard account-only lifecycle exception | None | `ALL` | Processor/resource/status, inventory/stock, lifecycle, lock and transaction rules | Yes | 12H-B → 12H-G | `modules/authorization/registry.ts`; `modules/stock/application/authorization.ts`; `modules/stock/application/requests/request-mutations.ts`; `modules/stock/application/authorization.test.ts`; `__tests__/api/stock-requests-routes.test.ts`; `__tests__/api/line-stock-routes.test.ts` |
| `stock.report.export` | Stock | `ALL` | `DASHBOARD` | `CENTRAL_ONLY` | None | `SYSTEM_ROLE / ADMIN`, `ALL`, then report/query rules | None | `ALL` | Dashboard channel, report filters, query limits and export audit behavior | Yes | 12H-B → 12H-G | `modules/authorization/registry.ts`; `modules/stock/application/authorization.ts`; `modules/stock/infrastructure/reports/report-export.ts`; `modules/stock/application/authorization.test.ts`; `__tests__/api/stock-reports-export-route.test.ts` |
| `leave.request.read` | Leave | `OWN` | `DASHBOARD`, `LIFF_SELF_SERVICE` | `CENTRAL_WITH_DEFAULT_POLICY` | `OWN` | `SYSTEM_ROLE / ADMIN`, `OWN`, plus Leave participant/detail rules | `OWN` | none beyond default | Owner/participant/detail/attachment/lifecycle and feature rules | Yes | 12H-C | `modules/authorization/registry.ts`; `modules/leave/application/authorization.ts`; `modules/leave/application/authorization.test.ts`; `__tests__/api/leave-request.test.ts` |
| `leave.approval.read` | Leave | `ASSIGNED` | `DASHBOARD`, `LIFF_SELF_SERVICE` | `CENTRAL_WITH_DEFAULT_POLICY` | `ASSIGNED` | `SYSTEM_ROLE / ADMIN`, `ASSIGNED`, then effective-approver/actionable-work rules | `ASSIGNED` | none beyond default | Effective approver precedence, owner exclusion, actionable states and history rules | Yes | 12H-C | `modules/authorization/registry.ts`; `modules/leave/application/authorization.ts`; `modules/leave/application/approvals/approval-queries.ts`; `modules/leave/application/authorization.test.ts`; `__tests__/api/leave-approvals.test.ts` |
| `leave.request.create` | Leave | `OWN` | `DASHBOARD`, `LIFF_SELF_SERVICE` | `CENTRAL_WITH_DEFAULT_POLICY` | `OWN` | `SYSTEM_ROLE / ADMIN`, `OWN`, then active Employee/workflow validation | `OWN` | none beyond default | Active Employee, date/overlap/quota, validation, transaction and workflow invariants | Yes | 12H-C | `modules/authorization/registry.ts`; `modules/leave/application/authorization.ts`; `modules/leave/application/authorization.test.ts`; `__tests__/api/leave-request.test.ts` |
| `leave.request.cancel` | Leave | `OWN` | `DASHBOARD`, `LIFF_SELF_SERVICE` | `CENTRAL_WITH_DEFAULT_POLICY` | `OWN` | `SYSTEM_ROLE / ADMIN`, `OWN`, then owner/state/date/workflow checks | `OWN` | none beyond default | Request ownership, cancellable state, dates, quota/transaction and notifications | Yes | 12H-C | `modules/authorization/registry.ts`; `modules/leave/application/authorization.ts`; `modules/leave/application/authorization.test.ts`; `__tests__/api/leave-cancel.test.ts` |
| `leave.request.approve` | Leave | `ASSIGNED` | `DASHBOARD`, `LIFF_SELF_SERVICE` | `CENTRAL_WITH_DEFAULT_POLICY` | `ASSIGNED` | `SYSTEM_ROLE / ADMIN`, `ASSIGNED`, then effective-approver/workflow checks | `ASSIGNED` | none beyond default | Effective approver relationship, owner exclusion, state, quota, concurrency and audit | Yes | 12H-C | `modules/authorization/registry.ts`; `modules/leave/application/authorization.ts`; `modules/leave/application/authorization.test.ts`; `__tests__/api/leave-decision.test.ts` |
| `leave.cancellation.decide` | Leave | `ASSIGNED` | `DASHBOARD` | `CENTRAL_WITH_DEFAULT_POLICY` | `ASSIGNED` on Dashboard; unavailable on LIFF | Dashboard `SYSTEM_ROLE / ADMIN`, `ASSIGNED`, plus Admin recovery override; LIFF is channel-denied | `ASSIGNED` on Dashboard; no default on LIFF | No additional scope; recovery entry requires future `leave.recovery.manage` | Cancellation state, effective approver, recovery reason, date/quota, transaction and audit invariants | Yes | 12H-C → 12H-D | `modules/authorization/registry.ts`; `modules/leave/application/authorization.ts`; `modules/leave/application/cancellation/cancellation.ts`; `modules/leave/application/authorization.test.ts`; `__tests__/api/leave-cancel.test.ts` |
| `leave.request.not_taken` | Leave | `OWN`, `ASSIGNED` | `DASHBOARD`, `LIFF_SELF_SERVICE` | `CENTRAL_WITH_DEFAULT_POLICY` | `OWN + ASSIGNED` | `SYSTEM_ROLE / ADMIN`, `OWN + ASSIGNED`, plus Dashboard recovery override | `OWN + ASSIGNED` | none beyond default; recovery entry is separate | Owner/effective-approver relationship, state, quota, reason, transaction, notifications and audit | Yes | 12H-C → 12H-D | `modules/authorization/registry.ts`; `modules/leave/application/authorization.ts`; `modules/leave/application/not-taken.ts`; `modules/leave/application/authorization.test.ts`; `__tests__/api/leave-not-taken.test.ts` |
| `leave.approver.manage` | Leave | `ALL` | `DASHBOARD` | `CENTRAL_ONLY` | None | `SYSTEM_ROLE / ADMIN`, `ALL`; current account-only Admin lifecycle seam may bypass Employee context | None | `ALL` | Active workforce/approver assignment, offboarding, relationship and transaction checks | Yes | 12H-B → 12H-G | `modules/authorization/registry.ts`; `modules/leave/application/authorization.ts`; `modules/leave/application/approvals/approver-assignment.ts`; `modules/leave/application/authorization.test.ts`; `__tests__/api/leave-approvers.test.ts` |
| `audit.read` | Audit | `ALL` | `DASHBOARD` | `CENTRAL_ONLY` | None without configured authority | `SYSTEM_ROLE / ADMIN`, `ALL`, then Audit query/resource boundary | None | `ALL` | Application AuditLog visibility; cleanup and export-event logging are separate system/application boundaries | Yes | 12H-B → 12H-G | `modules/authorization/registry.ts`; `modules/audit/application/authorization.ts`; `modules/audit/application/authorization.test.ts`; `__tests__/api/audit-log-route.test.ts` |
| `email.request.read` | Email Request | `OWN`, `ALL` | `DASHBOARD` | `DEFERRED` | Deferred; current GET query is requester-owned for non-ADMIN | Current GET uses `ADMIN` for all rows and non-ADMIN for requester-owned rows; registry path is deferred | None | `OWN` for requester authority; `ALL` for configured operational authority | Requester identity, pagination, future IT ownership and data/snapshot rules | Yes | 12H-D | `modules/authorization/registry.ts`; `modules/authorization/application/administration-catalog.ts`; `lib/services/email-request/queries.ts`; `__tests__/services/email-request/queries.test.ts`; `__tests__/api/email-request.test.ts` |
| `email.request.create` | Email Request | `ALL` | `DASHBOARD` | `DEFERRED` | Deferred; current POST is ADMIN-only | `requireAdminSession` / `requiredRole: ADMIN` | None | `ALL` | Input validation, idempotency, audit, outbox delivery and future IT workflow rules | Yes | 12H-D | `modules/authorization/registry.ts`; `modules/authorization/application/administration-catalog.ts`; `app/api/email-request/route.ts`; `__tests__/api/email-request.test.ts`; `__tests__/integration/email-request-idempotency.integration.test.ts` |
| `notification.inbox.read` | Notification | `OWN` | `DASHBOARD` | `CENTRAL_WITH_DEFAULT_POLICY` | `OWN` | `SYSTEM_ROLE / ADMIN`, `OWN` (the registry has no broader scope) | `OWN` | none beyond default | Actor-derived user predicate, pagination/history and independent read semantics | Yes | 12H-C | `modules/authorization/registry.ts`; `modules/notification/application/authorization.ts`; `modules/notification/application/queries.ts`; `modules/notification/application/authorization.test.ts`; `__tests__/api/notifications.test.ts` |
| `notification.inbox.update` | Notification | `OWN` | `DASHBOARD` | `CENTRAL_WITH_DEFAULT_POLICY` | `OWN` | `SYSTEM_ROLE / ADMIN`, `OWN` (the registry has no broader scope) | `OWN` | none beyond default | Actor-derived update predicate; read and update remain independent | Yes | 12H-C | `modules/authorization/registry.ts`; `modules/notification/application/authorization.ts`; `modules/notification/application/commands.ts`; `modules/notification/application/authorization.test.ts`; `__tests__/api/notifications.test.ts` |

No target disposition above preserves an ADMIN-only default. No Department
scope is converted into Team authority. No negative grant or precedence rule
is introduced.

## 5. Non-registry production role-check audit

This audit searched production paths under `app`, `components`, `constants`,
`lib`, `modules`, and `scripts` for the requested role forms and then traced
the behavior rather than classifying by filename. Tests and documentation were
searched separately and are not counted as production surfaces.

A **surface** is one semantic decision point; multiple source lines that
implement the same decision are grouped into one row. The resulting ledger has
32 production surfaces:

| Classification | Count |
| --- | ---: |
| `CONTROL_PLANE_KEEP` | 3 |
| `AUTHENTICATION_OR_LIFECYCLE_KEEP` | 4 |
| `PRESENTATION_IDENTITY_ONLY` | 3 |
| `BUSINESS_AUTHORITY_MIGRATE` | 19 |
| `DOMAIN_RELATIONSHIP_POLICY` | 3 |
| `TEST_OR_DOCUMENTATION_ONLY` | 0 |
| **Total** | **32** |

| ID | Production evidence | Current behavior traced | Classification | Later action |
| --- | --- | --- | --- | --- |
| BA-01 | `modules/authorization/application/evaluator.ts` | ADMIN is converted into `SYSTEM_ROLE / ADMIN` grants for registered capabilities | `BUSINESS_AUTHORITY_MIGRATE` | 12H-B removes system role from business evaluation; 12H-I deletes compatibility debt |
| BA-02 | `modules/authorization/application/resolver.ts` | ADMIN decisions skip persisted Team/TeamRole/User grant loading | `BUSINESS_AUTHORITY_MIGRATE` | 12H-B makes configured resolution role-neutral |
| BA-03 | `modules/authorization/application/composition.ts` | ADMIN receives empty default scopes instead of the domain default policy | `BUSINESS_AUTHORITY_MIGRATE` | 12H-B/C composes the same default for equivalent USER and ADMIN context |
| BA-04 | `modules/authorization/application/production-readiness.ts` | Readiness treats direct ADMIN User grants as redundant and has ADMIN account-only canary assumptions | `BUSINESS_AUTHORITY_MIGRATE` | 12H-E/H/I rebase readiness and snapshot checks on effective grants, not implicit ADMIN business authority |
| CP-01 | `app/api/authorization/administration/_lib/route-auth.ts`; `modules/authorization/application/administration.ts`; `modules/authorization/application/errors.ts` | Authorization Administration API and application boundary require a trusted ADMIN principal | `CONTROL_PLANE_KEEP` | Keep as the explicit Authorization Administration control plane |
| CP-02 | `app/dashboard/_lib/route-access.ts`; `constants/dashboard.ts`; `components/dashboard/context/dashboard/DashboardProvider.tsx` | Authorization Administration page/menu requires ADMIN | `CONTROL_PLANE_KEEP` | Keep for the control-plane surface; separate it from the Email Request menu entry |
| CP-03 | `lib/ssot/admin-bootstrap.ts`; `modules/auth/application/signup.ts`; `app/api/auth/signup/route.ts` | Bootstrap allowlist assigns and reports the initial ADMIN role | `CONTROL_PLANE_KEEP` | Keep as bootstrap administration; do not treat it as business capability authority |
| AL-01 | `lib/ssot/permissions.ts` | Defines the trusted `ADMIN`/`USER` identity vocabulary and `isAdminRole` helper | `AUTHENTICATION_OR_LIFECYCLE_KEEP` | Keep as system identity input; callers must be narrowed to the allowlist or domain policy |
| AL-02 | `lib/auth/api.ts` | `requireAdminSession` authenticates an API session and checks ADMIN | `AUTHENTICATION_OR_LIFECYCLE_KEEP` | Keep as a primitive only for control-plane callers; migrate the Email caller |
| AL-03 | `lib/auth/workforce.ts`; `app/api/stock/**`; `app/api/routines/**`; `app/api/leave/**`; `app/api/uploads/image/route.ts` | `requireActiveWorkforceOrAdminSession` lets ADMIN callers proceed through the helper's ADMIN branch without the same active-Employee requirement as USER callers, and the helper is used by business routes across Stock, Routine, Leave, and upload paths | `BUSINESS_AUTHORITY_MIGRATE` | 12H-B records the role-neutral session boundary; 12H-F/G migrates callers to `requireActiveWorkforceSession` or another explicitly role-neutral boundary and retires the ADMIN branch. Keep `requireApiSession`, identity parsing, and the role-neutral workforce helper as authentication/lifecycle primitives |
| AL-04 | `modules/auth/application/employee-account-lifecycle.ts` | Prevents deactivation of the last active ADMIN | `AUTHENTICATION_OR_LIFECYCLE_KEEP` | Keep as the last-active-ADMIN safeguard |
| BA-05 | `app/api/email-request/route.ts`; `app/dashboard/_lib/route-access.ts`; `constants/dashboard.ts`; `components/dashboard/context/dashboard/DashboardProvider.tsx` | Email Request POST/page/menu are ADMIN-only | `BUSINESS_AUTHORITY_MIGRATE` | 12H-D uses configured `email.request.create` and read scopes |
| BA-06 | `lib/services/email-request/queries.ts` | ADMIN sees all Email Requests; other actors see requester-owned rows | `BUSINESS_AUTHORITY_MIGRATE` | 12H-D maps `OWN`/`ALL` configured authority while retaining requester predicates |
| BA-07 | `modules/leave/application/authorization.ts`; `modules/leave/application/cancellation/cancellation.ts` | ADMIN is allowed to enter the Leave cancellation recovery override | `BUSINESS_AUTHORITY_MIGRATE` | 12H-D introduces the unregistered `leave.recovery.manage` design and preserves Leave invariants |
| BA-08 | `modules/leave/application/authorization.ts` | Account-only Dashboard ADMIN lifecycle is accepted for approver management | `BUSINESS_AUTHORITY_MIGRATE` | 12H-D/G requires configured business authority plus the correct workforce/lifecycle boundary |
| BA-09 | `app/api/leave/admin/recovery/route.ts` | Recovery API checks `isAdminRole` directly | `BUSINESS_AUTHORITY_MIGRATE` | 12H-F/G replaces the role gate with configured recovery authority |
| BA-10 | `app/dashboard/leave/page.tsx`; `constants/dashboard.ts`; `modules/leave/presentation/dashboard/LeaveManagementSection.tsx` | Recovery tab visibility and deep-link availability use ADMIN | `BUSINESS_AUTHORITY_MIGRATE` | 12H-F projects recovery authority; UI remains non-authoritative |
| BA-11 | `modules/leave/application/not-taken.ts` | ADMIN recovery override can confirm not-taken work when the normal approver path is unavailable | `BUSINESS_AUTHORITY_MIGRATE` | 12H-D/G uses dedicated configured recovery entry authority and keeps reason/state/quota checks |
| BA-12 | `app/api/leave/attachments/[attachmentId]/route.ts`; `modules/leave/application/queries/participant-access.ts` | ADMIN bypasses participant ownership for private Leave attachment reads | `BUSINESS_AUTHORITY_MIGRATE` | 12H-D/G replaces the role bypass with an explicit approved policy; no generic capability is invented in 12H-A |
| DR-01 | `modules/leave/application/approvals/exception-approver.ts` | The `role: "ADMIN"` query selects and persists an ADMIN Employee as a fallback exception approver; that persisted relationship then supplies effective `ASSIGNED` workflow authority | `BUSINESS_AUTHORITY_MIGRATE` | 12H-D preserves the Leave exception-approver/domain relationship concept but removes ADMIN as the candidate source. Use approved Leave configuration, Team, or another role-neutral domain relationship; preserve effective-approver, state, transaction, and audit invariants |
| BA-13 | `modules/routine/application/authorization.ts` | Default scopes are empty for non-USER actors; Dashboard ADMIN is marked administrative and LIFF ADMIN is channel-clamped | `BUSINESS_AUTHORITY_MIGRATE` | 12H-B/C removes system-role default branching while retaining channel and domain rules |
| BA-14 | `modules/routine/application/queries.ts` | Dashboard summary defaults to `all` when `queryActor.actor.role === "ADMIN"` | `BUSINESS_AUTHORITY_MIGRATE` | 12H-C changes the target default to `ASSIGNED`; configured `ALL` remains additive |
| BA-15 | `modules/routine/domain/capabilities.ts` | Compatibility fallback `isAdmin` allows edit/delete when scope data is absent | `BUSINESS_AUTHORITY_MIGRATE` | 12H-I removes the system-role compatibility fallback after all callers use effective capability scopes |
| BA-16 | `modules/routine/presentation/dashboard/RoutineSection.tsx`; `RoutineTaskList.tsx`; `RoutineOccurrenceList.tsx`; `RoutineDetailsDialog.tsx`; `RoutineTaskForm.tsx`; `modules/routine/application/mutations.ts` | ADMIN selects settings/admin form mode and receives role-derived import metadata/administrative mutation normalization | `BUSINESS_AUTHORITY_MIGRATE` | 12H-F/G projects configured capabilities and deletes role-derived business presentation mode |
| DR-02 | `modules/routine/application/recipients.ts`; `modules/routine/application/scheduler.ts`; `modules/routine/application/reminders.ts` | ADMIN role is used for Routine reminder recipient selection and stale-recipient validation | `DOMAIN_RELATIONSHIP_POLICY` | Keep separate from access authority; re-evaluate notification audience policy during the Routine/IT domain work |
| BA-17 | `modules/stock/application/authorization.ts` | ADMIN defaults are empty in the adapter, but central ADMIN grants inventory/process/cancel and current Dashboard ADMIN lifecycle is Employee-optional for selected operations | `BUSINESS_AUTHORITY_MIGRATE` | 12H-B/G makes these configured authority and retains only proven lifecycle checks |
| DR-03 | `modules/stock/application/requests/request-mutations.ts` | ADMIN role selects processor notification wording/path for cancellation | `DOMAIN_RELATIONSHIP_POLICY` | Rebase notification mode on effective operation/resource authority, not system role |
| PI-01 | `modules/stock/presentation/dashboard/context/StockProvider.tsx`; `modules/stock/presentation/dashboard/StockSection.tsx` | ADMIN is shown as a role badge; capability projection controls actual tabs/actions | `PRESENTATION_IDENTITY_ONLY` | Keep identity display or replace it with neutral identity metadata; never use it as a server boundary |
| DR-04 | `modules/stock/infrastructure/notifications/notifications.ts` | Stock notifications are addressed to active ADMIN accounts | `DOMAIN_RELATIONSHIP_POLICY` | Preserve as recipient policy only if product ownership confirms it; it grants no Stock authority |
| PI-02 | `modules/authorization/presentation/dashboard/permission-presentation.ts`; `modules/authorization/presentation/dashboard/components/UserAccessPanel.tsx`; `modules/authorization/application/types.ts`; `modules/authorization/application/administration-types.ts` | System-role source and ADMIN identity are displayed/projected as provenance | `PRESENTATION_IDENTITY_ONLY` | Preserve actor/source provenance for audit and inspection; do not treat display/source text as authority |
| PI-03 | `modules/leave/application/cancellation/cancellation.ts`; `modules/leave/application/not-taken.ts` | ADMIN actor name/role is written into notification/audit payloads for recovery provenance | `PRESENTATION_IDENTITY_ONLY` | Preserve provenance fields while changing the authorization source; role label must not decide ALLOW/DENY |
| AL-05 | `modules/employee/application/authorization.ts`; `modules/department/application/authorization.ts`; `modules/audit/application/authorization.ts`; `modules/notification/application/authorization.ts`; `modules/stock/application/authorization.ts`; `modules/leave/application/authorization.ts`; `modules/routine/application/authorization.ts`; `modules/authorization/application/administration.ts`; `modules/authorization/infrastructure/persistence/authorization-production-readiness-repository.ts` | Each adapter parses the persisted system-role union (`USER`/`ADMIN`) before creating a trusted actor | `AUTHENTICATION_OR_LIFECYCLE_KEEP` | Keep input validation; remove only role-derived business authority, not trusted identity validation |

The role-shaped literals excluded from the 32-surface count were traced and
are not system-role authorization: Routine assignee roles (`OWNER`/
`CO_OWNER`), Employee Department code `ADMIN`, UI text fixtures, and tests or
historical documents. No production match in the requested search set remains
unclassified.

## 6. Explicit ADMIN control-plane allowlist

After Phase 12H, system role `ADMIN` may still matter only at these audited
boundaries:

| Boundary | Evidence | Target classification | Why it remains |
| --- | --- | --- | --- |
| Authorization Administration | `app/api/authorization/administration/**`; `app/dashboard/authorization/page.tsx`; `modules/authorization/application/administration.ts`; `modules/authorization/application/administration-mutations.ts` | True system/control plane | ADMIN manages Team, TeamRole, membership, and configured capability grants |
| Bootstrap ADMIN assignment | `lib/ssot/admin-bootstrap.ts`; `modules/auth/application/signup.ts`; `app/api/auth/signup/route.ts` | Bootstrap administration | The allowlist determines initial control-plane authority during account creation |
| ADMIN account lifecycle | `modules/auth/application/employee-account-lifecycle.ts` | Authentication/lifecycle | Last-active-ADMIN protection is an account safety invariant, not a business capability |
| Trusted authentication/session helpers | `lib/ssot/permissions.ts`; `lib/auth/api.ts`; `lookupWorkforceSession` / `requireActiveWorkforceSession` in `lib/auth/workforce.ts`; related session identity adapters | Authentication/lifecycle | These helpers establish or validate trusted identity/lifecycle context; they do not authorize a business operation by themselves |

`requireActiveWorkforceOrAdminSession()` is explicitly **not** on this
allowlist. Its ADMIN branch is a business-authority migration surface because
it can admit account-only or otherwise non-equivalent ADMIN context into
business routes that require an active workforce context for USER actors. The
helper and its callers must be retired or role-neutralized after the callers
are migrated; this does not turn `requireApiSession()` or trusted identity
parsing into business capability authority.

No Leave recovery, Email Request, Routine management, Stock inventory/request
processing, Audit visibility, Employee mutation, or other domain operation is
on this allowlist. Those are business operations and are scheduled for
configured authority migration. No additional platform-level control-plane
privilege was invented because the repository did not prove one.

## 7. Business ADMIN authority scheduled for migration

The following current business authority is technical debt, not target
architecture:

- central `SYSTEM_ROLE / ADMIN` authority for all 38 currently centrally
  resolved registered capabilities, including the 25 default-backed and 13
  central-only entries;
- the current deferred Email Request ADMIN-only create gate and ADMIN-wide
  read query;
- the ADMIN branch of `requireActiveWorkforceOrAdminSession()` and its business
  route callers;
- Routine Dashboard ADMIN broad task/summary/reference/export behavior,
  administrative form normalization, and role-derived summary scope;
- Stock ADMIN inventory/process/broad request cancellation behavior and
  role-derived processor notification mode;
- Leave ADMIN recovery/override behavior, account-only approver-management
  lifecycle exception, private attachment bypass, and ADMIN-selected fallback
  exception approver relationship; and
- any presentation/route role gate that exposes one of those business
  operations.

The migration must not replace these with a new implicit “configured admin”
mode. The replacement is role-neutral default policy plus additive
Team/TeamRole/exceptional User grants, with domain-owned relationships and
workflow invariants still enforced.

## 8. Historical documentation updates required by this target

The following documents remain historical or generic records and must point
readers to this contract without being rewritten wholesale:

| Document | Phase 12H-A treatment |
| --- | --- |
| `docs/architecture/authorization-current-state.md` | Records that 12H-A introduced the new target, current runtime is still pre-12H/role-sensitive, and 12H-A supersedes both Phase 12A's long-term ADMIN business-authority target and the explicitly narrowed legacy USER defaults |
| `docs/architecture/authorization-contract.md` | Remains the historical Phase 1 vocabulary/registry contract and points to the current 12H target |
| `docs/architecture/authorization-phase-12a-additive-policy-contract.md` | Remains a historical Phase 12A boundary record; its long-term ADMIN target and selected legacy USER-default permanence are superseded, especially for Routine broad authority |
| `docs/architecture/authorization-resolver.md` | Remains the generic/current resolver record and distinguishes current `SYSTEM_ROLE` behavior from the 12H target |
| `docs/architecture/authorization-presentation-projection.md` | Remains the historical/current projection record; presentation projections do not make the 12H runtime target live |

## 9. Later Phase 12H migration ledger

| Phase | Owner and non-goal boundary |
| --- | --- |
| **12H-A** | Role-neutral contract and exhaustive inventory. This document is the open review record; closure is pending the corrections in Section 10. No runtime, schema, grant, seed, or migration changes. |
| **12H-B** | Role-neutral resolver/composition core. Remove system-role knowledge from business capability resolution/composition while keeping ADMIN control-plane authentication separate. |
| **12H-C** | Domain Default Policy rebaseline. Rebase Employee, Department, Routine, Stock, Leave, Audit, and Notification defaults; explicitly narrow Routine broad defaults. |
| **12H-D** | Missing/deferred business capability completion, including Leave recovery and Email Request. Register only reviewed capabilities; preserve domain invariants. |
| **12H-E** | Production Team/grant preparation and effective-access reconciliation. Reconcile grant provenance, Team/TeamRole/User sources, readiness, and snapshots without implicit ADMIN authority. |
| **12H-F** | Presentation and route role-authority removal. Replace business `requiredRole: ADMIN`, Admin recovery UI gates, Routine role modes, and similar projections with trusted capability/relationship projections. |
| **12H-G** | Enforcement cutover and full security regression audit. Verify server-side parity, channel/lifecycle/resource/workflow boundaries, and fail-closed behavior. |
| **12H-H** | Production snapshot and live rollout validation. Validate effective access and operational/audit evidence against the approved snapshot before rollout. |
| **12H-I** | Delete compatibility/system-role business-authority debt. Remove obsolete role fallbacks, readiness assumptions, and compatibility branches after the cutover evidence is accepted. |

## 10. Corrections required before closure

The following corrections are required before Phase 12H-A can close or hand
off to Phase 12H-B:

| ID | Correction | Evidence | Required disposition |
| --- | --- | --- | --- |
| C-01 | `requireActiveWorkforceOrAdminSession()` was incorrectly classified as an authentication/lifecycle keep. Its ADMIN branch is business-route migration debt. | `lib/auth/workforce.ts`; the AL-03 caller set in Section 5 | Keep role-neutral session primitives, but migrate callers and retire/role-neutralize the ADMIN branch in 12H-B → 12H-G |
| C-02 | Leave fallback exception-approver selection was incorrectly classified as domain relationship policy only. `role: "ADMIN"` creates a persisted effective approver relationship and therefore indirect business authority. | `modules/leave/application/approvals/exception-approver.ts`; DR-01 | Preserve the domain relationship, but remove ADMIN as candidate source through Leave-specific configuration, Team, or another approved role-neutral relationship in 12H-D |
| C-03 | Historical supersession wording named only ADMIN business authority. Phase 12H-A also supersedes selected legacy USER-default permanence, explicitly Routine broad task read, summary, and export defaults. | Sections 1.1 and 3; updated historical-document notes in Section 8 | Treat Phase 12H-A as the current target; retain Phase 12A as historical evidence only |

Phase 12H-A remains **OPEN** until these corrections are accepted. The
corrections do not change runtime behavior.

## 11. Intentionally unresolved or deferred items

No production role-check surface is left unclassified, and no registered
capability is left without a target disposition. The following items are
intentionally deferred because Phase 12H-A is a contract/inventory phase:

| Item | Why it is not resolved here | Evidence and owner |
| --- | --- | --- |
| Leave recovery capability | The target key `leave.recovery.manage` is required by the approved direction, but the user explicitly forbids registering it in this phase. Its entry semantics must be implemented with the existing recovery invariants, not inferred from `leave.request.not_taken`. | `modules/leave/application/authorization.ts`; `app/api/leave/admin/recovery/route.ts`; `__tests__/api/leave-admin-recovery.test.ts` — Phase 12H-D |
| Email Request configured authority | Email Request is still deferred and currently uses a role gate/query branch rather than the central capability path. The target OWN/ALL policy is recorded, but runtime migration is out of scope. | `modules/authorization/application/administration-catalog.ts`; `app/api/email-request/route.ts`; `lib/services/email-request/queries.ts`; Phase 12H-D |
| Production grant/data inventory | Phase 12H-A records code and test evidence only. It does not inspect, mutate, seed, backfill, or reconcile a production database. | `modules/authorization/application/production-readiness.ts`; Phase 12H-E/H |
| Future IT capabilities | IT is not implemented and no keys may be registered yet. The intended capability-first shape is recorded as design input only. | Future IT module; Phase 12H-D or a later approved domain phase |
| Role-based notification audiences | Routine/Stock ADMIN recipient selection is classified as domain relationship/recipient policy rather than actor authority. Replacing it requires product ownership decisions about notification audiences. | `modules/routine/application/recipients.ts`; `modules/routine/application/scheduler.ts`; `modules/stock/infrastructure/notifications/notifications.ts` — owning domain phase |

These are not the reason for the current open correction status; they are
explicitly owned by later phases and cannot be silently resolved by this
inventory document.

## 12. Phase 12H-A definition of done

After the corrections in Section 10 are accepted, the repository must answer,
from committed documentation:

- a normal actor receives the role-neutral default policy for the same trusted
  context;
- ADMIN does not receive different target default business authority;
- additional authority comes only from Team, TeamRole, or exceptional direct
  User grants;
- the explicit ADMIN control-plane/lifecycle allowlist is narrow and named;
- all 32 semantic production role-check surfaces are classified;
- all 40 registered capabilities have one target disposition;
- current `SYSTEM_ROLE` business authority remains clearly marked as runtime
  debt until later cutover;
- negative permissions, Department-to-Team inference, and replacement of
  domain workflow/resource rules with capabilities are forbidden.

Verification for this documentation-only phase is recorded in the delivery
report and does not imply runtime migration.
