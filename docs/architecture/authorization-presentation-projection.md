# Phase 5C — Routine presentation capability projection

Status: Phase 5C LIFF integration complete

This record defines the server-derived presentation contract added for the
Routine authorization migration. It extends the Phase 4 Routine pilot; it does
not replace the locked authorization source-of-truth or server-side
enforcement. Phase 5A established the projection, Phase 5B integrated it into
the Dashboard, and Phase 5C integrates the same projection into the LIFF home
contract and Routine client.

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
}
```

`getRoutinePresentationCapabilities()` is the one reusable server-side
Routine projection. It asks the central resolver for all nine migrated
capabilities through one `resolveMany()` call, then applies the existing
Routine-owned Phase 4 composition to each decision. For a USER, the central
resolver loads one shared authorization snapshot through `loadMany()` before
evaluation. Dashboard and LIFF code do not call the generic authorization
resolver directly and do not reproduce the Phase 4 compatibility table.

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
server-scoped and is not reimplemented in the browser. Create, update,
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
modules from that response. Routine is enabled only when both the Routine
feature flag and `routineCapabilities.canReadTasks` are true. The composition
helper does not resolve authorization again and does not introduce a second
policy table. Stock and Leave module behavior remains unchanged.

The existing `canCreateOwnRoutine` field remains in the LIFF contract for
compatibility and is derived as:

```text
canCreateOwnRoutine
  = Routine feature enabled
  AND routineCapabilities.canCreateTasks
```

`LiffRoutineApp` independently calls the trusted `fetchLiffHome()` contract
after `LiffBootstrap` is READY. It does not load Routine summary, task, or
reference data until the contract confirms both module availability and
`canReadTasks`. A denied or unavailable contract renders the existing stable
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
channel, while LIFF explicitly uses `LIFF_SELF_SERVICE`. A system ADMIN in
LIFF therefore remains constrained to self-service task relationships and
does not gain `routine.occurrence.override`,
`routine.occurrence.reassign`, `routine.occurrence.change_due_date`, or
`routine.import.manage` presentation access. Dashboard ADMIN behavior remains
the Phase 5B behavior.

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

## Deferred and non-Routine behavior

`routine.summary.read`, `routine.task.export`, and `routine.reference.read`
remain outside this projection because their legacy policy is unresolved.
Dashboard Excel export, summary authorization, reference-data authorization,
and their existing compatibility presentation behavior therefore remain
unchanged; no new capability rule is invented for them. In particular, the
deferred policies remain deferred:

```text
routine.summary.read
routine.task.export
routine.reference.read
```

When the Routine module is legitimately available, the existing LIFF summary
and reference compatibility behavior is preserved; the home gate only keeps
actors without Routine read availability from reaching those requests through
the Routine UI.

## Stock Phase 6B projection

สถานะ: **Phase 6A server enforcement closed; Phase 6B presentation projection closed**

Stock now owns the immutable `StockPresentationCapabilities` contract and
resolves it through the same Stock adapter and compatibility translation used
by Phase 6A. The projection is batched with one `authorization.resolveMany()`
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
`LIFF_SELF_SERVICE`. LIFF USER keeps requester compatibility; LIFF ADMIN
intentionally remains processor-compatible, and an explicit USER process grant
is honored. The Routine LIFF ADMIN self-service clamp is not applied to Stock.
Read ALL never implies process or cancel ALL. Any remaining Stock role check is
descriptive only (for example, a role badge); it does not select a tab, query
scope, expose a control or authorize a mutation.

Stock server enforcement remains authoritative. Leave, Employee, Audit, Email
Request, Settings and other non-Routine/non-Stock presentation and
authorization paths remain on their existing compatibility behavior until
their approved migration phases. Routine behavior is unchanged by Phase 6B.
