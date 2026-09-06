# Feature modules

`modules/` is the ownership boundary for business capabilities in the NHF
Employee application.

Stock, Routine, Leave, Employee, and Department are migrated feature modules.
Employee F0-F3 owns its server/business behavior and active presentation in
`modules/employee/`. Employee Dashboard routes consume the minimal
browser-safe `@/modules/employee/client` entry, which also exposes the proven
pure Employee display formatter required by Leave, Routine, and audit
presentation. Generic Dashboard shell/context/navigation and route access
remain outside Employee. Other legacy locations remain valid until their
feature is deliberately migrated; Employee compatibility cleanup is complete.

Rules for new work:

- Put a substantial new business feature under `modules/<feature>/`.
- Expose the supported external contract from `modules/<feature>/index.ts`.
- Treat everything below a module's public entry point as internal
  implementation.
- A module may depend on `shared/` and may consume another module only through
  that module's public entry point.
- Keep the structure proportional to the feature. See
  [module boundaries](../docs/architecture/module-boundaries.md) for the
  larger and smaller module shapes.

The intended dependency direction is documented in
[dependency rules](../docs/architecture/dependency-rules.md). Run
`npm run architecture:check` when changing code under this directory.

Employee/Leave lifecycle composition is intentionally one-way: Leave may use
the public Employee hierarchy contract for the Employee-owned `managerId`
write, while Employee lifecycle code depends only on its structural
`EmployeeOffboardingDependencyProvider` port. The outer application boundary
binds Leave's blocker implementation and passes the same transaction client
used by the Employee serializable lifecycle operation. Employee must not
runtime-import `@/modules/leave` or Leave internals.

The Employee presentation keeps using the existing `/api/employees/**` and
`/api/departments` browser endpoints. Its CSV upload/preview/result flow uses
the module-owned client-safe parser and does not depend on the deleted mixed
Prisma/Leave `lib/helpers/csv-helpers.ts` implementation. Employee
presentation internals use local contracts and must not import either Employee
public barrel. Generic User/Employee fallback display is owned by the neutral
structural helper in `shared/identity/display.ts`, and Leave report labels are
owned by Leave report infrastructure.

Phase F3 CLOSED — Employee migration complete.
F0-F3 Employee modular-monolith migration is complete. This does not claim
that other application features are fully migrated.

Phase G0 Organization/Department discovery remains available as a historical
record. The post-G0 product decision is permanent single-NHF organization:
there is no Organization domain or tenant architecture. Department is an
NHF-wide reference-data capability owned by `modules/department/`.

`modules/department/index.ts` is the supported server entry. It exposes
`listDepartments()` for `app/api/departments/route.ts` and
`listDepartmentReferences()` for Employee import. Department infrastructure
owns production Department Prisma reads. Employee still owns its
`departmentId` association, CSV aliases/mapping, import policy, and Employee
creation; it consumes Department only through `@/modules/department`.

Department is intentionally server-only: it has no `client.ts`, standalone
presentation, CRUD, lifecycle, hierarchy, or Department-head behavior in the
final G3 architecture.
Employee owns its Department selectors, `departmentId` form state, import
mapping, and Employee-specific display formatting. Browser lookup remains
`GET /api/departments`, and the architecture checker rejects direct or
transitive client-reachable imports of `@/modules/department`; server consumers
use the root entry. No obsolete production Department compatibility artifact
remained, so no runtime deletion was necessary in G3. See the final migration
ledger in
[organization-department-migration.md](../docs/architecture/organization-department-migration.md)
for the historical G0 record and final G1-G3 implementation ledger.

Phase H1 Notification server/application ownership is complete.
`modules/notification/` owns the user-facing in-app Notification/Inbox
persistence, queries, read commands, generic create-to-explicit-user mechanics,
and Notification dedupe behavior. Its `index.ts` is the only supported server
entry. The four `app/api/notifications/**` routes remain HTTP/auth adapters and
delegate through that entry; their full Prisma-serialized row responses and
current timestamp-cursor behavior remain compatible. H1 is server-only: no
`client.ts` or presentation migration exists yet.

`createInAppNotificationOnce` is now a thin compatibility adapter over the
Notification public create command. `createAdminInAppNotificationsOnce` remains
transitional and keeps its active-admin audience lookup outside Notification.
Leave, Stock, Routine, and the deferred Email Request/IT capability continue to
own event meaning, recipients, titles/messages, action/reference values,
channel choices, and event-specific dedupe or supersede rules. Their direct
Notification producer writes remain intentionally deferred to H3.

`NotificationOutbox` is not part of the Notification module. The shared
platform outbox owns reliable asynchronous delivery, claim/retry/dead-letter/
supersede lifecycle, scheduling/wakeup, and provider dispatch composition.
Business modules may enqueue outbox rows transactionally but must not import
the global processor. For business-owned outbox events, the global processor
routes through the producing business module's public dispatch contract. That
module owns domain validation, recipient/semantic resolution, and
stale/defer/supersede decisions before invoking Notification's public command
for an in-app write. The business dispatch contract owns any transaction-bound
persistence context; the global processor does not pass a transaction client
directly to Notification. A direct processor-to-Notification dispatch is
reserved for a future truly Notification-owned generic event with a fully
resolved command payload; no current production event uses that shape.
Email Request remains explicitly deferred until the future IT capability
boundary is ready. See
[notification-migration.md](../docs/architecture/notification-migration.md)
for the H0 evidence, exhaustive ledger, invariants, and H1-H3 slices.

Phase H0 CLOSED — Notification discovery and boundary definition complete.
Phase H1 CLOSED — Notification server/application ownership complete.
H2-H3 are not started.
