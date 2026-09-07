# Module boundaries

Status: Phase I2 CLOSED — Audit presentation ownership complete. Phase I3 NOT
STARTED. Phase H3 Notification producer integration and
final migration audit remain complete. Phase G3 Department migration remains
complete.
Stock, Routine, Leave, and Employee are migrated examples; Employee
server/business and active presentation ownership are migrated as well.

## What is a module

A module is the code ownership boundary for one business capability. It should
contain the rules, use cases, technical adapters, and feature-facing artifacts
that change together. A module is not merely a page, route folder, database
table, or collection of convenient helpers.

The test is ownership, not reuse:

> If the code changes because a business feature changes, keep it in that
> feature's module.

## Public module API

Each module should expose a deliberate server/application contract from its
root entry point:

```text
modules/<feature>/index.ts
```

Consumers use the public entry point:

```ts
import { something } from "@/modules/stock";
```

When a module owns client-facing presentation, that presentation may use the
separate client-safe entry point:

```text
modules/<feature>/client.ts
```

```ts
import { StockSection } from "@/modules/stock/client";
```

Routine follows the same split: server/application consumers use
`@/modules/routine`, while Dashboard and LIFF consumers use
`@/modules/routine/client`.

Leave server/application consumers use `@/modules/leave`. Leave Dashboard and
LIFF route composition use the explicit client-safe entry point
`@/modules/leave/client`; migrated module presentation internals use local
relative contracts.

Employee server/application consumers use `@/modules/employee`. Employee
Dashboard route composition uses `@/modules/employee/client`, whose route-facing
presentation exports are `EmployeeManagementSection`,
`EmployeeManagementSectionSkeleton`, `AddEmployeeSection`, and
`ImportEmployeeRouteContent`. The same client entry exposes the proven pure
`getEmployeeDisplayName` formatter required by Leave, Routine, and audit
presentation. The active feature presentation, provider/context, forms, local
types/formatters, and CSV browser flow live under
`modules/employee/presentation/**`; internals use relative/local contracts.
Server schema exports remain in `modules/employee/index.ts` for Employee API
routes; `modules/employee/client.ts` does not expose server schemas. The
former `lib/validations/employee.ts` compatibility facade was removed after
its production consumers were audited.

Generic User/Employee display fallback projection is owned by the browser-safe
structural helper `shared/identity/display.ts` and is consumed through
`getUserDisplayName`; it does not depend on the Employee module. Employee
status values and presentation formatting are owned by Employee domain and
presentation-local contracts. Employee CSV parsing is owned by
`modules/employee/presentation/import/csv.ts`, while Leave report labels and
row mapping are owned by Leave report infrastructure.

Department server/application consumers use `@/modules/department`. Its root
entry exposes `listDepartments()` for the app Department route and the narrow
`listDepartmentReferences()` query for Employee import. Department owns its
server-side application and Prisma persistence; G2 confirms that it is
intentionally server-only and has no `client.ts` or Department-owned
presentation.

## Notification boundary (H0/H1/H2/H3)

The `modules/notification/` module now owns the user-facing in-app
Notification/Inbox capability. It owns the `Notification` repository and
persistence boundary, strict and idempotent explicit-user create mechanics,
strict explicit-user batch create, business-driven unread reference
transitions, dedupe handling, latest/history/unread queries,
mark-one/mark-all-read commands, and the public server/application contract.
Notification-specific Dashboard
presentation is now owned under
`modules/notification/presentation/dashboard/**` and is exposed only through
the browser-safe `@/modules/notification/client` entry.

The module must receive explicit recipients and semantic payloads. Leave,
Stock, Routine, and the deferred Email Request/IT capability retain ownership
of the triggering event, recipient policy, notification type, title/message,
action URL, reference ID, channel choice, and event-specific dedupe or
supersede semantics. Notification must not grow audience APIs such as “notify
all Stock admins” or become a workflow owner for another module. Leave, Stock,
and Routine use only `@/modules/notification` for Inbox persistence; physical
Prisma `Notification` delegate operations are owned exclusively by
`modules/notification/infrastructure/**` in production. Stock's active/
non-deleted admin policy and separate requester-cancellation `role = ADMIN`
policy remain Stock-owned and intentionally distinct. The legacy generic
adapter remains solely for deferred Email Request.

`NotificationOutbox` is a separate shared/platform boundary. The global
outbox owns reliable asynchronous delivery, event claim and status lifecycle,
retry/backoff/dead-letter/stale recovery, scheduling/wakeup, and provider
dispatch composition. Business modules may enqueue outbox rows transactionally
but must not import the global Outbox Processor. For business-owned outbox
events, the global processor calls the producing business module's supported
public dispatch contract. That module revalidates domain state, resolves
recipients and semantics, makes stale/defer/supersede decisions, and invokes
Notification's public command when an in-app entry is needed. The business
dispatch contract owns any transaction context; the global processor does not
pass a transaction client directly to Notification. A direct
processor-to-Notification dispatch is reserved for a future generic
Notification-owned event with a fully resolved command payload, not current
Leave, Stock, Routine, or deferred Email Request events.

The four existing `app/api/notifications/**` routes remain app HTTP delivery
composition and now delegate their query/read behavior through
`@/modules/notification`. The notification page and loading route consume
`@/modules/notification/client`; `DashboardNavbar` remains generic Dashboard
shell ownership and mounts `NotificationDropdown` through that entry. The
obsolete `components/dashboard/notifications/**` path is deleted, while the
generic Dashboard navbar, route/page composition, menu constants, and session/auth
infrastructure remain outside the module. The complete H0 evidence and ledger
are in [notification-migration.md](./notification-migration.md).

Employee and Leave have one deliberate server dependency direction. Leave may
consume the public Employee hierarchy contract to mutate the Employee-owned
`managerId` inside Leave's transaction. Employee lifecycle code must not import
`@/modules/leave` or any Leave internal. Instead, Employee defines the narrow
structural `EmployeeOffboardingDependencyProvider` port; the outer application
composition binds Leave's blocker implementation to that port. The provider
must receive and use the same `Prisma.TransactionClient` as the Employee
serializable lifecycle operation.

The root barrel remains server/application-oriented. Where a client entry
exists, it must export only client-safe presentation contracts; a server-only
module intentionally has no client entry. Notification's client graph remains
HTTP-based through `API_ROUTES.notifications.*` and may not reach Prisma,
server-only Next.js modules, Email/LINE infrastructure, the Outbox Processor,
or Notification application/infrastructure code.

The Employee client entry is browser-safe: its runtime graph contains no
Prisma runtime, database/session/secret implementation, server-only Next.js
modules, or Employee application/infrastructure code. Employee browser API
traffic continues through `/api/employees/**` and `/api/departments`; the
architecture checker walks this graph and guards the route/client boundary.

Files below the module root are internal implementation. Consumers must not
turn paths such as the following into an accidental public API:

```ts
import { something } from "@/modules/stock/application/internal/foo";
```

The public entries should export only contracts that another layer or module
is intended to rely on. Avoid exporting an entire internal tree through broad
barrel files; small explicit entry points are easier to evolve and keep
dependency direction visible. Only the module root and, when present, its
`client.ts` entry are public; arbitrary subpaths remain private.

## Audit boundary (I1/I2)

Phase I0 remains the historical discovery and boundary-definition record. The
current owner is the first-class `modules/audit/` capability module, not
`shared/audit/`. I1 establishes its server/application and generic persistence
boundary, and I2 now owns its Dashboard presentation. I3 producer migration
remains unstarted. The
decision follows the ownership principle: Audit has a cohesive persistence,
generic query/pagination, retention, and serialization capability, while the
events it records remain owned by their producing capabilities.

Audit infrastructure owns generic AuditLog persistence, append
mechanics, parsing/serialization, generic reads, pagination, retention, and
Audit-specific presentation. Auth, Employee, Leave, Stock, Routine, and the
deferred IT capability continue to own event meaning, AuditAction,
entity meaning/identifiers, snapshots, event metadata, actor semantics, and
the decision and failure policy for each write. Transaction-bound writes must
keep the same business transaction; current best-effort and after-response
writes must not be normalized. Leave's CUID-in-details fallback and all
historical enum/storage values remain compatibility constraints.

The supported server entry is `@/modules/audit`. It exposes generic
`appendAuditInTransaction`, `appendAuditBestEffort`, `getAuditLogs`, and
retention cleanup capabilities plus neutral contracts. Physical AuditLog
access is owned by
`modules/audit/infrastructure/persistence/audit-log-repository.ts`.
`lib/server/audit.ts` and the legacy query/retention paths are compatibility
adapters and no longer own physical persistence. The known business
direct-write and Routine nested-reader seams remain temporarily allowlisted;
I3 will migrate producers and close final physical AuditLog exclusivity. The
browser-safe `@/modules/audit/client` entry exposes the Audit Dashboard section
and loading skeleton; its implementation is under
`modules/audit/presentation/dashboard/**`. The routes retain App Router
composition and use only that client entry for Audit presentation. See
audit-migration.md for the exact allowlist and operation counts.

The full producer, reader, retention, presentation, action, identity,
transaction, metadata, compatibility, and phased I1-I3 ledger is in
audit-migration.md. The source record explicitly keeps Email Request
deferred; I1 implementation and I2 presentation ownership are complete while
I3 producer migration remains unstarted.

## Larger feature shape

A feature with substantial domain rules, workflows, persistence, or external
integrations may evolve toward:

```text
modules/<feature>/
├── domain/
├── application/
├── infrastructure/
├── presentation/
└── index.ts
```

The layers have these responsibilities:

- `domain/`: pure business concepts, policies, invariants, domain errors, and
  calculations. Avoid framework and database dependencies where reasonably
  possible.
- `application/`: cohesive use cases and orchestration such as
  `create-item`, `approve-request`, `generate-routine`, or `complete-task`.
  Prefer use-case cohesion over increasingly large generic buckets such as
  `queries.ts`, `mutations.ts`, `utils.ts`, or `helpers.ts`.
- `infrastructure/`: technical adapters such as Prisma repositories,
  external-service clients, storage integration, and workbook/file
  implementations.
- `presentation/`: feature-facing schemas, components, hooks, API adapters,
  and other artifacts that translate to or from delivery concerns.
- `index.ts`: the supported public module API.

These folders are guidance, not a requirement to add ceremony before the
feature needs it.

## Smaller feature shape

A small feature should remain small:

```text
modules/<feature>/
├── server/
├── components/
├── schemas.ts
└── index.ts
```

Do not create domain, application, infrastructure, and presentation layers
with no distinct responsibility. Complexity should be added when the feature
has a real boundary or use case that benefits from it.

## Cross-module communication

When module A needs module B, module A may consume only B's documented public
API. Prefer a narrow command, query, type, or result contract over reaching
into B's repository, database model, UI component, or internal helper.

```text
module A -> module B/index.ts or module B/client.ts -> module B internals
```

The target module owns the meaning and compatibility of its public contract.
If two modules appear to share a business rule, first determine which module
owns that rule. Move it to `shared/` only when it is truly cross-domain and
platform-level; reuse alone is not enough.

## Organization / Department boundary (G1)

Phase G0 remains preserved as a historical discovery record in
[organization-department-migration.md](./organization-department-migration.md).
The current product invariant is permanent single-NHF organization: there is
no Organization domain or tenant architecture. Department is an independent
NHF-wide reference-data capability in `modules/department/`.

Employee owns `Employee.departmentId`, its association semantics, current import
mapping, and Employee-facing projections. Department owns Department identity,
reference queries, and Department Prisma persistence. Employee consumes the
Department server contract only through `@/modules/department`; Department does
not depend on Employee. `Employee.affiliation` remains free text, and
`Employee.managerId` remains Employee-owned hierarchy rather than a Department
head.

The current `/api/departments` URL remains app delivery. It authenticates,
delegates to `listDepartments()`, and preserves the existing response/order/error
contract. Employee owns the selector, `departmentId` form state, import mapping,
and Employee-specific Department display behavior. Department has no CRUD,
lifecycle, hierarchy, head, or client-owned presentation behavior in the final
G3 architecture.
The G3 final audit confirmed that this remains the final boundary; no obsolete
Department compatibility artifact or runtime deletion was identified.

The browser contract is intentionally HTTP-based:

```text
Employee client -> GET /api/departments -> app route -> @/modules/department
```

Client-reachable runtime code must not import `@/modules/department` directly
or transitively. The architecture checker enforces this server-only boundary;
it permits the app route and Employee application server consumers. Auth and
Dashboard keep Department as an Employee/session display projection, Leave
keeps Employee projections, Routine carries an opaque Employee `departmentId`,
Stock has no Department dependency, and Email Request keeps free-text
`department`/`สังกัด`.

Department migration G0-G3 is complete. Department remains a server-only
reference-data owner with the minimal public server API
`listDepartments()`/`listDepartmentReferences()`; Employee owns association,
import, selector, and display compatibility behavior.

## Shared/platform ownership

Appropriate future `shared/` responsibilities may include authentication and
session infrastructure, database adapters, HTTP/security primitives, trusted
network/request metadata primitives, notification or LINE delivery, uploads,
and generic UI primitives. Phase I1 resolves the cohesive Audit capability's
physical persistence and generic query/retention owner as `modules/audit/`,
not `shared/audit/`; existing lib/ Audit code remains only as compatibility
adapters while producer and presentation migrations proceed.

Feature-specific validation, policies, calculations, status semantics,
workflow orchestration, and feature UI remain feature-owned. For example, code
whose behavior changes with Routine rules belongs to Routine, even if multiple
Routine screens use it.

## Correct and incorrect placement

| Concern | Preferred owner | Avoid |
| --- | --- | --- |
| Approving a leave request | Leave application/domain | A generic global service or shared helper |
| Stock inventory invariant | Stock domain/application | `shared/` because two Stock screens use it |
| Prisma client adapter | Shared/platform infrastructure or a feature infrastructure layer | Direct Prisma handling in a new client component |
| Generic request parsing/security primitive | `shared/http` or `shared/security` | Copying it into every feature |
| Routine-specific schema | Routine module | `lib/validations/` for new Routine code |
| Feature-to-feature call | Target module public API | Importing the target's internal file |

## Legacy coexistence

The current `app/`, `components/`, `hooks/`, `lib/`, and `lib/validations/`
structure remains operational for features that have not migrated. Existing
imports are not rewritten merely to make the target diagram look complete. A
migration must preserve behavior unless a separate change explicitly requests
a behavior change.

Leave is a completed incremental migration: `modules/leave/` owns server,
Dashboard presentation, and LIFF presentation behavior. No Leave compatibility
facades remain. The architecture checker rejects deleted Leave ownership paths,
requires API routes to use `@/modules/leave`, requires Dashboard/LIFF routes to
use `@/modules/leave/client`, and walks production Client Component graphs so a
generic helper cannot transitively import the Leave server entry.

Employee F0-F3 is complete. Employee API routes use the module root, Auth
signup uses its transaction-aware Employee lookup/recheck interface, and Leave
uses its hierarchy mutation interface. Employee lifecycle composition binds the
Leave offboarding blocker provider at the route boundary; there is no Employee
→ Leave runtime dependency. Generic Dashboard shell/context/navigation remain
outside Employee. The former legacy Employee validation facade, mixed Employee
helpers/types, duplicate CSV helper, and confirmed orphan presentation files
were removed after production-consumer audits.

G1 added Department server ownership without changing the Employee
presentation boundary or the other module projections. G2 re-audited the
presentation boundary and confirmed that no Department client entry is needed.
Department internals remain private; the Department root is the only supported
server entry.
