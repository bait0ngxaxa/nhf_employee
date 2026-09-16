# NHF Employee — Authorization Phase 12A: Additive Default Policy Contract Lock

Status: CLOSED — architecture contract and inventory only

Audit baseline: main commit 07cec1aa0427c50acbf4dc408b506aaad1c9be0f

Date: 2026-09-16

This document records the Phase 12A product-policy decision and the
code-owned authorization inventory. It does not implement the Phase 12B
runtime composition. The current resolver, domain adapters, routes,
presentation projections, database schema, and seed behavior remain unchanged.

The repository has never deployed the Team/capability authorization
architecture to production. This phase therefore requires no production grant
inventory, historical-grant reconciliation, migration, seed, backfill, or
default-Team creation. The repository seed configuration is also empty; that
configuration is source evidence and is not a production inventory.

## 1. Phase goal and status

Phase 12A locks the permanent meaning of existing NHF user behavior and
defines how future configured capability grants will be composed with it. It
also re-audits the current registry, administration catalog, adapters, query
predicates, workflow checks, and deferred surfaces.

The scope is deliberately limited to:

- recording the permanent Default Domain Policy;
- recording configured Team, TeamRole, and exceptional direct User grant
  semantics;
- recomputing and documenting the current capability classification;
- identifying every current Default Domain Policy candidate;
- identifying current central-only additive capabilities;
- recording deferred non-IT surfaces for Phase 12D; and
- defining the acceptance contract for Phase 12B and later phases.

No production authorization semantics are changed by Phase 12A.

## 2. Locked architecture decision

The permanent authorization model is:

~~~text
Authenticated Identity
        |
        v
System Role
        |
        +---- ADMIN -> highest system authorization authority
        |
        v
Default Domain Policy
(existing NHF business behavior)
        +
Configured Capability Grants
(Team + TeamRole + exceptional direct User grants)
        |
        v
Effective Authorization
        |
        v
Domain Resource / Relationship Policy
        |
        v
Business / Workflow Invariants
        |
        v
ALLOW / DENY
~~~

For a normal USER:

~~~text
effective authority
= default domain authority
UNION configured additive grants
~~~

The closure invariant is:

> Existing NHF user behavior is now a permanent Default Domain Policy, not a
> temporary compatibility behavior scheduled for retirement. Configured Team,
> TeamRole, and direct User capability grants are additive authority layered on
> top of that baseline. No configured grant may implicitly narrow the default
> authority.

This is a product-policy lock. The names compatibility and compatibility
fallback continue to describe the current implementation mechanics until a
later phase changes them deliberately.

## 3. Current runtime semantics (as-is)

The current implementation is not yet the Phase 12B composition:

1. The registry validates capability keys, supported scopes, and execution
   channels.
2. The central resolver returns registered capability authority for ADMIN and
   applicable persisted grants for USER.
3. ADMIN is resolved from the registered capability definition and does not
   need Team membership or a configured grant.
4. USER Team, TeamRole, and direct User grants are unioned by the central
   resolver, with active membership/lifecycle and origin checks.
5. For migrated domains, the adapter may translate exactly
   NO_APPLICABLE_GRANT into the existing compatibility fallback.
6. CENTRAL_ONLY capabilities have no normal USER fallback. An ungranted USER
   has no default authority for those operations.
7. DEFERRED paths remain domain-owned or legacy paths and do not acquire a new
   central grant behavior in this phase.
8. Domain queries, resource predicates, relationship checks, workflow rules,
   and transaction/concurrency checks run after the capability boundary.

The current compatibility branch can use an explicit allowed resolver result
without first unioning it with the fallback. That is current implementation
state, not the locked product policy. Phase 12B must introduce the additive
composition contract so a narrower configured grant cannot narrow a normal
USER's existing baseline. Phase 12A does not alter this runtime behavior.

The current RuntimeAuthorizationMode, administration readiness values,
resolver APIs, compatibility functions, and capability identifiers remain
unchanged.

## 4. Permanent Default Domain Policy

Default Domain Policy is the exact existing NHF business behavior for a
trusted actor, registered capability, supported channel, and valid domain
context before configured capability grants are added. It includes more than
a scope label:

- actor and account/workforce lifecycle prerequisites;
- channel and entry-point restrictions;
- default operation scope;
- path/context-specific behavior;
- resource and relationship predicates;
- query-to-scope translation;
- domain-specific data visibility;
- workflow/state-machine rules;
- validation, transaction, concurrency, and idempotency invariants; and
- intentional LIFF/self-service restrictions.

The policy is owned by the domain adapter and domain module. It is not
reconstructed from Team membership, Department, manager, position, title, or
seeded grants.

A USER with no configured capability grants must not need:

- a seed grant;
- a default Team;
- a default Team membership;
- a backfilled User grant; or
- a migration-created compatibility record

to reproduce the existing behavior.

The candidate matrix in Section 11 records the current behavior that Phase
12B/12C must preserve. It records behavior; it does not redesign broad
Employee visibility, Routine scope, Stock ownership, Leave workflow, or any
other domain policy.

## 5. Configured Capability Grant

A configured grant is a validated ALLOW authority source for a registered
capability and supported scope. Applicable configured sources are:

- a Team-sourced grant, retaining source/origin metadata for the originating
  Team;
- a TeamRole-sourced grant, retaining source/origin metadata for its
  originating Team and TeamRole; and
- an exceptional direct User grant.

Only a grant whose scope is TEAM carries a Team resource constraint. For that
scope, the constraint identifies the originating Team. A non-TEAM grant
retains its Team or TeamRole source/origin metadata but does not gain an
implicit Team resource constraint.

The central resolver remains responsible for loading and validating these
sources, applying active Team/TeamRole/membership rules, and retaining
source/origin information. Domain modules remain responsible for interpreting
the resulting authority against their resources.

Configured grants are additive. They are not overrides, replacement policies,
priority rules, or a second business-rule engine.

## 6. Additive composition invariants

The following invariants are locked:

1. A no-grant USER has the exact existing NHF behavior.
2. A configured grant may increase authority but can never reduce default
   authority.
3. Revoking one Team, TeamRole, or direct User grant removes only authority
   originating from that source.
4. Revoking all configured grants restores the Default Domain Policy.
5. Multiple applicable Team, TeamRole, and direct User grants are unioned.
6. There is no explicit DENY grant, deny precedence, negative permission,
   wildcard permission, ABAC rule, policy DSL, or priority-based conflict
   resolution.
7. A narrower configured scope never narrows a broader default scope.
8. A broader configured scope can expand the effective scope, subject to
   domain resource, relationship, workflow, channel, lifecycle, and
   transaction rules.
9. Scope normalization preserves existing ALL semantics: if ALL is present,
   the normalized scope has ALL semantics.
10. Scope normalization must not discard grant source, Team origin, or
    constraint data needed by resource policy.

Examples:

~~~text
default: CREATED + ASSIGNED
grant:   CREATED
effective: CREATED + ASSIGNED

default: OWN
grant:   ALL
effective: ALL
~~~

## 7. ADMIN semantics

ADMIN remains the highest coarse system-level authorization authority. ADMIN
does not require Team membership or a configured grant.

ADMIN authority must not bypass:

- authentication;
- active/deleted account lifecycle;
- active Employee/workforce lifecycle where the entry point requires it;
- capability channel restrictions;
- input validation;
- workflow/state-machine rules;
- transactional and concurrency invariants;
- intentional domain-specific relationship rules; or
- intentional LIFF/self-service restrictions.

An ADMIN capability result is therefore not an unrestricted business-rule
bypass. Domain-owned resource and workflow checks remain authoritative.

The current code contains a few Admin-only compatibility/lifecycle seams,
including lower application seams that can be Employee-optional. Those seams
are not normal USER Default Domain Policy and do not change the ADMIN rule
above.

## 8. Team, TeamRole, and User source semantics

Team is an independent authorization grouping:

~~~text
Department != Team
~~~

No Team membership or authority may be inferred from Department, manager,
position, job title, or Employee hierarchy. No automatic Team assignment is
part of Phase 12A.

All active applicable sources union together. A direct User grant remains an
exceptional source, not a replacement for Team governance. Inactive Teams,
inactive TeamRoles, and removed memberships contribute no configured
additional authority.

### 8.1 TEAM origin is mandatory

TEAM scope is origin-bound. A TEAM-scoped grant must retain the originating
Team resource constraint. A Team-sourced or TeamRole-sourced grant with a
non-TEAM scope retains source/origin metadata but does not gain a Team
resource constraint. A direct User grant must not provide TEAM scope without a
Team origin. A TeamRole-sourced grant must retain both its Team and TeamRole
origin metadata.

The existing evaluator/resolver already rejects direct TEAM grants and rejects
origin mismatches as structural authorization configuration failures. Phase
12B must preserve this information when it composes default and configured
authority. Effective authorization cannot safely be represented only as:

~~~text
AuthorizationScope[]
~~~

when resource-policy evaluation depends on Team origin. An effective result
must retain the source/grant and origin/constraint metadata, or an equivalent
trusted representation.

### 8.2 Structural failures are fail-closed

Default Domain Policy is considered only after trusted identity, registered
capability, supported execution channel, and valid authorization
configuration boundaries pass.

The following must never become an allow through default-policy fallback:

- unknown capability;
- unsupported execution channel;
- invalid persisted capability;
- unsupported persisted scope;
- Team/TeamRole origin mismatch;
- direct TEAM scope without origin; or
- any other invalid authorization configuration.

A structural denial or configuration error remains a denial/error. It is not
the same as a valid USER with no applicable configured grant.

## 9. Domain responsibility boundary

The central resolver owns configured grant resolution. It does not own domain
business policy.

Domain modules continue to own:

- default behavior;
- relationship semantics;
- scope-to-query translation;
- resource predicates;
- actor-derived ownership;
- workflow and state transitions;
- recovery and exception rules; and
- transaction/concurrency invariants.

The final decision path is intentionally layered:

~~~text
trusted authentication/lifecycle
  -> registered capability and supported channel
  -> configured grant resolution
  -> domain default policy composition
  -> resource/relationship policy
  -> business/workflow invariants
~~~

Presentation projections, menu visibility, disabled controls, route
visibility, and client-supplied identity/role data are not authorization
boundaries.

## 10. Verified capability inventory

The inventory was recomputed from the current code-owned
CAPABILITY_DEFINITIONS registry and CAPABILITY_ADMINISTRATION_METADATA
administration catalog, then cross-checked against the adapter migration
sets and the administration catalog tests. The result is:

| Runtime mode | Count | Meaning |
| --- | ---: | --- |
| CENTRAL_WITH_COMPATIBILITY | 22 | Central resolver plus current adapter fallback for a normal USER with NO_APPLICABLE_GRANT |
| CENTRAL_ONLY | 13 | Central resolver authority; no normal USER compatibility/default fallback |
| DEFERRED | 5 | Registered shape retained, but current application path is not consistently centrally backed |
| Total registered | 40 | All current registry definitions |

The catalog readiness projection is therefore 13 GRANTABLE,
22 POLICY_ACTIVATION_REQUIRED, and 5 DEFERRED. This is a code inventory, not
a production grant inventory.

### 10.1 Inventory by domain

| Domain | Total | CENTRAL_WITH_COMPATIBILITY | CENTRAL_ONLY | DEFERRED |
| --- | ---: | ---: | ---: | ---: |
| Employee | 7 | 3 | 4 | 0 |
| Department | 1 | 1 | 0 | 0 |
| Routine | 12 | 5 | 4 | 3 |
| Stock | 7 | 4 | 3 | 0 |
| Leave | 8 | 7 | 1 | 0 |
| Audit | 1 | 0 | 1 | 0 |
| Email | 2 | 0 | 0 | 2 |
| Notification | 2 | 2 | 0 | 0 |
| Total | 40 | 22 | 13 | 5 |

### 10.2 CENTRAL_WITH_COMPATIBILITY

The exact current compatibility-backed set is:

| Domain | Capabilities |
| --- | --- |
| Employee | employee.read, employee.stats.read, employee.export |
| Department | department.read |
| Routine | routine.task.read, routine.task.create, routine.task.update, routine.task.delete, routine.occurrence.read |
| Stock | stock.catalog.read, stock.request.read, stock.request.create, stock.request.cancel |
| Leave | leave.request.read, leave.approval.read, leave.request.create, leave.request.cancel, leave.request.approve, leave.cancellation.decide, leave.request.not_taken |
| Notification | notification.inbox.read, notification.inbox.update |

The classification means the current adapter has an audited
NO_APPLICABLE_GRANT fallback for the audited normal USER application path. It does not
mean that ordinary configured grants are currently activated: the catalog
readiness remains POLICY_ACTIVATION_REQUIRED.

### 10.3 CENTRAL_ONLY

The exact current central-only/additive set is:

| Domain | Capabilities |
| --- | --- |
| Employee | employee.create, employee.update, employee.delete, employee.import |
| Routine | routine.occurrence.override, routine.occurrence.reassign, routine.occurrence.change_due_date, routine.import.manage |
| Stock | stock.inventory.manage, stock.request.process, stock.report.export |
| Leave | leave.approver.manage |
| Audit | audit.read |

For a normal USER, the default authority for these capabilities is empty.
Configured authority is therefore conceptually additive already. ADMIN
receives registered system-role authority subject to channel, lifecycle,
resource, relationship, and workflow rules. Admin-only compatibility branches
in an adapter do not create a USER default.

### 10.4 DEFERRED

The exact current deferred set is:

| Domain | Capabilities | Current status |
| --- | --- | --- |
| Routine | routine.task.export, routine.summary.read, routine.reference.read | Registered, but current operations remain deferred legacy/domain paths |
| Email Request / future IT | email.request.read, email.request.create | Explicitly deferred; outside the Phase 12 roadmap |

No deferred capability is activated or redesigned by Phase 12A.

## 11. Default Domain Policy candidate matrix

The following matrix identifies the exact current no-grant USER behavior that
must become the permanent default policy. The scope names are not the whole
policy: the listed relationship, path, channel, lifecycle, and workflow
constraints remain part of the behavior.

### 11.1 Employee

| Capability | Current no-grant USER baseline | Domain/resource behavior that must remain |
| --- | --- | --- |
| employee.read | ALL | Eligible authenticated workforce boundary; list is organization-wide, paginated, excludes deleted Employees and bootstrap Admin accounts, and preserves existing filters/query shape. |
| employee.stats.read | ALL | Existing aggregate counts remain unchanged, including the current count/query behavior and department/status buckets. This phase does not redesign broad Employee data visibility. |
| employee.export | ALL | Eligible authenticated workforce boundary; CSV uses the existing non-deleted/non-bootstrap filtered Employee query, fields, and export limits. Broad PII/HR policy is not narrowed here. |

### 11.2 Department

| Capability | Current no-grant USER baseline | Domain/resource behavior that must remain |
| --- | --- | --- |
| department.read | ALL | An eligible user may read the Department reference list using the existing ordered Department query. Department is reference data and is not a Team or a source of Team authority. |

### 11.3 Routine

Routine is path- and context-sensitive. Its default policy must not be
collapsed into one scope string.

| Capability | Current no-grant USER baseline | Domain/resource behavior that must remain |
| --- | --- | --- |
| routine.task.read | Management view: CREATED + ASSIGNED; work-item mine: ASSIGNED; work-item all: ALL | Management list/detail and work-item queries retain creator/active-assignee predicates, requested view semantics, active task rules, source metadata redaction, and focus/deep-link relationship checks. LIFF forces self-service/mine behavior and retains creator/task-assignee/occurrence-assignee restrictions. |
| routine.task.create | OWN | Actor identity and Employee context are server-derived; task ownership/assignment normalization, validation, active lifecycle, and transaction invariants remain domain-owned. |
| routine.task.update | CREATED + ASSIGNED | Creator and assignee permissions remain operation-specific; target Employee lifecycle, editable fields, state, and optimistic/concurrency checks remain enforced. |
| routine.task.delete | CREATED | Creator/resource relationship remains required; deletion state and transaction rules remain enforced. |
| routine.occurrence.read | ASSIGNED | Occurrence assignment is evaluated at occurrence level and is not silently replaced by task assignment; active-task and route/path checks remain. |

The current explicit USER grant path and current fallback behavior must not be
used to justify narrowing the management/work-item default in Phase 12B.

### 11.4 Stock

| Capability | Current no-grant USER baseline | Domain/resource behavior that must remain |
| --- | --- | --- |
| stock.catalog.read | ALL | Existing active catalog/item/category and availability queries remain broad within their current filters; catalog visibility does not imply request processing authority. |
| stock.request.read | OWN | Normal USER requests are filtered by server-derived requester identity. Dashboard requested scope and Admin behavior remain domain/channel-specific; LIFF forces mine. ALL may broaden only when effective authority and the existing detail predicates permit it. |
| stock.request.create | OWN | Requester identity is server-derived; active workforce, item/quantity/stock, validation, transaction, and notification invariants remain. |
| stock.request.cancel | OWN | Normal USER may act on own eligible pending requests; status, ownership, transaction, notification, and concurrency checks remain. |

### 11.5 Leave

Leave scope is separate from Leave relationship and workflow policy.

| Capability | Current no-grant USER baseline | Domain/resource/workflow behavior that must remain |
| --- | --- | --- |
| leave.request.read | OWN | The actor's own requests remain the default readable set; participant, detail, attachment, lifecycle, and feature boundaries remain Leave-owned. |
| leave.approval.read | ASSIGNED | Assigned means the effective Leave approver relationship, including exception-approver precedence and actionable/history query semantics. It does not authorize arbitrary Leave approval. |
| leave.request.create | OWN | Active Employee identity, date/overlap/quota validation, transaction, and workflow rules remain. |
| leave.request.cancel | OWN | Request ownership, cancellable state, dates, and transaction/workflow rules remain. |
| leave.request.approve | ASSIGNED | The actor must still be the effective approver for the request and pass Leave state/quota/workflow checks. ASSIGNED is not a generic approval bypass. |
| leave.cancellation.decide | ASSIGNED on DASHBOARD; unavailable on LIFF | Effective approver relationship and cancellation state remain; the Admin recovery/override path is Dashboard-only and remains constrained by Leave domain rules. |
| leave.request.not_taken | OWN + ASSIGNED | Owner/effective-approver relationships, state transitions, recovery behavior, and confirmation rules remain. Admin recovery is not an unrestricted ALL grant. |

In particular, a future configured ASSIGNED grant must not be documented as
automatically approving any arbitrary Leave request.

### 11.6 Notification

| Capability | Current no-grant USER baseline | Domain/resource behavior that must remain |
| --- | --- | --- |
| notification.inbox.read | OWN | The authenticated actor's user ID is supplied by the server and is used in persistence predicates. Pagination/history does not mean cross-user ALL access. |
| notification.inbox.update | OWN | Read/update authority remains actor-derived and independent; the notification repository continues to constrain updates to the actor's user ID. |

The current Notification adapter intentionally rejects ALL for inbox
operations. The permanent default is actor-derived OWN, not a generic
organization-wide inbox.

### 11.7 Presentation projection audit

Presentation projections were included in the re-audit because they expose
capability-shaped UI state but do not replace server authorization:

| Domain | Current projection behavior | Phase 12A interpretation |
| --- | --- | --- |
| Employee | One batched projection covers the seven registered Employee capabilities and exposes granular read/stats/create/update/delete/import/export fields. | UI controls reflect current resolver/compatibility results; Employee API, lifecycle, query, and transaction checks remain authoritative. |
| Department | The Department projection derives canReadDepartments from department.read with ALL semantics. | It gates presentation loading only; it does not turn Department into Team authority. |
| Routine | Migrated task/occurrence/management controls use registered capability projections and retain Dashboard versus LIFF context. Deferred summary/reference behavior is not promoted by the projection. | Context-sensitive query and relationship policy remains authoritative; LIFF self-service restrictions remain intact. |
| Stock | The Stock projection is granular and derives requester mine/all controls from the requested context; legacy aliases remain presentation conveniences. | Catalog, request ownership, processing, inventory, report, and transaction checks remain independent server decisions. |
| Leave | The projection covers the eight registered Leave capabilities; report visibility, Admin recovery, and effective-approver relationships remain separate, and the LIFF cancellation channel restriction is preserved. | A capability-shaped boolean never bypasses Leave relationship, workflow, report, attachment, or recovery policy. |
| Notification | Read and update are independent projected fields and both retain actor-derived OWN semantics. | Read does not imply update, and presentation state does not authorize another user's inbox. |
| Audit | Dashboard audit capability projection is derived from audit.read. | The server capability check and audit query/resource boundary remain authoritative; export-event logging is separate instrumentation. |

## 12. Central-only additive capability matrix

These capabilities have no normal USER compatibility/default fallback in the
current code. They are therefore already structurally aligned with:

~~~text
default authority is empty
+ configured grant
= additional authority
~~~

| Domain | Capability | Normal USER without grant | ADMIN/current domain boundary |
| --- | --- | --- | --- |
| Employee | employee.create | No default authority | Central registered authority, then Employee lifecycle/validation/transaction rules |
| Employee | employee.update | No default authority | Central registered authority, then target lifecycle and transaction rules |
| Employee | employee.delete | No default authority | Central registered authority, then offboarding/lifecycle/transaction rules |
| Employee | employee.import | No default authority | Central registered authority, then import validation, partial-success, audit, and transaction rules |
| Routine | routine.occurrence.override | No default authority | Central registered authority, then occurrence/state/resource rules |
| Routine | routine.occurrence.reassign | No default authority | Central registered authority, then assignee lifecycle and transaction rules |
| Routine | routine.occurrence.change_due_date | No default authority | Central registered authority, then date/state/concurrency rules |
| Routine | routine.import.manage | No default authority | Central registered authority, then import validation and domain invariants |
| Stock | stock.inventory.manage | No default authority | Central registered authority, channel boundary, stock/concurrency rules |
| Stock | stock.request.process | No default authority | Central registered authority, processor/resource/status/stock rules |
| Stock | stock.report.export | No default authority | Central registered authority, Dashboard channel and report/query rules |
| Leave | leave.approver.manage | No default authority | Central registered authority, active workforce and Leave assignment rules |
| Audit | audit.read | No default authority | Central registered ALL authority, then audit resource/query boundaries |

Phase 12A does not alter the catalog readiness or enable any of these
capabilities beyond the current implementation.

## 13. Deferred non-IT authorization surfaces

These findings are inputs for Phase 12D or a later domain-owned decision. They
are not new capability designs and are not implemented in Phase 12A.

| Surface | Current code behavior | Later boundary |
| --- | --- | --- |
| routine.task.export | Registered but DEFERRED. The export path uses the deferred domain/export mode and currently exports the active task set according to its route limits and format/audit behavior; it does not resolve routine.task.export centrally. | Phase 12D must decide policy and migrate the complete export path atomically with query, UI, audit, and grant readiness. |
| routine.summary.read | Registered but DEFERRED. Summary remains on the legacy/domain path; Dashboard defaults differ for Admin and USER, and the existing scope=all behavior can be organization-wide for a regular USER. LIFF forces self-service/mine. | Phase 12D must trace summary scope, resource predicates, and channel semantics before selecting a policy. |
| routine.reference.read | Registered but DEFERRED. Active units/categories are broadly read; Dashboard employee reference visibility differs for Admin and non-Admin; LIFF omits the employee list and uses a self-service context. | Phase 12D must decide whether a capability is needed and preserve the LIFF data-minimization boundary. |
| Leave report/export | No registered generic report capability. The route has an active-workforce boundary and domain-owned report scopes: current-team uses active direct-manager relationships; approver-history uses original approver identity and can include historical rows. | Remains Leave-owned/deferred until the business meaning of reports and effective/original approver history is decided. Do not invent a capability name from the route alone. |
| Leave participant/detail/attachment surfaces | Access remains relationship- and participant-based, with private attachment checks separate from generic capability scope. | Remains domain-owned; do not replace the relationship policy with a generic scope. |
| Leave unavailable-approver recovery | Recovery uses effective-approver availability and constrained Admin recovery behavior. | Remains Leave workflow policy; a capability grant is not a recovery bypass. |
| Leave LIFF cancellation decision | leave.cancellation.decide is registered with Dashboard-only support; LIFF behavior remains a channel/domain boundary rather than an implicit allow. | Revisit only with the Leave migration policy; do not broaden the channel in 12A. |
| Audit export-event logging | The audit-log export endpoint records an authenticated event and is not itself a data-read/export authority. | Keep instrumentation separate from audit.read until a later policy explicitly covers it. |

Explicitly deferred and outside this phase and the current Phase 12 roadmap:

- email.request.read and email.request.create;
- Email Request routes and UI;
- the future IT module;
- any production capability grant inventory; and
- any automatic organizational-to-Team mapping.

Employee PII policy, Leave workflow redesign, broad Routine visibility
redesign, and generic report/participant capability design are also
non-goals. Phase 12A records their current behavior only.

## 14. Terminology lock

The implementation vocabulary and the permanent policy vocabulary are
intentionally different during the transition:

| Current runtime/catalog term | Permanent product-policy meaning |
| --- | --- |
| Compatibility fallback | Default Domain Policy |
| Compatibility floor | Existing baseline authority that must remain available without configured grants |
| CENTRAL_WITH_COMPATIBILITY | A current implementation classification for a capability whose normal USER baseline is still supplied by an adapter fallback |
| POLICY_ACTIVATION_REQUIRED | Current catalog readiness; not a statement that the permanent baseline will be retired |

Phase 12A does not mass-rename runtime types, functions, constants, adapter
helpers, or catalog values. It does not change RuntimeAuthorizationMode,
catalog readiness, or current resolver behavior. Phase 12B/12C may make a
focused implementation transition from temporary fallback mechanics to
permanent additive Default Domain Policy semantics.

Earlier Phase 0–11 closure documents remain historical records. Language in
those records about retiring, narrowing, or replacing compatibility describes
the decision state at the time and must not be rewritten as though it were
written under this Phase 12A lock.

## 15. Phase 12B implementation contract

For a normal USER, a registered capability, a supported execution channel,
and a trusted domain context, Phase 12B must implement the following logical
contract:

~~~text
defaultAuthority =
    domainDefaultPolicy(actor, capability, trustedDomainContext)

configuredAuthority =
    centralResolver(actor, capability)

effectiveAuthority =
    additiveUnion(defaultAuthority, configuredAuthority)
~~~

The central resolver result is configured authority, not by itself the final
domain/resource decision. ADMIN remains the separate highest system-role
authority described in Section 7.

The composition must satisfy:

| Inputs | Required effective result |
| --- | --- |
| default empty + grant empty | DENY / no authority |
| default non-empty + grant empty | Default authority |
| default empty + grant non-empty | Configured authority |
| default non-empty + narrower grant | Default authority remains; it is never narrowed |
| default non-empty + broader grant | Broader effective authority, subject to domain policy |
| multiple Team/TeamRole/User grants | Additive union of all applicable sources |
| one grant removed | Only that source's additional authority is removed |
| all configured grants removed | Default authority is restored |

Before composition, Phase 12B must enforce trusted identity, capability
registration, supported channel, and valid authorization configuration. It
must not convert a structural failure into a default allow.

If ALL is present, effective scope normalization must retain ALL semantics.
The implementation must retain source/origin metadata for every configured
Team/TeamRole grant, and must carry a Team resource constraint only for a
grant whose scope is TEAM. A flattened AuthorizationScope array is
insufficient wherever domain resource policy needs to evaluate Team origin.

The domain adapter must then apply resource/relationship predicates and
business/workflow invariants. A capability grant is never a workflow or
business-rule bypass.

## 16. Later Phase 12 boundaries

| Phase | Handoff |
| --- | --- |
| 12A | Contract + inventory only |
| 12B | Implement additive Default Policy + configured-grant composition |
| 12C | Migrate existing compatibility-backed domains and make them safely grantable: 12C.1 Department + Notification; 12C.2 Employee; 12C.3 Routine; 12C.4 Stock; 12C.5 Leave |
| 12D | Complete remaining non-IT deferred capability surfaces |
| 12E | Authorization Administration effective-access UX completion |
| 12F | Full authorization regression/security matrix |
| 12G | First production capability deployment readiness |

No later phase is implemented by this document.

## 17. Mandatory regression contract for later phases

The following are required acceptance tests for Phase 12B and subsequent
domain migrations:

~~~text
USER + no grants
= exact existing behavior

USER + Team grant
= existing behavior + Team authority

USER + TeamRole grant
= existing behavior + TeamRole authority

USER + direct User grant
= existing behavior + direct authority

USER + multiple grant sources
= additive union

narrower configured grant
= never narrows default behavior

broader configured grant
= expands authority

revoke one grant
= other authority remains

revoke all configured grants
= default behavior restored

inactive Team
= Team-derived additional authority removed

inactive TeamRole
= TeamRole-derived authority removed

membership removed
= Team-derived authority removed

ADMIN
= highest system authorization authority without Team/grants

capability grant
!= workflow/business-rule bypass

unsupported channel
= fail closed

invalid authorization configuration
= fail closed

LIFF/self-service restriction
= preserved where domain-owned

TEAM scope
= preserves Team origin/constraint
~~~

The regression matrix must include route/API, application-service,
transaction-time, query/resource, presentation-projection, and LIFF
boundaries where the capability is exposed. It must test both allow and
deny/error paths without treating UI visibility as authority.

## 18. Phase 12A Definition of Done

Phase 12A is complete when:

- the current registry/catalog inventory is recomputed and records 40 total,
  22 CENTRAL_WITH_COMPATIBILITY, 13 CENTRAL_ONLY, and 5 DEFERRED;
- every compatibility-backed capability has an exact Default Domain Policy
  candidate recorded;
- central-only additive capabilities are listed;
- deferred non-IT surfaces and their current domain behavior are recorded;
- Email Request and the future IT module remain explicitly deferred;
- the permanent additive composition and TEAM-origin contract is documented;
- structural authorization failures remain explicitly fail-closed;
- ADMIN, Department/Team separation, and domain responsibility boundaries are
  explicit;
- historical Phase 0–11 closure documents remain historical;
- living architecture documents link to and agree with this lock;
- no runtime authorization source has a semantic change;
- no Prisma schema, migration, seed, backfill, default Team, or production
  grant inventory has been added; and
- focused inventory/architecture checks and git diff checks pass.

The exact implementation target handed to Phase 12B is the contract in
Section 15: preserve each domain's recorded default behavior, resolve
configured grants centrally, union them without narrowing, retain source and
origin metadata for Team/TeamRole grants, apply Team resource constraints only
to TEAM-scoped grants, and leave resource, relationship, workflow,
authentication, lifecycle, channel, validation, transaction, and concurrency
rules in their owning boundaries.

## 19. Audit evidence

The re-audit used the following current code-owned sources:

- registry and catalog: modules/authorization/registry.ts,
  modules/authorization/application/administration-catalog.ts,
  modules/authorization/application/administration-types.ts;
- resolver/evaluator and grant contracts:
  modules/authorization/application/resolver.ts,
  modules/authorization/application/evaluator.ts,
  modules/authorization/application/types.ts;
- domain adapters:
  modules/employee/application/authorization.ts,
  modules/department/application/authorization.ts,
  modules/routine/application/authorization.ts,
  modules/stock/application/authorization.ts,
  modules/leave/application/authorization.ts,
  modules/notification/application/authorization.ts,
  modules/audit/application/authorization.ts;
- domain query/resource/workflow sources in the Employee, Routine, Stock,
  Leave, Department, Notification, and Audit modules; and
- the Phase 9–11 architecture and closure records.

The authoritative counts are derived from the current registry/catalog, not
from historical phase documents and not from an assumed production state.
