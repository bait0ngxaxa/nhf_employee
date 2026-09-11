# Phase 4 — Routine authorization pilot

Status: implemented as a server-side migration slice. This document records
the Routine-specific composition around the Phase 3 authorization boundary;
the Phase 0–3 contracts remain authoritative:

- [Authorization current state](./authorization-current-state.md)
- [Authorization contract](./authorization-contract.md)
- [Authorization persistence](./authorization-persistence.md)
- [Authorization resolver](./authorization-resolver.md)
- [Routine migration inventory](./routine-migration.md)
- [Module boundaries](./module-boundaries.md)

## Migrated capabilities

The following capabilities now pass through the public
`@/modules/authorization` resolver:

- `routine.task.read`
- `routine.task.create`
- `routine.task.update`
- `routine.task.delete`
- `routine.occurrence.read`
- `routine.occurrence.override`
- `routine.occurrence.reassign`
- `routine.occurrence.change_due_date`
- `routine.import.manage`

`routine.summary.read`, `routine.task.export`, and `routine.reference.read`
remain deferred because their Phase 0 behavior has unresolved policy questions.
The exporter explicitly opts into the deferred work-item path so this pilot
does not silently change broad USER export behavior.

## Server call chains

Dashboard task list/detail and task mutations use the following composition:

```text
requireActiveWorkforceOrAdminSession
  -> server-derived RoutineCommandActor
  -> active User/Employee validation in the mutation transaction
  -> authorization.resolve / authorization.resolveInTransaction
  -> Routine scope translation and resource query
  -> Routine workflow, validation, and concurrency rules
  -> persistence
```

The Dashboard task routes are `app/api/routines/tasks` and the task view of
`app/api/routines/occurrences`. Dashboard occurrence list/detail routes and the
three occurrence mutation routes use the corresponding occurrence capabilities.
The import routes for preview, reference, batch, rows, apply, and cancel all
use `routine.import.manage` at their Routine application boundary. Legacy
Admin-guarded occurrence-admin and import routes also perform a Routine
capability preflight after the existing session/workforce gate and before
their existing rate-limit/input parsing sequence, preserving the old
authenticated-but-unauthorized 403 boundary. Mutations repeat the decision
inside the transaction.

LIFF task routes retain `requireLiffWorkforceSession`, set the actor mode on the
server, and use the same Routine task capability path. No LIFF occurrence
administrative capability was added; the registry continues to make those
capabilities Dashboard-only.

## AuthorizationActor mapping

Routine maps the server-authenticated actor as follows:

| Source | AuthorizationActor field |
|---|---|
| authenticated `User.id` | `userId` |
| active linked Employee identity | `employeeId` |
| database/session `User.role` | `systemRole` |
| Dashboard route | `channel: "DASHBOARD"` |
| LIFF Routine route | `channel: "LIFF_SELF_SERVICE"` |

The actor role, employee identity, scopes, grant source, and Team values are not
accepted from request payloads. The transaction path re-reads and locks the
User row, derives the role from that row, and validates the active Employee
before resolving the capability.

## Routine scope translation

Routine translates the generic resolver result into resource predicates:

- `OWN` is used for normal task creation; the creator/owner remains derived
  from the authenticated actor and the submitted assignee list is normalized.
- `CREATED` becomes `RoutineTask.createdById = actor.userId`.
- `ASSIGNED` for tasks becomes the current task-assignee relationship and may
  require the existing active Employee relationship. It is not creator access.
- `ASSIGNED` for occurrences becomes the occurrence-assignee relationship;
  it is intentionally separate from task assignment.
- `ALL` omits ownership predicates only. It does not bypass active target
  validation, workflow/state checks, input normalization, locks, version checks,
  reminder invariants, or audit behavior.
- Multiple task scopes are composed as an OR. An empty effective scope is
  fail-closed with an impossible predicate.

The `canEdit` and `canDelete` fields are still response projections. They are
computed from the resolved update/delete scopes where the migrated query has
those decisions, and are not used as server authorization.

## Transaction-time authorization

`modules/authorization` exposes the narrow public
`authorization.resolveInTransaction(actor, capability, persistenceContext)`
composition seam. It reuses the same registry, evaluator, validation, and
grant semantics as `authorization.resolve`, while the persistence repository
reads through the supplied Prisma transaction context.

Routine calls that seam after its existing active User/Employee checks and
before resource mutation. Existing User/Employee locks, resource lookup locks,
version claims, idempotency handling, active assignee checks, due-date rules,
reminder behavior, and audit writes remain inside their transactions.
The generic resolver's default-deny behavior is unchanged.

## Migration compatibility bridge

Phase 2 has no approved production Team/membership/grant mapping. A Routine-
owned adapter therefore preserves only the characterized no-grant baseline
when all of these conditions hold:

1. the central decision is denied specifically with `NO_APPLICABLE_GRANT`;
2. the actor is a normal `USER`; and
3. the capability is one of the migrated Routine capabilities with a recorded
   legacy behavior.

The bridge preserves these exact Routine floors:

| Capability/path | Compatibility scopes |
|---|---|
| task management/detail read | `CREATED + ASSIGNED` |
| task work-item read with `scope=mine` | `ASSIGNED` |
| task work-item read with `scope=all` | `ALL`, preserving the frozen broad behavior |
| task create | `OWN` |
| task update | `CREATED + ASSIGNED` |
| task delete | `CREATED` |
| occurrence read | `ASSIGNED` |
| occurrence administration | no compatibility access |
| import management | no compatibility access |

The bridge is not a second resolver or a permanent role policy. It never
handles `UNKNOWN_CAPABILITY`, `CHANNEL_NOT_SUPPORTED`, or resolver/persistence
configuration errors. Configured grants take precedence and their returned
scopes are translated directly by Routine. The bridge is isolated to
`modules/routine/application/authorization.ts` and is removable once an
approved Routine Team/TeamRole/User grant configuration fully replaces the
characterized baseline and the parity tests are retired or rewritten.

## LIFF ADMIN self-service compatibility

The central resolver can return the registered ADMIN `ALL` result for a LIFF
actor because the task capabilities support the LIFF channel. Routine therefore
clamps a LIFF ADMIN result to the existing self-service task semantics after
central resolution:

- create remains actor-owned (`OWN` normalization);
- update remains creator/task-assignee constrained with self-service field
  restrictions;
- delete remains creator-only; and
- reads retain the existing LIFF creator/task-assignee/occurrence-assignee
  relationship behavior and source metadata redaction.

The resulting context is not marked administrative. The channel is server-set
by the LIFF route and cannot be selected by the client.

## Remaining legacy role checks

`isRoutineAdminActor` remains only for intentionally deferred or presentation
behavior:

- `getRoutineSummary` retains its frozen summary scope behavior;
- `getRoutineReferenceData` retains its Dashboard-vs-user employee reference
  projection; and
- the deferred export path retains its frozen work-item query/projection.

These callers do not decide any of the nine migrated capability outcomes. The
Dashboard `RoutineSection` `isAdminRole` value and the `isAdmin` presentation
props are also unchanged UI contracts; Phase 5 owns their broader integration.
Other Routine role checks in recipient/scheduler/reminder code describe
notification composition or background behavior, not a migrated request
capability, and were not changed in this phase.

## Query and mutation enforcement

Task management/detail, occurrence list/detail, and the migrated work-item
query apply the effective ownership predicate to Prisma `where` input before
rows are loaded. Task assignment and occurrence assignment use distinct
relationships. Delete uses only `CREATED` for the compatibility floor; an
assignee-only USER cannot delete a task merely because update permits
`ASSIGNED`.

Task creation, update, deletion, occurrence override/reassignment/due-date
changes, and every import staging/apply mutation resolve the capability in the
same transaction as their existing business checks. Import apply passes its
`routine.import.manage` authorization context to internal task creation rather
than reusing `routine.task.create`, so import authorization and task creation
business rules remain separate.

## Deliberate non-goals

This pilot does not change navigation, buttons, tabs, Dashboard/LIFF global
capability projections, Team administration, authorization schema, resource
`teamId` columns, Department mappings, or any Stock, Leave, Employee, Audit,
Email, or Notifications authorization path. Phase 5 UI integration has not
started.
