# Phase 5A — Routine presentation capability projection

Status: Phase 5A foundation

This record defines the server-derived presentation contract added for the
Routine authorization migration. It extends the Phase 4 Routine pilot; it
does not replace the locked authorization source-of-truth or migrate Routine
screens and navigation.

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
Routine projection. It resolves each of the nine migrated capabilities through
`resolveRoutineCapabilityForMigration()` in
`modules/routine/application/authorization.ts`. Dashboard and LIFF code do
not call the generic authorization resolver directly and do not reproduce the
Phase 4 compatibility table.

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

## Presentation is not enforcement

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
Their existing role-based presentation behavior is intentionally not rewritten
in Phase 5A.

Stock, Leave, Employee, Audit, Email Request, Settings, and other non-Routine
presentation and authorization paths remain on their existing compatibility
behavior until their approved migration phases, including Phase 6 where
applicable. Dashboard presentation migration is deferred to Phase 5B and LIFF
presentation migration to Phase 5C.
