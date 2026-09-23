# Routine module migration

Status: Phase D module migration completed. H2A.1 permanently retired Routine
Import runtime behavior; the module shape below excludes its former
implementation. Prisma models and DB fields temporarily remain as deployment
compatibility for the previous application process. H2A.2 will contract that
persistence after all previous processes are confirmed retired.

Routine is now owned by `modules/routine/`. The migration moved the existing
domain, application, validation, HTTP, scheduler, reminder, contract-reminder,
Dashboard, and LIFF implementations. H2A later retired the separate Excel/file
import workflow as a permanent product decision. The H2A.1 schema retains only
the physical compatibility representation; no Routine runtime module consumes
it. See [Routine Import retirement](../routine-import.md) for the H2A.1/H2A.2
rollout stages.

## Ownership and public entry points

The module owns:

- Bangkok calendar-date and schedule calculation, timing, assignee, capability,
  and notification-readiness rules under `domain/`;
- task and occurrence application services, authorization, audit, idempotency,
  generation/reconciliation, recipient resolution, reminders, contract
  reminders, and scheduler under `application/`;
- Routine schemas and server adapters under `schemas/` and `server/`;
- Dashboard and LIFF presentation under `presentation/`; and
- Routine-specific email/LINE payload and message composition under
  `application/notifications/`.

Server/application consumers use the explicit `@/modules/routine` entry point.
It exposes the route-facing task, occurrence, reference, summary, scheduler,
reminder-dispatch, contract-reminder-dispatch, actor, HTTP,
serialization, schema, link, and error contracts required by the current API,
cron, outbox, and compatibility consumers. Internal Prisma selects,
transaction-only helpers, workbook internals, and private recipient helpers
remain unexported.

Client consumers use `@/modules/routine/client`, which intentionally exposes
only the runtime presentation components `RoutineSection`,
`RoutineSectionSkeleton`, and `LiffRoutineApp`, plus the type-only
`RoutinePresentationCapabilities` contract. The type-only export is
client-safe presentation data; it is not a server authorization implementation
and does not resolve capabilities. Dashboard and LIFF internals use relative
imports inside the module; the client entry does not export
server/application implementation.

## Actual module shape

```text
modules/routine/
├── application/
│   ├── audit.ts
│   ├── authorization.ts
│   ├── contract-reminders.ts
│   ├── errors.ts
│   ├── generation.ts
│   ├── idempotency.ts
│   ├── links.ts
│   ├── mutations.ts
│   ├── queries.ts
│   ├── recipients.ts
│   ├── relevant-occurrence.ts
│   ├── reminders.ts
│   ├── scheduler.ts
│   ├── types.ts
│   └── notifications/
│       ├── email.ts
│       ├── notification-types.ts
│       ├── routine-contract-expiry-email.ts
│       ├── routine-contract-expiry-flex.ts
│       ├── routine-reminder-email.ts
│       └── routine-reminder-flex.ts
├── domain/
│   ├── assignees.ts
│   ├── capabilities.ts
│   ├── notification-readiness.ts
│   ├── schedule.ts
│   └── timing.ts
├── presentation/
│   ├── dashboard/
│   │   ├── RoutineAssigneePicker.tsx
│   │   ├── RoutineDetailsDialog.tsx
│   │   ├── RoutineKpiGrid.tsx
│   │   ├── RoutineOccurrenceEditDialog.tsx
│   │   ├── RoutineOccurrenceList.tsx
│   │   ├── RoutineReminderFields.tsx
│   │   ├── RoutineScheduleFields.tsx
│   │   ├── RoutineSection.tsx
│   │   ├── RoutineSkeletons.tsx
│   │   ├── RoutineTaskDialog.tsx
│   │   ├── RoutineTaskForm.tsx
│   │   ├── RoutineTaskList.tsx
│   │   ├── focus-invalid-field.ts
│   │   ├── form-dirty-state.ts
│   │   ├── labels.ts
│   │   └── types.ts
│   └── liff/
│       ├── LiffRoutineApp.tsx
│       ├── LiffRoutineDeleteConfirm.tsx
│       ├── LiffRoutineStatusFilter.tsx
│       ├── LiffRoutineSummary.tsx
│       ├── LiffRoutineTaskCard.tsx
│       ├── LiffRoutineTaskDetail.tsx
│       ├── LiffRoutineTaskForm.tsx
│       ├── LiffRoutineTaskFormSurface.tsx
│       ├── LiffRoutineTaskList.tsx
│       ├── api.ts
│       └── types.ts
├── schemas/
│   ├── liff.ts
│   └── routine.ts
├── server/
│   ├── command-actor.ts
│   ├── http.ts
│   └── liff-serialization.ts
├── client.ts
└── index.ts
```

Tests are colocated with their owned module slices. External API and
integration tests remain under `__tests__/` because they exercise application
route boundaries.

## Scheduler and outbox ownership

The scheduler has one execution boundary and preserves the existing cron
secret, feature flag, response counters, and error semantics:

```text
POST /api/cron/routine-scheduler
    -> @/modules/routine.runRoutineScheduler
        -> Routine generation and reminder enqueueing
            -> database notification outbox

lib/services/outbox/processor.ts
    -> @/modules/routine dispatch contracts
        -> generic in-app / email / LINE providers
```

Routine creates/enqueues notification work and owns its event, recipient,
payload, dedupe, retry, and link semantics. The global Outbox Processor remains
platform infrastructure and owns delivery execution. No file under
`modules/routine/` imports or executes the global processor. The architecture
checker now applies this prohibition to every business module, not only Stock.

## Transitional platform dependencies

Generic Prisma, transaction, auth, request-body, notification delivery, email
transport, LINE transport, and LIFF URL infrastructure remains in its existing
platform locations. `lib/line/rich-menu.ts` remains a mixed LINE platform
provisioning adapter because it owns generic rich-menu API operations alongside
Routine's menu definition; its Routine link construction now consumes the
Routine public API. `scripts/line-routine-rich-menu.ts` and
`scripts/generate-routine-rich-menu.ts` remain CLI compatibility adapters.

The canonical URLs remain `/dashboard/routine`, `/liff/routine`, the existing
Routine web/LIFF API paths, and `/api/cron/routine-scheduler`. No Prisma schema
or migration changes are part of Phase D.
