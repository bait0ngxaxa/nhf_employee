# Phase 5B — Routine presentation capability projection

Status: Phase 5B Dashboard integration

This record defines the server-derived presentation contract added for the
Routine authorization migration. It extends the Phase 4 Routine pilot; it does
not replace the locked authorization source-of-truth or server-side
enforcement. Phase 5A established the projection and Phase 5B integrates it
into the Dashboard navigation, route boundary, Routine tabs, and Routine
actions.

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
verified LIFF workforce session
  -> getRoutinePresentationCapabilities(
       { id, role, email, mode: "LIFF_SELF_SERVICE" },
       employeeId,
     )
  -> LiffCapabilities.routineCapabilities
```

The existing `canCreateOwnRoutine` field remains in the LIFF contract for
compatibility. It is now `routineEnabled && routineCapabilities.canCreateTasks`.
The Routine feature flag therefore still controls availability, while the
capability projection answers the separate authorization question. LIFF ADMIN
uses the same Phase 4 Routine composition and remains clamped to self-service
task semantics; Dashboard-only occurrence administration and import access do
not become available through LIFF.

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
unchanged in Phase 5B; no new capability rule is invented for them.

Stock, Leave, Employee, Audit, Email Request, Settings, and other non-Routine
presentation and authorization paths remain on their existing compatibility
behavior until their approved migration phases, including Phase 6 where
applicable. LIFF presentation migration remains deferred to Phase 5C.
