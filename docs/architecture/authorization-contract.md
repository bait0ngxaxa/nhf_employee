# NHF Employee — Authorization Contract (Phase 1)

Status: Phase 1 — Capability Contract & Registry

This document defines the code-level authorization vocabulary for the next
authorization phases. It does not replace or rewrite the current behavior
baseline in [authorization-current-state.md](./authorization-current-state.md).
No production route or authorization consumer is migrated in this phase.

## 1. Purpose and invariants

Phase 1 establishes:

- `AuthorizationActor`;
- the authorization execution channel vocabulary;
- the initial scope vocabulary;
- the code-owned capability inventory and registry; and
- the public module seam future phases will consume.

Future authorization remains intended to be additive `ALLOW` grants with
default deny. Phase 1 does not implement grant persistence, effective-grant
resolution, a resolver, or an authorization evaluator. `ADMIN` remains the
highest system role, but the actor role is not a bypass for authentication,
workforce lifecycle, resource relationships, workflow state, validation,
transactions, or concurrency rules.

The existing role source of truth remains
[`lib/ssot/permissions.ts`](../../lib/ssot/permissions.ts). The authorization
contract uses its `UserRole` type rather than defining a second role universe.

## 2. Module and public interface

The contract is framework-independent and lives behind the module public entry
point:

```text
modules/authorization/
├── contracts.ts
├── registry.ts
├── registry.test.ts
└── index.ts
```

Production consumers must use:

```ts
import {
    CAPABILITY_REGISTRY,
    getCapabilityDefinition,
} from "@/modules/authorization";
```

The module has no Prisma, Next.js, route, persistence, or domain-module
dependency. `CAPABILITY_REGISTRY` is code-owned and immutable at runtime.
Future persisted grants may store a capability key as a string, but application
code must validate it against this registry. The database does not define or
invent capability keys.

`createCapabilityRegistry()` is only a static registry-construction and
validation helper. It is not a permission resolver and does not decide whether
an actor may perform an operation.

## 3. Shared contracts

The public module exports these concepts:

```ts
interface AuthorizationActor {
    userId: number;
    employeeId: number | null;
    systemRole: UserRole;
    channel: AuthorizationChannel;
}

type AuthorizationChannel =
    | "DASHBOARD"
    | "LIFF_SELF_SERVICE"
    | "SYSTEM";

type AuthorizationScope =
    | "OWN"
    | "CREATED"
    | "ASSIGNED"
    | "TEAM"
    | "ALL";

type CapabilityDefinition = {
    key: CapabilityKey;
    domain: AuthorizationDomain;
    scopes: readonly AuthorizationScope[];
    channels: readonly AuthorizationChannel[];
};
```

`AuthorizationActor` intentionally contains no department, manager,
assignee, approver, workflow, resource, or UI state. A domain interprets its
own relationships after a future capability/scope decision.

### 3.1 Execution channel versus entry-point surface

The current-state matrix uses these transport or entry-point surfaces:

```text
DASHBOARD, API, LIFF, SYSTEM endpoint
```

They are not the actor channel contract. The actor channel is only:

| Authorization channel | Meaning |
|---|---|
| `DASHBOARD` | Dashboard web execution, including a Dashboard-owned `/api/**` request. |
| `LIFF_SELF_SERVICE` | A verified LIFF self-service execution. |
| `SYSTEM` | Trusted background/platform execution where a system principal is explicitly appropriate. |

`API` is intentionally absent. An HTTP route under `/api/**` does not by
itself establish an authorization channel. Existing Dashboard-owned API calls
remain `DASHBOARD` context; LIFF routes use `LIFF_SELF_SERVICE`; secret/HMAC
system boundaries remain authentication boundaries rather than User grants.

### 3.2 Scope vocabulary

| Scope | Contract meaning | Important non-meaning |
|---|---|---|
| `OWN` | The actor's self-owned resource, as defined by the owning domain. | Not every resource with a User foreign key is automatically ownable. |
| `CREATED` | A resource created by the actor. | Not the same as current assignment. |
| `ASSIGNED` | A resource assigned to the actor, with assignment semantics owned by the domain. | Not a universal Prisma predicate. |
| `TEAM` | A resource constrained by the Team associated with the originating grant. | Not Department, department name, manager reports, or organizational unit. |
| `ALL` | No resource constraint within the capability's authorized resource set. | Not `ADMIN`; role and business rules remain separate. |

The initial vocabulary deliberately does not contain `PARTICIPANT`, `APPROVER`,
`RECOVERY`, `MANAGED`, or `DIRECT_REPORT`. Those relationships remain
domain-owned where the initial generic vocabulary cannot express their exact
semantics.

### 3.3 Capability key naming

Capability keys are lower-case dot-separated identifiers owned by a registered
domain. Nested resources use the architecture form:

```text
<domain>.<resource>.<action>
```

For a domain whose primary resource is the domain itself, the two-segment form
used by the locked examples is used (`employee.read`, `audit.read`). This is
the only shorter form. Keys have no more than three segments, use lower-case
ASCII letters/digits with `_` or `-` inside a segment, and have no empty
segments. The first segment must match the definition's domain.

The registry exposes `RegisteredCapabilityKey`, the literal union derived from
the static inventory, in addition to the structural `CapabilityKey` contract.

## 4. Registry validation

Registry construction fails early when any of these invariants is violated:

- a key is duplicated;
- a key is not a valid two- or three-segment capability identifier;
- the key's domain is unknown or does not match `domain`;
- `domain` is missing or unknown;
- `scopes` is empty, contains an unknown scope, or repeats a scope; or
- `channels` is empty, contains an unknown channel, or repeats a channel.

`getCapabilityDefinition(unknownKey)` returns `undefined`, and
`isRegisteredCapabilityKey(unknownKey)` returns `false`. The registry does not
silently construct definitions for unknown persisted strings.

## 5. Initial capability inventory

The registry inventory below is derived from the Phase 0 route, application,
query, domain, and test evidence. `ALL` in a definition describes a supported
resource shape; it does not create a grant and does not settle an unresolved
policy decision. `D` and `L` are expanded in the channel column as the exact
contract values.

### 5.1 Employee

| Key | Supported scopes | Channels | Current operation and status |
|---|---|---|---|
| `employee.read` | `ALL` | `DASHBOARD` | Employee list. Current authenticated organization-wide USER access is `POLICY_DECISION_REQUIRED`. |
| `employee.stats.read` | `ALL` | `DASHBOARD` | Employee aggregate statistics. Broad aggregate visibility is `POLICY_DECISION_REQUIRED`. |
| `employee.create` | `ALL` | `DASHBOARD` | Employee lifecycle create; current Admin route and transaction safeguards are `CURRENT_COMPATIBILITY`. |
| `employee.update` | `ALL` | `DASHBOARD` | Employee lifecycle update; current Admin route and business invariants are `CURRENT_COMPATIBILITY`. |
| `employee.delete` | `ALL` | `DASHBOARD` | Employee lifecycle delete/offboarding; current Admin route and lifecycle safeguards are `CURRENT_COMPATIBILITY`. |
| `employee.import` | `ALL` | `DASHBOARD` | Employee import; current Admin route and transactional lifecycle rules are `CURRENT_COMPATIBILITY`. |
| `employee.export` | `ALL` | `DASHBOARD` | Employee CSV export. Current authenticated organization-wide USER access is `POLICY_DECISION_REQUIRED`. |

### 5.2 Department reference data

| Key | Supported scopes | Channels | Current operation and status |
|---|---|---|---|
| `department.read` | `ALL` | `DASHBOARD` | Authenticated Department reference read. Department is reference data and is not an authorization grouping or Team substitute. |

### 5.3 Routine

| Key | Supported scopes | Channels | Current operation and status |
|---|---|---|---|
| `routine.task.read` | `CREATED`, `ASSIGNED`, `ALL` | `DASHBOARD`, `LIFF_SELF_SERVICE` | Task management/detail and self-service task reads; creator, task-assignee, occurrence-assignee, and Admin behavior remain Routine-owned. |
| `routine.task.create` | `OWN`, `ALL` | `DASHBOARD`, `LIFF_SELF_SERVICE` | Task creation; LIFF/USER creation is actor-owned and normalized by Routine, while Dashboard Admin creation can supply assignment data. |
| `routine.task.update` | `CREATED`, `ASSIGNED`, `ALL` | `DASHBOARD`, `LIFF_SELF_SERVICE` | Task update; creator and assignee field permissions remain distinct domain rules. |
| `routine.task.delete` | `CREATED`, `ALL` | `DASHBOARD`, `LIFF_SELF_SERVICE` | Task deletion; current USER behavior is creator-only. |
| `routine.occurrence.read` | `ASSIGNED`, `ALL` | `DASHBOARD` | Occurrence read/focus; occurrence assignment remains distinct from task assignment. |
| `routine.occurrence.override` | `ALL` | `DASHBOARD` | Atomic occurrence override of due date/assignee data; current Admin and transaction rules remain Routine-owned. |
| `routine.occurrence.reassign` | `ALL` | `DASHBOARD` | Occurrence reassignment; active target and concurrency checks remain Routine-owned. |
| `routine.occurrence.change_due_date` | `ALL` | `DASHBOARD` | Explicit occurrence due-date change; date, reminder, lock, and audit behavior remain Routine-owned. |
| `routine.import.manage` | `ALL` | `DASHBOARD` | Import preview, staging, row, apply, and cancel operations; current Admin-only behavior is `CURRENT_COMPATIBILITY`. |
| `routine.task.export` | `ALL` | `DASHBOARD` | Routine task export. Current broad USER all-scope behavior is `POLICY_DECISION_REQUIRED`. |
| `routine.summary.read` | `ASSIGNED`, `ALL` | `DASHBOARD`, `LIFF_SELF_SERVICE` | Routine summary/KPI read. Current USER all-scope behavior is `POLICY_DECISION_REQUIRED`. |
| `routine.reference.read` | `OWN`, `ALL` | `DASHBOARD`, `LIFF_SELF_SERVICE` | Routine units/categories/assignment reference read. The LIFF response must not expose the employee list; the internal route mode issue is `OPEN`. |

### 5.4 Stock

| Key | Supported scopes | Channels | Current operation and status |
|---|---|---|---|
| `stock.catalog.read` | `ALL` | `DASHBOARD`, `LIFF_SELF_SERVICE` | Active item/category/availability catalog read; requester catalog visibility is separate from request visibility. |
| `stock.inventory.manage` | `ALL` | `DASHBOARD` | Admin inventory item/category/quantity operations, including the Admin image-upload operation; Stock owns stock and concurrency invariants. |
| `stock.request.read` | `OWN`, `ALL` | `DASHBOARD`, `LIFF_SELF_SERVICE` | Request reads: requester-owned for normal users and Admin all/mine behavior. |
| `stock.request.create` | `OWN` | `DASHBOARD`, `LIFF_SELF_SERVICE` | Request creation; requester identity is always server-derived from the actor. |
| `stock.request.cancel` | `OWN`, `ALL` | `DASHBOARD`, `LIFF_SELF_SERVICE` | Own pending cancellation for normal users and Admin broad pending cancellation. |
| `stock.request.process` | `ALL` | `DASHBOARD`, `LIFF_SELF_SERVICE` | Admin review/issue/processor queue; status, stock, and atomic claim rules remain Stock-owned. |
| `stock.report.export` | `ALL` | `DASHBOARD` | Admin-only organization-wide Stock report export. |

### 5.5 Leave

| Key | Supported scopes | Channels | Current operation and status |
|---|---|---|---|
| `leave.request.read` | `OWN` | `DASHBOARD`, `LIFF_SELF_SERVICE` | Current Employee self profile/history/request read. Participant detail and attachment policy remains Leave-owned. |
| `leave.approval.read` | `ASSIGNED` | `DASHBOARD`, `LIFF_SELF_SERVICE` | Actionable/history approval work for the effective approver; effective assignment remains Leave-owned. |
| `leave.request.create` | `OWN` | `DASHBOARD`, `LIFF_SELF_SERVICE` | Current Employee creates a request for the actor's own Employee identity. |
| `leave.request.cancel` | `OWN` | `DASHBOARD`, `LIFF_SELF_SERVICE` | Owner cancellation request, subject to Leave state/date rules. |
| `leave.request.approve` | `ASSIGNED` | `DASHBOARD`, `LIFF_SELF_SERVICE` | Effective assigned approver decision; Admin is not a universal approval bypass. |
| `leave.cancellation.decide` | `ASSIGNED` | `DASHBOARD` | Assigned effective approver cancellation decision. Admin unavailable-approver override remains a Leave-specific policy path. |
| `leave.request.not_taken` | `OWN`, `ASSIGNED` | `DASHBOARD`, `LIFF_SELF_SERVICE` | Owner request and assigned approver confirmation for the not-taken workflow; Admin recovery override remains domain-owned and channel-restricted. |
| `leave.approver.manage` | `ALL` | `DASHBOARD` | Admin approver assignment/settings operation; Employee hierarchy and pending-request constraints remain Leave-owned. |

### 5.6 Audit

| Key | Supported scopes | Channels | Current operation and status |
|---|---|---|---|
| `audit.read` | `ALL` | `DASHBOARD` | Admin AuditLog read. Query filters/pagination do not replace the Admin route guard. |

### 5.7 Email Request

| Key | Supported scopes | Channels | Current operation and status |
|---|---|---|---|
| `email.request.read` | `OWN`, `ALL` | `DASHBOARD` | USER requester-owned read versus Admin all read. |
| `email.request.create` | `ALL` | `DASHBOARD` | Admin email-request creation; notification and mail transport remain outside generic authorization. |

### 5.8 Notifications

| Key | Supported scopes | Channels | Current operation and status |
|---|---|---|---|
| `notification.inbox.read` | `OWN` | `DASHBOARD` | Authenticated current-User latest/history inbox read. |
| `notification.inbox.update` | `OWN` | `DASHBOARD` | Authenticated current-User read/unread state updates. User ID remains server-derived. |

## 6. Domain-owned relationship translation

The generic module defines capability, supported scope, and supported channel;
it does not translate a scope into a Prisma predicate or shared resource
relationship.

Examples that remain outside `modules/authorization`:

- Routine `CREATED` checks `createdById`; `ASSIGNED` can mean task assignment
  or occurrence assignment depending on the operation.
- Stock `OWN` means the request's server-derived `requestedBy` relationship.
- Leave `ASSIGNED` means effective approver semantics, where an exception
  approver can supersede the original approver.
- Leave participant, original-approver history, manager/direct-report report
  scope, and recovery candidate selection remain Leave-owned policies.
- Active/deleted User and Employee checks, workflow status, quota, validation,
  transaction, lock, and concurrency rules remain with Auth, Employee, Leave,
  Routine, or Stock as appropriate.

`TEAM` is a vocabulary value only in Phase 1. It means the Team associated
with the originating grant. No Team persistence, membership, TeamRole, or
resource resolver exists, and no current Department field is used to derive it.

## 7. Deliberate exclusions

These current or adjacent operations are intentionally not separate registry
capabilities in Phase 1:

| Exclusion | Reason |
|---|---|
| Generic `data.export` | Employee, Routine, Stock, and Leave exports have different authority and relationship semantics. A generic export key would hide those differences. The registered exports stay with their owning domains. |
| `leave.report.export` | Current-team reporting uses active direct reports while approver-history reporting uses the original approver. The initial generic scopes cannot claim either mapping without a Leave policy decision. |
| Leave participant/detail/attachment access | The initial vocabulary has no `PARTICIPANT` scope. Owner, effective approver, original approver, and Dashboard Admin relationship behavior remain Leave-owned. |
| Leave Admin recovery candidate access | Recovery is a constrained unavailable-approver workflow, not generic `ALL`; no `RECOVERY` scope is invented. |
| Audit export-event logging | `POST /api/audit-logs/export` records a caller-attributed event; it is not authority to read or export data. It remains an audit/instrumentation boundary and is not represented as `data.export`. |
| Routine settings UI | No independently authorized settings API was found. A UI tab or hidden button is not enough evidence for `settings.manage`. Proven Leave approver configuration is represented by `leave.approver.manage`. |
| Public upload GET | Public upload reads are path-safety/public-file behavior, not a User capability. Admin stock image upload is covered by the Stock inventory operation rather than a generic upload permission. |
| Authentication, account lifecycle, session, password, OAuth, LINE linking, and LIFF session verification | These are authentication or account-lifecycle boundaries, not generic application capabilities. |
| Cron, cleanup, outbox worker, scheduler, and LINE webhook endpoints | Shared-secret/HMAC verification authenticates a system/platform event. They are not User grants. `SYSTEM` remains available for a future explicitly approved system-principal contract. |
| Feature flags and presentation projections | Menu visibility, `canApproveLeave`, `canViewLeaveReports`, and `LiffCapabilities` are not authority. |

## 8. Open policy decisions

The registry records operation shapes without silently deciding these unresolved
policies:

1. Whether Employee list, aggregate statistics, and CSV export remain broad
   authenticated operations or receive a narrower approved policy.
2. Whether Routine normal-user all-scope task work items, summary, and export
   behavior is retained or narrowed. Existing characterization tests freeze the
   current behavior until an explicit decision.
3. The intended authorization and scope for Leave report visibility/export.
4. How Leave participant access, original-approver history, effective
   approver, manager/direct-report reporting, and recovery should compose with
   future capability grants without inventing generic scopes.
5. Hardening of the internal LIFF Routine reference query's missing
   `LIFF_SELF_SERVICE` mode. The no-employee-list response boundary remains
   compatibility behavior; the broader internal query is an open least-data
   access issue.
6. Which future capabilities, if any, support `TEAM`, and how a Team resource
   relationship is resolved. Department must not be used as a substitute.
7. The final policy and input-validation treatment of the Audit export-event
   logging endpoint.
8. The future mapping of Admin authority to each capability/channel. Admin
   role remains separate from domain/workflow invariants and is not a generic
   bypass.

No runtime branch is based on these labels in Phase 1.

## 9. Explicit Phase 1 non-goals

Phase 1 does not create or modify:

- Team, TeamRole, TeamMembership, TeamCapabilityGrant,
  TeamRoleCapabilityGrant, or UserCapabilityGrant persistence;
- `prisma/schema.prisma`, database migrations, authorization seeds, or grant
  tables;
- `authorization.can()`, `authorization.require()`,
  `authorization.resolve()`, or `authorization.getScopes()`;
- effective permission resolution, Admin resolver bypass, grant-source
  explanations, caching, or default-deny runtime evaluation;
- authentication, session, refresh, password, OAuth, LINE, LIFF, or account
  lifecycle behavior; or
- route, Dashboard, LIFF, query, mutation, response, relationship, workflow,
  or existing authorization behavior.

## 10. Later-phase consumption

Phase 2 may add persisted grant records whose string keys are checked against
`CAPABILITY_REGISTRY`, while keeping grant origin and Team relationships out of
this Phase 1 registry implementation. Domain modules will continue to own
resource relationship translation.

Phase 3 may build a centralized resolver using `AuthorizationActor`, a
registered `CapabilityKey`, an explicitly supported scope, and an execution
channel. That resolver must preserve the separation between role,
authentication, account/workforce lifecycle, domain relationships, business
rules, and transactions. No Phase 2 or Phase 3 behavior is implemented here.
