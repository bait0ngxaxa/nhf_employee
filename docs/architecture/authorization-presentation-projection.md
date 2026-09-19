# Authorization presentation capability projections

Phase 12H-A target note: these projection records describe current/historical
presentation behavior and do not make the role-neutral target runtime live.
Presentation visibility is never authority. The future ADMIN target and
migration ledger are authoritative in
[authorization-phase-12ha-role-neutral-contract.md](./authorization-phase-12ha-role-neutral-contract.md).

Status: Routine Phase 5C and Stock Phase 6B/6C closed; Leave Phase 7A/7B/7C
closed; Employee Phase 8A/8B/8C and Phase 12C.2 additive policy migration
closed; Phase 9A/9B/9C Department, Audit and Notification integration closed;
Phase 12C.3 Routine, Phase 12C.4 Stock, Phase 12C.5 Leave, and Phase 12D
Routine deferred-capability additive policy migrations closed; Phase 12E
effective-access Administration UX is closed; Phase 12F full authorization
regression/security matrix is closed; Phase 12G-B First Production Capability
Deployment Readiness is implementation-complete and awaits production
operational acceptance.

This record defines the server-derived presentation contracts added for the
Routine, Stock, Leave, and Employee authorization migrations. These projections do not
replace the locked authorization source-of-truth or server-side enforcement.
The Routine and Stock sections retain their completed migration records; the
Leave Phase 7B section records the projection and the Phase 7C section records
the final production-surface closure and regression hardening. The Employee
Phase 8B section records the Dashboard projection and the Phase 8C section
records the final complete-surface audit and regression hardening. Phase 9B is
recorded in
[authorization-remaining-presentation-migration.md](authorization-remaining-presentation-migration.md).

## Phase 12E Administration effective-access inspection

The Authorization Administration User detail now includes a bounded,
server-derived effective-access projection in addition to the unchanged raw
central resolver evidence. Each row is domain/context/channel aware and
separates Default Domain Policy, Additional resolver/system authority, and
Effective composed capability authority. The result is not a final resource,
relationship, lifecycle, or workflow decision.

The structural provider port is consumed by the Authorization Administration
application layer and bound by outer API composition. Department, Notification,
Employee, Routine, Stock, Leave, and Audit own their inspection policy and reuse
their runtime additive composition/channel rules. The generic authorization
core and React presentation contain no domain default matrix. The provider
emits only registered `DASHBOARD` and `LIFF_SELF_SERVICE` contexts; Routine
context variants, Stock's intentional LIFF processor behavior, Leave's
Dashboard-only cancellation decision, unsupported Routine LIFF export, and
deferred Email Request are represented explicitly.

The User inspector preserves source/origin and TEAM constraints, shows
domain-owned limitations, retains lifecycle caveats, filters by domain/state,
and revalidates after direct User grant mutations. Invalid resolver
configuration remains fail-closed. Full phase evidence is in
[authorization-phase-12e-effective-access-ux.md](authorization-phase-12e-effective-access-ux.md).

## Contract and ownership

`modules/routine/application/types.ts` owns the serializable
`RoutinePresentationCapabilities` contract:

```ts
interface RoutinePresentationCapabilities {
    canReadTasks: boolean;
    canCreateTasks: boolean;
    canUpdateTasks: boolean;
    canDeleteTasks: boolean;
    canReadOccurrences: boolean;
    canOverrideOccurrences: boolean;
    canReassignOccurrences: boolean;
    canChangeOccurrenceDueDate: boolean;
    canManageImports: boolean;
    canExportTasks: boolean;
    canReadSummary: boolean;
    canReadReference: boolean;
}
```

`getRoutinePresentationCapabilities()` is the one reusable server-side
Routine projection. It asks the central resolver for all 12 registered
capabilities through one `resolveMany()` call, then applies permanent Routine
default composition and the Routine execution-channel policy to each decision.
For a USER, the central resolver loads one shared authorization snapshot through
`loadMany()` before evaluation. Dashboard and LIFF code do not call the generic
authorization resolver directly and do not reproduce the Routine policy table.

Expected Routine authorization denial is projected as `false`. Configuration,
registry, persistence, and other system failures continue to propagate so a
real authorization defect is not hidden as an ordinary unavailable control.

## Dashboard path

```text
hybrid access cookie
  -> resolveAuthenticatedAccount()
  -> findCurrentEmployeeProjection()
  -> getRoutinePresentationCapabilities(
       { id: account.userId, role: account.role, email: account.email },
       employee.id,
     )
  -> CurrentUserProjection / AuthenticatedUser.routineCapabilities
  -> DashboardUser
```

The actor is constructed from the server-resolved account and active Employee
projection. The Dashboard channel is selected by the Routine command-actor
adapter. No client-provided role, capability, Team ID, or Employee ID is used.
Existing account/workforce eligibility and the Leave fields
`canApproveLeave` and `canViewLeaveReports` remain unchanged.

Phase 5B consumes the projection through this Dashboard path:

```text
server Routine projection
    -> AuthenticatedUser.routineCapabilities
    -> DashboardProvider menu filtering
    -> /dashboard/routine feature + read-capability route boundary
    -> Routine tabs and task/occurrence/import presentation controls
```

Routine navigation requires both the Routine feature flag and
`canReadTasks`. The direct Dashboard route preserves the normal login redirect,
redirects authenticated actors without `canReadTasks` to access denied, and
renders only when the feature and read capability are both available. The
operational `mine` and `all` tabs use `canReadTasks`; their distinction remains
server-scoped and is not reimplemented in the browser. Export visibility uses
`canExportTasks`, while the export API independently resolves
`routine.task.export`. Create, update,
lifecycle, delete, occurrence override, and import visibility use their
corresponding projection booleans together with existing resource projections
such as `task.canEdit` and `task.canDelete`.

Remaining role-derived Dashboard presentation is intentionally limited to the
existing ADMIN versus SELF_SERVICE editor contract and related management-tab
and detail metadata presentation. It does not authorize any migrated action.

Dashboard client components consume the already-established user projection.
They do not call the central authorization resolver or send capability
evaluation inputs from the browser.

## LIFF path

```text
LiffBootstrap
  -> establishLiffSession()
  -> verified LIFF workforce session
  -> GET /api/line/home
  -> getLiffCapabilities()
  -> one getRoutinePresentationCapabilities(..., mode: "LIFF_SELF_SERVICE")
  -> capability-aware LiffHomeResponse
  -> Routine home-card availability
  -> LiffRoutineApp
  -> granular task action visibility
```

`GET /api/line/home` resolves `getLiffCapabilities()` once and composes its
modules from that response. Routine is enabled only when the Routine feature
flag, `routineCapabilities.canReadTasks`, and
`routineCapabilities.canReadSummary` are true. The composition
helper does not resolve authorization again and does not introduce a second
policy table. Stock behavior remains unchanged; Leave behavior is recorded in
the Leave Phase 7B section below.

The existing `canCreateOwnRoutine` field remains in the LIFF contract for
compatibility and is derived as:

```text
canCreateOwnRoutine
  = Routine feature enabled
  AND routineCapabilities.canCreateTasks
```

`LiffRoutineApp` independently calls the trusted `fetchLiffHome()` contract
after `LiffBootstrap` is READY. It does not load Routine summary, task, or
reference data until the contract confirms module availability,
`canReadTasks`, and `canReadSummary`; reference forms additionally require
`canReadReference`. A denied or unavailable contract renders the existing stable
unavailable module view and makes no Routine data requests. Direct links and
focus query parameters follow the same gate.

Routine LIFF task presentation uses the granular projection as follows:

| Presentation | Rule |
|---|---|
| Read/task list/detail | `canReadTasks` and the existing self-service server/resource result |
| Create | `canCreateTasks` |
| Edit | `canUpdateTasks AND task.canEdit` |
| Delete | `canDeleteTasks AND task.canDelete` |
| Lifecycle mutation | `canUpdateTasks AND` the existing resource lifecycle eligibility; no broader access is inferred |
| Occurrence administration/import | Not exposed in LIFF; the LIFF self-service clamp keeps these capabilities unavailable |

The client also guards form opening, confirmation, submission, and stale open
state. These are presentation controls only; the LIFF routes and Routine
application remain authoritative for authentication, relationships, business
rules, and mutations.

The `/liff/routine` RSC page intentionally does not use the Dashboard page
guard pattern. LIFF session establishment happens in `LiffBootstrap` on the
client before child applications render, so the session may not exist while
the RSC page is rendered. The page only selects the existing feature-disabled
landing view or mounts `LiffRoutineApp`; capability and module authorization
happens after bootstrap through `/api/line/home`.

Dashboard and LIFF use different actor modes: Dashboard uses its Dashboard
channel, while LIFF explicitly uses `LIFF_SELF_SERVICE`. Routine task-read
presentation eligibility is context-sensitive: management uses
`CREATED + ASSIGNED`, work-item `mine` uses `ASSIGNED`, and work-item `all`
uses `ALL` for a normal USER without a configured grant. A normal USER's
configured supported grant is additive. A system ADMIN in LIFF is instead
constrained by the Routine self-service channel policy and does not gain
`routine.occurrence.override`,
`routine.occurrence.reassign`, `routine.occurrence.change_due_date`, or
`routine.import.manage` presentation access. Dashboard ADMIN behavior remains
the Phase 5B behavior. LIFF summary/reference projections remain available only
for self-service behavior; central/configured `ALL` authority is clamped before
the projection is exposed.

## Presentation visibility != authorization enforcement

These booleans are UX hints for future navigation, tabs, buttons, and module
availability. They are never a security boundary. Route/application
authorization, active account/workforce checks, resource relationships,
business rules, transactions, locks, and concurrency checks remain
authoritative on the server.

In particular, a global `canUpdateTasks` value means only that the actor may
have an applicable update scope. It does not authorize every task. The
resource-specific `task.canEdit` and `task.canDelete` projections remain
Routine-owned hints for individual resources, and mutation routes still
enforce their own decisions.

## Routine Phase 12D projection

The three capabilities that were deferred after Phase 12C.3 are now part of
the same permanent projection and the same bounded central batch:

| Projection | Server-owned meaning |
|---|---|
| `canExportTasks` | Dashboard export is eligible according to `routine.task.export`; LIFF is false because the registry is Dashboard-only. |
| `canReadSummary` | Summary is available; Dashboard view intent is still validated and authorized server-side as `mine`/`all`, while LIFF remains `ASSIGNED` self-service. |
| `canReadReference` | Reference is available; Dashboard Employee visibility remains `OWN`/`ALL` according to server policy, and LIFF continues to omit the Employee list. |

The booleans are presentation hints only. They do not turn a query parameter
into authority, expose an Employee list in LIFF, or replace the independent
server capability checks. The only registered deferred capabilities after
Phase 12D are `email.request.read` and `email.request.create`.

## Stock Phase 6B projection

สถานะ: **Phase 6A server enforcement closed; Phase 6B presentation projection closed; Phase 12C.4 additive policy migration closed**

Stock now owns the immutable `StockPresentationCapabilities` contract and
resolves it through the permanent Stock adapter and Phase 12B additive
composition used by server enforcement. The projection is batched with one `authorization.resolveMany()`
call per Dashboard current-user request or LIFF home request. It does not
replace route guards, resource relationships, Stock domain state or
transaction-time authorization.

```text
canReadCatalog
canReadOwnRequests / canReadAllRequests
canCreateRequests
canCancelOwnRequests / canCancelAnyRequests
canProcessRequests
canManageInventory
canExportReports
```

Dashboard constructs the trusted actor from the authenticated account and
current workforce projection with `DASHBOARD`. The current-user contract sends
`stockCapabilities` to `DashboardProvider`; Stock menu/direct-route access,
tab normalization, query scope, and controls use the individual booleans. In
particular, `scope=all` requires `canReadAllRequests`, while process,
cancel-any, inventory and export remain independent gates. A stale or
unauthorized `stockTab` is normalized to the first visible tab, or to the
stable unavailable state when no surface is usable.

LIFF `/api/line/home` constructs the Stock actor with `LIFF_SELF_SERVICE` and
returns the same granular shape. The legacy aliases are compatibility fields
derived only from it:

```text
canRequestStock = canReadCatalog && canCreateRequests
canProcessStockRequests = canProcessRequests
```

The LIFF Stock module is available when catalog read, own-request read or
processing is available. `LiffStockApp` obtains this trusted home contract
before loading catalog, mine or processing data, and its tabs, deep links and
mutation handlers repeat the global capability gates together with server
`availableActions` and resource/state eligibility. Session recovery refreshes
the home projection before another mutation attempt and never retries using a
stale snapshot.

Dashboard-only `stock.inventory.manage` and `stock.report.export` remain false
in LIFF because the registry does not support those capabilities on
`LIFF_SELF_SERVICE`. LIFF USER keeps requester defaults; LIFF ADMIN
intentionally remains processor-compatible, and an explicit USER process grant
is honored. The Routine LIFF ADMIN self-service clamp is not applied to Stock.
Read ALL never implies process or cancel ALL. Any remaining Stock role check is
descriptive only (for example, a role badge); it does not select a tab, query
scope, expose a control or authorize a mutation.

Stock server enforcement remains authoritative. Email Request, Settings and
other non-Routine/non-Stock presentation and authorization paths remain on
their existing compatibility behavior until their approved migration phases.
Routine and Employee behavior is unchanged by the Stock projection. After
Phase 12C.4, Stock defaults are permanent domain policy and the projection
composes them with configured resolver authority. The Phase 12E
Administration inspector now visualizes the complete Stock Default +
Additional + Effective result without changing Stock enforcement.

## Leave Phase 7B projection

สถานะ: **Phase 7A Leave server enforcement closed; Phase 7B Leave presentation projection complete**

Phase 7B adds a Leave-owned, server-derived presentation contract. It projects
the registered Phase 7A capability eligibility into immutable serializable
booleans for Dashboard and LIFF. It does not redesign Leave policy and does
not replace server authorization, resource relationships, workflow state,
transactions, or concurrency checks.

`modules/leave/application/types.ts` owns the contract:

```ts
interface LeavePresentationCapabilities {
    readonly canReadOwnRequests: boolean;
    readonly canReadAssignedApprovals: boolean;

    readonly canCreateOwnRequests: boolean;
    readonly canCancelOwnRequests: boolean;

    readonly canApproveAssignedRequests: boolean;
    readonly canDecideAssignedCancellations: boolean;

    readonly canRequestOwnNotTaken: boolean;
    readonly canConfirmAssignedNotTaken: boolean;

    readonly canManageApprovers: boolean;
}
```

`getLeavePresentationCapabilities()` makes exactly one
`authorization.resolveMany()` call for the eight registered Leave decisions in
`LEAVE_MIGRATED_CAPABILITIES`. It projects the two scopes of
`leave.request.not_taken` into the two corresponding fields. Each decision is
translated by the same Leave adapter (`buildLeaveCapabilityAuthorization`)
used by Phase 7A server enforcement, so the compatibility floor is not
duplicated in the presentation path. Only the existing `NO_APPLICABLE_GRANT`
compatibility behavior is reused. Expected channel/authorization denials
project to `false`; unknown capabilities, invalid configuration, persistence
failures, and structural/system failures propagate.

### Capability eligibility and Leave relationships

The projection is deliberately separate from Leave-owned resource/work
relationships:

```text
global capability eligibility
    + Leave resource/state/work relationship
    -> presentation surface or action hint
```

`canReadAssignedApprovals` is only a prerequisite. The Dashboard approval tab
also requires the existing `canApproveLeave` work/relationship hint. The LIFF
approval tab and approval list likewise require assigned-read capability and
the existing actionable effective-approver relationship. Exception approver
precedence, owner exclusion, effective assignment, actionable status, report
history, and participant access remain Leave-owned queries and server rules.
One action capability never implies another: approval read, approve,
cancellation decision, not-taken confirmation, and approver management remain
independent fields.

### Dashboard projection and presentation

The trusted current-user path is:

```text
authenticated account + active Employee projection
    -> Leave actor (DASHBOARD)
    -> getLeavePresentationCapabilities() [one resolveMany()]
    -> existing Leave relationship/report projection
    -> CurrentUserProjection / AuthenticatedUser / DashboardUser
```

My Leave data is requested only with `canReadOwnRequests`. Create, own cancel,
own not-taken request, assigned approve/reject, assigned not-taken confirmation,
and Dashboard cancellation decision controls each use their matching granular
field together with the existing domain action/state and effective-assignment
checks. Handlers repeat the presentation checks and stale open forms/dialogs
are closed or disabled when the projection changes.

The legacy Dashboard fields remain temporarily:

```text
canApproveLeave
    = leaveCapabilities.canReadAssignedApprovals
      AND existing Leave approval-surface relationship/work hint

canViewLeaveReports
    = existing manager/direct-report or original-approver-history projection
```

Reports are intentionally not represented by `LeavePresentationCapabilities`;
there is still no approved generic `leave.report.export` capability. Admin
recovery is also intentionally outside the generic contract and continues to
use the existing Admin-only Leave recovery presentation rule. In particular,
`canManageApprovers` does not imply recovery or approval authority; an explicit
normal USER `leave.approver.manage / ALL` grant can expose approver settings
without exposing recovery.

### LIFF projection and presentation

`getLiffCapabilities()` builds the trusted actor from the verified LIFF
session's account and `employeeId`, with `LIFF_SELF_SERVICE`, and calls the
same Leave projection as Dashboard. `/api/line/home` returns
`leaveCapabilities` inside `LiffCapabilities` before capability-dependent
Leave data is loaded. The Leave home module is available only when Leave is
enabled and at least one of own-read or assigned-read is true.

The legacy LIFF aliases remain for compatibility:

```text
canRequestLeave
    = Leave feature enabled
      AND canReadOwnRequests
      AND canCreateOwnRequests

canApproveLeave
    = Leave feature enabled
      AND canReadAssignedApprovals
      AND existing actionable effective-approver relationship hint
```

Own profile/history is loaded only with own-read capability. The approval list
is loaded only with assigned-read capability and actionable work. LIFF action
buttons intersect server-provided `availableActions` with the matching global
capability for employee cancellation/not-taken and normal approve/reject/not-
taken confirmation actions. Participant/detail deep links remain governed by
the existing server participant boundary and are not rejected solely because a
generic read boolean is false.

The LIFF cancellation decision exception is explicit: the registry supports
`leave.cancellation.decide` only on Dashboard, so
`canDecideAssignedCancellations` is false in LIFF. `CONFIRM_CANCELLATION` and
`REJECT_CANCELLATION` continue to use the server's `availableActions`, the
effective-approver relationship, and Phase 7A Leave-domain enforcement. LIFF
does not receive a fake capability, a channel bridge, or Admin recovery
override. After ambiguous session recovery, LIFF refreshes `/api/line/home`
first, replaces the capability snapshot, closes revoked controls, refreshes
only newly permitted data, and never retries with the old snapshot.

### Deferred policy and security boundary

Phase 7B does not migrate report/export, participant/detail, attachment,
manager/direct-report scope, or Admin recovery policy. All presentation
booleans are UX hints only. Every Leave route and application mutation remains
responsible for authentication, server-side authorization, resource
relationships, workflow/business rules, and transaction-time revalidation.

### Leave Phase 7C presentation closure

Phase 7C closes the Dashboard entry-point and deep-link presentation boundary
without adding a capability or changing Leave policy. The shared helper in
`constants/dashboard.ts` computes the five Leave tab visibilities from the
granular projection plus the existing Leave-owned projections:

```text
my-leave          -> canReadOwnRequests
approvals         -> canReadAssignedApprovals AND canApproveLeave relationship hint
recovery          -> existing Dashboard Admin recovery rule
reports           -> canViewLeaveReports
approver-settings -> canManageApprovers
```

`canAccessLeaveDashboard()` returns true only when at least one tab is usable:
own-read, assigned-read plus an existing approval relationship, the deferred
report relationship, the existing Admin recovery surface, or approver
management. `getAvailableMenuGroups()` and `DashboardProvider` use this same
decision. A direct `/dashboard/leave` request performs feature check, trusted
current-user projection, authentication redirect, availability denial, and
server-side tab normalization before rendering. An unavailable `leaveTab`
deep link therefore cannot select a hidden surface; a valid route with another
unavailable tab falls back to the first visible tab.

Explicit normal USER approver-management grants can expose the Dashboard and
approver-settings without exposing Admin recovery. Role checks remain only for
the existing recovery relationship/presentation boundary and descriptive
identity; they are not replacements for migrated capabilities.

LIFF continues to load granular `leaveCapabilities` from `/api/line/home` and
combines them with server `availableActions` and effective resource/state
relationships. The Dashboard-only `leave.cancellation.decide` capability is
not projected as a LIFF permission: LIFF cancellation confirmation/rejection
continues through the documented Leave-domain exception. Session recovery
refreshes the trusted home projection and authorized data, and never retries
an ambiguous protected mutation. `canRequestLeave` and `canApproveLeave` remain
response-compatibility aliases only; the deprecated internal
`getLiffLeaveCapabilities()`/`LiffLeaveCapabilities` contract was removed after
the production-consumer audit, while
`getLiffLeaveRelationshipProjection()` remains canonical.

Reports/export, participant/detail, attachments, and Dashboard Admin recovery
remain explicitly deferred Leave-owned policy. No generic report, participant,
attachment, or recovery capability is implied by the presentation projection.

### Leave Phase 12C.5 additive projection update

The current Leave adapter replaces the historical compatibility translation with
the permanent additive composition path. `getLeavePresentationCapabilities()`
still makes exactly one batched `authorization.resolveMany()` call over
`LEAVE_CAPABILITIES`, then composes each resolver decision with the trusted
Leave Default Domain Policy. For an eligible normal USER with no configured
grant, the projection remains read-own, assigned-approval, create-own,
cancel-own, approve-assigned, Dashboard cancellation-decision,
own/assigned-not-taken, and no approver-management eligibility. A configured
grant can add scopes but cannot remove those defaults; ADMIN defaults remain
empty and central `SYSTEM_ROLE` authority is used.

`leave.cancellation.decide` remains registered for `DASHBOARD` only. The LIFF
projection therefore keeps `canDecideAssignedCancellations` false and does not
bridge `CHANNEL_NOT_SUPPORTED` or invent a LIFF capability. Effective
approver/resource/workflow checks, including exception-approver precedence and
owner exclusion, remain Leave-domain authorization rather than presentation
authority. The complete phase record is in
[authorization-phase-12c5-leave-additive-migration.md](authorization-phase-12c5-leave-additive-migration.md).

## Employee Phase 8B projection

สถานะ: **Phase 8A Employee server enforcement closed; Phase 8B Employee
Dashboard presentation projection closed; Phase 8C complete-surface audit and
regression hardening closed**

Employee owns the immutable, serializable seven-field
`EmployeePresentationCapabilities` contract:

```ts
interface EmployeePresentationCapabilities {
    readonly canReadEmployees: boolean;
    readonly canReadStats: boolean;
    readonly canCreateEmployees: boolean;
    readonly canUpdateEmployees: boolean;
    readonly canDeleteEmployees: boolean;
    readonly canImportEmployees: boolean;
    readonly canExportEmployees: boolean;
}
```

`getEmployeePresentationCapabilities()` calls
`authorization.resolveMany()` exactly once for all seven entries in
`EMPLOYEE_CAPABILITIES`. Each decision is composed through the same
`composeAuthorizationAuthority()` path used by Phase 12C.2 server
authorization. The permanent default gives an eligible normal USER
read/stats/export and gives no default authority to create/update/delete/import;
an ADMIN gets all seven from the central `SYSTEM_ROLE / ADMIN` decision; and
an explicit USER grant enables only its matching mutation field while never
narrowing the read baseline. Expected denials project to `false`; unknown
capabilities, omitted decisions, invalid configuration and resolver or
persistence failures propagate rather than becoming a misleading ordinary
denial. The returned object is frozen.

The trusted Dashboard path is:

```text
authenticated account
  -> active Employee projection
  -> Employee AuthorizationActor / DASHBOARD with current employeeId
  -> one getEmployeePresentationCapabilities() resolveMany()
  -> CurrentUserProjection / AuthenticatedUser / DashboardUser
  -> DashboardProvider and Employee Dashboard presentation
```

`getCurrentUserProjection()` builds the Employee actor from the server account
and current Employee projection. It returns `employeeCapabilities` through
the canonical current-user contract used by `/api/auth/me`; clients do not
resolve capabilities and no Employee capability endpoint was added.

Employee Dashboard navigation and controls use independent fields: the
management entry requires `canReadEmployees` or `canReadStats`; list/search/
pagination uses `canReadEmployees`; stats uses `canReadStats`; add/import/edit/
export use `canCreateEmployees`, `canImportEmployees`, `canUpdateEmployees`,
and `canExportEmployees` respectively. `getAvailableMenuGroups()` and
`DashboardProvider.handleMenuClick()` apply these checks without changing the
generic `requiredRole: ADMIN` behavior for unrelated Email Request items. The
direct Add Employee and Import Employee pages use a small trusted
server-side capability guard and preserve login, access-denied and render
outcomes.

EmployeeProvider uses conditional SWR keys and refreshes only permitted list
and stats resources. Export and edit handlers repeat their capability checks,
and a revoked update capability closes an open edit surface. The list/stats/
export query scope, CSV shape, filters, row limits and audit behavior are
unchanged.

`canDeleteEmployees` is projected and carried through the current-user
contract, but no existing Employee delete/offboarding presentation control was
found. Phase 8B intentionally adds no delete UI or workflow. Every projection
and UI decision above is presentation/data-minimization behavior only;
Employee routes and application authorization remain authoritative on the
server. Phase 8C confirmed the main `/dashboard/employees` RSC boundary,
direct-route parity, complete Employee production call-site coverage,
capability-aware loading/revalidation, role-check classification, the
unreachable export-without-read state under the locked registry, and the
absence of an existing Employee delete/offboarding UI. The focused Employee
regression suites, typecheck, strict lint, and architecture check passed;
details are recorded in
[authorization-employee-migration.md](authorization-employee-migration.md).

Employee Phase 8C is closed for the historical production surface, and Phase
12C.2 is closed for its permanent additive authorization policy. This does not
change the independent `employee.export` authority, broad read/stats/export
policy, or any deferred Team policy. The Phase 12E resolver-level/effective
access inspector now displays the final composed Employee capability scopes
while preserving the raw resolver result.

## Phase 9B remaining-domain presentation closure

Phase 9B adds the Department, Audit and Notification presentation projections
listed in [authorization-remaining-presentation-migration.md](authorization-remaining-presentation-migration.md).
Department reference-data loading in Employee Add/Edit is capability-aware;
Audit menu, stale menu clicks and direct route entry use `auditCapabilities`;
Notification Navbar/page entry uses `canReadInbox`, while read-state mutation
controls and side effects require the independent `canUpdateInbox` field.
The current-user projection resolves these domain capabilities after the active
Employee lifecycle check and batches independent projection work. Phase 9A
server authorization remains authoritative, Phase 9C is closed for the current
production surface, Email Request remains deferred, and Phase 12C.3 records
the permanent Routine presentation composition.
