# NHF Employee modular monolith

Status: Phase I1 CLOSED — Audit server/application/persistence foundation
complete. Phase I2 NOT STARTED. Phase H3 Notification producer integration and
final migration audit remain complete. Phase G3 Department migration remains
complete.

This document separates the repository's observed current state from the
target architecture. Stock server/business ownership is now migrated into
`modules/stock/`; its Dashboard and client presentation now live in the same
module behind separate server and client public entry points. See
[stock-migration.md](./stock-migration.md) for the migration status and
transitional dependencies.

Routine server/business and Dashboard/LIFF presentation ownership is now also
migrated into `modules/routine/`. See
[routine-migration.md](./routine-migration.md) for its public contracts and
transitional platform dependencies.

Leave server/business, Dashboard, and LIFF presentation ownership is now
migrated into `modules/leave/`; Leave E1/E2/E3 are complete. See
[leave-migration.md](./leave-migration.md) for the ownership boundary, public
server and client APIs, attachment boundary, and compatibility ledger.

Employee server/business and active Dashboard presentation ownership now live
in `modules/employee/`; Employee API routes consume its server interface and
Employee Dashboard routes consume `@/modules/employee/client`. Employee
compatibility cleanup and the final dependency re-audit are complete. See
[employee-migration.md](./employee-migration.md) for the F0 discovery record
and F1-F3 implementation ledger.

Phase G0 Organization/Department discovery remains preserved as a historical
record in [organization-department-migration.md](./organization-department-migration.md).
The post-G0 product decision is authoritative: NHF Employee is permanently a
single-NHF-organization system, with no Organization domain or tenant
architecture. Phases G1-G3 give the NHF-wide Department reference-data
capability a stable server/application/persistence owner in
`modules/department/`; Employee still owns its required Department association
and Employee-specific mapping and presentation behavior.

Phase H1 established the server/application Notification boundary in
`modules/notification/`, H2 owns its active Dashboard presentation in
`modules/notification/presentation/dashboard/**` behind
`@/modules/notification/client`. It is the in-app Notification/Inbox owner; it
does not absorb business notification semantics, the global
`NotificationOutbox`, or Email/LINE delivery infrastructure. Leave, Stock, and
Routine retain event and recipient policy, while Email Request remains a
transitional/deferred consumer pending the future IT capability boundary. The
Notification page/loading routes use the client entry, while
`DashboardNavbar` remains Dashboard-owned and mounts the dropdown through it.
See [notification-migration.md](./notification-migration.md) for the complete
discovery record and migration ledger.

## Why a modular monolith

NHF Employee is gaining business capabilities while remaining one product. A
modular monolith gives each capability a clear ownership boundary while
keeping deployment and operations simple. It makes incremental feature
migration possible without requiring a distributed-system boundary before the
business boundaries are stable.

## Why not microservices

The target remains one Next.js application, one deployment/runtime boundary,
and the existing Prisma/database infrastructure. This phase does not introduce
separate repositories, databases, services, queues, brokers, or network calls
between features. A module boundary is a source-code ownership and dependency
boundary, not a process boundary.

## Current architecture

The repository currently has a single Next.js application with responsibilities
distributed across locations such as:

- `app/` for routes, pages, and other Next.js delivery concerns;
- `components/`, `hooks/`, and `types/` for UI and client-facing artifacts;
- `lib/` for shared/platform infrastructure and legacy feature implementation
  for capabilities not yet migrated, plus authentication, notification, and
  upload code;
- `prisma/` for the single schema and its migrations; and
- `__tests__/` for the existing unit, integration, API, and component tests.

`modules/stock/`, `modules/routine/`, `modules/leave/`, and `modules/employee/`
own their server/business and client-facing presentation code behind separate
public entry points. The `modules/department/` server module intentionally owns
only Department application and persistence behavior; G2 confirmed that no
Department client entry or standalone presentation is required.
`modules/employee/` owns Employee server/business behavior and `presentation/**`;
its browser route surface is
`modules/employee/client.ts`. Generic Dashboard shell, navigation, access
checks, and generic feedback remain app/Dashboard-owned.
The Dashboard uses route-per-module App Router pages;
historical
`/dashboard?tab=...` links remain inbound-compatible through the dashboard home
route boundary.

Notification server/application ownership now lives in `modules/notification/`:
the four Notification routes delegate through its public server entry, and the
shared generic in-app helper is a minimal explicit-user compatibility adapter
used only by deferred Email Request. Leave, Stock, and Routine Inbox writes
consume the Notification public entry; physical Notification Prisma
persistence is owned only by `modules/notification/infrastructure/**`.
Dashboard Notification presentation is module-owned behind its browser-safe
client entry; the deleted `components/dashboard/notifications/**` path is not a
supported ownership path. The current global outbox already treats in-app
delivery as one possible
channel, including Routine reminders, while the outbox processor and provider
composition remain shared/platform infrastructure.

Audit Phase I0 discovery remains the historical boundary record. Phase I1 now
owns generic AuditLog persistence, query/pagination, retention, and
serialization in `modules/audit/`, not `shared/audit/`. Its public server
entry is `@/modules/audit`; the generic Audit API routes consume that entry,
while `lib/server/audit.ts` remains a best-effort compatibility adapter.
Producing capabilities retain event meaning, AuditAction, entity semantics,
details/snapshots, actor semantics, and strict versus best-effort transaction
behavior. Auth and Email Request remain later/deferred producer boundaries.
Known business producer and Routine-reader direct-access seams remain
temporary for I3. Audit presentation remains in its pre-I2 locations. See
audit-migration.md for the evidence and I1-I3 plan.

## Target architecture

The intended high-level dependency direction is:

```mermaid
flow LR
    APP[app/**\nNext.js delivery layer]
    MODULES[modules/**\nfeature ownership]
    SHARED[shared/**\ncross-domain platform]

    APP --> MODULES
    APP --> SHARED
    MODULES --> SHARED
    MODULES -.->|public API only| MODULES
```

`app/` owns routing and framework delivery. `modules/` owns business feature
behavior. `shared/` owns only genuinely cross-domain/platform capabilities.
Cross-module use is deliberate and goes through the target module's public
entry point: `modules/<feature>/index.ts` for server/application code or, when
the target feature owns browser presentation, the explicit
`modules/<feature>/client.ts` entry for client presentation. A server-only
module may intentionally have no client entry.

The dependency graph describes new architecture code. It does not claim that
the legacy `lib/`, `components/`, or unrelated route structure has already been
reorganized. Employee F0-F3 is complete; unrelated legacy feature locations
remain outside the scope of this migration.

### Employee/Leave lifecycle direction

The Employee ↔ Leave seam is intentionally one-way at runtime. Employee owns
`managerId` and exposes the hierarchy mutation contract used by Leave's
approver-assignment transaction. Employee lifecycle code exposes only the
structural `EmployeeOffboardingDependencyProvider` port; the Employee API
composition boundary imports the public Employee and Leave APIs and binds
`getEmployeeLeaveOffboardingBlockers` to that port. The provider receives the
same `Prisma.TransactionClient` as the Employee serializable lifecycle
transaction. Employee must not import Leave directly or through a facade.

### Department server/persistence direction

Department is an independent NHF-wide reference-data capability. Its supported
server entry is `@/modules/department`, which exposes `listDepartments()` for
`app/api/departments/route.ts` and the narrow `listDepartmentReferences()` query
for Employee import. Department application code is framework-independent and
its infrastructure owns the production `prisma.department` reads.

The `/api/departments` URL remains app delivery: it owns authentication,
response composition, and sanitized failures. Employee consumes Department only
through the public server entry; no Department code depends on Employee, and no
other module is coupled to Department speculatively. There is no Department
client presentation, CRUD, lifecycle, hierarchy, or Department-head behavior
in the final G3 architecture.

### Department presentation boundary (G2)

The G2 audit found no Department-owned page, editor, selector, browser state,
client validation, or client business logic. Employee owns its Department
selectors, `departmentId` form state, import mapping, and Employee-specific
display formatting. Auth/Dashboard, Leave, and Routine retain their existing
projection or transport behavior; Stock has no speculative Department
dependency; Email Request remains free text.

Browser Department lookup therefore remains an app-delivered HTTP contract:

```text
Employee client -> GET /api/departments -> app route -> @/modules/department
```

`@/modules/department` is server-only. The architecture checker rejects direct
and transitive runtime imports from production Client Component graphs while
allowing the app route and Employee server/application consumers. No
`modules/department/client.ts` exists because no evidence-backed client
contract requires one.

### Department migration closure (G3)

Department migration G0-G3 is complete. The Department module is intentionally
server-only, its supported functions are `listDepartments()` and
`listDepartmentReferences()`, and its production Prisma ownership remains in
Department infrastructure. The authenticated `/api/departments` route and
Employee import seam preserve their existing contracts; Employee browser code
continues to use HTTP. No obsolete Department runtime artifact remained, so no
runtime cleanup was required.

### Notification boundary and presentation ownership (H0/H1/H2/H3)

The Notification capability is deliberately narrower than the word
"notification" in the repository. It owns durable per-user in-app Inbox
entries, latest/history/unread queries, mark-read commands, strict and
idempotent explicit-user creates, strict explicit-user batch create, the
business-driven unread reference transition, and its server/application
contract. H2 owns
Notification-specific Dashboard presentation under
`modules/notification/presentation/dashboard/**` and exposes only the active
composition contract through `modules/notification/client.ts`. A business module
supplies the explicit
recipient and owns the event's meaning, semantic
type, title/message, action URL, reference ID, channel choice, and
event-specific dedupe/supersede behavior.

`NotificationOutbox` remains global reliable asynchronous delivery
infrastructure. Its processor owns claiming, retry/backoff, stale
`PROCESSING` recovery, dead-lettering, superseding, scheduling/wakeup, and
dispatch composition for Email, LINE, and in-app delivery. Business modules
may enqueue rows in their own transactions but must not import the processor.
For business-owned outbox events, the processor routes through the producing
business module's public dispatch contract. That module revalidates domain
state, resolves recipients and notification semantics, makes stale/defer/
supersede decisions, and may then invoke Notification's public command for the
in-app write. The business dispatch contract owns any transaction-bound
persistence context; the global processor does not pass a transaction client
directly to Notification. A direct processor-to-Notification dispatch is
reserved for a future truly Notification-owned generic event with a fully
resolved command payload, not current business-owned events.

Dashboard navbar/page/menu composition remains app/Dashboard-owned. Email
Request is documented as a transitional/deferred consumer and legacy IT enum
values remain storage-compatible history only. H1 server/application, H2
presentation, and H3 producer integration/compatibility cleanup are complete.
The timestamp-only history cursor risk remains unresolved.

## Ownership principle

Code belongs with the business capability whose rules determine its behavior.
If a change is required because Routine, Leave, Stock, or another feature's
business rules changed, that code is feature-owned even when several screens
use it. Shared placement is justified by stable platform responsibility, not
by reuse alone.

## Incremental migration strategy

Future migrations should be vertical and behavior-preserving:

1. Identify one feature's current routes, UI, services, validations, tests,
   and persistence dependencies.
2. Define the feature's public contract and choose a proportional module
   shape.
3. Move or wrap one coherent slice at a time, keeping existing URLs, API
   contracts, permissions, database behavior, and integrations unchanged.
4. Update delivery code to consume the module public API.
5. Verify the feature before removing the now-obsolete legacy path.

Legacy and migrated modules may coexist during this process. Migration is
explicit and feature-by-feature; Stock was the Phase B pilot, Routine is the
Phase D migration, Leave E1/E2/E3 is complete, and Employee F0-F3 now owns
the Employee server/business and active presentation boundaries.

## Invariants for this phase

The following remain outside the scope of the G1 ownership migration:

- business behavior, API contracts, visual UI behavior, and navigation wording;
- API URLs and historical dashboard query-tab URLs remain behavior-preserving
  compatibility constraints; canonical Dashboard page paths are now explicit;
- authentication, authorization, permissions, and LIFF behavior;
- organization/tenant architecture; NHF remains permanently single-organization;
- the Prisma schema, migrations, and database layout; and
- cron, notifications, email, LINE, uploads, and Employee runtime behavior;
  Leave runtime behavior remains unchanged by its ownership migration. Stock
  and Routine runtime behavior remain unchanged by their ownership migrations.

The lifecycle correction does not change the Employee/Leave policy or API
behavior: Leave still owns responsibility blockers and Employee still performs
the paired Employee/User transition atomically.

Detailed boundary and import rules are in
[module-boundaries.md](./module-boundaries.md) and
[dependency-rules.md](./dependency-rules.md).
